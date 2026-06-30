import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Instantly snap the window back to the top left on route change
    window.scrollTo(0, 0);
  }, [pathname]);

  return null; // This component doesn't render any UI
};

export default ScrollToTop;