import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import GoldDustParticles from "@/components/GoldDustParticles";
import { Sparkles } from "lucide-react";

const formatINR = (n: number) => "₹" + n.toLocaleString("en-IN");

const MySchemes = () => {
  const { enrolledSchemes } = useAuth();
  const navigate = useNavigate();

  return (
    <Layout>
      <section className="pt-32 pb-28 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cream via-pearl to-ivory" />
        <div className="absolute inset-0" style={{ background: 'var(--gradient-spotlight)' }} />
        {/* Temple silhouette gradient */}
        <div className="absolute top-0 left-0 right-0 h-48" style={{
          background: 'linear-gradient(180deg, hsla(38, 40%, 75%, 0.08) 0%, transparent 100%)',
        }} />
        <div className="absolute top-0 left-0 right-0 gold-divider" />
        <GoldDustParticles />

        <div className="relative z-10 max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-16">
            <p className="font-elegant text-base tracking-[0.3em] uppercase text-gold-dark mb-3">Portfolio</p>
            <h1 className="font-display text-3xl md:text-5xl font-bold text-foreground">
              My <span className="text-gold-gradient-shine">Schemes</span>
            </h1>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="h-0.5 w-20 mx-auto mt-4"
              style={{ background: 'var(--gradient-gold)' }}
            />
          </motion.div>

          {enrolledSchemes.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center max-w-lg mx-auto" style={{ boxShadow: 'var(--shadow-luxury)' }}>
              <p className="font-body text-muted-foreground mb-6">No active schemes. Start your golden journey today.</p>
              <button onClick={() => navigate("/schemes")} className="btn-gold text-sm px-8 py-3">Explore Schemes</button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {enrolledSchemes.map((scheme, i) => {
                const progress = (scheme.installmentsPaid / scheme.durationMonths) * 100;
                const goldAccumulated = scheme.monthlyAmount * scheme.installmentsPaid;
                const remaining = scheme.durationMonths - scheme.installmentsPaid;
                const status = remaining === 0 ? "Completed" : "Active";

                return (
                  <motion.div
                    key={scheme.id}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: i * 0.12 }}
                    className="glass-card rounded-3xl p-8 spotlight relative overflow-hidden group"
                    style={{
                      boxShadow: 'var(--shadow-luxury)',
                      ...(status === "Completed"
                        ? { borderColor: 'hsla(160, 50%, 38%, 0.3)' }
                        : {}),
                    }}
                  >
                    {/* Active: animated gold border highlight */}
                    {status === "Active" && (
                      <div className="absolute inset-0 rounded-3xl pointer-events-none animate-glow-pulse"
                        style={{ boxShadow: 'inset 0 0 0 1.5px hsla(43, 80%, 55%, 0.2)' }}
                      />
                    )}
                    {/* Completed: celebratory glow */}
                    {status === "Completed" && (
                      <div className="absolute inset-0 rounded-3xl pointer-events-none"
                        style={{
                          background: 'radial-gradient(ellipse at 50% 50%, hsla(160, 50%, 50%, 0.06) 0%, transparent 60%)',
                        }}
                      />
                    )}
                    {/* Hover shimmer */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                      style={{ background: 'linear-gradient(135deg, transparent, hsla(43,80%,60%,0.08), transparent)' }}
                    />

                    <div className="flex items-center justify-between mb-4 relative">
                      <h3 className="font-display text-xl font-bold text-foreground">{scheme.name}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-body font-semibold border ${
                        status === "Active"
                          ? "bg-gold/10 text-gold-dark border-gold/20"
                          : "bg-emerald/10 text-emerald border-emerald/20"
                      }`}>
                        {status}
                      </span>
                    </div>

                    <p className="font-body text-sm text-muted-foreground mb-1 relative">EMI: {formatINR(scheme.monthlyAmount)}/month</p>
                    <p className="font-body text-sm text-muted-foreground mb-4 relative">
                      Gold Accumulated: <span className="font-semibold text-gold-gradient">{formatINR(goldAccumulated)}</span>
                    </p>

                    {/* Gold shimmer progress bar */}
                    <div className="w-full h-3 rounded-full bg-cream overflow-hidden mb-2 relative">
                      <motion.div
                        className="h-full rounded-full relative overflow-hidden"
                        style={{ background: 'var(--gradient-gold)' }}
                        initial={{ width: "0%" }}
                        whileInView={{ width: `${progress}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                      >
                        {/* Shimmer sweep on progress */}
                        <div className="absolute inset-0" style={{
                          background: 'linear-gradient(90deg, transparent, hsla(40, 40%, 97%, 0.4), transparent)',
                          animation: 'light-sweep 3s ease-in-out infinite',
                        }} />
                      </motion.div>
                    </div>
                    <div className="flex justify-between font-body text-xs text-muted-foreground relative">
                      <span>{scheme.installmentsPaid} of {scheme.durationMonths} months</span>
                      <span>{remaining} remaining</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Inspirational footer quote */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex items-center justify-center gap-3 mt-16"
          >
            <div className="h-px w-16 md:w-24" style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--gold-light)))' }} />
            <Sparkles className="w-4 h-4 text-gold-dark/50" />
            <p className="font-elegant text-sm text-gold-dark/60 italic tracking-wide">
              "Gold is not just wealth — it is heritage."
            </p>
            <Sparkles className="w-4 h-4 text-gold-dark/50" />
            <div className="h-px w-16 md:w-24" style={{ background: 'linear-gradient(90deg, hsl(var(--gold-light)), transparent)' }} />
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default MySchemes;