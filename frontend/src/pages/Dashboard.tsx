import { motion, AnimatePresence } from "framer-motion";
import { useAuth, Scheme } from "@/contexts/AuthContext";
import { Calendar, Sparkles, X, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import GoldDustParticles from "@/components/GoldDustParticles";
import { useState, useEffect } from "react";

const formatINR = (n: number) => "₹" + (n || 0).toLocaleString("en-IN");
const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://suvarna-jewellers-customer-backend.vercel.app";
const getSchemeDetails = (scheme: Scheme) => {
  const enrolledDate = new Date(scheme.enrolledDate || Date.now());
  const lastPaymentDate = new Date(enrolledDate);
  lastPaymentDate.setMonth(lastPaymentDate.getMonth() + (scheme.installmentsPaid || 1) - 1);

  const nextDueDate = new Date(enrolledDate);
  nextDueDate.setMonth(nextDueDate.getMonth() + (scheme.installmentsPaid || 1));

  const isCompleted = (scheme.installmentsPaid || 0) >= (scheme.durationMonths || 1);
  const isDue = !isCompleted;

  return {
    lastPaymentDate: lastPaymentDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    nextDueDate: nextDueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    amountDue: scheme.monthlyAmount,
    isCompleted,
    isDue,
  };
};

const SchemeDetailModal = ({ scheme, onClose }: { scheme: Scheme; onClose: () => void }) => {
  const details = getSchemeDetails(scheme);
  const progress = ((scheme.installmentsPaid || 0) / (scheme.durationMonths || 1)) * 100;

  return (
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
        className="glass-card rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-0"
        style={{ boxShadow: '0 30px 80px -20px hsla(30, 30%, 15%, 0.25), 0 0 0 1px hsla(38, 60%, 55%, 0.2)' }}
      >
        {/* Header */}
        <div className="relative p-8 pb-4">
          <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-pearl/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-pearl transition-colors">
            <X className="w-5 h-5" />
          </button>
          <p className="font-elegant text-sm tracking-[0.2em] uppercase text-gold-dark mb-2">Scheme Ledger</p>
          <h3 className="font-display text-2xl font-bold text-foreground">{scheme.name}</h3>
          <div className="mt-1">
            <span className={`px-3 py-1 rounded-full text-xs font-body font-semibold border ${
              details.isCompleted
                ? "bg-emerald/10 text-emerald border-emerald/20"
                : "bg-gold/10 text-gold-dark border-gold/20"
            }`}>
              {details.isCompleted ? "Completed" : "Active"}
            </span>
          </div>
        </div>

        {/* Progress */}
        <div className="px-8 pb-6">
          <div className="w-full h-3 rounded-full bg-cream overflow-hidden mb-2">
            <motion.div
              className="h-full rounded-full relative overflow-hidden"
              style={{ background: 'var(--gradient-gold)' }}
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            >
              <div className="absolute inset-0" style={{
                background: 'linear-gradient(90deg, transparent, hsla(40, 40%, 97%, 0.4), transparent)',
                animation: 'light-sweep 3s ease-in-out infinite',
              }} />
            </motion.div>
          </div>
          <p className="font-body text-sm text-muted-foreground text-center">
            {scheme.installmentsPaid} of {scheme.durationMonths} installments completed
          </p>
        </div>

        {/* Details grid */}
        <div className="px-8 pb-6 grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-gold/5 border border-gold/15">
            <p className="font-body text-xs text-muted-foreground mb-1">Monthly Amount</p>
            <p className="font-display text-lg font-bold text-gold-gradient">{formatINR(scheme.monthlyAmount)}</p>
          </div>
          <div className="p-4 rounded-xl bg-gold/5 border border-gold/15">
            <p className="font-body text-xs text-muted-foreground mb-1">Gold Accumulated</p>
            <p className="font-display text-lg font-bold text-gold-gradient">{formatINR(scheme.monthlyAmount * scheme.installmentsPaid)}</p>
          </div>
          <div className="p-4 rounded-xl bg-gold/5 border border-gold/15">
            <p className="font-body text-xs text-muted-foreground mb-1">Last Payment</p>
            <p className="font-body text-sm font-semibold text-foreground">{details.lastPaymentDate}</p>
          </div>
          <div className="p-4 rounded-xl bg-gold/5 border border-gold/15">
            <p className="font-body text-xs text-muted-foreground mb-1">{details.isCompleted ? "Completed On" : "Next Due"}</p>
            <p className="font-body text-sm font-semibold text-foreground">{details.isCompleted ? details.lastPaymentDate : details.nextDueDate}</p>
          </div>
        </div>

        {/* Payment timeline */}
        <div className="px-8 pb-6">
          <p className="font-display text-sm font-semibold text-foreground mb-3">Payment Timeline</p>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
            {Array.from({ length: scheme.durationMonths }, (_, i) => {
              const isPaid = i < scheme.installmentsPaid;
              const isCurrent = i === scheme.installmentsPaid;
              return (
                <div key={i} className="flex items-center gap-3">
                  {isPaid ? (
                    <CheckCircle2 className="w-4 h-4 text-gold-dark flex-shrink-0" />
                  ) : isCurrent ? (
                    <AlertCircle className="w-4 h-4 text-gold flex-shrink-0 animate-glow-pulse" />
                  ) : (
                    <Clock className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                  )}
                  <span className={`font-body text-xs ${isPaid ? "text-foreground" : isCurrent ? "text-gold-dark font-semibold" : "text-muted-foreground/50"}`}>
                    Month {i + 1} — {formatINR(scheme.monthlyAmount)}
                  </span>
                  <span className={`ml-auto font-body text-xs ${isPaid ? "text-gold-dark" : isCurrent ? "text-gold-dark" : "text-muted-foreground/40"}`}>
                    {isPaid ? "Paid" : isCurrent ? "Due" : "Upcoming"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pay Now CTA */}
        {details.isDue && (
          <div className="px-8 pb-8">
            <div className="p-4 rounded-xl border border-gold/20 mb-4" style={{ background: 'hsla(43, 80%, 55%, 0.05)' }}>
              <p className="font-body text-sm text-foreground text-center">
                Amount Due: <span className="font-display font-bold text-gold-gradient">{formatINR(details.amountDue)}</span>
              </p>
            </div>
            <button className="btn-gold btn-gold-pulse w-full text-base py-3.5">
              Pay Now
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

const Dashboard = () => {
  const { user, enrolledSchemes, setEnrolledSchemes, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [selectedScheme, setSelectedScheme] = useState<Scheme | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
  const fetchSchemes = async () => {
    try {
      const res = await fetch(`${API_URL}/api/schemes/my`, {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        console.log("Dashboard schemes raw:", data.schemes);

        const formatted = data.schemes.map((s: any) => ({
          id: s.id,
          name: s.Scheme?.name || "Active Scheme",
          monthlyAmount: s.totalPaid || s.Scheme?.monthlyAmount || 0,
          durationMonths: s.Scheme?.durationMonths || 11,
          enrolledDate: s.startDate,
          installmentsPaid: s.installmentsPaid,
        }));

        setEnrolledSchemes(formatted);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setFetching(false);
    }
  };

  if (user) {
    fetchSchemes();
  }

  window.addEventListener("schemeUpdated", fetchSchemes);

  return () => {
    window.removeEventListener("schemeUpdated", fetchSchemes);
  };
}, [user, setEnrolledSchemes]);

  // Prevent crashes while data is loading
  if (authLoading || fetching) {
    return (
      <Layout>
        <div className="h-screen flex items-center justify-center bg-pearl">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="font-elegant text-gold-dark italic">Opening Suvarna Treasury...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const hasDuePayments = enrolledSchemes.length > 0 && enrolledSchemes.some(
    (s) => (s.installmentsPaid || 0) < (s.durationMonths || 1)
  );

  return (
    <Layout>
      <section className="pt-32 pb-28 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cream via-pearl to-ivory" />
        <div className="absolute inset-0" style={{ background: 'var(--gradient-spotlight)' }} />
        <div className="absolute top-0 left-0 right-0 h-48" style={{
          background: 'linear-gradient(180deg, hsla(38, 40%, 75%, 0.08) 0%, transparent 100%)',
        }} />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30z' fill='none' stroke='%23b8860b' stroke-width='0.5'/%3E%3C/svg%3E")`,
        }} />
        <div className="absolute top-0 left-0 right-0 gold-divider" />
        <GoldDustParticles />

        <div className="relative z-10 max-w-6xl mx-auto">
          {/* Welcome section with Velvet Spotlight logic restored */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="relative">
            <div className="absolute -top-16 left-0 w-96 h-48 pointer-events-none" style={{
              background: 'radial-gradient(ellipse at 30% 50%, hsla(43, 70%, 55%, 0.1) 0%, transparent 70%)',
              filter: 'blur(30px)',
            }} />
            <h1 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-2 relative">
              Welcome, <span className="text-gold-gradient-shine">{user?.name || "Member"}</span>
            </h1>
            <p className="font-elegant text-lg text-muted-foreground italic mb-3 relative">Your scheme control room</p>
            <p className="font-elegant text-sm text-gold-dark/70 italic mb-12 relative">
              "Every gram you save today becomes tomorrow's celebration."
            </p>
          </motion.div>

          {hasDuePayments && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card rounded-2xl p-4 mb-8 flex items-center gap-3 border-gold/30"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <div className="w-2.5 h-2.5 rounded-full animate-glow-pulse flex-shrink-0" style={{ background: 'hsl(var(--gold))' }} />
              <p className="font-body text-sm text-foreground">
                You have installments due. Tap a scheme to view details and pay.
              </p>
            </motion.div>
          )}

          {/* Temple Divider Sparkle strip restored */}
          {enrolledSchemes.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex items-center justify-center gap-3 mb-8">
              <div className="h-px flex-1 max-w-24" style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--gold-light)))' }} />
              <Sparkles className="w-4 h-4 text-gold-dark animate-glow-pulse" />
              <p className="font-elegant text-sm text-gold-dark/80 italic tracking-wide">Your Active Schemes</p>
              <Sparkles className="w-4 h-4 text-gold-dark animate-glow-pulse" />
              <div className="h-px flex-1 max-w-24" style={{ background: 'linear-gradient(90deg, hsl(var(--gold-light)), transparent)' }} />
            </motion.div>
          )}

          <div className="relative mb-6">
            <h2 className="font-display text-2xl font-bold text-foreground">Your Schemes</h2>
            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, delay: 0.4 }} className="h-0.5 w-24 mt-2 origin-left" style={{ background: 'var(--gradient-gold)' }} />
          </div>

          {enrolledSchemes.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center" style={{ boxShadow: 'var(--shadow-card)' }}>
              <p className="font-body text-muted-foreground mb-4">You haven't enrolled in any schemes yet.</p>
              <button onClick={() => navigate("/schemes")} className="btn-gold text-sm px-8 py-3">Explore Schemes</button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {enrolledSchemes.map((scheme, i) => {
                const progress = ((scheme.installmentsPaid || 0) / (scheme.durationMonths || 1)) * 100;
                const isCompleted = scheme.installmentsPaid >= scheme.durationMonths;
                return (
                  <motion.div
                    key={scheme.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                    onClick={() => setSelectedScheme(scheme)}
                    className="glass-card rounded-2xl p-6 relative overflow-hidden group cursor-pointer hover:border-gold/40 transition-all duration-300"
                    style={{ boxShadow: 'var(--shadow-card)' }}
                  >
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                      style={{ background: 'linear-gradient(135deg, transparent, hsla(43,80%,60%,0.06), transparent)' }} />
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-display text-lg font-bold text-foreground">{scheme.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-body font-semibold border ${isCompleted ? "bg-emerald/10 text-emerald border-emerald/20" : "bg-gold/10 text-gold-dark border-gold/20"}`}>
                        {isCompleted ? "Completed" : "Active"}
                      </span>
                    </div>
                    <p className="font-body text-sm text-muted-foreground mb-1">{formatINR(scheme.monthlyAmount)}/month • {scheme.installmentsPaid}/{scheme.durationMonths} paid</p>
                    <p className="font-body text-sm text-muted-foreground mb-3">Gold saved: <span className="font-semibold text-gold-gradient">{formatINR(scheme.monthlyAmount * scheme.installmentsPaid)}</span></p>
                    <div className="w-full h-2 rounded-full bg-cream overflow-hidden">
                      <motion.div className="h-full rounded-full" style={{ background: 'var(--gradient-gold)' }} initial={{ width: "0%" }} animate={{ width: `${progress}%` }} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        <AnimatePresence>
          {selectedScheme && <SchemeDetailModal scheme={selectedScheme} onClose={() => setSelectedScheme(null)} />}
        </AnimatePresence>
      </section>
    </Layout>
  );
};

export default Dashboard;