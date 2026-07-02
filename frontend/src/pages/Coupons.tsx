import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Copy, CheckCircle2, History, Scale } from "lucide-react";
import Layout from "@/components/Layout";
import GoldDustParticles from "@/components/GoldDustParticles";
import { useAuth } from "@/contexts/AuthContext";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://suvarna-jewellers-customer-backend.vercel.app";

interface Coupon {
  id: string;
  code: string;
  isUsed: boolean;
  isActive: boolean;
  totalCashValue: number;
  totalWeightGrams: number;
  createdAt: string;
  usedAt?: string;
  Scheme?: {
    name: string;
    isWeightBased: boolean;
    durationMonths: number;
    monthlyAmount: number;
  };
  CustomerScheme?: {
    totalPaid: number;
    accumulatedGrams: number;
    isCompleted: boolean;
  };
}

const formatINR = (n: number) => "₹" + (n || 0).toLocaleString("en-IN");

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${d.getDate().toString().padStart(2, "0")}-${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${d.getFullYear()}`;
};

const CouponCard = ({ coupon, isActive }: { coupon: Coupon; isActive: boolean }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(coupon.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isWeightBased = coupon.Scheme?.isWeightBased ?? false;
  const schemeName = coupon.Scheme?.name ?? "Scheme";
  const durationMonths = coupon.Scheme?.durationMonths ?? 0;
  const monthlyAmount = coupon.Scheme?.monthlyAmount ?? 0;
  const totalPaid = coupon.CustomerScheme?.totalPaid ?? 0;
  const accumulatedGrams = coupon.CustomerScheme?.accumulatedGrams ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl overflow-hidden"
      style={{
        boxShadow: isActive
          ? "var(--shadow-luxury), 0 0 0 1px hsla(43,80%,55%,0.2)"
          : "var(--shadow-card)",
      }}
    >
      {/* Top section */}
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="font-elegant text-xs tracking-[0.2em] uppercase text-gold-dark mb-1">
              {schemeName}
            </p>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-body font-semibold border ${
              isActive
                ? "bg-gold/10 text-gold-dark border-gold/20"
                : "bg-muted/40 text-muted-foreground border-border/50"
            }`}>
              {isActive ? "Active" : "Redeemed"}
            </span>
          </div>
          <div className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: isActive ? "hsla(43,80%,55%,0.1)" : "hsla(0,0%,50%,0.1)" }}>
            <Gift className={`w-5 h-5 ${isActive ? "text-gold-dark" : "text-muted-foreground"}`} />
          </div>
        </div>

        {/* Value display */}
        <div className="p-4 rounded-xl mb-4" style={{ background: "hsla(38,40%,88%,0.5)" }}>
          {isWeightBased ? (
            <div className="flex items-center justify-center gap-2">
              <Scale className="w-4 h-4 text-gold-dark" />
              <span className="font-display text-2xl font-bold text-foreground">
                {accumulatedGrams.toFixed(3)}g
              </span>
              <span className="font-body text-sm text-muted-foreground">gold accumulated</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <span className="font-display text-2xl font-bold text-gold-gradient">
                {formatINR(coupon.totalCashValue)}
              </span>
              <span className="font-body text-sm text-muted-foreground">redeemable value</span>
            </div>
          )}
        </div>

        {/* Info chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { label: `${durationMonths} months` },
            { label: `${formatINR(monthlyAmount)}/mo` },
            { label: `${formatINR(totalPaid)} paid` },
          ].map((chip) => (
            <span
              key={chip.label}
              className="px-3 py-1 rounded-full font-body text-xs text-muted-foreground"
              style={{ background: "hsla(38,40%,88%,0.6)", border: "1px solid hsla(38,40%,70%,0.3)" }}
            >
              {chip.label}
            </span>
          ))}
        </div>

        {/* Redeemed date */}
        {!isActive && coupon.usedAt && (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-body text-xs text-emerald-600">
              Redeemed on {formatDate(coupon.usedAt)}
            </span>
          </div>
        )}
      </div>

      {/* Dashed divider + coupon code — only for active */}
      {isActive && (
        <>
          <div className="mx-6 flex gap-1">
            {Array.from({ length: 28 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 h-px"
                style={{ background: i % 2 === 0 ? "hsla(43,80%,55%,0.35)" : "transparent" }}
              />
            ))}
          </div>
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="font-body text-xs text-muted-foreground mb-0.5">Coupon Code</p>
              <p className="font-display text-base font-bold text-gold-dark tracking-widest">
                {coupon.code}
              </p>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-body text-xs font-semibold text-white transition-all duration-300"
              style={{ background: copied ? "hsla(142,60%,40%,0.9)" : "var(--gradient-gold)" }}
            >
              {copied ? (
                <><CheckCircle2 className="w-3.5 h-3.5" /> Copied!</>
              ) : (
                <><Copy className="w-3.5 h-3.5" /> Copy</>
              )}
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
};

const Coupons = () => {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "redeemed">("active");

  useEffect(() => {
    const fetchCoupons = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const res = await fetch(`${API_URL}/api/coupons/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setCoupons(data.coupons || []);
        }
      } catch (err) {
        console.error("Coupons fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCoupons();
  }, []);

  const activeCoupons = coupons.filter(
    (c) => c.CustomerScheme?.isCompleted && !c.isUsed
  );
  const redeemedCoupons = coupons.filter((c) => c.isUsed);

  const displayed = activeTab === "active" ? activeCoupons : redeemedCoupons;

  if (loading) {
    return (
      <Layout>
        <div className="h-screen flex items-center justify-center bg-pearl">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="font-elegant text-gold-dark italic">Loading your coupons...</p>
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
        <div className="absolute top-0 left-0 right-0 h-48" style={{
          background: "linear-gradient(180deg, hsla(38, 40%, 75%, 0.08) 0%, transparent 100%)",
        }} />
        <div className="absolute top-0 left-0 right-0 gold-divider" />
        <GoldDustParticles />

        <div className="relative z-10 max-w-3xl mx-auto">
          {/* Page header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-10"
          >
            <p className="font-elegant text-sm tracking-[0.2em] uppercase text-gold-dark mb-2">
              Rewards
            </p>
            <h1 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-2">
              My <span className="text-gold-gradient-shine">Coupons</span>
            </h1>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="h-0.5 w-20 mt-3 origin-left"
              style={{ background: "var(--gradient-gold)" }}
            />
          </motion.div>

          {/* Tab switcher */}
          <div
            className="flex p-1 rounded-2xl mb-8 w-fit"
            style={{ background: "hsla(38,40%,88%,0.6)", border: "1px solid hsla(38,40%,70%,0.3)" }}
          >
            {(["active", "redeemed"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="relative px-8 py-2.5 rounded-xl font-body text-sm font-semibold transition-all duration-300 capitalize"
                style={{
                  color: activeTab === tab ? "white" : "hsl(28, 25%, 35%)",
                }}
              >
                {activeTab === tab && (
                  <motion.div
                    layoutId="coupon-tab"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: "var(--gradient-gold)" }}
                    transition={{ type: "spring", damping: 20, stiffness: 300 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {tab === "active" ? (
                    <><Gift className="w-3.5 h-3.5" /> Active
                      {activeCoupons.length > 0 && (
                        <span className="bg-white/30 text-white text-xs px-1.5 py-0.5 rounded-full">
                          {activeCoupons.length}
                        </span>
                      )}
                    </>
                  ) : (
                    <><History className="w-3.5 h-3.5" /> Redeemed</>
                  )}
                </span>
              </button>
            ))}
          </div>

          {/* Coupon list */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {displayed.length === 0 ? (
                <div className="glass-card rounded-2xl p-12 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
                  {activeTab === "active" ? (
                    <Gift className="w-12 h-12 text-gold/40 mx-auto mb-4" />
                  ) : (
                    <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  )}
                  <p className="font-display text-lg font-semibold text-foreground mb-2">
                    {activeTab === "active" ? "No active coupons yet" : "No redeemed coupons yet"}
                  </p>
                  {activeTab === "active" && (
                    <p className="font-body text-sm text-muted-foreground">
                      Complete a scheme to earn your coupon
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {displayed.map((coupon, i) => (
                    <motion.div
                      key={coupon.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                    >
                      <CouponCard coupon={coupon} isActive={activeTab === "active"} />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </Layout>
  );
};

export default Coupons;