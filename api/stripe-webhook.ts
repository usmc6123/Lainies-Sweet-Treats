import { dbService, getDb } from "../src/server/db.js";
import { getStripe } from "./_lib/stripe.js";
import { verifyAndConfirmStripePayment, reconcileStripeRefund } from "./stripe.js";
import { Order } from "../src/types.js";

// Disable automatic Vercel body parsing to access raw request bytes
export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(readable: any): Promise<Buffer> {
  const chunks: any[] = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed. Only POST supported." });
  }

  try {
    const stripe = getStripe();
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig) {
      return res.status(400).json({ error: "Missing stripe-signature header" });
    }
    if (!webhookSecret) {
      return res.status(500).json({ error: "Server misconfiguration. Webhook secret is missing." });
    }

    const rawBody = await getRawBody(req);
    let event: any;

    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
      console.error(`[Webhook Signature Failed] Error: ${err.message}`);
      return res.status(400).send(`Webhook Signature Error: ${err.message}`);
    }

    console.log(`[Webhook Received] Event ID: ${event.id}, Type: ${event.type}`);

    // Atomic transaction at the beginning to claim the event ID
    const db = getDb();
    const eventRef = db.collection("stripeWebhookEvents").doc(event.id);

    const claimResult = await db.runTransaction(async (transaction: any) => {
      const eventSnap = await transaction.get(eventRef);
      if (eventSnap.exists) {
        const data = eventSnap.data();
        if (data.processingStatus === "failed") {
          // Allow retrying failed events by resetting status to processing
          transaction.update(eventRef, {
            processingStatus: "processing",
            processedAt: null,
            error: null
          });
          return { status: "processing", allowedToRetry: true };
        }
        return { status: data.processingStatus, exists: true };
      }
      
      transaction.set(eventRef, {
        id: event.id,
        eventId: event.id,
        type: event.type,
        processingStatus: "processing",
        createdAt: new Date().toISOString(),
        processedAt: null
      });
      return { status: "processing", exists: false };
    });

    if (claimResult.exists) {
      if (claimResult.status === "processed" || claimResult.status === "processing") {
        console.log(`[Webhook Idempotency Gate] Event ${event.id} is already in status: ${claimResult.status}. Skipping duplication.`);
        return res.status(200).json({ received: true, status: claimResult.status, skipped: true });
      }
    }

    let orderId = "";
    const dataObject = event.data.object;

    try {
      // Process the webhook events safely
      switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded": {
          const session = dataObject;
          orderId = session.client_reference_id;

          if (orderId) {
            console.log(`[Webhook Action] Checking checkout session for order ${orderId}`);
            const verifyRes = await verifyAndConfirmStripePayment(orderId, session.id, session.payment_intent as string);
            if (!verifyRes.success) {
              throw new Error(`Payment verification failed: ${verifyRes.error}`);
            }
          }
          break;
        }

        case "checkout.session.expired":
        case "checkout.session.async_payment_failed": {
          const session = dataObject;
          orderId = session.client_reference_id;
          if (orderId) {
            const order: Order | null = await dbService.get("orders", orderId);
            if (order && order.paymentStatus !== "Paid") {
              await dbService.update("orders", orderId, {
                paymentStatus: event.type === "checkout.session.expired" ? "Expired" : "Failed",
                paymentFailureMessage: `Stripe Checkout Session expired or payment failed.`
              });
            }
          }
          break;
        }

        case "payment_intent.succeeded": {
          const paymentIntent = dataObject;
          orderId = paymentIntent.metadata?.orderId;
          if (orderId) {
            console.log(`[Webhook Action] Checking payment intent success for order ${orderId}`);
            const verifyRes = await verifyAndConfirmStripePayment(orderId, undefined, paymentIntent.id);
            if (!verifyRes.success) {
              throw new Error(`Payment Intent verification failed: ${verifyRes.error}`);
            }
          }
          break;
        }

        case "payment_intent.payment_failed": {
          const paymentIntent = dataObject;
          orderId = paymentIntent.metadata?.orderId;
          if (orderId) {
            await dbService.update("orders", orderId, {
              paymentStatus: "Failed",
              paymentFailureMessage: paymentIntent.last_payment_error?.message || "Payment intent failed."
            });
          }
          break;
        }

        case "payment_intent.processing": {
          const paymentIntent = dataObject;
          orderId = paymentIntent.metadata?.orderId;
          if (orderId) {
            await dbService.update("orders", orderId, {
              paymentStatus: "Processing"
            });
          }
          break;
        }

        case "refund.created":
        case "refund.updated": {
          const refund = dataObject;
          if (refund.payment_intent) {
            const orderQuery = await db.collection("orders").where("stripePaymentIntentId", "==", refund.payment_intent).get();
            if (!orderQuery.empty) {
              orderId = orderQuery.docs[0].id;
              await reconcileStripeRefund(orderId, refund.id, refund.status, refund.amount);
            }
          }
          break;
        }

        case "refund.failed": {
          const refund = dataObject;
          if (refund.payment_intent) {
            const orderQuery = await db.collection("orders").where("stripePaymentIntentId", "==", refund.payment_intent).get();
            if (!orderQuery.empty) {
              orderId = orderQuery.docs[0].id;
              await reconcileStripeRefund(orderId, refund.id, "failed", refund.amount);
            }
          }
          break;
        }

        case "charge.refunded": {
          const charge = dataObject;
          orderId = charge.metadata?.orderId;
          if (!orderId && charge.payment_intent) {
            const orderQuery = await db.collection("orders").where("stripePaymentIntentId", "==", charge.payment_intent).get();
            if (!orderQuery.empty) {
              orderId = orderQuery.docs[0].id;
            }
          }
          if (orderId) {
            if (charge.refunds && charge.refunds.data) {
              for (const ref of charge.refunds.data) {
                await reconcileStripeRefund(orderId, ref.id, ref.status, ref.amount);
              }
            } else {
              await reconcileStripeRefund(orderId, "fallback-charge-refund", "succeeded", charge.amount_refunded);
            }
          }
          break;
        }

        case "charge.dispute.created":
        case "charge.dispute.updated":
        case "charge.dispute.closed": {
          const dispute = dataObject;
          orderId = dispute.metadata?.orderId;
          if (orderId) {
            await dbService.update("orders", orderId, {
              paymentStatus: "Disputed"
            });
          }
          break;
        }

        default:
          console.log(`[Webhook Unhandled Type] ${event.type}`);
      }

      // Transition the webhook event record to fully processed
      await dbService.update("stripeWebhookEvents", event.id, {
        processingStatus: "processed",
        orderId: orderId || "",
        processedAt: new Date().toISOString()
      });

      return res.status(200).json({ received: true });

    } catch (processError: any) {
      console.error(`[Webhook Process Error] Event ${event.id}:`, processError);
      
      // Update event record to failed, allowing Stripe's retry attempts to retry cleanly
      await dbService.update("stripeWebhookEvents", event.id, {
        processingStatus: "failed",
        error: processError.message || "Unknown processing error",
        processedAt: new Date().toISOString()
      });

      return res.status(500).json({ error: "Webhook processing failed. Requesting retry." });
    }

  } catch (error: any) {
    console.error("[Webhook Handling Fatal Error]:", error);
    return res.status(500).json({ error: error.message || "Webhook handling crashed" });
  }
}
