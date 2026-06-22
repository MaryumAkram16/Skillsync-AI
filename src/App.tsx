/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./components/ThemeProvider";
import LandingPage from "./pages/index";
import Dashboard from "./pages/dashboard";
import RadarPage from "./pages/radar";
import ParserPage from "./pages/parser";
import GapMapPage from "./pages/gapmap";
import InterviewPage from "./pages/interview";
import ProfilePage from "./pages/profile";
import SignInPage from "./pages/signin";
import ResumeToolsPage from "./pages/resume-tools";
import RoadmapPage from "./pages/roadmap";
import SkillAssessmentPage from "./pages/skill-assessment";
import CareerMentorPage from "./pages/career-mentor";
import DemosPage from "./pages/demos";
import AdminPage from "./pages/admin";
import PrivacyPolicyPage from "./pages/privacy-policy";
import TermsOfServicePage from "./pages/terms-of-service";
import { UserProvider, useUser } from "./context/UserContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider } from "./components/Toast"; // <-- ADDED
import { RouteLoadingSkeleton } from "./components/SkeletonLoaders";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isAuthReady, user } = useUser();
  const location = window.location.pathname;
  
  if (!isAuthReady) {
    return <RouteLoadingSkeleton />;
  }
  
  if (!isLoggedIn) {
    // Preserve where the user was trying to go (including query params like
    // ?role=... from chatbot deep links) so signin.tsx can send them back
    // there after they log in, instead of always dumping them on /dashboard.
    const intendedDestination = window.location.pathname + window.location.search;
    return (
      <Navigate
        to={`/signin?redirect=${encodeURIComponent(intendedDestination)}`}
        replace
      />
    );
  }

  const redirectFlag = `redirected_${user?.uid}`;
  const alreadyRedirected = sessionStorage.getItem(redirectFlag);

  if (
    user && 
    user.score === 0 && 
    (!user.skills || user.skills.length === 0) && 
    location === '/dashboard' && 
    !alreadyRedirected
  ) {
    sessionStorage.setItem(redirectFlag, 'true');
    return <Navigate to="/skill-assessment" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  React.useEffect(() => {
    if (typeof window !== "undefined" && window.performance) {
      const logLoadTime = () => {
        setTimeout(() => {
          const perfEntries = window.performance.getEntriesByType("navigation");
          if (perfEntries.length > 0) {
            const navEntry = perfEntries[0] as PerformanceNavigationTiming;
            const loadTime = navEntry.loadEventEnd - navEntry.startTime;
            const domReadyTime = navEntry.domContentLoadedEventEnd - navEntry.startTime;
            console.log(
              `%c[Performance] App initial load: %c${loadTime.toFixed(0)}ms %c(DOM ready: %c${domReadyTime.toFixed(0)}ms%c)`,
              "color: #3b82f6; font-weight: bold;",
              "color: #10b981; font-weight: bold;",
              "color: #9ca3af;",
              "color: #8b5cf6; font-weight: bold;",
              "color: #9ca3af;"
            );
          } else {
            const loadTime = window.performance.now();
            console.log(
              `%c[Performance] App initialized in %c${loadTime.toFixed(0)}ms`,
              "color: #3b82f6; font-weight: bold;",
              "color: #10b981; font-weight: bold;"
            );
          }
        }, 0);
      };

      if (document.readyState === "complete") {
        logLoadTime();
      } else {
        window.addEventListener("load", logLoadTime);
        return () => window.removeEventListener("load", logLoadTime);
      }
    }
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" storageKey="skillsync-theme">
        <UserProvider>
          <ToastProvider> {/* <-- ADDED: wraps everything so toast works everywhere */}
            <Router>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                <Route path="/terms-of-service" element={<TermsOfServicePage />} />
                <Route path="/signin" element={<SignInPage />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/radar" element={<ProtectedRoute><RadarPage /></ProtectedRoute>} />
                <Route path="/parser" element={<ProtectedRoute><ParserPage /></ProtectedRoute>} />
                <Route path="/gapmap" element={<ProtectedRoute><GapMapPage /></ProtectedRoute>} />
                <Route path="/interview" element={<ProtectedRoute><InterviewPage /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/resume-tools" element={<ProtectedRoute><ResumeToolsPage /></ProtectedRoute>} />
                <Route path="/roadmap" element={<ProtectedRoute><RoadmapPage /></ProtectedRoute>} />
                <Route path="/skill-assessment" element={<ProtectedRoute><SkillAssessmentPage /></ProtectedRoute>} />
                <Route path="/career-mentor" element={<ProtectedRoute><CareerMentorPage /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
                <Route path="/demos" element={<DemosPage />} />
              </Routes>
            </Router>
          </ToastProvider> {/* <-- ADDED */}
        </UserProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}