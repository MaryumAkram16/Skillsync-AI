import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ShieldCheck } from "lucide-react";

interface ResumeConsentModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

const CONSENT_KEY = "skillsync_resume_consent";

export function hasResumeConsent(): boolean {
  return localStorage.getItem(CONSENT_KEY) === "true";
}

export function setResumeConsent(value: boolean) {
  localStorage.setItem(CONSENT_KEY, value ? "true" : "false");
}

export default function ResumeConsentModal({ isOpen, onAccept, onDecline }: ResumeConsentModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-md mx-4 bg-dark-card border border-dark-border rounded-2xl shadow-2xl overflow-hidden"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary-blue/10 rounded-lg">
                  <ShieldCheck className="w-6 h-6 text-primary-blue" />
                </div>
                <h3 className="text-lg font-semibold text-white">Resume Data Notice</h3>
              </div>

              <div className="space-y-3 text-sm text-gray-300">
                <p>
                  Your resume will be sent to an AI service for analysis. This may include personal information such as your name, contact details, work history, and education.
                </p>
                <p>
                  <strong className="text-white">What we do:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-1">
                  <li>Send resume text to Google Gemini AI for processing</li>
                  <li>Use the results to generate your career analysis</li>
                  <li>Store results in your account for future reference</li>
                </ul>
                <p>
                  <strong className="text-white">What we don't do:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-1">
                  <li>Share your resume with third parties</li>
                  <li>Use your data for training AI models</li>
                </ul>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={onDecline}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-dark-border text-gray-300 hover:bg-dark-border/50 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setResumeConsent(true);
                    onAccept();
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-primary-blue text-white hover:bg-primary-blue/90 transition-colors text-sm font-medium"
                >
                  I Agree, Continue
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
