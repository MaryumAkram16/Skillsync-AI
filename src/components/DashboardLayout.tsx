import { ReactNode, useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { ArrowLeft, Menu, MessageSquare } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { ChatbotWidget } from "./ChatbotWidget";
import { WelcomeModal } from "./WelcomeModal";
import PlatformFeedbackModal from "./PlatformFeedbackModal";
import { AnimatePresence } from "motion/react";
import { triggerFeedbackWithDelay, shouldShowFeedback, markFeedbackShown } from "../lib/feedbackControl";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  showBackButton?: boolean;
  backPath?: string;
  onBack?: () => void;
  actions?: ReactNode;
}

export function DashboardLayout({ children, title, showBackButton, backPath, onBack, actions }: DashboardLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showPlatformFeedback, setShowPlatformFeedback] = useState(false);
  const navigate = useNavigate();
  const { user, firstName, updateProfile } = useUser();

  // ── Fallback: Check if we should show feedback on navigation/dashboard load ──
  useEffect(() => {
    if (!user) return;
    
    // Check if we missed a prompt or reached a threshold
    if (shouldShowFeedback()) {
      const t = setTimeout(() => {
        setShowPlatformFeedback(true);
        markFeedbackShown();
      }, 3000); // Slightly longer delay on dashboard
      return () => clearTimeout(t);
    }
  }, [user?.uid, children]); // Check on children change too (navigation)

  // ── Auto-trigger logic moved to individual features via trackFeatureCompletion ──────────────

  const handleFeedbackDone = () => {
    setShowPlatformFeedback(false);
    if (user) {
      updateProfile({ hasGivenPlatformFeedback: true } as any);
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backPath) {
      navigate(backPath);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      {/* Sidebar - Desktop */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 shadow-2xl animate-in slide-in-from-left duration-300">
            <Sidebar onClose={() => setIsMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-md flex items-center justify-between px-4 lg:px-8 shrink-0 z-40">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2.5 rounded-xl hover:bg-border/50 text-text-secondary transition-all active:scale-95"
            >
              <Menu className="h-6 w-6" />
            </button>

            {showBackButton && (
              <button
                onClick={handleBack}
                className="flex items-center gap-2.5 p-2 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary transition-all active:scale-95"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline text-xs font-black uppercase tracking-widest text-[10px]">Back</span>
              </button>
            )}

            <h1 className="text-lg font-display font-semibold text-text-heading uppercase tracking-tight truncate max-w-[200px] sm:max-w-none">
              {title}
            </h1>
            {actions && <div className="ml-2 sm:ml-4">{actions}</div>}
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle />

            {/* Feedback button — manual trigger, always visible */}
            <button
              onClick={() => setShowPlatformFeedback(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-border text-text-secondary hover:bg-border/50 hover:text-text-primary transition-all text-[10px] sm:text-xs font-bold"
              title="Share your feedback"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Feedback</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main id="main-content" className="flex-1 overflow-y-auto overflow-x-hidden w-full">
          <div className="max-w-[1600px] mx-auto p-4 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      <ChatbotWidget />
      <WelcomeModal />

      {/* Platform Feedback Modal */}
      <AnimatePresence>
        {showPlatformFeedback && user && (
          <PlatformFeedbackModal
            userId={user.uid}
            userName={firstName || user.email || "User"}
            onClose={handleFeedbackDone}
            onSubmitted={handleFeedbackDone}
          />
        )}
      </AnimatePresence>
    </div>
  );
}