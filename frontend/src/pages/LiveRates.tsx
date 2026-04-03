import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import GoldDustParticles from "@/components/GoldDustParticles";

const cleanPrice = (value: string) =>
  Number(value.replace(/[₹,]/g, "").trim());

const formatINR = (n: number) =>
  "₹" + n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const LiveRates = () => {
  const { isLoggedIn, enrolledSchemes } = useAuth();

  const totalSaved = enrolledSchemes.reduce(
    (acc, s) => acc + s.monthlyAmount * s.paidMonths,
    0
  );

  const [loading, setLoading] = useState(true);

  const [rates, setRates] = useState([
    {
      metal: "Gold 24K",
      price: 0,
      unit: "/gram",
    },
    {
      metal: "Gold 22K",
      price: 0,
      unit: "/gram",
    },
    {
      metal: "Gold 18K",
      price: 0,
      unit: "/gram",
    },
    {
      metal: "Silver",
      price: 0,
      unit: "/gram",
    },
  ]);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch("https://suvarnagold-16e5.vercel.app/api/rates");
        const data = await res.json();

        setRates([
          {
            metal: "Gold 24K",
            price: cleanPrice(data.gold24),
            unit: "/gram",
          },
          {
            metal: "Gold 22K",
            price: cleanPrice(data.gold22),
            unit: "/gram",
          },
          {
            metal: "Gold 18K",
            price: cleanPrice(data.gold18),
            unit: "/gram",
          },
          {
            metal: "Silver",
            price: cleanPrice(data.silver),
            unit: "/gram",
          },
        ]);

        setTimeout(() => {
          setLoading(false);
        }, 1000);
      } catch (error) {
        console.error("Rates fetch failed:", error);
        setLoading(false);
      }
    };

    fetchRates();
  }, []);

  return (
    <Layout>
      <section className="pt-32 pb-28 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cream via-pearl to-ivory" />
        <div className="absolute inset-0" style={{ background: "var(--gradient-spotlight)" }} />

        <div
          className="absolute top-0 left-0 right-0 h-48"
          style={{
            background:
              "linear-gradient(180deg, hsla(38, 40%, 75%, 0.08) 0%, transparent 100%)",
          }}
        />

        <div className="absolute top-0 left-0 right-0 gold-divider" />

        <GoldDustParticles />

        <div className="relative z-10 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-6"
          >
            <p className="font-elegant text-base tracking-[0.3em] uppercase text-gold-dark mb-3">
              Market Watch
            </p>

            <h1 className="font-display text-3xl md:text-5xl font-bold text-foreground">
              Live <span className="text-gold-gradient-shine">Rates</span>
            </h1>

            <p className="font-elegant text-lg text-muted-foreground italic mt-3">
              Today's precious metal prices
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center mb-16"
          >
            <p className="font-elegant text-sm text-gold-dark/70 italic">
              "Today's Gold — Guiding Tomorrow's Celebrations"
            </p>

            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1, delay: 0.6 }}
              className="h-px w-32 mx-auto mt-4"
              style={{
                background:
                  "linear-gradient(90deg, transparent, hsl(var(--gold-light)), transparent)",
              }}
            />
          </motion.div>

          {loading ? (
            <div className="text-center py-20">
              <p className="font-display text-2xl text-gold-gradient animate-pulse">
                Loading...
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-8 mb-12">
              {rates.map((rate, i) => (
                <motion.div
                  key={rate.metal}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.12 }}
                  className="glass-card rounded-3xl p-8 text-center spotlight relative overflow-hidden group"
                  style={{ boxShadow: "var(--shadow-luxury)" }}
                >
                  <h3 className="font-display text-lg font-bold text-foreground mb-1">
                    {rate.metal}
                  </h3>

                  <span className="font-display text-3xl font-bold text-gold-gradient">
                    {formatINR(rate.price)}
                  </span>

                  <span className="font-body text-sm text-muted-foreground block">
                    {rate.unit}
                  </span>
                </motion.div>
              ))}
            </div>
          )}

          {isLoggedIn && totalSaved > 0 && (
            <motion.div className="glass-card rounded-2xl p-8 text-center max-w-md mx-auto">
              <p className="font-elegant text-base text-muted-foreground italic mb-2">
                Your current gold savings value
              </p>

              <span className="font-display text-3xl font-bold text-gold-gradient">
                {formatINR(totalSaved)}
              </span>

              <p className="font-body text-xs text-muted-foreground mt-2">
                Based on current 22K rate
              </p>
            </motion.div>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default LiveRates;