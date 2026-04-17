import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles, Check } from "lucide-react";
import Layout from "@/components/Layout";
import GoldDustParticles from "@/components/GoldDustParticles";
import PaymentModal from "@/components/PaymentModal";

const formatINR = (n: number = 0) =>
  "₹" + n.toLocaleString("en-IN");

const ProgressArc = ({ paidMonths, totalMonths }: { paidMonths: number; totalMonths: number }) => {
  const pct = (paidMonths / totalMonths) * 100;
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="relative">
      <div className="absolute inset-0 rounded-full" style={{
        background: 'radial-gradient(circle, hsla(43, 80%, 55%, 0.15) 0%, transparent 70%)',
        filter: 'blur(8px)',
        transform: 'scale(1.4)',
      }} />
      <svg width="100" height="100" viewBox="0 0 100 100" className="mx-auto relative z-10">
        <circle cx="50" cy="50" r={r} fill="none" stroke="hsla(38,40%,70%,0.2)" strokeWidth="6" />
        <motion.circle
          cx="50" cy="50" r={r}
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
        <text x="50" y="50" textAnchor="middle" dy="0.35em" className="font-display text-sm font-bold" fill="hsl(28, 25%, 15%)">
          {paidMonths}/{totalMonths}
        </text>
      </svg>
    </div>
  );
};

const Schemes = () => {
  const { isLoggedIn, enrollScheme, enrolledSchemes } = useAuth();
  const navigate = useNavigate();
  
  // 1. Dynamic state for database schemes
  const [dbSchemes, setDbSchemes] = useState<any[]>([]);
  const [paymentScheme, setPaymentScheme] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // 2. Fetch all schemes from your Vercel API
  useEffect(() => {
    const fetchAllSchemes = async () => {
      try {
        const res = await fetch("https://suvarnagold-16e5.vercel.app/api/schemes/all");
        if (res.ok) {
          const data = await res.json();
          setDbSchemes(data.schemes || []);
        }
      } catch (err) {
        console.error("Failed to fetch royal schemes:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllSchemes();
  }, []);

  const handleEnroll = (scheme: any) => {
    if (!isLoggedIn) {
      navigate("/login");
      return;
    }
    setPaymentScheme(scheme);
  };

  const handlePaymentSuccess = async () => {
    if (paymentScheme) {
      window.dispatchEvent(new Event("schemeUpdated"));

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
            <p className="font-elegant italic text-gold-dark">Loading Royal Collections...</p>
          </div>
        </div>
      </Layout>
    );
  }

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
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-8">
            <p className="font-elegant text-base tracking-[0.3em] uppercase text-gold-dark mb-3">Investment Plans</p>
            <h1 className="font-display text-4xl md:text-6xl font-bold text-foreground mb-4">
              <span className="text-gold-gradient-shine">Golden</span> Savings Plans
            </h1>
            <p className="font-elegant text-xl text-muted-foreground italic">Invest today. Adorn tomorrow.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {dbSchemes.map((scheme, index) => {
              // Compare IDs to see if already enrolled
              const isEnrolled = enrolledSchemes.some((s) => s.name === scheme.name);
              
              return (
                <motion.div
                  key={scheme.id}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.15 }}
                  className="glass-card rounded-3xl p-8 flex flex-col items-center text-center spotlight relative overflow-hidden group"
                  style={{ boxShadow: 'var(--shadow-luxury)' }}
                >
                  <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                    style={{ background: 'linear-gradient(135deg, transparent 20%, hsla(43,80%,60%,0.12) 50%, transparent 80%)' }} />

                  {/* Mock progress for display purpose */}
                  <ProgressArc paidMonths={0} totalMonths={scheme.durationMonths} />

                  <h3 className="font-display text-xl font-bold text-foreground mt-4 mb-2">{scheme.name}</h3>

                  <div className="mb-4">
                    <span className="font-display text-3xl font-bold text-gold-gradient">{formatINR(scheme.monthlyAmount)}</span>
                    <span className="font-body text-sm text-muted-foreground">/month</span>
                  </div>

                  <div className="space-y-2 mb-6 w-full">
                    <div className="flex items-center gap-2 font-body text-sm text-foreground">
                      <Check className="w-4 h-4 text-gold-dark" /> {scheme.durationMonths} monthly installments
                    </div>
                    <div className="flex items-center gap-2 font-body text-sm text-foreground text-left">
                      <Sparkles className="w-4 h-4 text-gold-dark" /> Get Maturity Value: {formatINR(scheme.monthlyAmount * scheme.durationMonths)}
                    </div>
                  </div>

                  {isEnrolled ? (
                    <div className="btn-gold w-full text-center py-3.5 opacity-80 cursor-default flex items-center justify-center gap-2">
                      <Check className="w-4 h-4" /> Enrolled
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEnroll(scheme)}
                      className="btn-gold btn-gold-pulse w-full text-base py-3.5"
                    >
                      Enroll Now
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

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