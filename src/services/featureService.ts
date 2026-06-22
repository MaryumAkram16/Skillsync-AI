import React, { useState } from 'react'
import { db } from '../firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

import { triggerFeedbackWithDelay } from '../lib/feedbackControl'

// Feature tracking
export async function trackFeatureStart(
  userId: string,
  featureId: string,
  featureName: string
) {
  try {
    // Store start time in sessionStorage to calculate duration later
    const startTime = Date.now()
    sessionStorage.setItem(
      `feature_${featureId}_start`,
      startTime.toString()
    )
    
    // Log to activity
    await addDoc(collection(db, 'activityLog'), {
      userId,
      type: 'pathway-started',
      details: `Started using ${featureName}`,
      timestamp: serverTimestamp(),
    })
  } catch (error) {
    console.error('Error tracking feature start:', error)
  }
}

export async function trackFeatureCompletion(
  userId: string,
  featureId: string,
  featureName: string,
  onShowFeedback: () => void
) {
  try {
    const startTimeStr = sessionStorage.getItem(
      `feature_${featureId}_start`
    )
    const startTime = startTimeStr ? parseInt(startTimeStr) : Date.now()
    const endTime = Date.now()
    const timeSpent = Math.round((endTime - startTime) / 1000) // in seconds

    // Log to feature usage
    await addDoc(collection(db, 'featureUsage'), {
      userId,
      feature: featureId,
      action: 'completed',
      timeSpent,
      timestamp: serverTimestamp(),
    })

    // Log to activity log
    await addDoc(collection(db, 'activityLog'), {
      userId,
      type: 'pathway-started', // Maybe add 'feature-completed' to enum later
      details: `Completed ${featureName} in ${timeSpent}s`,
      timestamp: serverTimestamp(),
    })

    // Clear session storage
    sessionStorage.removeItem(`feature_${featureId}_start`)

    // Use smart feedback logic with delay
    triggerFeedbackWithDelay(onShowFeedback);
  } catch (error) {
    console.error('Error tracking feature completion:', error)
  }
}

// Feature usage hook helper
export interface FeedbackState {
  isOpen: boolean
  featureId: string
  featureName: string
}

export function useFeedbackModal(userId: string) {
  const [feedback, setFeedback] = useState<FeedbackState>({
    isOpen: false,
    featureId: '',
    featureName: '',
  })

  const showFeedback = (featureId: string, featureName: string) => {
    setFeedback({
      isOpen: true,
      featureId,
      featureName,
    })
  }

  const closeFeedback = () => {
    setFeedback((prev) => ({ ...prev, isOpen: false }))
  }

  const trackCompletion = async (
    featureId: string,
    featureName: string
  ) => {
    await trackFeatureCompletion(
      userId,
      featureId,
      featureName,
      () => showFeedback(featureId, featureName)
    )
  }

  return {
    feedback,
    showFeedback,
    closeFeedback,
    trackCompletion,
  }
}

// Feature name mapping
export const FEATURE_NAMES: Record<string, string> = {
  'skill-assessment': 'Skill Assessment',
  'career-mentor': 'Career Mentor',
  radar: 'Market Radar',
  parser: 'Resume Parser',
  'resume-tools': 'Resume Tools',
  gapmap: 'GapMap',
  roadmap: 'Roadmap',
  'interview-prep': 'Interview Prep',
}

// Initialize feature tracking for a user
export async function logUserActivity(
  userId: string,
  type: "login" | "logout" | "resume-generated" | "pathway-started",
  details: string
) {
  try {
    await addDoc(collection(db, 'activityLog'), {
      userId,
      type,
      details,
      timestamp: serverTimestamp(),
    })
  } catch (error) {
    console.error('Error logging activity:', error)
  }
}
