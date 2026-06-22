import { Link } from "react-router-dom";
import { Button } from "./Button";
import { BrainCircuit, MessageSquare, Play } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { useUser } from "../context/UserContext";
import { useState } from "react";
import PlatformFeedbackModal from "./PlatformFeedbackModal";
import { AnimatePresence } from "motion/react";

export function Navbar() {
  const { fullName, isLoggedIn, logout, user, firstName } = useUser();
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <>
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <BrainCircuit className="h-8 w-8 text-primary-blue" />
            <span className="font-display text-xl font-semibold bg-gradient-to-r from-primary-blue to-primary-purple bg-clip-text text-transparent">
              SkillSync AI
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle />

            {/* Watch Demos link — only for logged-out visitors evaluating the app.
                Once signed in, this would just be clutter in the authenticated
                header, so it's hidden — the Welcome Modal covers that case instead. */}
            {!isLoggedIn && (
              <Link
                to="/demos"
                className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-border text-text-secondary hover:bg-border/50 hover:text-text-primary transition-all text-[10px] sm:text-xs font-bold"
                title="Watch feature demos"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Watch Demos</span>
              </Link>
            )}

            {/* Subtle Feedback Button */}
            <button
              onClick={() => setShowFeedback(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-border text-text-secondary hover:bg-border/50 hover:text-text-primary transition-all text-[10px] sm:text-xs font-bold"
              title="Share your feedback"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Feedback</span>
            </button>

            {isLoggedIn ? (
              <>
                <Link to="/dashboard">
                  <Button variant="ghost" className="hidden sm:inline-flex text-xs font-bold uppercase tracking-widest">Dashboard</Button>
                </Link>
                <Link to="/dashboard" className="sm:hidden">
                  <Button size="sm">App</Button>
                </Link>
                <Button variant="outline" onClick={logout} className="hidden sm:inline-flex text-xs font-bold uppercase tracking-widest">Sign Out</Button>
              </>
            ) : (
              <>
                <Link to="/signin?mode=signin" className="hidden sm:inline-block">
                  <Button variant="ghost" className="text-xs font-bold uppercase tracking-widest">Sign In</Button>
                </Link>
                <Link to="/signin?mode=signup">
                  <Button className="px-3 py-1.5 text-[10px] sm:text-xs sm:px-4 sm:py-2 font-black uppercase tracking-widest">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {showFeedback && (
          <PlatformFeedbackModal
            userId={user?.uid || "guest"}
            userName={firstName || fullName || "Guest"}
            onClose={() => setShowFeedback(false)}
            onSubmitted={() => setShowFeedback(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}