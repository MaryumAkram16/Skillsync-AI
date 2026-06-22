import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile as updateFirebaseProfile
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrors';

import { UserProfileExtensions, SkillSyncScore } from '../types/profile';

export interface UserProfile extends UserProfileExtensions {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  photoURL?: string;
  role: string;
  location: string;
  experience: string;
  score: number;
  tier: 'Free' | 'Pro';
  createdAt: string;
  isAdmin?: boolean; 
  lastActive?: string;
  fieldOfStudy?: string;
  skills?: string[];
  learningPath?: {
    skillName: string;
    learnUrl: string;
    title: string;
  }[];
  completedResources?: string[];
}

interface UserContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  isAuthReady: boolean;
  isLoggedIn: boolean;
  isAdmin: boolean; // <-- ADDED
  firstName: string;
  fullName: string;
  initials: string;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signupWithEmail: (email: string, pass: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const cached = localStorage.getItem('skillsync_profile');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [isAuthReady, setIsAuthReady] = useState(false);

  const firstName = user?.firstName || (user?.email ? user.email.split('@')[0] : 'User');
  const fullName = user ? (`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email) : '';
  const initials = user ? (
    (user.firstName && user.lastName) 
      ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
      : (user.firstName 
          ? user.firstName.slice(0, 2).toUpperCase()
          : (user.email ? user.email.slice(0, 2).toUpperCase() : 'US'))
  ) : 'US';
  const isAdmin = !!(user?.isAdmin);

  useEffect(() => {
    if (user) {
      localStorage.setItem('skillsync_profile', JSON.stringify(user));
    } else if (isAuthReady && !firebaseUser) {
      localStorage.removeItem('skillsync_profile');
    }
  }, [user, isAuthReady, firebaseUser]);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (fUser) => {
      setFirebaseUser(fUser);
      
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (fUser) {
        const userDocRef = doc(db, 'users', fUser.uid);
        
        unsubProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setUser(docSnap.data() as UserProfile);
          } else {
            const names = fUser.displayName?.split(' ') || ['User', ''];
            const initialProfile: UserProfile = {
              uid: fUser.uid,
              firstName: names[0],
              lastName: names.slice(1).join(' '),
              email: fUser.email || '',
              photoURL: fUser.photoURL || '',
              role: 'Job Seeker',
              location: 'Not specified',
              experience: 'Entry Level',
              score: 0,
              tier: 'Free',
              createdAt: new Date().toISOString(),
              isAdmin: false,
              savedAssessments: [],
              savedCareerReports: [],
              savedRoadmaps: [],
              savedRadarAnalyses: [],
              savedResumeItems: [],
              savedGapAnalyses: [],
              savedInterviewSessions: [],
              savedJobs: [],
              hasGivenPlatformFeedback: false,
              skillSyncScore: {
                total: 0,
                categories: {
                  assessment: 0,
                  careerMentor: 0,
                  roadmap: 0,
                  radar: 0,
                  resume: 0,
                  gapMap: 0,
                  interview: 0
                }
              },
              scoreHistory: []
            };
            
            setDoc(userDocRef, initialProfile).catch(err => {
              handleFirestoreError(err, OperationType.CREATE, `users/${fUser.uid}`);
            });
          }
          setIsAuthReady(true);
        }, (err) => {
          console.error("Profile listener error:", err);
          handleFirestoreError(err, OperationType.GET, `users/${fUser.uid}`);
          setIsAuthReady(true);
        });
      } else {
        setUser(null);
        setIsAuthReady(true);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google login failed:", error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error("Email login failed:", error);
      throw error;
    }
  };

  const signupWithEmail = async (email: string, pass: string, fName: string, lName: string) => {
    try {
      const { user: fUser } = await createUserWithEmailAndPassword(auth, email, pass);
      
      await updateFirebaseProfile(fUser, {
        displayName: `${fName} ${lName}`
      });

      const userDocRef = doc(db, 'users', fUser.uid);
      const initialProfile: UserProfile = {
        uid: fUser.uid,
        firstName: fName,
        lastName: lName,
        email: email,
        photoURL: '',
        role: 'Job Seeker',
        location: 'Not specified',
        experience: 'Entry Level',
        score: 0,
        tier: 'Free',
        createdAt: new Date().toISOString(),
        isAdmin: false,
        savedAssessments: [],
        savedCareerReports: [],
        savedRoadmaps: [],
        savedRadarAnalyses: [],
        savedResumeItems: [],
        savedGapAnalyses: [],
        savedInterviewSessions: [],
        savedJobs: [],
        hasGivenPlatformFeedback: false,
        skillSyncScore: {
          total: 0,
          categories: {
            assessment: 0,
            careerMentor: 0,
            roadmap: 0,
            radar: 0,
            resume: 0,
            gapMap: 0,
            interview: 0
          }
        },
        scoreHistory: []
      };
      
      await setDoc(userDocRef, initialProfile);
    } catch (error) {
      console.error("Email signup failed:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem("skillsync_profile");
      // Note: we intentionally do NOT remove skillsync_chatbot_history_${uid} /
      // skillsync_chatbot_session_${uid} here — those are scoped per-uid already,
      // so no other user can ever see them, and keeping them lets this user
      // resume their conversation next time they log back in.
      // Defensive cleanup of any legacy unscoped keys from before per-user scoping.
      localStorage.removeItem("skillsync_chatbot_history");
      localStorage.removeItem("skillsync_chatbot_session");
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
      throw error;
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!firebaseUser) return;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    try {
      await setDoc(userDocRef, { ...user, ...updates }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${firebaseUser.uid}`);
    }
  };

  return (
    <UserContext.Provider value={{ 
      user, 
      firebaseUser, 
      isAuthReady, 
      isLoggedIn: !!firebaseUser,
      isAdmin, // <-- ADDED
      firstName,
      fullName,
      initials,
      loginWithGoogle,
      loginWithEmail,
      signupWithEmail,
      logout,
      updateProfile
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}