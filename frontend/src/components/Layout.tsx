import React from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-gold/20 selection:text-gold-dark">
      {/* FIX: Add Skip to Main Content Link as first keyboard-focusable item */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only fixed top-4 left-4 z-[999] bg-gold text-primary-foreground px-4 py-2 rounded-full font-body text-sm font-semibold shadow-lg transition-transform focus:outline-none focus:ring-2 focus:ring-gold-dark"
      >
        Skip to main content
      </a>

      {/* Navigation Bar */}
      <Navbar />

      {/* FIX: Add id="main-content" and tabIndex={-1} for programmatic skip routing focus */}
      <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col w-full focus:outline-none">
        {children}
      </main>

      {/* Sticky Footer */}
      <Footer />
    </div>
  );
};

export default Layout;