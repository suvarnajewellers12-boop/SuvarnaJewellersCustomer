import { motion, AnimatePresence } from "framer-motion";
import { Shield, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";

interface LogoutModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const ModalParticles = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const particles: { x: number; y: number; vy: number; size: number; opacity: number }[] = [];
    for (let i = 0; i < 30; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vy: -(Math.random() * 0.5 + 0.2),
        size: Math.random() * 2.5 + 0.8,
        opacity: Math.random() * 0.6 + 0.2,
      });
    }

    let animId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.y += p.vy;
        if (p.y < -5) { p.y = canvas.height + 5; p.x = Math.random() * canvas.width; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grad.addColorStop(0, `hsla(43, 85%, 65%, ${p.opacity})`);
        grad.addColorStop(1, `hsla(43, 80%, 55%, 0)`);
        ctx.fillStyle = grad;
        ctx.fill();
      });
      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animId);
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />;
};

const LogoutModal = ({ open, onClose, onConfirm }: LogoutModalProps) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />

        {/* Velvet spotlight */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: 500,
            height: 500,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "radial-gradient(ellipse, hsla(43,80%,55%,0.12) 0%, transparent 70%)",
          }}
        />

        {/* Modal card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="relative glass-card rounded-3xl p-8 md:p-10 max-w-md w-full text-center overflow-hidden"
          style={{ boxShadow: "var(--shadow-luxury), 0 0 60px hsla(43,80%,55%,0.1)" }}
        >
          <ModalParticles />

          {/* Icon */}
          <div className="relative z-10 mb-6">
            <div
              className="mx-auto w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, hsla(43,80%,55%,0.15), hsla(43,80%,55%,0.05))",
                border: "1px solid hsla(43,80%,60%,0.3)",
              }}
            >
              <Shield className="w-7 h-7 text-gold" />
            </div>
          </div>

          {/* Text */}
          <h3 className="relative z-10 font-display text-2xl md:text-3xl font-bold text-foreground mb-3">
            Leaving Your Golden Chamber?
          </h3>
          <p className="relative z-10 font-elegant text-base md:text-lg text-foreground/60 italic mb-8">
            Your progress and schemes remain safe with Suvarna Jewellers.
          </p>

          {/* Decorative divider */}
          <div className="relative z-10 gold-divider max-w-[60%] mx-auto mb-8" />

          {/* Buttons */}
          <div className="relative z-10 flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={onClose} className="btn-gold text-sm px-8 py-3 flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" /> Stay Logged In
            </button>
            <button onClick={onConfirm} className="btn-rose-outline text-sm px-8 py-3">
              Logout Securely
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default LogoutModal;
