import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Star, X, ChevronRight, Loader2 } from "lucide-react";
import { Card } from "./Card";
import { Button } from "./Button";
import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

interface PlatformFeedbackModalProps {
  userId: string;
  userName: string;
  onClose: () => void;
  onSubmitted: () => void;
}

const STEP_LABELS = ["Rating", "Experience", "Purchase Intent", "Done"];

export default function PlatformFeedbackModal({
  userId,
  userName,
  onClose,
  onSubmitted,
}: PlatformFeedbackModalProps) {
  const [step, setStep] = useState(1);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [liked, setLiked] = useState("");
  const [improve, setImprove] = useState("");
  const [wouldBuy, setWouldBuy] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canProceedStep1 = rating > 0;
  const canProceedStep2 = true; // text fields optional
  const canProceedStep3 = wouldBuy !== "";

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await addDoc(collection(db, "platformFeedback"), {
        userId,
        userName,
        rating,
        liked: liked.trim(),
        improve: improve.trim(),
        wouldBuy,
        priceRange,
        timestamp: serverTimestamp(),
      });
      onSubmitted();
    } catch (err) {
      console.error("[PlatformFeedback] Submit error:", err);
      onSubmitted(); // close anyway
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm p-4 flex justify-center items-start sm:items-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-md my-auto"
      >
        <Card className="p-6 border-primary-blue/20 relative overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="font-display text-xl font-semibold text-text-primary tracking-tight">
                Share Your Experience
              </h2>
              <p className="text-sm text-text-secondary mt-1">
                Takes 60 seconds — helps us improve SkillSync for everyone
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-border/50 text-text-secondary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Progress */}
          <div className="flex gap-1.5 mb-6">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  s <= step ? "bg-primary-blue" : "bg-border"
                }`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* ── Step 1: Overall Rating ── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div>
                  <p className="text-sm font-bold text-text-primary mb-1">
                    How would you rate SkillSync AI overall?
                  </p>
                  <p className="text-xs text-text-secondary mb-4">
                    Rate your overall experience with the platform
                  </p>
                  <div className="flex gap-2 justify-center py-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        onClick={() => setRating(star)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          className={`h-10 w-10 transition-colors ${
                            star <= (hoveredRating || rating)
                              ? "text-warning fill-warning"
                              : "text-border"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  {rating > 0 && (
                    <p className="text-center text-sm font-medium text-text-secondary mt-2">
                      {["", "Poor", "Fair", "Good", "Very Good", "Excellent!"][rating]}
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="font-mono text-xs text-text-secondary uppercase tracking-widest block mb-1.5">
                      What do you like most? (optional)
                    </label>
                    <textarea
                      value={liked}
                      onChange={(e) => setLiked(e.target.value)}
                      placeholder="e.g. The Market Radar feature is really helpful..."
                      rows={2}
                      maxLength={500}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary-blue resize-none"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-xs text-text-secondary uppercase tracking-widest block mb-1.5">
                      What should we improve? (optional)
                    </label>
                    <textarea
                      value={improve}
                      onChange={(e) => setImprove(e.target.value)}
                      placeholder="e.g. The roadmap generation could be faster..."
                      rows={2}
                      maxLength={500}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary-blue resize-none"
                    />
                  </div>
                </div>

                <Button
                  className="w-full"
                  disabled={!canProceedStep1}
                  onClick={() => setStep(2)}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </motion.div>
            )}

            {/* ── Step 2: Purchase Intent ── */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div>
                  <p className="text-sm font-bold text-text-primary mb-1">
                    If SkillSync AI launched as a paid product, would you subscribe?
                  </p>
                  <p className="text-xs text-text-secondary mb-4">
                    Your honest answer helps us plan the right pricing model
                  </p>
                  <div className="space-y-2">
                    {[
                      { value: "definitely", label: "Yes, definitely" },
                      { value: "if_priced_right", label: "Yes, if priced right" },
                      { value: "maybe", label: "Maybe, need more time with it" },
                      { value: "no", label: "No" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setWouldBuy(opt.value)}
                        className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                          wouldBuy === opt.value
                            ? "border-primary-blue bg-primary-blue/10 text-primary-blue"
                            : "border-border bg-background text-text-primary hover:border-primary-blue/40"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {(wouldBuy === "definitely" || wouldBuy === "if_priced_right") && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                  >
                    <p className="font-mono text-xs text-text-secondary uppercase tracking-widest mb-2">
                      What monthly price feels fair?
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {["Under $5", "$5 – $10", "$10 – $20", "$20+"].map((price) => (
                        <button
                          key={price}
                          onClick={() => setPriceRange(price)}
                          className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                            priceRange === price
                              ? "border-success bg-success/10 text-success"
                              : "border-border bg-background text-text-primary hover:border-success/40"
                          }`}
                        >
                          {price}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={!canProceedStep3 || submitting}
                    onClick={handleSubmit}
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Submit Feedback"
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>
    </div>
  );
}