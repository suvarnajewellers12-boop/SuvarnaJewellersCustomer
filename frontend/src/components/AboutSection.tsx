import { motion } from "framer-motion";
import { Heart, Shield, Gem, Users } from "lucide-react";

const milestones = [
  {
    icon: Heart,
    title: "Gold in Indian Hearts",
    description: "For thousands of years, gold has been at the centre of Indian life — from sacred rituals and festivals to the most precious moments of marriage. It is not just wealth; it is love, passed from mother to daughter.",
  },
  {
    icon: Users,
    title: "The Wedding Tradition",
    description: "Every Indian family begins saving for gold long before the wedding bells ring. It is a promise — a commitment to honour tradition and gift prosperity to the next generation.",
  },
  {
    icon: Shield,
    title: "Trust & Legacy",
    description: "Suvarna Jewellers was born from this very tradition. We believe every family deserves a dignified, transparent, and beautiful way to save for the gold that will adorn their most cherished celebrations.",
  },
  {
    icon: Gem,
    title: "Our Mission",
    description: "To make gold savings as elegant as the jewelry itself. Through innovative savings schemes, we empower millions of Indian families to build their golden future — one step at a time.",
  },
];

const AboutSection = () => {
  return (
    <section id="about" className="py-28 px-4 relative overflow-hidden bg-ivory">
      {/* Temple pattern bg */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30z' fill='none' stroke='%23b8860b' stroke-width='0.5'/%3E%3C/svg%3E")`,
        backgroundSize: "60px 60px",
      }} />

      {/* Ambient spotlight */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[40%] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, hsla(43,70%,55%,0.06) 0%, transparent 60%)' }}
      />

      <div className="relative z-10 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <p className="font-elegant text-base tracking-[0.3em] uppercase text-gold-dark mb-3">Our Story</p>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-4">
            A Legacy of <span className="text-gold-gradient-shine">Golden Trust</span>
          </h2>
          <p className="font-body text-muted-foreground max-w-xl mx-auto">
            Rooted in India's timeless love for gold, Suvarna Jewellers honours tradition with modern elegance.
          </p>
        </motion.div>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px hidden lg:block"
            style={{ background: 'linear-gradient(to bottom, transparent, hsl(43 80% 52% / 0.3), hsl(43 80% 52% / 0.4), hsl(43 80% 52% / 0.3), transparent)' }}
          />

          <div className="space-y-16 lg:space-y-24">
            {milestones.map((item, index) => {
              const Icon = item.icon;
              const isLeft = index % 2 === 0;

              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, x: isLeft ? -50 : 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: 0.1 }}
                  className={`flex flex-col lg:flex-row items-center gap-8 ${
                    isLeft ? "lg:flex-row" : "lg:flex-row-reverse"
                  }`}
                >
                  <div className={`flex-1 ${isLeft ? "lg:text-right" : "lg:text-left"}`}>
                    <h3 className="font-display text-xl md:text-2xl font-bold text-foreground mb-3">{item.title}</h3>
                    <p className="font-body text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>

                  {/* Center icon with glow */}
                  <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center z-10"
                    style={{ boxShadow: '0 8px 30px -6px hsla(43, 80%, 50%, 0.4), 0 0 0 4px hsla(43, 80%, 55%, 0.1)' }}
                  >
                    <Icon className="w-7 h-7 text-primary-foreground" />
                  </div>

                  <div className="flex-1" />
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
