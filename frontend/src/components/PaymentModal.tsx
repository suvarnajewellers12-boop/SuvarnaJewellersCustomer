import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, Smartphone, Landmark, CheckCircle2, X, Shield } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

interface PaymentModalProps {
  schemeId: string; // Add this line
  schemeName: string;
  monthlyAmount: number;
  onSuccess: () => void;
  onClose: () => void;
}

const formatINR = (n: number) => "₹" + n.toLocaleString("en-IN");

type PaymentMethod = "upi" | "card" | "netbanking";
type Stage = "summary" | "processing" | "success";

const paymentMethods: { id: PaymentMethod; label: string; icon: typeof CreditCard; desc: string }[] = [
  { id: "upi", label: "UPI", icon: Smartphone, desc: "Google Pay, PhonePe, Paytm" },
  { id: "card", label: "Card", icon: CreditCard, desc: "Credit / Debit Card" },
  { id: "netbanking", label: "Net Banking", icon: Landmark, desc: "All major banks" },
];

const PaymentModal = ({ schemeId, schemeName, monthlyAmount, onSuccess, onClose }: PaymentModalProps) => {
  // MOVED INSIDE THE COMPONENT
  const { user } = useAuth(); 
  const currentUserId = user?.id;

  const [stage, setStage] = useState<Stage>("summary");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("upi");

  const handleProceed = async () => {
    try {
      setStage("processing");

      // 1. Create Order on the Backend
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://suvarna-jewellers-customer-backend.vercel.app'}/api/payments/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: monthlyAmount }),
      });

      const orderData = await response.json();

      if (!response.ok) throw new Error("Could not create order");

      // 2. Configure Razorpay Options
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_SQBmMDbmpm3m0D", // Use your Test Key ID here
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Suvarna Jewellers",
        description: `Payment for ${schemeName}`,
        order_id: orderData.orderId,
        // Inside the 'handler' function of your Razorpay options:
// Inside your PaymentModal's handleProceed function, update the 'options.handler':

handler: async function (response: any) {
          console.log("DEBUG: Finalizing payment for UUID:", currentUserId);

          // HARDCODED BACKEND URL TO FIX 'UNDEFINED' ERROR
          const backendUrl = "https://suvarna-jewellers-customer-backend.vercel.app";

          try {
            const verifyRes = await fetch(`${backendUrl}/api/payments/verify`, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                schemeId: schemeId,
                userId: currentUserId,
              }),
            });

            if (verifyRes.ok) {
              setStage("success");
              // This triggers the dashboard to refresh the gold counts
              window.dispatchEvent(new Event("schemeUpdated"));
            } else {
              const errorText = await verifyRes.text();
              console.error("Verification failed server response:", errorText);
              alert("Payment successful! Please refresh your dashboard to see updates.");
            }
          } catch (err) {
            console.error("Fetch Error:", err);
            alert("Connection error. Please check your internet and refresh.");
          }
        },
        prefill: {
          name: "Customer Name", // You can pass user.name from context here
          contact: "9876543210",
        },
        theme: {
          color: "#b8860b", // Your gold theme color
        },
        modal: {
          ondismiss: function () {
            setStage("summary"); // Go back if user closes popup
          }
        }
      };

      // 3. Open the Popup
      const rzp = new (window as any).Razorpay(options);
      rzp.open();

    } catch (err) {
      console.error("Payment Error:", err);
      alert("Payment failed to initialize. Check console.");
      setStage("summary");
    }
  };

  const handleGoToDashboard = () => {
    onSuccess();
  };

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-foreground/60 backdrop-blur-sm" onClick={stage === "summary" ? onClose : undefined} />

      <AnimatePresence mode="wait">
        {/* ─── STAGE 1: Payment Summary (RESTORED FULL VERSION) ─── */}
        {stage === "summary" && (
          <motion.div
            key="summary"
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="relative z-10 w-full max-w-md rounded-3xl overflow-hidden"
            style={{
              background: "linear-gradient(170deg, hsl(40, 28%, 96%) 0%, hsl(38, 22%, 91%) 100%)",
              boxShadow: "0 25px 60px -15px hsla(38, 50%, 30%, 0.35), 0 0 0 1px hsla(43, 80%, 55%, 0.2)",
            }}
          >
            {/* Gold accent bar */}
            <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, hsl(var(--gold-dark)), hsl(var(--gold)), hsl(var(--gold-dark)))" }} />

            {/* Close button */}
            <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>

            <div className="p-8 pt-6">
              <p className="font-elegant text-xs tracking-[0.25em] uppercase text-gold-dark mb-1">Payment Summary</p>
              <h2 className="font-display text-2xl font-bold text-foreground mb-6">{schemeName}</h2>

              {/* Amount card */}
              <div className="rounded-2xl p-5 mb-6" style={{
                background: "linear-gradient(135deg, hsla(43, 80%, 55%, 0.1) 0%, hsla(38, 40%, 75%, 0.08) 100%)",
                border: "1px solid hsla(43, 80%, 55%, 0.2)",
              }}>
                <div className="flex justify-between items-center">
                  <span className="font-body text-sm text-muted-foreground">
                    {window.location.pathname.includes('dashboard') ? "Monthly Installment" : "First Installment"}
                  </span>
                  <span className="font-display text-2xl font-bold" style={{ color: "hsl(var(--gold-dark))" }}>
                    {formatINR(monthlyAmount)}
                  </span>
                </div>
              </div>

              {/* Payment methods */}
              <p className="font-body text-xs text-muted-foreground mb-3 uppercase tracking-wider">Select Payment Method</p>
              <div className="space-y-2.5 mb-8">
                {paymentMethods.map(({ id, label, icon: Icon, desc }) => (
                  <button
                    key={id}
                    onClick={() => setSelectedMethod(id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 text-left ${
                      selectedMethod === id
                        ? "border-gold bg-gold/5 shadow-sm"
                        : "border-border hover:border-gold-light bg-transparent"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      selectedMethod === id ? "bg-gold/15" : "bg-muted"
                    }`}>
                      <Icon className={`w-5 h-5 ${selectedMethod === id ? "text-gold-dark" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <p className="font-body font-semibold text-sm text-foreground">{label}</p>
                      <p className="font-body text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <div className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      selectedMethod === id ? "border-gold-dark" : "border-muted-foreground/30"
                    }`}>
                      {selectedMethod === id && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-2.5 h-2.5 rounded-full bg-gold-dark"
                        />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Proceed button */}
              <button
                onClick={handleProceed}
                className="btn-gold btn-gold-pulse w-full text-base py-4 flex items-center justify-center gap-2"
              >
                <Shield className="w-4 h-4" /> Proceed to Pay {formatINR(monthlyAmount)}
              </button>

              <p className="font-body text-[11px] text-muted-foreground text-center mt-3 flex items-center justify-center gap-1">
                <Shield className="w-3 h-3" /> Secured by 256-bit encryption
              </p>
            </div>
          </motion.div>
        )}

        {/* ─── STAGE 2: Processing (RESTORED FULL VERSION) ─── */}
        {stage === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
            className="relative z-10 w-full max-sm rounded-3xl p-10 flex flex-col items-center text-center"
            style={{
              background: "linear-gradient(170deg, hsl(40, 28%, 96%) 0%, hsl(38, 22%, 91%) 100%)",
              boxShadow: "0 25px 60px -15px hsla(38, 50%, 30%, 0.35)",
            }}
          >
            {/* Animated gold spinner */}
            <div className="relative w-24 h-24 mb-6">
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  border: "3px solid hsla(43, 80%, 55%, 0.15)",
                }}
              />
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  borderTop: "3px solid hsl(var(--gold))",
                  borderRight: "3px solid transparent",
                  borderBottom: "3px solid transparent",
                  borderLeft: "3px solid transparent",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute inset-2 rounded-full"
                style={{
                  borderTop: "2px solid transparent",
                  borderRight: "2px solid hsl(var(--gold-dark))",
                  borderBottom: "2px solid transparent",
                  borderLeft: "2px solid transparent",
                }}
                animate={{ rotate: -360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <CreditCard className="w-8 h-8 text-gold-dark" />
                </motion.div>
              </div>
            </div>

            <h3 className="font-display text-xl font-bold text-foreground mb-2">Verifying Payment</h3>
            <p className="font-body text-sm text-muted-foreground">Please wait while we confirm your transaction…</p>
          </motion.div>
        )}

        {/* ─── STAGE 3: Success (RESTORED FULL VERSION WITH FIX) ─── */}
        {stage === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative z-10 w-full max-w-sm rounded-3xl p-10 flex flex-col items-center text-center overflow-hidden"
            style={{
              background: "linear-gradient(170deg, hsl(40, 28%, 96%) 0%, hsl(38, 22%, 91%) 100%)",
              boxShadow: "0 25px 60px -15px hsla(38, 50%, 30%, 0.35)",
            }}
          >
            {/* Celebratory glow */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: "radial-gradient(circle at 50% 30%, hsla(43, 80%, 55%, 0.12) 0%, transparent 60%)",
            }} />

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-20 h-20 rounded-full flex items-center justify-center mb-6 relative"
              style={{
                background: "linear-gradient(135deg, hsla(43, 80%, 55%, 0.15) 0%, hsla(120, 40%, 50%, 0.1) 100%)",
                border: "2px solid hsla(120, 50%, 45%, 0.4)",
              }}
            >
              <CheckCircle2 className="w-10 h-10" style={{ color: "hsl(120, 50%, 38%)" }} />
              <motion.div
                className="absolute inset-0 rounded-full"
                initial={{ opacity: 0.6, scale: 1 }}
                animate={{ opacity: 0, scale: 1.8 }}
                transition={{ duration: 1, delay: 0.4 }}
                style={{ border: "2px solid hsla(120, 50%, 45%, 0.3)" }}
              />
            </motion.div>

            <motion.h3
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="font-display text-2xl font-bold text-foreground mb-2"
            >
              Payment Successful
            </motion.h3>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              className="font-body text-sm text-muted-foreground mb-2"
            >
              {/* DYNAMIC TEXT RESTORED */}
              {window.location.pathname.includes('dashboard') ? "Your installment has been received for" : "You are now enrolled in"}
            </motion.p>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
              className="font-display text-lg font-semibold mb-6"
              style={{ color: "hsl(var(--gold-dark))" }}
            >
              {schemeName}
            </motion.p>

            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
              onClick={handleGoToDashboard}
              className="btn-gold w-full text-base py-4"
            >
              Go to Dashboard
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PaymentModal;