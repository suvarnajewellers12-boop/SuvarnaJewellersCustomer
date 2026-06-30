import React from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    // 1. Force the layout wrapper to take up at least 100% of the screen height
    <div className="min-h-screen flex flex-col bg-background selection:bg-gold/20 selection:text-gold-dark">
      {/* Navigation Bar */}
      <Navbar />

      {/* 
        2. flex-grow forces the main content window to expand and fill all remaining space, 
           automatically pinning the footer to the absolute bottom when content size is small.
      */}
      <main className="flex-grow w-full">
        {children}
      </main>

      {/* Sticky Footer */}
      <Footer />
    </div>
  );
};

export default Layout;