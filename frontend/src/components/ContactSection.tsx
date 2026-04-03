import { useState } from "react";
import { motion } from "framer-motion";
import { Phone, Mail, MapPin, Send, Sparkles } from "lucide-react";
import showroomImg from "@/assets/showroom.jpg";

const ContactSection = () => {
  const [formData, setFormData] = useState({ name: "", phone: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
    setFormData({ name: "", phone: "", message: "" });
  };

  return (
    <section id="contact" className="py-28 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-cream via-pearl to-ivory" />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 70% 50%, hsla(43,70%,55%,0.06) 0%, transparent 50%)' }} />
      <div className="absolute top-0 left-0 right-0 gold-divider" />

      <div className="relative z-10 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="font-elegant text-base tracking-[0.3em] uppercase text-gold-dark mb-3">Visit Us</p>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-4">
            Welcome to Our <span className="text-gold-gradient-shine">Showroom</span>
          </h2>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 items-stretch">
          {/* Showroom Image */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="rounded-3xl overflow-hidden relative"
            style={{ boxShadow: 'var(--shadow-depth)' }}
          >
            <img src={showroomImg} alt="Suvarna Jewellers showroom" className="w-full h-full object-cover min-h-[400px]" />
            {/* Glass overlay at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-foreground/15 to-transparent" />
          </motion.div>

          {/* Contact Card */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="glass-card rounded-3xl p-8 flex flex-col justify-between"
            style={{ boxShadow: 'var(--shadow-luxury)' }}
          >
            {/* Info */}
            <div className="space-y-5 mb-8">
              {[
                { icon: Phone, label: "Phone", value: "+91 98765 43210" },
                { icon: Mail, label: "Email", value: "support@suvarnajewellers.com" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0 border border-gold/15">
                    <Icon className="w-4 h-4 text-gold-dark" />
                  </div>
                  <div>
                    <p className="font-body text-sm text-muted-foreground">{label}</p>
                    <p className="font-body font-semibold text-foreground">{value}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0 border border-gold/15">
                  <MapPin className="w-4 h-4 text-gold-dark" />
                </div>
                <div>
                  <p className="font-body text-sm text-muted-foreground">Address</p>
                  <p className="font-body font-semibold text-foreground">
                    Suvarna Jewellers Showroom<br />
                    D.No 10-45, Main Road, Gajuwaka<br />
                    Visakhapatnam, Andhra Pradesh – 530026<br />
                    India
                  </p>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Your Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-3.5 rounded-xl bg-pearl/60 border border-gold/15 font-body text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-gold/40 focus:ring-2 focus:ring-gold/15 transition-all"
              />
              <input
                type="tel"
                placeholder="Phone Number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                className="w-full px-4 py-3.5 rounded-xl bg-pearl/60 border border-gold/15 font-body text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-gold/40 focus:ring-2 focus:ring-gold/15 transition-all"
              />
              <textarea
                placeholder="Your Message"
                rows={3}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                required
                className="w-full px-4 py-3.5 rounded-xl bg-pearl/60 border border-gold/15 font-body text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-gold/40 focus:ring-2 focus:ring-gold/15 transition-all resize-none"
              />
              <button
                type="submit"
                className="btn-gold w-full flex items-center justify-center gap-2 text-base py-4"
              >
                {submitted ? (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" /> Message Sent!
                  </motion.span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Message
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
