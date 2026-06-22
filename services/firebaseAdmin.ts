import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "../firebase-applet-config.json";

/**
 * Shared firebase-admin singleton.
 *
 * server.ts already initializes the default admin app for ID-token
 * verification. This guard means any module (careerMentorService.ts,
 * scripts, etc.) can safely import this file standalone — e.g. when run
 * outside server.ts via tsx — without double-initializing.
 *
 * IMPORTANT: this is for trusted, server-internal reads/writes only
 * (data we've already authorized one layer up, e.g. via requireAuth's
 * verifiedUid). It bypasses Firestore security rules entirely. Don't use
 * this for anything where the rules are the actual security boundary —
 * that's what the client SDK + firestore.rules is for.
 */
if (!admin.apps || admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: firebaseConfig.projectId,
  });
}

const FIRESTORE_DATABASE_ID = (firebaseConfig as any).firestoreDatabaseId as string | undefined;

export const adminDb = FIRESTORE_DATABASE_ID
  ? getFirestore(admin.app(), FIRESTORE_DATABASE_ID)
  : getFirestore(admin.app());

export default admin;