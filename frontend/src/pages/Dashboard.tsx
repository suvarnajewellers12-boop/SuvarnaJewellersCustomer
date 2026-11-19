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
import { useState, useEffect, useRef } from "react";
import PaymentModal from "@/components/PaymentModal";

const formatINR = (n: number) =>
  "₹" + (n || 0).toLocaleString("en-IN");

type SchemeCategory = "GOLD" | "SILVER" | "CASH";

const getSchemeRateType = (scheme: any) =>
  String(
    scheme?.rateType ??
      scheme?.scheme?.rateType ??
      scheme?.Scheme?.rateType ??
      ""
  )
    .trim()
    .toUpperCase();

const getSchemeCategory = (
  scheme: any
): SchemeCategory => {
  const rateType =
    getSchemeRateType(scheme);

  if (rateType === "SILVER") {
    return "SILVER";
  }

  if (
    rateType === "GOLD_22K" ||
    rateType === "GOLD_18K"
  ) {
    return "GOLD";
  }

  if (rateType === "CASH") {
    return "CASH";
  }

  if (scheme?.isWeightBased === true) {
    return "GOLD";
  }

  return "CASH";
};

const getSchemeTypeLabel = (
  scheme: any
) => {
  const rateType =
    getSchemeRateType(scheme);

  if (rateType === "GOLD_22K") {
    return "22K Gold";
  }

  if (rateType === "GOLD_18K") {
    return "18K Gold";
  }

  if (rateType === "SILVER") {
    return "Silver";
  }

  return "Cash";
};

const getAccumulationLabel = (
  scheme: any
) => {
  const category =
    getSchemeCategory(scheme);

  if (category === "SILVER") {
    return "Total Silver Accumulated";
  }

  if (category === "GOLD") {
    return "Total Gold Accumulated";
  }

  return "Total Cash Saved";
};

const getAccumulationValue = (
  scheme: any
) => {
  const category =
    getSchemeCategory(scheme);

  if (
    category === "GOLD" ||
    category === "SILVER"
  ) {
    return `${Number(
      scheme.accumulatedGrams || 0
    ).toFixed(3)} g`;
  }

  return formatINR(
    scheme.totalPaid || 0
  );
};

const formatDate = (value?: string | Date | null) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getSchemeDetails = (scheme: Scheme) => {
  const raw = scheme as any;

  const schemeMeta =
    raw.scheme || raw.Scheme || {};

  const installments =
    raw.installments ||
    raw.Installments ||
    [];

  const duration = Number(
    raw.durationMonths ||
      schemeMeta.durationMonths ||
      11
  );

  const installmentsPaid = Number(
    raw.installmentsPaid || 0
  );

  const installmentAmount = Number(
    raw.installmentAmount ??
      raw.monthlyAmount ??
      0
  );

  const isCompleted =
    Boolean(raw.isCompleted) ||
    installmentsPaid >= duration;

  const hasMissedInstallments =
    Boolean(raw.hasMissedInstallments) ||
    installments.some(
      (item: any) =>
        item.status === "MISSED"
    );

  const currentMonthInstallment =
    raw.currentMonthInstallment ||
    null;

  const nextInstallment =
    raw.nextInstallment ||
    currentMonthInstallment ||
    installments.find(
      (item: any) =>
        item.status !== "PAID"
    ) ||
    null;

  const isPaidThisMonth =
    Boolean(raw.isPaidThisMonth) ||
    currentMonthInstallment?.status ===
      "PAID";

  const canPayOnline =
    Boolean(raw.canPayOnline);

  const lastPayment =
    raw.paymentHistory?.[0] ||
    raw.PaymentHistory?.[0] ||
    null;

  const lastPaymentDate =
    raw.lastPaymentDate ||
    lastPayment?.paidAt ||
    null;

  const nextDueDate =
    raw.nextDueDate ||
    currentMonthInstallment?.dueDate ||
    nextInstallment?.dueDate ||
    null;

  const amountDue = Number(
    currentMonthInstallment?.amount ??
      nextInstallment?.amount ??
      installmentAmount
  );

  const currentInstallmentNumber =
    Number(
      currentMonthInstallment
        ?.installmentNumber ??
        nextInstallment
          ?.installmentNumber ??
        installmentsPaid + 1
    );

  let paymentMessage = "";

  if (isCompleted) {
    paymentMessage =
      "This scheme has been completed.";
  } else if (hasMissedInstallments) {
    paymentMessage =
      "A previous installment is missed. Please visit the store to clear it before continuing online payments.";
  } else if (isPaidThisMonth) {
    paymentMessage =
      "This month's installment is already paid.";
  } else if (canPayOnline) {
    paymentMessage =
      nextDueDate
        ? `Payment window is open until ${formatDate(
            nextDueDate
          )}.`
        : "Payment window is open.";
  } else if (nextDueDate) {
    paymentMessage =
      `Next payment due by ${formatDate(
        nextDueDate
      )}.`;
  } else {
    paymentMessage =
      "Payment is not available yet.";
  }

  return {
    duration,
    installments,
    installmentAmount,

    lastPaymentDate:
      formatDate(lastPaymentDate),

    nextDueDate:
      formatDate(nextDueDate),

    amountDue,

    isCompleted,

    isPayable:
      canPayOnline,

    isDue:
      !isCompleted,

    canPayOnline,

    hasMissedInstallments,

    isPaidThisMonth,

    currentMonthInstallment,

    nextInstallment,

    currentInstallmentNumber,

    paymentMessage,

    lastPaymentGrams:
      Number(
        lastPayment?.gramsAdded || 0
      ),
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

  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const details = getSchemeDetails(scheme);

  const progress =
    ((scheme.installmentsPaid || 0) /
      details.duration) *
    100;

  // SAFE ACCESSIBILITY HOOKS: Focus trapping & accessibility without crashing
  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement;
    
    // Safely focus the modal container or close button on mount
    if (dialogRef.current) {
      const closeBtn = dialogRef.current.querySelector('button[aria-label="Close Scheme Ledger"]') as HTMLElement;
      if (closeBtn) {
        closeBtn.focus();
      } else {
        dialogRef.current.focus();
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab" && dialogRef.current) {
        const focusableEls = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([-1])'
        );
        if (focusableEls.length === 0) return;

        const firstEl = focusableEls[0];
        const lastEl = focusableEls[focusableEls.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            lastEl.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastEl) {
            firstEl.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (triggerRef.current) {
        triggerRef.current.focus();
      }
    };
  }, [onClose]);

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
          monthlyAmount={details.installmentAmount}
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
          {/* ACCESSIBILITY FIX: Semantic dialog roles and relationship mapping */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-scheme-title"
            tabIndex={-1}
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
            className="glass-card rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-0 outline-none"
            style={{
              boxShadow:
                "0 30px 80px -20px hsla(30, 30%, 15%, 0.25), 0 0 0 1px hsla(38, 60%, 55%, 0.2)",
            }}
          >
            <div className="relative p-8 pb-4">
              {/* ACCESSIBILITY FIX: Screen reader friendly label string */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close Scheme Ledger"
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-pearl/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-pearl transition-colors focus:outline-none focus:ring-2 focus:ring-gold"
              >
                <X className="w-5 h-5" />
              </button>

              <p className="font-elegant text-sm tracking-[0.2em] uppercase text-gold-dark mb-2">
                Scheme Ledger
              </p>

              {/* ACCESSIBILITY FIX: Tied explicitly to dialog header lookup tag */}
              <h3 id="modal-scheme-title" className="font-display text-2xl font-bold text-foreground">
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
                {details.duration}{" "}
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
                    details.installmentAmount
                  )}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gold/5 border border-gold/15">
                <p className="font-body text-xs text-muted-foreground mb-1">
                  {getSchemeCategory(
                    scheme
                  ) === "SILVER"
                    ? "Silver Accumulated"
                    : getSchemeCategory(
                        scheme
                      ) === "GOLD"
                    ? "Gold Accumulated"
                    : "Cash Saved"}
                </p>

                <p className="font-display text-lg font-bold text-gold-gradient">
                  {getAccumulationValue(
                    scheme
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

              {/* ACCESSIBILITY FIX: Structured sequence within ordered list components */}
              <ol className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {details.installments.map(
                  (item: any) => {
                    const status =
                      String(
                        item.status || ""
                      ).toUpperCase();

                    const isPaid =
                      status === "PAID";

                    const isMissed =
                      status === "MISSED";

                    return (
                      <li
                        key={
                          item.id ||
                          item.installmentNumber
                        }
                        className="flex items-center gap-3"
                      >
                        {isPaid ? (
                          <CheckCircle2 className="w-4 h-4 text-gold-dark flex-shrink-0" />
                        ) : isMissed ? (
                          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        ) : (
                          <Clock className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                        )}

                        <div className="min-w-0">
                          <span className="font-body text-xs block">
                            Month{" "}
                            {
                              item.installmentNumber
                            }
                          </span>

                          <span className="font-body text-[11px] text-muted-foreground">
                            Last date:{" "}
                            {formatDate(
                              item.dueDate
                            )}
                          </span>
                        </div>

                        <span
                          className={`ml-auto text-xs font-semibold ${
                            isPaid
                              ? "text-emerald"
                              : isMissed
                              ? "text-red-500"
                              : "text-muted-foreground"
                          }`}
                        >
                          {isPaid
                            ? "Paid"
                            : isMissed
                            ? "Missed"
                            : "Upcoming"}
                        </span>
                      </li>
                    );
                  }
                )}
              </ol>
            </div>

            {details.isDue && (
              <div className="px-8 pb-8">
                <div
                  className={`mb-3 rounded-xl px-4 py-3 text-sm ${
                    details.hasMissedInstallments
                      ? "bg-red-50 border border-red-200 text-red-700"
                      : details.canPayOnline
                      ? "bg-gold/5 border border-gold/20 text-foreground"
                      : "bg-pearl border border-gold/10 text-muted-foreground"
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {details.paymentMessage}
                </div>

                <button
                  type="button"
                  disabled={
                    !details.canPayOnline
                  }
                  onClick={() => {
                    setPaymentMonth(
                      Math.max(
                        0,
                        details.currentInstallmentNumber -
                          1
                      )
                    );

                    setIsPaying(true);
                  }}
                  className={`w-full text-base py-3.5 rounded-xl font-bold transition-all ${
                    details.canPayOnline
                      ? "btn-gold btn-gold-pulse"
                      : "bg-pearl border border-gold/20 text-muted-foreground/50 cursor-not-allowed"
                  }`}
                >
                  {details.canPayOnline
                    ? `Pay Now — ${formatINR(
                        details.amountDue
                      )}`
                    : details.hasMissedInstallments
                    ? "Visit Store to Clear Missed Payment"
                    : details.isPaidThisMonth
                    ? "This Month Paid"
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

  const [selectedCategory, setSelectedCategory] =
    useState<SchemeCategory>("GOLD");

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
    enrolledSchemes.filter(
      (scheme) =>
        getSchemeCategory(scheme) ===
        selectedCategory
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

            <p className="font-body text-lg text-muted-foreground mb-10">
              Your scheme dashboard
            </p>
          </motion.div>

          <div className="mb-8">
            <div
              className="flex flex-wrap gap-3"
              role="tablist"
              aria-label="Scheme Categories"
            >
              <button
                role="tab"
                id="tab-gold"
                aria-selected={
                  selectedCategory ===
                  "GOLD"
                }
                aria-controls="scheme-tab-panel"
                onClick={() =>
                  setSelectedCategory(
                    "GOLD"
                  )
                }
                className={`px-5 py-2 rounded-xl font-semibold transition-all ${
                  selectedCategory ===
                  "GOLD"
                    ? "btn-gold"
                    : "bg-pearl border border-gold/20"
                }`}
              >
                ✦ Gold Schemes
              </button>

              <button
                role="tab"
                id="tab-silver"
                aria-selected={
                  selectedCategory ===
                  "SILVER"
                }
                aria-controls="scheme-tab-panel"
                onClick={() =>
                  setSelectedCategory(
                    "SILVER"
                  )
                }
                className={`px-5 py-2 rounded-xl font-semibold transition-all ${
                  selectedCategory ===
                  "SILVER"
                    ? "btn-gold"
                    : "bg-pearl border border-gold/20"
                }`}
              >
                ◇ Silver Schemes
              </button>

              <button
                role="tab"
                id="tab-cash"
                aria-selected={
                  selectedCategory ===
                  "CASH"
                }
                aria-controls="scheme-tab-panel"
                onClick={() =>
                  setSelectedCategory(
                    "CASH"
                  )
                }
                className={`px-5 py-2 rounded-xl font-semibold transition-all ${
                  selectedCategory ===
                  "CASH"
                    ? "btn-gold"
                    : "bg-pearl border border-gold/20"
                }`}
              >
                ₹ Cash Schemes
              </button>
            </div>
          </div>

          {filteredSchemes.length === 0 ? (
            <div id="scheme-tab-panel" role="tabpanel" aria-labelledby={
              selectedCategory === "GOLD"
                ? "tab-gold"
                : selectedCategory ===
                  "SILVER"
                ? "tab-silver"
                : "tab-cash"
            } className="glass-card rounded-2xl p-8 text-center">
              <p className="font-body text-muted-foreground mb-4">
                {selectedCategory === "GOLD"
                  ? "No gold schemes available"
                  : selectedCategory ===
                    "SILVER"
                  ? "No silver schemes available"
                  : "No cash schemes available"}
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
            <div id="scheme-tab-panel" role="tabpanel" aria-labelledby={
              selectedCategory === "GOLD"
                ? "tab-gold"
                : selectedCategory ===
                  "SILVER"
                ? "tab-silver"
                : "tab-cash"
            } className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSchemes.map(
                (scheme, i) => {
                  const details =
                    getSchemeDetails(
                      scheme
                    );

                  const progress =
                    ((scheme.installmentsPaid ||
                      0) /
                      details.duration) *
                    100;

                  const isCompleted =
                    details.isCompleted;

                  return (
                    <motion.div
                      key={scheme.id}
                      initial={{
                        opacity: 0,
                        y: 20,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0
                      }}
                      transition={{
                        delay: i * 0.1,
                      }}
                      className="space-y-3"
                    >
                      {/* ACCESSIBILITY FIX: Switched from plain div to button context for semantic interaction */}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedScheme(
                            scheme
                          )
                        }
                        aria-haspopup="dialog"
                        aria-label={`Scheme Summary: ${scheme.name}, ${formatINR(details.installmentAmount)} per month, ${scheme.installmentsPaid} of ${details.duration} installments paid. Status: ${isCompleted ? "Completed" : details.hasMissedInstallments ? "Missed payment pending" : "Active"}. Activate to view full scheme ledger.`}
                        className="w-full text-left glass-card rounded-2xl p-6 relative overflow-hidden group cursor-pointer hover:border-gold/40 transition-all duration-300 block focus:outline-none focus:ring-2 focus:ring-gold/50"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-display text-lg font-bold text-foreground">
                            {scheme.name}
                          </h3>

                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-body font-semibold border ${
                              isCompleted
                                ? "bg-emerald/10 text-emerald border-emerald/20"
                                : details.hasMissedInstallments
                                ? "bg-red-50 text-red-600 border-red-200"
                                : "bg-gold/10 text-gold-dark border-gold/20"
                            }`}
                          >
                            {isCompleted
                              ? "Completed"
                              : details.hasMissedInstallments
                              ? "Payment Pending"
                              : "Active"}
                          </span>
                        </div>

                        <p className="font-body text-sm text-muted-foreground mb-1">
                          {formatINR(
                            details.installmentAmount
                          )}
                          /month •{" "}
                          {
                            scheme.installmentsPaid
                          }
                          /
                          {
                            details.duration
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
                      </button>

                      <div className="rounded-2xl p-5 bg-[#2E2118] border border-gold/20">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0">
                            {getSchemeCategory(
                              scheme
                            ) === "CASH" ? (
                              <Wallet className="w-6 h-6 text-gold-dark" />
                            ) : (
                              <Scale className="w-6 h-6 text-gold-dark" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gold-dark/70 uppercase tracking-wider mb-0.5">
                              {getAccumulationLabel(
                                scheme
                              )}
                            </p>

                            {/* FIXED: Switched from an h3 to a simple semantic paragraph wrapper to fix the navigation issue */}
                            <p className="font-display text-2xl font-bold text-gold-gradient-shine">
                              {getAccumulationValue(
                                scheme
                              )}
                            </p>

                            {getSchemeCategory(
                              scheme
                            ) !== "CASH" &&
                              details.lastPaymentGrams > 0 && (
                                <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gold/10 w-fit">
                                  <span className="text-gold-dark text-xs">
                                    ↑
                                  </span>

                                  <span className="text-xs text-gold-dark/90 font-medium">
                                    Last payment: +
                                    {details.lastPaymentGrams.toFixed(
                                      3
                                    )}{" "}
                                    g
                                  </span>
                                </div>
                              )}
                          </div>

                          <div className="px-3 py-1 rounded-full bg-gold/10 text-gold-dark text-xs font-semibold flex-shrink-0">
                            {getSchemeTypeLabel(
                              scheme
                            )}
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
