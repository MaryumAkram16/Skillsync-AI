import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUp } from "lucide-react";
import { cn } from "../utils/cn";

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // We target the main scrolling container of the app (#main-content), 
    // or fallback to window if not present.
    const getScrollContainer = () => {
      return document.getElementById("main-content") || window;
    };

    const handleScroll = () => {
      const container = getScrollContainer();
      let scrollY = 0;
      if (container instanceof HTMLElement) {
        scrollY = container.scrollTop;
      } else {
        scrollY = window.scrollY;
      }
      setIsVisible(scrollY > 300);
    };

    // Initial check
    handleScroll();

    const container = getScrollContainer();
    container.addEventListener("scroll", handleScroll, { passive: true });

    // Also attach to window as a general listener/fallback
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Polling interval in case the main layout renders asynchronously or does a client route swap
    let targetFound = !!document.getElementById("main-content");
    const interval = setInterval(() => {
      const currentTarget = document.getElementById("main-content");
      if (currentTarget && !targetFound) {
        targetFound = true;
        currentTarget.removeEventListener("scroll", handleScroll);
        currentTarget.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      window.removeEventListener("scroll", handleScroll);
      const c = document.getElementById("main-content");
      if (c) {
        c.removeEventListener("scroll", handleScroll);
      }
    };
  }, []);

  const scrollToTop = () => {
    const container = document.getElementById("main-content");
    if (container) {
      container.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          id="scroll-to-top-btn"
          onClick={scrollToTop}
          initial={{ opacity: 0, scale: 0.8, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 16 }}
          whileHover={{ scale: 1.1, y: -2 }}
          whileTap={{ scale: 0.95 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 20
          }}
          className={cn(
            "fixed bottom-[5.5rem] right-6 z-40",
            "flex h-11 w-11 items-center justify-center rounded-full cursor-pointer",
            "border border-border",
            "bg-card text-text-primary hover:bg-card-hover",
            "shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.3)]",
            "backdrop-blur-md transition-colors duration-200 outline-none",
            "focus-visible:ring-2 focus-visible:ring-primary-blue focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
          aria-label="Scroll to top"
          title="Scroll to top"
        >
          <ArrowUp className="h-5 w-5 text-text-primary" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
