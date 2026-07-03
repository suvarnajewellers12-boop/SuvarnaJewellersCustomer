import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles, Check, X } from "lucide-react";
import Layout from "@/components/Layout";
import GoldDustParticles from "@/components/GoldDustParticles";
import PaymentModal from "@/components/PaymentModal";

const formatINR = (n: number = 0) => "₹" + n.toLocaleString("en-IN");

const _termsAndConditionsContent = `Eligibility

Users must provide accurate personal details during registration. Suvarna Jewellers reserves the right to suspend accounts containing false information.

Savings Schemes

• Customers may enroll in available gold or cash savings schemes.
• Monthly installment amounts and durations are fixed according to the selected scheme.
• Failure to pay installments on time may affect benefits associated with the scheme.
• Duplicate enrollment into the same scheme may not be permitted.

Payments

• All payments are securely processed through authorized payment gateways.
• Customers are responsible for verifying payment details before confirmation.
• Suvarna Jewellers shall not be liable for failed transactions caused by banking or network issues.

Gold Rate & Valuation

• Gold rates displayed in the application are subject to daily market fluctuations.
• Final valuation will be based on prevailing rates at the showroom during redemption or purchase.

Refund & Cancellation

• Payments once made are generally non-refundable.
• Refund requests, if applicable, shall be processed according to company policy.
• Cancellation charges may apply for discontinued schemes.

Exchange & Buyback Policy

• Exchange or buyback of jewellery is subject to prevailing company policies.
• Gold content will be evaluated based on purity and applicable deductions.
• Damaged or altered products may not qualify for exchange.

User Responsibilities

• Users are responsible for maintaining confidentiality of their account credentials and MPIN.
• Sharing OTPs, passwords, or MPINs with others is strictly discouraged.
• Any unauthorized activity should be reported immediately.

Notifications & OTP Services

• The application may send OTPs, reminders, and notifications for authentication and scheme updates.
• Users consent to receive SMS and app notifications related to their account activities.

Privacy & Data Usage

• User information is collected solely for authentication, payments, and customer service purposes.
• Suvarna Jewellers does not sell personal customer information to third parties.

Limitation of Liability

Suvarna Jewellers shall not be held responsible for losses caused due to:

• Internet or server interruptions
• Unauthorized account access caused by user negligence
• Third-party payment gateway failures
• Temporary application downtime or maintenance

Intellectual Property

All logos, designs, application content, branding, and visuals are the property of Suvarna Jewellers and may not be copied or reused without permission.

Modifications to Terms

Suvarna Jewellers reserves the right to modify these Terms & Conditions at any time without prior notice.

Jurisdiction

Any disputes arising from the use of this application or website shall be subject to the jurisdiction of courts in Andhra Pradesh, India.

Contact Information

Suvarna Jewellers
D.No. 13-1-12, Main Road, Near YSR Statue,
New Gajuwaka, Visakhapatnam - 530026,
Andhra Pradesh, India.

Email: suvarnajewellers12@gmail.com

© 2026 Suvarna Jewellers. All Rights Reserved.`;

// Module-level cache — survives page navigation, resets on browser refresh
let _cachedDbSchemes: any[] | null = null;

const ProgressArc = ({
  paidMonths,
  totalMonths,
}: {
  paidMonths: number;
  totalMonths: number;
}) => {
  const pct = (paidMonths / totalMonths) * 100;
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="relative">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle, hsla(43, 80%, 55%, 0.15) 0%, transparent 70%)",
          filter: "blur(8px)",
          transform: "scale(1.4)",
        }}
      />

      {/* ACCESSIBILITY FIX: Configured semantic role="img" and added descriptive dynamic aria-label text */}
      <svg
        width="100"
        height="100"
        viewBox="0 0 100 100"
        role="img"
        aria-label={`${paidMonths} of ${totalMonths} installments progress`}
        className="mx-auto relative z-10"
      >
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="hsla(38,40%,70%,0.2)"
          strokeWidth="6"
        />

        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="url(#goldGrad)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          whileInView={{ strokeDashoffset: offset }}
          viewport={{ once: true }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          transform="rotate(-90 50 50)"
        />

        <defs>
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(43, 85%, 58%)" />
            <stop offset="100%" stopColor="hsl(38, 72%, 42%)" />
          </linearGradient>
        </defs>

        <text
          x="50"
          y="50"
          textAnchor="middle"
          dy="0.35em"
          className="font-display text-sm font-bold"
          fill="hsl(28, 25%, 15%)"
          aria-hidden="true"
        >
          {paidMonths}/{totalMonths}
        </text>
      </svg>
    </div>
  );
};

interface TermsModalProps {
  onClose: () => void;
  onAgree: () => void;
}

const TermsModal = ({ onClose, onAgree }: TermsModalProps) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-md"
    onClick={onClose}
  >
    <motion.div
      initial={{ scale: 0.85, opacity: 0, y: 40 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.85, opacity: 0, y: 40 }}
      transition={{ type: "spring", damping: 22, stiffness: 260 }}
      onClick={(e) => e.stopPropagation()}
      className="glass-card rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col p-0 overflow-hidden"
      style={{ boxShadow: "0 30px 80px -20px hsla(30, 30%, 15%, 0.25), 0 0 0 1px hsla(38, 60%, 55%, 0.2)" }}
    >
      <div className="p-6 border-b border-gold/20 flex items-center justify-between bg-pearl/50">
        <h3 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-gold-dark" /> Terms & Conditions
        </h3>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-cream hover:bg-gold/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6 overflow-y-auto font-body text-sm text-muted-foreground space-y-4 bg-cream/30 whitespace-pre-line leading-relaxed">
        {_termsAndConditionsContent}
      </div>

      <div className="p-4 border-t border-gold/20 bg-pearl/50 flex gap-3 justify-end">
        <button
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl border border-gold/30 font-body text-sm text-foreground hover:bg-gold/5 transition-colors"
        >
          Decline
        </button>
        <button
          onClick={onAgree}
          className="btn-gold px-6 py-2.5 rounded-xl font-body text-sm font-semibold"
        >
          Agree & Proceed
        </button>
      </div>
    </motion.div>
  </motion.div>
);

const Schemes = () => {
  const {
    isLoggedIn,
    enrolledSchemes,
    refreshSchemes,
  } = useAuth();

  const navigate = useNavigate();

  const [dbSchemes, setDbSchemes] = useState<any[]>(_cachedDbSchemes ?? []);
  const [pendingScheme, setPendingScheme] = useState<any | null>(null);
  const [paymentScheme, setPaymentScheme] = useState<any | null>(null);
  const [loading, setLoading] = useState(_cachedDbSchemes === null);
  const [showGold, setShowGold] = useState(true);

  useEffect(() => {
    if (_cachedDbSchemes !== null) return;

    const fetchAllSchemes = async () => {
      try {
        const res = await fetch("https://suvarnagold-16e5.vercel.app/api/schemes/all");
        if (res.ok) {
          const data = await res.json();
          _cachedDbSchemes = data.schemes || [];
          setDbSchemes(_cachedDbSchemes!);
        }
      } catch (err) {
        console.error("Failed to fetch royal schemes:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllSchemes();
  }, []);

  const handleTabKeyDown = (e: React.KeyboardEvent, isGoldTab: boolean) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      setShowGold(!isGoldTab);
      const targetId = isGoldTab ? "tab-cash" : "tab-gold";
      document.getElementById(targetId)?.focus();
    }
  };

  const filteredSchemes = dbSchemes.filter((scheme) =>
    showGold ? scheme.isWeightBased === true : scheme.isWeightBased === false
  );

  const handleEnrollClick = (scheme: any) => {
    if (!isLoggedIn) {
      navigate("/login");
      return;
    }
    setPendingScheme(scheme);
  };

  const handleTermsAccepted = () => {
    if (pendingScheme) {
      setPaymentScheme(pendingScheme);
      setPendingScheme(null);
    }
  };

  const handlePaymentSuccess = async () => {
    if (paymentScheme) {
      await refreshSchemes();
      setPaymentScheme(null);
      navigate("/dashboard");
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="h-screen flex items-center justify-center bg-pearl">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="font-elegant italic text-gold-dark">
              Loading Royal Collections...
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="pt-32 pb-28 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cream via-pearl to-ivory" />
        <div className="absolute inset-0" style={{ background: "var(--gradient-spotlight)" }} />
        <div
          className="absolute top-0 left-0 right-0 h-48"
          style={{
            background: "linear-gradient(180deg, hsla(38, 40%, 75%, 0.08) 0%, transparent 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30z' fill='none' stroke='%23b8860b' stroke-width='0.5'/%3E%3C/svg%3E")`,
          }}
        />

        <div className="absolute top-0 left-0 right-0 gold-divider" />
        <GoldDustParticles />

        <div className="relative z-10 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-8"
          >
            <p className="font-elegant text-base tracking-[0.3em] uppercase text-gold-dark mb-3">
              Investment Plans
            </p>
            <h1 className="font-display text-4xl md:text-6xl font-bold text-foreground mb-4">
              <span className="text-gold-gradient-shine">Golden</span> Savings Plans
            </h1>
            <p className="font-body text-base md:text-lg text-muted-foreground max-w-xl mx-auto">
              Invest today. Adorn tomorrow.
            </p>

            {/* ACCESSIBILITY FIX: Wrapped option selectors in full tablist landmarks and updated tab item bindings */}
            <nav className="mt-8 max-w-md mx-auto" aria-label="Savings Schemes Filters">
              <div 
                role="tablist" 
                aria-label="Scheme Types"
                className="bg-pearl/70 p-1 rounded-2xl flex border border-gold/10"
              >
                <button
                  id="tab-gold"
                  role="tab"
                  aria-selected={showGold}
                  aria-controls="schemes-panel"
                  tabIndex={showGold ? 0 : -1}
                  onClick={() => setShowGold(true)}
                  onKeyDown={(e) => handleTabKeyDown(e, true)}
                  className={`flex-1 py-3 rounded-xl font-body text-sm font-semibold transition-all duration-300 ${
                    showGold ? "bg-gold text-white shadow-lg" : "text-muted-foreground"
                  }`}
                >
                  ✦ Gold Schemes
                </button>
                <button
                  id="tab-cash"
                  role="tab"
                  aria-selected={!showGold}
                  aria-controls="schemes-panel"
                  tabIndex={!showGold ? 0 : -1}
                  onClick={() => setShowGold(false)}
                  onKeyDown={(e) => handleTabKeyDown(e, false)}
                  className={`flex-1 py-3 rounded-xl font-body text-sm font-semibold transition-all duration-300 ${
                    !showGold ? "bg-gold text-white shadow-lg" : "text-muted-foreground"
                  }`}
                >
                  ₹ Cash Schemes
                </button>
              </div>
            </nav>
          </motion.div>

          <div
            id="schemes-panel"
            role="tabpanel"
            aria-labelledby={showGold ? "tab-gold" : "tab-cash"}
          >
            {filteredSchemes.length === 0 ? (
              <div className="glass-card rounded-3xl p-12 text-center max-w-lg mx-auto">
                <p className="font-body text-muted-foreground">
                  {showGold ? "No gold schemes available" : "No cash schemes available"}
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-8">
                {filteredSchemes.map((scheme, index) => {
                  const isEnrolled = enrolledSchemes.some((s) => s.name === scheme.name);

                  return (
                    <motion.div
                      key={scheme.id}
                      initial={{ opacity: 0, y: 50 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: index * 0.15 }}
                      className="glass-card rounded-3xl p-8 flex flex-col items-center text-center spotlight relative overflow-hidden group"
                      style={{ boxShadow: "var(--shadow-luxury)" }}
                    >
                      <div
                        className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                        style={{
                          background: "linear-gradient(135deg, transparent 20%, hsla(43,80%,60%,0.12) 50%, transparent 80%)",
                        }}
                      />

                      <ProgressArc paidMonths={0} totalMonths={scheme.durationMonths} />

                      {/* ACCESSIBILITY FIX: Changed layout heading structure from h3 to h2 */}
                      <h2 className="font-display text-xl font-bold text-foreground mt-4 mb-2">
                        {scheme.name}
                      </h2>

                      <div className="mb-4">
                        <span className="font-display text-3xl font-bold text-gold-gradient">
                          {formatINR(scheme.monthlyAmount)}
                        </span>
                        <span className="font-body text-sm text-muted-foreground">/month</span>
                      </div>

                      <div className="space-y-2 mb-6 w-full">
                        <div className="flex items-center gap-2 font-body text-sm text-foreground">
                          <Check className="w-4 h-4 text-gold-dark" />
                          {scheme.durationMonths} monthly installments
                        </div>

                        {scheme.isWeightBased ? (
                          <div className="flex items-center gap-2 font-body text-sm text-foreground text-left">
                            <Sparkles className="w-4 h-4 text-gold-dark" />
                            Gold accumulation based savings plan
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 font-body text-sm text-foreground text-left">
                            <Sparkles className="w-4 h-4 text-gold-dark" />
                            Get Maturity Value: {formatINR(scheme.monthlyAmount * scheme.durationMonths)}
                          </div>
                        )}
                      </div>

                      {isEnrolled ? (
                        <div className="btn-gold w-full text-center py-3.5 opacity-80 cursor-default flex items-center justify-center gap-2">
                          <Check className="w-4 h-4" /> Enrolled
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEnrollClick(scheme)}
                          className="btn-gold btn-gold-pulse w-full text-base py-3.5"
                        >
                          Enroll Now
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <AnimatePresence>
        {pendingScheme && (
          <TermsModal
            onClose={() => setPendingScheme(null)}
            onAgree={handleTermsAccepted}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {paymentScheme && (
          <PaymentModal
            schemeId={paymentScheme.id}
            schemeName={paymentScheme.name}
            monthlyAmount={paymentScheme.monthlyAmount}
            onSuccess={handlePaymentSuccess}
            onClose={() => setPaymentScheme(null)}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
};

export default Schemes;