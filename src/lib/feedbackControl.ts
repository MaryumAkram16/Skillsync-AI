/**
 * Smart Logic for auto-prompting feedback modal.
 * Tracks usage counts and display history in localStorage.
 */

export interface FeedbackConfig {
  shown: number;
  used: number;
  lastAt: number;
}

const STORAGE_KEYS = {
  COUNT: 'skillsync_feedback_count',
  USED: 'skillsync_features_used',
  LAST_AT: 'skillsync_last_feedback_at'
};

export const getFeedbackConfig = (): FeedbackConfig => {
  return {
    shown: Number(localStorage.getItem(STORAGE_KEYS.COUNT) || 0),
    used: Number(localStorage.getItem(STORAGE_KEYS.USED) || 0),
    lastAt: Number(localStorage.getItem(STORAGE_KEYS.LAST_AT) || 0)
  };
};

export const incrementFeaturesUsed = () => {
  const current = Number(localStorage.getItem(STORAGE_KEYS.USED) || 0);
  const next = current + 1;
  localStorage.setItem(STORAGE_KEYS.USED, String(next));
  return next;
};

export const markFeedbackShown = () => {
  const config = getFeedbackConfig();
  localStorage.setItem(STORAGE_KEYS.COUNT, String(config.shown + 1));
  localStorage.setItem(STORAGE_KEYS.LAST_AT, String(config.used));
};

export const shouldShowFeedback = (currentUsed?: number): boolean => {
  const config = getFeedbackConfig();
  const shown = config.shown;
  const used = currentUsed !== undefined ? currentUsed : config.used;
  const lastAt = config.lastAt;
  
  // Maximum 3 feedback prompts per session total
  if (shown >= 3) return false;
  
  // First prompt: after user completes 2 features
  if (shown === 0 && used >= 2) return true;
  
  // If user dismisses/skips: wait 4 more features
  if (shown === 1 && used >= lastAt + 4) return true;
  
  // If dismissed again: show after 6 more
  if (shown === 2 && used >= lastAt + 6) return true;
  
  return false;
};

export const triggerFeedbackWithDelay = (showCallback: () => void, delayMs = 2500) => {
  // First increment the count of features used
  const nextUsed = incrementFeaturesUsed();
  
  // Check if we should prompt
  if (shouldShowFeedback(nextUsed)) {
    setTimeout(() => {
      showCallback();
      markFeedbackShown();
    }, delayMs);
  }
};
