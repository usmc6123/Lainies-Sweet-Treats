import React, { useEffect, useState } from "react";
import { CheckCircle, AlertCircle, Loader2, Calendar, DollarSign, ShoppingBag, ArrowLeft, ShieldAlert } from "lucide-react";

interface PaymentStatusPageProps {
  status: "success" | "cancelled";
  sessionId?: string;
  orderId?: string;
  onReturnToStore: () => void;
}

export function PaymentStatusPage({ status, sessionId, orderId, onReturnToStore }: PaymentStatusPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<any>(null);
  const [retrying, setRetrying] = useState(false);

  // Poll for Paid status upon success redirect
  useEffect(() => {
    if (status !== "success" || !sessionId) {
      setLoading(false);
      return;
    }

    let pollCount = 0;
    const maxPolls = 6;
    let timeoutId: any;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/stripe/checkout-status?session_id=${sessionId}`);
        if (!res.ok) {
          throw new Error("Failed to load status");
        }
        const data = await res.json();
        setOrder(data);

        if (data.paymentStatus === "Paid") {
          // Success! Clear local cart and fields
          localStorage.removeItem("lst_cart");
          sessionStorage.removeItem("lst_last_cart");
          sessionStorage.removeItem("lst_last_checkout_fields");
          setLoading(false);
        } else {
          pollCount++;
          if (pollCount < maxPolls) {
            timeoutId = setTimeout(checkStatus, 2000);
          } else {
            setLoading(false); // Stop polling and let user see current status
          }
        }
      } catch (err: any) {
        console.error("Status check error:", err);
        setError("Could not confirm your payment automatically. Please check your email or contact Lainie!");
        setLoading(false);
      }
    };

    checkStatus();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [status, sessionId]);

  const handleRetryPayment = async () => {
    if (!orderId) return;
    setRetrying(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/retry-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.totalChanged) {
          alert("Note: The price, promo, or capacity changed since your first checkout. Your total has been updated.");
        }
        window.location.assign(data.checkoutUrl);
      } else {
        setError(data.error || "Fulfillment capacity or coupon is no longer valid. Please start a new order!");
      }
    } catch (err) {
      setError("Network failure retrying payment. Please contact Lainie’s Sweet Treats for assistance.");
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-brand-pink/20 shadow-md text-center space-y-6 animate-pulse">
        <Loader2 className="h-10 w-10 text-brand-rosegold animate-spin mx-auto" />
        <h2 className="text-xl font-bold text-brand-chocolate">We are confirming your payment...</h2>
        <p className="text-xs text-gray-500">Please do not close this window or hit back while we secure your baking slot with Stripe.</p>
      </div>
    );
  }

  if (status === "success" && order) {
    const isPaid = order.paymentStatus === "Paid";
    return (
      <div className="max-w-2xl mx-auto my-8 p-8 bg-white rounded-3xl border border-brand-pink/25 shadow-lg space-y-6">
        <div className="text-center space-y-3">
          {isPaid ? (
            <>
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <h2 className="text-2xl font-black text-brand-chocolate uppercase tracking-wide">Sweet payment confirmed!</h2>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Lainie has booked your spot on her calendar and is polishing her baking pans. We're so excited to make your sweet Treats!
              </p>
            </>
          ) : (
            <>
              <Loader2 className="h-12 w-12 text-brand-rosegold animate-spin mx-auto" />
              <h2 className="text-xl font-bold text-brand-chocolate">Still confirming with Stripe...</h2>
              <p className="text-xs text-gray-500">Your payment is processing. Once verified, we will email your confirmation invoice.</p>
            </>
          )}
        </div>

        <div className="border-t border-b border-brand-pink/15 py-4 my-2 space-y-3 bg-brand-cream/10 rounded-2xl px-5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-gray-400 uppercase tracking-wider">Order Reference</span>
            <span className="font-extrabold text-brand-chocolate">{order.orderNumber}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-gray-400 uppercase tracking-wider">Fulfillment Date</span>
            <span className="font-extrabold text-brand-chocolate flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-brand-rosegold" /> {order.fulfillmentDate}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-gray-400 uppercase tracking-wider">Method</span>
            <span className="font-extrabold text-brand-chocolate uppercase">{order.type}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-gray-400 uppercase tracking-wider">Amount Paid</span>
            <span className="font-black text-brand-rosegold text-sm flex items-center">
              <DollarSign className="h-3.5 w-3.5" />{order.total?.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Items Summary */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-chocolate flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-brand-pink" /> Selected treats list:
          </h3>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {order.items?.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between items-start text-xs border-b border-brand-pink/5 pb-2">
                <div>
                  <p className="font-bold text-brand-chocolate">
                    {item.quantity}x {item.name} {item.variationName ? `(${item.variationName})` : ""}
                  </p>
                  {item.size && <p className="text-[10px] text-gray-400">Scale: {item.size}</p>}
                </div>
                <span className="font-semibold text-gray-500">${item.totalPrice?.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center pt-4">
          <button
            onClick={onReturnToStore}
            className="px-6 py-3 bg-brand-chocolate text-brand-cream hover:opacity-95 font-bold rounded-full text-xs uppercase tracking-wider shadow-sm"
          >
            Return to Web Store
          </button>
        </div>
      </div>
    );
  }

  // Cancelled State
  return (
    <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-brand-pink/20 shadow-md text-center space-y-6">
      <AlertCircle className="h-12 w-12 text-brand-rosegold mx-auto" />
      <div className="space-y-2">
        <h2 className="text-2xl font-black text-brand-chocolate uppercase tracking-wide">Checkout Not Completed</h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          Your payment attempt was cancelled or was not completed by Stripe. No funds have been captured, and your spot on Lainie's calendar remains open!
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[11px] text-red-600 font-bold flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-2 pt-4">
        {orderId && (
          <button
            onClick={handleRetryPayment}
            disabled={retrying}
            className="w-full bg-brand-chocolate text-brand-cream hover:opacity-95 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2"
          >
            {retrying ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Rebuilding Stripe checkout...</span>
              </>
            ) : (
              <span>Retry Secure Payment</span>
            )}
          </button>
        )}
        <button
          onClick={onReturnToStore}
          className="w-full bg-brand-cream hover:bg-brand-pink/20 text-brand-chocolate border border-brand-pink/25 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Return to Cart / Store</span>
        </button>
      </div>
    </div>
  );
}
