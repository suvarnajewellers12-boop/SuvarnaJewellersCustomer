import { motion, AnimatePresence } from "framer-motion";
import { useAuth, Scheme } from "@/contexts/AuthContext";
import {
  Sparkles,
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  Scale,
  Wallet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import GoldDustParticles from "@/components/GoldDustParticles";
import { useState } from "react";
import PaymentModal from "@/components/PaymentModal";

const formatINR = (n: number) =>
  "₹" + (n || 0).toLocaleString("en-IN");

const getSchemeDetails = (scheme: Scheme) => {
  const enrolledDate = new Date(
    (scheme as any).enrolledDate ||
      (scheme as any).startDate ||
      Date.now()
  );

  const installments = scheme.installmentsPaid || 0;
  const duration = scheme.durationMonths || 1;

  const lastPaymentDate = new Date(enrolledDate);

  lastPaymentDate.setMonth(
    lastPaymentDate.getMonth() +
      (installments > 0 ? installments - 1 : 0)
  );

  const nextDueDate = new Date(enrolledDate);

  nextDueDate.setMonth(
    nextDueDate.getMonth() + installments
  );

  const isCompleted = installments >= duration;

  const isPayable = !isCompleted;

  return {
    lastPaymentDate:
      lastPaymentDate.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),

    nextDueDate:
      nextDueDate.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),

    amountDue: scheme.monthlyAmount,

    isCompleted,

    isPayable,

    isDue: !isCompleted,
  };
};

const SchemeDetailModal = ({
  scheme,
  onClose,
  onPaymentSuccess,
}: {
  scheme: Scheme;
  onClose: () => void;
  onPaymentSuccess: () => Promise<void>;
}) => {
  const [isPaying, setIsPaying] = useState(false);

  const [paymentMonth, setPaymentMonth] =
    useState(0);

  const details = getSchemeDetails(scheme);

  const progress =
    ((scheme.installmentsPaid || 0) /
      (scheme.durationMonths || 1)) *
    100;

  const handleInstallmentSuccess =
    async () => {
      alert(
        `Payment for Month ${
          paymentMonth + 1
        } was successful!`
      );

      await onPaymentSuccess();

      setIsPaying(false);

      onClose();
    };

  return (
    <AnimatePresence mode="wait">
      {isPaying ? (
        <PaymentModal
          key="payment-step"
          schemeId={(scheme as any).schemeId}
          schemeName={scheme.name}
          monthlyAmount={scheme.monthlyAmount}
          onSuccess={handleInstallmentSuccess}
          onClose={() => setIsPaying(false)}
        />
      ) : (
        <motion.div
          key="details-step"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{
              scale: 0.85,
              opacity: 0,
              y: 40,
            }}
            animate={{
              scale: 1,
              opacity: 1,
              y: 0,
            }}
            exit={{
              scale: 0.85,
              opacity: 0,
              y: 40,
            }}
            transition={{
              type: "spring",
              damping: 22,
              stiffness: 260,
            }}
            onClick={(e) =>
              e.stopPropagation()
            }
            className="glass-card rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-0"
            style={{
              boxShadow:
                "0 30px 80px -20px hsla(30, 30%, 15%, 0.25), 0 0 0 1px hsla(38, 60%, 55%, 0.2)",
            }}
          >
            <div className="relative p-8 pb-4">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-pearl/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-pearl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <p className="font-elegant text-sm tracking-[0.2em] uppercase text-gold-dark mb-2">
                Scheme Ledger
              </p>

              <h3 className="font-display text-2xl font-bold text-foreground">
                {scheme.name}
              </h3>

              <div className="mt-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-body font-semibold border ${
                    details.isCompleted
                      ? "bg-emerald/10 text-emerald border-emerald/20"
                      : "bg-gold/10 text-gold-dark border-gold/20"
                  }`}
                >
                  {details.isCompleted
                    ? "Completed"
                    : "Active"}
                </span>
              </div>
            </div>

            <div className="px-8 pb-6">
              <div className="w-full h-3 rounded-full bg-cream overflow-hidden mb-2">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background:
                      "var(--gradient-gold)",
                  }}
                  initial={{ width: "0%" }}
                  animate={{
                    width: `${progress}%`,
                  }}
                />
              </div>

              <p className="font-body text-sm text-muted-foreground text-center">
                {scheme.installmentsPaid} of{" "}
                {scheme.durationMonths}{" "}
                installments completed
              </p>
            </div>

            <div className="px-8 pb-6 grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-gold/5 border border-gold/15">
                <p className="font-body text-xs text-muted-foreground mb-1">
                  Monthly Amount
                </p>

                <p className="font-display text-lg font-bold text-gold-gradient">
                  {formatINR(
                    scheme.monthlyAmount
                  )}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gold/5 border border-gold/15">
                <p className="font-body text-xs text-muted-foreground mb-1">
                  {scheme.isWeightBased
                    ? "Gold Accumulated"
                    : "Cash Saved"}
                </p>

                <p className="font-display text-lg font-bold text-gold-gradient">
                  {scheme.isWeightBased
                    ? `${(
                        scheme.accumulatedGrams ||
                        0
                      ).toFixed(3)} g`
                    : formatINR(
                        scheme.totalPaid || 0
                      )}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gold/5 border border-gold/15">
                <p className="font-body text-xs text-muted-foreground mb-1">
                  Last Payment
                </p>

                <p className="font-body text-sm font-semibold text-foreground">
                  {
                    details.lastPaymentDate
                  }
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gold/5 border border-gold/15">
                <p className="font-body text-xs text-muted-foreground mb-1">
                  Next Due
                </p>

                <p className="font-body text-sm font-semibold text-foreground">
                  {details.nextDueDate}
                </p>
              </div>
            </div>

            <div className="px-8 pb-6">
              <p className="font-display text-sm font-semibold text-foreground mb-3">
                Payment Timeline
              </p>

              <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                {Array.from(
                  {
                    length:
                      scheme.durationMonths,
                  },
                  (_, i) => {
                    const isPaid =
                      i <
                      scheme.installmentsPaid;

                    const isCurrent =
                      i ===
                      scheme.installmentsPaid;

                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3"
                      >
                        {isPaid ? (
                          <CheckCircle2 className="w-4 h-4 text-gold-dark flex-shrink-0" />
                        ) : isCurrent ? (
                          <AlertCircle className="w-4 h-4 text-gold flex-shrink-0" />
                        ) : (
                          <Clock className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                        )}

                        <span className="font-body text-xs">
                          Month {i + 1}
                        </span>

                        <span className="ml-auto text-xs">
                          {isPaid
                            ? "Paid"
                            : isCurrent
                            ? "Due"
                            : "Upcoming"}
                        </span>
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            {details.isDue && (
              <div className="px-8 pb-8">
                <button
                  disabled={
                    !details.isPayable
                  }
                  onClick={() => {
                    setPaymentMonth(
                      scheme.installmentsPaid
                    );

                    setIsPaying(true);
                  }}
                  className={`w-full text-base py-3.5 rounded-xl font-bold transition-all ${
                    details.isPayable
                      ? "btn-gold btn-gold-pulse"
                      : "bg-pearl border border-gold/20 text-muted-foreground/50"
                  }`}
                >
                  {details.isPayable
                    ? `Pay Now — ${formatINR(
                        details.amountDue
                      )}`
                    : `Next Due: ${details.nextDueDate}`}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const Dashboard = () => {
  const {
    user,
    enrolledSchemes,
    isLoading: authLoading,
    refreshSchemes,
  } = useAuth();

  const navigate = useNavigate();

  const [selectedScheme, setSelectedScheme] =
    useState<Scheme | null>(null);

  const [showGold, setShowGold] =
    useState(true);

  if (authLoading) {
    return (
      <Layout>
        <div className="h-screen flex items-center justify-center bg-pearl">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />

            <p className="font-elegant text-gold-dark italic">
              Opening Suvarna Treasury...
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  const filteredSchemes =
    enrolledSchemes.filter((scheme) =>
      showGold
        ? scheme.isWeightBased
        : !scheme.isWeightBased
    );

  return (
    <Layout>
      <section className="pt-32 pb-28 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cream via-pearl to-ivory" />

        <div
          className="absolute inset-0"
          style={{
            background:
              "var(--gradient-spotlight)",
          }}
        />

        <div className="absolute top-0 left-0 right-0 gold-divider" />

        <GoldDustParticles />

        <div className="relative z-10 max-w-6xl mx-auto">
          <motion.div
            initial={{
              opacity: 0,
              y: 30,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.8,
            }}
          >
            <h1 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-2">
              Welcome,{" "}
              <span className="text-gold-gradient-shine">
                {user?.name ||
                  "Member"}
              </span>
            </h1>

            <p className="font-elegant text-lg text-muted-foreground italic mb-10">
              Your scheme dashboard
            </p>
          </motion.div>

          <div className="mb-8">
            <div className="flex gap-3">
              <button
                onClick={() =>
                  setShowGold(true)
                }
                className={`px-5 py-2 rounded-xl font-semibold transition-all ${
                  showGold
                    ? "btn-gold"
                    : "bg-pearl border border-gold/20"
                }`}
              >
                ✦ Gold Schemes
              </button>

              <button
                onClick={() =>
                  setShowGold(false)
                }
                className={`px-5 py-2 rounded-xl font-semibold transition-all ${
                  !showGold
                    ? "btn-gold"
                    : "bg-pearl border border-gold/20"
                }`}
              >
                ₹ Cash Schemes
              </button>
            </div>
          </div>

          {filteredSchemes.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <p className="font-body text-muted-foreground mb-4">
                No schemes available
              </p>

              <button
                onClick={() =>
                  navigate("/schemes")
                }
                className="btn-gold text-sm px-8 py-3"
              >
                Explore Schemes
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSchemes.map(
                (scheme, i) => {
                  const progress =
                    ((scheme.installmentsPaid ||
                      0) /
                      (scheme.durationMonths ||
                        1)) *
                    100;

                  const isCompleted =
                    (scheme.installmentsPaid ||
                      0) >=
                    (scheme.durationMonths ||
                      1);

                  return (
                    <motion.div
                      key={scheme.id}
                      initial={{
                        opacity: 0,
                        y: 20,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      transition={{
                        delay: i * 0.1,
                      }}
                      className="space-y-3"
                    >
                      <div
                        onClick={() =>
                          setSelectedScheme(
                            scheme
                          )
                        }
                        className="glass-card rounded-2xl p-6 relative overflow-hidden group cursor-pointer hover:border-gold/40 transition-all duration-300"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-display text-lg font-bold text-foreground">
                            {scheme.name}
                          </h3>

                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-body font-semibold border ${
                              isCompleted
                                ? "bg-emerald/10 text-emerald border-emerald/20"
                                : "bg-gold/10 text-gold-dark border-gold/20"
                            }`}
                          >
                            {isCompleted
                              ? "Completed"
                              : "Active"}
                          </span>
                        </div>

                        <p className="font-body text-sm text-muted-foreground mb-1">
                          {formatINR(
                            scheme.monthlyAmount
                          )}
                          /month •{" "}
                          {
                            scheme.installmentsPaid
                          }
                          /
                          {
                            scheme.durationMonths
                          }{" "}
                          paid
                        </p>

                        <div className="w-full h-2 rounded-full bg-cream overflow-hidden mt-4">
                          <motion.div
                            className="h-full rounded-full"
                            style={{
                              background:
                                "var(--gradient-gold)",
                            }}
                            initial={{
                              width: "0%",
                            }}
                            animate={{
                              width: `${progress}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl p-5 bg-[#2E2118] border border-gold/20">
  <div className="flex items-center gap-4">
    <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0">
      {scheme.isWeightBased ? (
        <Scale className="w-6 h-6 text-gold-dark" />
      ) : (
        <Wallet className="w-6 h-6 text-gold-dark" />
      )}
    </div>

    <div className="flex-1 min-w-0">
      <p className="text-xs text-gold-dark/70 uppercase tracking-wider mb-0.5">
        {scheme.isWeightBased
          ? "Total Gold Accumulated"
          : "Total Cash Saved"}
      </p>

      <h3 className="font-display text-2xl font-bold text-gold-gradient-shine">
        {scheme.isWeightBased
          ? `${(
              scheme.accumulatedGrams || 0
            ).toFixed(3)} g`
          : formatINR(
              scheme.totalPaid || 0
            )}
      </h3>

      {scheme.isWeightBased &&
        (scheme.lastPaymentGrams ?? 0) > 0 && (
          <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gold/10 w-fit">
            <span className="text-gold-dark text-xs">
              ↑
            </span>

            <span className="text-xs text-gold-dark/90 font-medium">
              This month: +
              {(
                scheme.lastPaymentGrams ?? 0
              ).toFixed(3)}{" "}
              g
            </span>
          </div>
        )}
    </div>

    <div className="px-3 py-1 rounded-full bg-gold/10 text-gold-dark text-xs font-semibold flex-shrink-0">
      {scheme.isWeightBased
        ? "Gold"
        : "Cash"}
    </div>
  </div>
</div>
                    </motion.div>
                  );
                }
              )}
            </div>
          )}
        </div>

        <AnimatePresence>
          {selectedScheme && (
            <SchemeDetailModal
              scheme={
                enrolledSchemes.find(
                  (s) =>
                    s.id ===
                    selectedScheme.id
                ) || selectedScheme
              }
              onClose={() =>
                setSelectedScheme(null)
              }
              onPaymentSuccess={
                refreshSchemes
              }
            />
          )}
        </AnimatePresence>
      </section>
    </Layout>
  );
};

export default Dashboard;