import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import heroBg from "@/assets/hero-bg.jpg";

const SparkleParticles = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number; life: number }[] = [];

    const createParticle = (x: number, y: number) => {
      for (let i = 0; i < 4; i++) {
        particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 3,
          vy: (Math.random() - 0.5) * 3 - 1.5,
          size: Math.random() * 4 + 1.5,
          opacity: 1,
          life: Math.random() * 50 + 25,
        });
      }
    };

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -Math.random() * 0.6 - 0.15,
        size: Math.random() * 3 + 0.8,
        opacity: Math.random() * 0.7 + 0.3,
        life: 999999,
      });
    }

    const handleMouse = (e: MouseEvent) => createParticle(e.clientX, e.clientY);
    canvas.addEventListener("mousemove", handleMouse);

    let animId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.life < 999999) {
          p.life--;
          p.opacity = Math.max(0, p.opacity - 0.018);
        }
        if (p.life <= 0 || p.opacity <= 0) {
          if (p.life === 999999) {
            p.x = Math.random() * canvas.width;
            p.y = canvas.height + 10;
            p.opacity = Math.random() * 0.7 + 0.3;
          } else {
            particles.splice(i, 1);
            continue;
          }
        }
        if (p.y < -10) { p.y = canvas.height + 10; }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grad.addColorStop(0, `hsla(43, 85%, 70%, ${p.opacity})`);
        grad.addColorStop(0.5, `hsla(43, 80%, 60%, ${p.opacity * 0.5})`);
        grad.addColorStop(1, `hsla(43, 80%, 55%, 0)`);
        ctx.fillStyle = grad;
        ctx.fill();
      }
      animId = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener("mousemove", handleMouse);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-10 pointer-events-auto" style={{ maxWidth: '100%' }} />;
};

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <img src={heroBg} alt="Luxury Indian gold jewelry display" className="w-full h-full object-cover scale-105" />
        <div className="absolute inset-0 bg-gradient-to-b from-pearl/50 via-ivory/30 to-cream/60" />
        <div className="absolute inset-0 bg-gradient-to-r from-pearl/40 via-transparent to-pearl/40" />
      </div>

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[50%] pointer-events-none z-[5]"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, hsla(43,80%,55%,0.12) 0%, transparent 65%)' }}
      />
      <div className="absolute top-1/4 left-0 w-[30%] h-[60%] pointer-events-none z-[5]"
        style={{ background: 'radial-gradient(ellipse at 0% 50%, hsla(43,70%,55%,0.08) 0%, transparent 60%)' }}
      />
      <div className="absolute top-1/4 right-0 w-[30%] h-[60%] pointer-events-none z-[5]"
        style={{ background: 'radial-gradient(ellipse at 100% 50%, hsla(43,70%,55%,0.08) 0%, transparent 60%)' }}
      />

      <div className="absolute inset-0 pointer-events-none z-[6] overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute animate-light-sweep"
            style={{
              background: 'linear-gradient(90deg, transparent, hsla(43,80%,70%,0.06), hsla(43,80%,70%,0.12), hsla(43,80%,70%,0.06), transparent)',
              width: '30%',
              height: '100%',
            }}
          />
        </div>
      </div>

      <SparkleParticles />

      <div className="relative z-20 text-center px-4 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0 }}
        >
          <p className="font-elegant text-lg md:text-xl tracking-[0.35em] uppercase text-gold-dark mb-5 drop-shadow-sm">
            ✦ Premium Gold Savings ✦
          </p>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="font-display text-5xl sm:text-6xl md:text-8xl font-bold leading-[1.1] mb-8"
          style={{ textShadow: '0 4px 30px hsla(30, 20%, 15%, 0.15)' }}
        >
          <span className="text-foreground">Build Your </span>
          <span className="text-gold-gradient-shine animate-text-glow">Golden</span>
          <br />
          <span className="text-foreground">Future with </span>
          <span className="text-gold-gradient">Trust</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="font-elegant text-xl md:text-2xl text-foreground/70 max-w-2xl mx-auto mb-12 italic"
          style={{ textShadow: '0 1px 10px hsla(40, 20%, 50%, 0.15)' }}
        >
          India's most elegant gold savings experience designed for your dreams.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-5 justify-center"
        >
          <button onClick={() => navigate("/schemes")} className="btn-gold btn-gold-pulse text-base md:text-lg px-12 py-4">
            Explore Schemes
          </button>
          <button onClick={() => navigate("/products")} className="btn-rose-outline text-base md:text-lg px-12 py-4">
            Start Gold Journey
          </button>
        </motion.div>
      </div>

      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20"
      >
        <div className="w-7 h-11 rounded-full border-2 border-gold/50 flex items-start justify-center p-2"
          style={{ boxShadow: '0 0 15px hsla(43, 80%, 55%, 0.15)' }}
        >
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-gold"
          />
        </div>
      </motion.div>
    </section>
  );
};

export default HeroSection;