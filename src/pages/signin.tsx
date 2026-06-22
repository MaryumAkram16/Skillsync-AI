import React, { useState, useEffect } from "react";
import { useUser } from "../context/UserContext";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { BrainCircuit, LogIn, ArrowLeft, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Input } from "../components/Input";

export default function SignInPage() {
  const { loginWithGoogle, loginWithEmail, signupWithEmail, isLoggedIn } = useUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const getInitialView = () => {
    const mode = searchParams.get("mode");
    if (mode === "signin") return "signin-options";
    if (mode === "signup") return "signup-options";
    return "choice";
  };

  const [view, setView] = useState<"choice" | "signin-options" | "signup-options" | "email-signin" | "email-signup">(getInitialView());
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Where to send the user after a successful login/signup. Falls back to
  // /dashboard if they arrived here directly (no specific page was requested).
  const getRedirectTarget = () => {
    const redirect = searchParams.get("redirect");
    // Basic safety check: only ever redirect to an internal path, never an
    // absolute/external URL, even if the query param were tampered with.
    if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
      return redirect;
    }
    return "/dashboard";
  };

  useEffect(() => {
    if (isLoggedIn) {
      navigate(getRedirectTarget());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, navigate]);

  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await loginWithGoogle();
      navigate(getRedirectTarget());
    } catch (err: any) {
      setError(err.message || "Failed to sign in with Google.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      if (view === "email-signin") {
        await loginWithEmail(email, password);
      } else {
        if (!firstName || !lastName) {
          throw new Error("Please provide your full name.");
        }
        await signupWithEmail(email, password, firstName, lastName);
      }
      navigate(getRedirectTarget());
    } catch (err: any) {
      let msg = err.message || "Authentication failed.";
      if (msg.includes("auth/user-not-found")) msg = "No account found with this email.";
      if (msg.includes("auth/wrong-password")) msg = "Incorrect password.";
      if (msg.includes("auth/email-already-in-use")) msg = "An account already exists with this email.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    switch (view) {
      case "choice":
        return (
          <motion.div 
            key="choice"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-4"
          >
            <h2 className="font-display text-2xl font-semibold mb-2 text-center">Get Started</h2>
            <p className="text-text-secondary text-center mb-8 text-sm">Welcome to SkillSync AI. How would you like to continue?</p>
            <Button onClick={() => setView("signin-options")} className="w-full py-6 text-lg shadow-lg shadow-primary-blue/20">Sign In</Button>
            <Button onClick={() => setView("signup-options")} variant="outline" className="w-full py-6 text-lg">Sign Up</Button>
          </motion.div>
        );
      
      case "signin-options":
      case "signup-options":
        const isSignUp = view === "signup-options";
        return (
          <motion.div 
            key="options"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <Button variant="ghost" size="sm" onClick={() => setView("choice")} className="mb-2 -ml-2 text-text-secondary hover:text-primary-blue">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <h2 className="font-display text-2xl font-semibold mb-2 text-center">{isSignUp ? "Create Account" : "Sign In"}</h2>
            <p className="text-text-secondary text-center mb-8 text-sm">Select your preferred authentication method</p>
            
            <Button 
              onClick={handleGoogleLogin} 
              className="w-full gap-3 bg-white text-black hover:bg-gray-100 border border-gray-300 py-6 shadow-sm"
              disabled={isLoading}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              Continue with Google
            </Button>

            <Button 
              onClick={() => setView(isSignUp ? "email-signup" : "email-signin")}
              variant="outline"
              className="w-full py-6 gap-3"
              disabled={isLoading}
            >
              <LogIn className="h-5 w-5" />
              Continue with Email
            </Button>
          </motion.div>
        );

      case "email-signin":
        return (
          <motion.div 
            key="email-signin"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setView("signin-options")} className="mb-2 -ml-2 text-text-secondary hover:text-primary-blue">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <h2 className="font-display text-2xl font-semibold mb-2 text-center">Sign In</h2>
              <p className="text-text-secondary text-center mb-6 text-sm">Enter your credentials to access your account</p>
              
              <div className="space-y-2">
                <label className="font-mono text-xs text-text-secondary uppercase tracking-wider">Email Address</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@example.com" className="h-12" />
              </div>
              <div className="space-y-2">
                <label className="font-mono text-xs text-text-secondary uppercase tracking-wider">Password</label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="h-12" />
              </div>
              
              <Button type="submit" className="w-full py-6 mt-4 shadow-lg shadow-primary-blue/20" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                    Signing in...
                  </>
                ) : "Sign In"}
              </Button>
            </form>
          </motion.div>
        );

      case "email-signup":
        return (
          <motion.div 
            key="email-signup"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setView("signup-options")} className="mb-2 -ml-2 text-text-secondary hover:text-primary-blue">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <h2 className="font-display text-2xl font-semibold mb-2 text-center">Create Account</h2>
              <p className="text-text-secondary text-center mb-6 text-sm">Join SkillSync AI and supercharge your career</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="font-mono text-xs text-text-secondary uppercase tracking-wider">First Name</label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="Jane" className="h-12" />
                </div>
                <div className="space-y-2">
                  <label className="font-mono text-xs text-text-secondary uppercase tracking-wider">Last Name</label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="Doe" className="h-12" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="font-mono text-xs text-text-secondary uppercase tracking-wider">Email Address</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@example.com" className="h-12" />
              </div>
              <div className="space-y-2">
                <label className="font-mono text-xs text-text-secondary uppercase tracking-wider">Password</label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="h-12" />
              </div>
              
              <Button type="submit" className="w-full py-6 mt-4 shadow-lg shadow-primary-blue/20" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                    Creating account...
                  </>
                ) : "Sign Up"}
              </Button>
            </form>
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="absolute top-8 left-8"
      >
        <Button variant="ghost" className="gap-2" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Button>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="relative overflow-hidden rounded-[2rem] py-6 flex items-center justify-center gap-2 mb-8">
          <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-30" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[320px] h-[180px] bg-primary-violet/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="relative z-10 flex items-center gap-2">
            <BrainCircuit className="h-10 w-10 text-primary-blue" />
            <span className="font-display text-3xl font-semibold bg-gradient-to-r from-primary-blue to-primary-purple bg-clip-text text-transparent">
              SkillSync AI
            </span>
          </div>
        </div>

        <Card className="p-8 shadow-2xl border-primary-blue/10">
          <AnimatePresence mode="wait">
            {renderContent()}
          </AnimatePresence>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-md text-danger text-sm text-center"
            >
              {error}
            </motion.div>
          )}

          <p className="mt-8 text-[10px] text-center text-text-secondary leading-relaxed uppercase tracking-widest font-bold opacity-50">
            By continuing, you agree to our <br />
            <Link to="/terms-of-service" className="underline hover:opacity-100">Terms of Service</Link>
            {" "}and{" "}
            <Link to="/privacy-policy" className="underline hover:opacity-100">Privacy Policy</Link>.
          </p>
        </Card>
      </motion.div>
    </div>
  );
}