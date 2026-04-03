import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "@/components/Layout";
import HeroSection from "@/components/HeroSection";

const Index = () => {
  const location = useLocation();
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);

  useEffect(() => {
    if (location.state && (location.state as any).loggedOut) {
      setShowWelcomeBack(true);
      // Clear the state so it doesn't persist on refresh
      window.history.replaceState({}, document.title);
      const timer = setTimeout(() => setShowWelcomeBack(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  return (
    <Layout>
      <HeroSection />
      <AnimatePresence>
        {showWelcomeBack && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[80] px-8 py-4 rounded-full"
            style={{
              background: "hsla(40, 28%, 97%, 0.9)",
              backdropFilter: "blur(20px)",
              border: "1px solid hsla(43,80%,60%,0.3)",
              boxShadow: "var(--shadow-gold), 0 0 40px hsla(43,80%,55%,0.1)",
            }}
          >
            <p className="font-elegant text-base md:text-lg text-foreground/80 italic text-center">
              ✦ You are always welcome back to <span className="text-gold-gradient font-semibold not-italic">Suvarna Jewellers</span> ✦
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

export default Index;
