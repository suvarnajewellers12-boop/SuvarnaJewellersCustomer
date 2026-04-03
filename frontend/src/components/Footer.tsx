import suvarnaLogo from "@/assets/suvarna-logo.png";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const footerLinks = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
  { label: "Schemes", href: "/schemes" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

const Footer = () => {
  const navigate = useNavigate();

  return (
    <footer className="relative pt-16 pb-8 px-4 bg-cream overflow-hidden">
      <div className="absolute top-0 left-0 right-0 gold-divider" />

      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='20' cy='20' r='8' fill='none' stroke='%23b8860b' stroke-width='0.3'/%3E%3Ccircle cx='20' cy='20' r='16' fill='none' stroke='%23b8860b' stroke-width='0.3'/%3E%3C/svg%3E")`,
      }} />

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[50%] h-[30%] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, hsla(43,70%,55%,0.05) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 max-w-6xl mx-auto">
        <div className="flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-center gap-2.5 mb-6"
          >
            <img src={suvarnaLogo} alt="Suvarna Jewellers" className="w-8 h-8 drop-shadow-sm object-contain" />
            <span className="font-display text-2xl font-bold text-gold-gradient">Suvarna Jewellers</span>
          </motion.div>

          <p className="font-elegant text-lg italic text-muted-foreground mb-8 max-w-md">
            Crafting golden dreams, preserving timeless traditions.
          </p>

          <nav className="flex flex-wrap justify-center gap-6 mb-8">
            {footerLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => navigate(link.href)}
                className="font-body text-sm text-muted-foreground hover:text-gold-dark transition-colors duration-300"
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className="gold-divider w-48 mb-6" />

          <p className="font-body text-xs text-muted-foreground">
            © {new Date().getFullYear()} Suvarna Jewellers. All rights reserved. Crafted with ♥ in India.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
