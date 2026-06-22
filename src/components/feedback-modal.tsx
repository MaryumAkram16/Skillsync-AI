import React, { useState } from 'react'
import { db } from '../firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { Star, X, CheckCircle2 } from 'lucide-react'

interface FeedbackModalProps {
  isOpen: boolean
  featureId: string
  featureName: string
  userId: string
  onClose: () => void
}

export default function FeedbackModal({
  isOpen,
  featureId,
  featureName,
  userId,
  onClose,
}: FeedbackModalProps) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (rating === 0) {
      alert('Please select a rating')
      return
    }

    setLoading(true)
    try {
      await addDoc(collection(db, 'userFeedback'), {
        userId,
        feature: featureId,
        rating,
        comment: comment || '',
        timestamp: serverTimestamp(),
      })

      setSubmitted(true)
      setTimeout(() => {
        onClose()
        resetForm()
      }, 2000)
    } catch (error) {
      console.error('Error submitting feedback:', error)
      alert('Error submitting feedback. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setRating(0)
    setComment('')
    setSubmitted(false)
  }

  const ratingLabel: Record<number, string> = {
    0: 'Select a rating',
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Very Good',
    5: 'Excellent',
  }

  return (
    // FIX: overlay changed from bg-black/50 to bg-black/30 so page stays visible behind it
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {/* FIX: card now uses dark theme colors matching the rest of the app */}
      <div
        className="rounded-2xl shadow-2xl max-w-md w-full border border-[#374151]"
        style={{ backgroundColor: '#1f2937' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#374151]">
          <div>
            <h2 className="font-display text-base font-semibold text-[#f3f4f6] uppercase tracking-widest">
              Rate this feature
            </h2>
            <p className="text-xs text-[#9ca3af] mt-0.5">{featureName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#9ca3af] hover:text-[#f3f4f6] transition-colors p-1 rounded-lg hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!submitted ? (
            <div className="space-y-6">
              {/* Stars */}
              <div className="text-center">
                <div className="flex justify-center gap-3 mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="focus:outline-none transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-9 h-9 transition-colors ${
                          star <= (hoverRating || rating)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-[#374151]'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <span className="text-sm font-semibold text-[#10b981]">
                  {ratingLabel[rating]}
                </span>
              </div>

              {/* Comment */}
              <div>
                <label className="block font-mono text-xs uppercase tracking-widest text-[#9ca3af] mb-2">
                  Additional feedback (optional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, 200))}
                  placeholder="What could we improve?"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl text-sm text-[#f3f4f6] placeholder-[#6b7280]
                    border border-[#374151] outline-none resize-none
                    focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] transition-colors"
                  style={{ backgroundColor: '#111827' }}
                />
                <p className="text-xs text-[#6b7280] mt-1 text-right">
                  {comment.length}/200
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 border border-[#374151] text-[#9ca3af]
                    rounded-xl hover:bg-white/5 transition-colors text-sm font-medium"
                >
                  Skip
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || rating === 0}
                  className="flex-1 px-4 py-2.5 bg-[#10b981] text-white rounded-xl
                    hover:bg-[#059669] transition-colors text-sm font-bold
                    disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-[#10b981]/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#10b981]/30">
                <CheckCircle2 className="w-7 h-7 text-[#10b981]" />
              </div>
              <h3 className="font-display text-base font-semibold text-[#f3f4f6] uppercase tracking-widest mb-1">
                Thank you!
              </h3>
              <p className="text-sm text-[#9ca3af]">
                Your feedback helps us improve SkillSync
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#374151] rounded-b-2xl">
          <p className="text-xs text-[#6b7280] text-center">
            Feedback is saved securely and helps us build better features
          </p>
        </div>
      </div>
    </div>
  )
}