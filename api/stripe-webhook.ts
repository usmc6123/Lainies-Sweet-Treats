import { dbService } from "../src/server/db.js";
import { getStripe } from "./_lib/stripe.js";
import { confirmSuccessfulOrderPayment } from "./stripe.js";
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

    // Idempotency: Process each Stripe Event ID exactly once
    const existingEvent = await dbService.get("stripeWebhookEvents", event.id);
    if (existingEvent) {
      console.log(`[Webhook Idempotency] Event ${event.id} was already processed.`);
      return res.status(200).json({ received: true, duplicated: true });
    }

    let orderId = "";
    let orderNumber = "";

    const dataObject = event.data.object;

    // Handle events
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = dataObject;
        orderId = session.client_reference_id;
        orderNumber = session.metadata?.orderNumber || "";

        if (orderId) {
          const order: Order | null = await dbService.get("orders", orderId);
          if (order) {
            // Verify payment currency and exact total amount
            const stripeCurrency = session.currency?.toLowerCase();
            const orderCurrency = (order.currency || "usd").toLowerCase();
            
            if (stripeCurrency !== orderCurrency || session.amount_total !== order.totalAmountCents) {
              console.error(`[Payment Mismatch] Order: ${order.orderNumber}. Expected ${order.totalAmountCents} ${orderCurrency}, but received ${session.amount_total} ${stripeCurrency}`);
              await dbService.update("orders", orderId, {
                paymentStatus: "Failed",
                paymentFailureMessage: `Discrepancy: Paid $${(session.amount_total / 100).toFixed(2)} but expected $${(order.totalAmountCents / 100).toFixed(2)}. Requires attention.`
              });
            } else if (session.payment_status === "paid") {
              await confirmSuccessfulOrderPayment(orderId, session.id, session.payment_intent as string);
            }
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
              paymentFailureMessage: `Stripe Checkout Session was expired or payment failed.`
            });
          }
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = dataObject;
        orderId = paymentIntent.metadata?.orderId;
        if (orderId) {
          const order: Order | null = await dbService.get("orders", orderId);
          if (order && order.paymentStatus !== "Paid") {
            await confirmSuccessfulOrderPayment(orderId, order.stripeCheckoutSessionId || "", paymentIntent.id);
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

      case "charge.refunded": {
        const charge = dataObject;
        orderId = charge.metadata?.orderId;
        if (orderId) {
          const order: Order | null = await dbService.get("orders", orderId);
          if (order) {
            const refundAmountCents = charge.amount_refunded;
            const nextRefundedCents = refundAmountCents;
            const nextBalanceCents = Math.max(0, (order.amountPaidCents || 0) - nextRefundedCents);
            const nextStatus = nextRefundedCents >= (order.amountPaidCents || 0) ? "Refunded" : "Partially Refunded";

            await dbService.update("orders", orderId, {
              amountRefundedCents: nextRefundedCents,
              balanceDueCents: nextBalanceCents,
              paymentStatus: nextStatus,
              refundedAt: new Date().toISOString(),
              paymentUpdatedAt: new Date().toISOString()
            });
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

    // Save event record in Firestore for full idempotency/auditing
    await dbService.insert("stripeWebhookEvents", {
      id: event.id,
      eventId: event.id,
      type: event.type,
      orderId: orderId || "",
      processingStatus: "Processed",
      createdAt: new Date().toISOString(),
      processedAt: new Date().toISOString()
    });

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error("[Webhook Processing Error]:", error);
    return res.status(500).json({ error: error.message || "Webhook processing crashed" });
  }
}
