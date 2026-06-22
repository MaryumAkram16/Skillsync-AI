import { doc, updateDoc, arrayUnion, runTransaction, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../context/UserContext';
import { SavedResult, SkillSyncScore, ScoreHistoryEntry } from '../types/profile';

/**
 * Calculates current SkillSync score based on user profile contents
 */
export function calculateScore(profile: Partial<UserProfile>): SkillSyncScore {
  const categories = {
    assessment: (profile.savedAssessments?.length || 0) > 0 ? 15 : 0,
    careerMentor: (profile.savedCareerReports?.length || 0) > 0 ? 15 : 0,
    roadmap: (profile.savedRoadmaps?.length || 0) > 0 ? 15 : 0,
    radar: (profile.savedRadarAnalyses?.length || 0) > 0 ? 15 : 0,
    resume: Math.min((profile.savedResumeItems?.length || 0) * 5, 15),
    gapMap: (profile.savedGapAnalyses?.length || 0) > 0 ? 10 : 0,
    interview: Math.min((profile.savedInterviewSessions?.length || 0) * 5, 15),
  };

  const total = Object.values(categories).reduce((acc, curr) => acc + curr, 0);

  return {
    total: Math.min(total, 100),
    categories
  };
}

const EMPTY_PROFILE = {
  savedAssessments: [],
  savedCareerReports: [],
  savedRoadmaps: [],
  savedRadarAnalyses: [],
  savedResumeItems: [],
  savedGapAnalyses: [],
  savedInterviewSessions: [],
  skillSyncScore: {
    total: 0,
    categories: {
      assessment: 0, careerMentor: 0, roadmap: 0,
      radar: 0, resume: 0, gapMap: 0, interview: 0,
    }
  },
  scoreHistory: [],
  score: 0,
};

/**
 * Centralized service to save any feature result to the user profile
 * and trigger score recalculation.
 *
 * Includes a race-condition guard: if the Firestore profile document
 * doesn't exist yet (can happen when a user navigates to a feature
 * immediately after sign-in before UserContext's setDoc completes),
 * we create it on the fly inside the same transaction rather than throwing.
 */
export async function saveResultToProfile(userId: string, result: SavedResult) {
  const userDocRef = doc(db, 'users', userId);

  try {
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userDocRef);

      // ── Race condition guard ─────────────────────────────────────────────
      // Profile creation in UserContext is fire-and-forget (.catch only).
      // If the user navigates quickly, the document may not exist yet.
      // Create a fallback profile inside this transaction instead of throwing.
      const profile = userDoc.exists()
        ? (userDoc.data() as UserProfile)
        : ({ ...EMPTY_PROFILE } as unknown as UserProfile);

      if (!userDoc.exists()) {
        transaction.set(userDocRef, {
          ...EMPTY_PROFILE,
          uid: userId,
          firstName: 'User',
          lastName: '',
          email: 'pending@example.com',
          role: 'Job Seeker',
          location: 'Not specified',
          experience: 'Entry Level',
          tier: 'Free',
          createdAt: new Date().toISOString(),
          isAdmin: false
        });
      }
      // ────────────────────────────────────────────────────────────────────

      let fieldName: keyof UserProfile;
      let scoreReason = "";

      switch (result.type) {
        case 'skill-assessment':
          fieldName = 'savedAssessments';
          scoreReason = "Completed Skill Assessment";
          break;
        case 'career-mentor':
          fieldName = 'savedCareerReports';
          scoreReason = "Generated Career Mentor Report";
          break;
        case 'roadmap':
          fieldName = 'savedRoadmaps';
          scoreReason = "Created Career Roadmap";
          break;
        case 'radar':
          fieldName = 'savedRadarAnalyses';
          scoreReason = "Analyzed Market Radar";
          break;
        case 'resume-tool':
          fieldName = 'savedResumeItems';
          scoreReason = `Saved ${result.subType.replace('-', ' ')}`;
          break;
        case 'gap-map':
          fieldName = 'savedGapAnalyses';
          scoreReason = "Completed Gap Analysis";
          break;
        case 'interview-training':
          fieldName = 'savedInterviewSessions';
          scoreReason = `Completed Interview ${result.mode === 'quiz' ? 'Quiz' : 'Training'}`;
          break;
        default:
          throw new Error("Invalid result type");
      }

      // 1. Add result to correct array
      const currentArray = (profile[fieldName] as any[]) || [];
      const updatedArray = [result, ...currentArray].slice(0, 10);

      // 2. Recalculate score
      const updatedProfileSlice = { ...profile, [fieldName]: updatedArray };
      const newScore = calculateScore(updatedProfileSlice);

      // 3. Create history entry
      const historyEntry: ScoreHistoryEntry = {
        timestamp: new Date().toISOString(),
        score: newScore.total,
        change: newScore.total - (profile.skillSyncScore?.total || 0),
        reason: scoreReason
      };

      const updatedHistory = [historyEntry, ...(profile.scoreHistory || [])].slice(0, 20);

      // 4. Update the document
      transaction.update(userDocRef, {
        [fieldName]: updatedArray,
        skillSyncScore: newScore,
        scoreHistory: updatedHistory,
        score: newScore.total
      });
    });
  } catch (error) {
    console.error("Error saving result to profile:", error);
    throw error;
  }
}

/**
 * Exports user profile data as JSON
 */
export function exportProfileData(profile: UserProfile) {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(profile, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", `SkillSync_Profile_${profile.firstName}.json`);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

/**
 * Resets user profile data (keeps basics)
 */
export async function clearProfileData(userId: string) {
  const userDocRef = doc(db, 'users', userId);
  try {
    await updateDoc(userDocRef, { 
      savedAssessments: [],
      savedCareerReports: [],
      savedRoadmaps: [],
      savedRadarAnalyses: [],
      savedResumeItems: [],
      savedGapAnalyses: [],
      savedInterviewSessions: [],
      skillSyncScore: {
        total: 0,
        categories: {
          assessment: 0, careerMentor: 0, roadmap: 0,
          radar: 0, resume: 0, gapMap: 0, interview: 0,
        }
      },
      scoreHistory: [],
      score: 0
    });
  } catch (error) {
    console.error("Error clearing profile data:", error);
    throw error;
  }
}