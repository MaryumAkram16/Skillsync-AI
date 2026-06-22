/**
 * test_adaptive_assessment.ts
 *
 * Standalone round-trip test for the Tier 3 adaptive assessment session
 * lifecycle. Run this directly in your dev environment (real env vars,
 * real Firestore) — it bypasses HTTP/auth and calls the service functions
 * directly, so it isolates "does the Firestore session logic actually
 * work" from "is the auth middleware configured right."
 *
 * Usage:
 *   npx tsx test_adaptive_assessment.ts
 *   (or: npx ts-node test_adaptive_assessment.ts)
 *
 * Requires the same env vars your server needs: OPENAI_API_KEY and/or
 * GEMINI_API_KEY, plus whatever Firebase Admin credentials your
 * environment normally picks up (applicationDefault()).
 *
 * What this checks, in order:
 *   1. Stage 1 generates 5 questions AND writes a session doc to Firestore
 *   2. Stage 2 analysis reads that session, grades Stage 1 locally,
 *      generates 5 branched questions, and re-saves the session with
 *      Stage 1 answers/score filled in
 *   3. Final submit reads the session again, merges both stages, grades
 *      everything, and then clears the session
 *   4. After submit, the session is actually gone (so a stale session
 *      can't leak into a future assessment for the same user)
 *   5. Calling Stage 2 or submit with NO prior session throws the
 *      expected "session expired" error rather than crashing oddly
 */

import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json";

// ── Init Firebase Admin (mirrors server.ts) ────────────────────────────────
if (!admin.apps || admin.apps.length === 0) {
  if (firebaseConfig.projectId) {
    process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;
    process.env.GCLOUD_PROJECT = firebaseConfig.projectId;
  }
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: firebaseConfig.projectId,
  });
}

const FIRESTORE_DATABASE_ID = (firebaseConfig as any).firestoreDatabaseId as string | undefined;
function getDb() {
  return FIRESTORE_DATABASE_ID ? getFirestore(FIRESTORE_DATABASE_ID) : getFirestore();
}

// Use a clearly-fake, namespaced test user so this never collides with a
// real account, and so cleanup at the end is unambiguous.
const TEST_USER_ID = `_test_adaptive_${Date.now()}`;
const SESSION_COLLECTION = "ai_cache_assessment_session"; // matches COLLECTION_PREFIX + namespace in persistentCache.ts

import { getPersistentCache, setPersistentCache } from "./services/persistentCache";

async function getSessionDoc() {
  return await getPersistentCache(SESSION_COLLECTION.replace("ai_cache_", ""), TEST_USER_ID);
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`  ✓ ${message}`);
}

async function main() {
  console.log(`\n=== Tier 3 Adaptive Assessment — Firestore Round-Trip Test ===`);
  console.log(`Test user: ${TEST_USER_ID}\n`);

  const {
    generateAssessmentStage1,
    analyzeStage1AndGenerateStage2,
    submitAdaptiveAssessment,
  } = await import("./services/careerMentorService");

  // ── Step 0: confirm no session exists yet ─────────────────────────────
  console.log("Step 0: Pre-check — no session should exist yet");
  const preCheck = await getSessionDoc();
  assert(preCheck === null, "no stale session doc before test starts");

  // ── Step 1: Stage 1 generation ──────────────────────────────────────────
  console.log("\nStep 1: Generating Stage 1 (baseline) questions...");
  const stage1Result = await generateAssessmentStage1(
    TEST_USER_ID,
    [
      { name: "JavaScript", level: "Intermediate" },
      { name: "React", level: "Intermediate" },
      { name: "Communication", level: "Beginner" },
    ],
    "Bachelor's in Computer Science",
    "Pakistan"
  );
  assert(stage1Result.stage === 1, "stage1Result.stage === 1");
  assert(Array.isArray(stage1Result.quiz) && stage1Result.quiz.length > 0, "Stage 1 quiz has questions");
  console.log(`    Generated ${stage1Result.quiz.length} questions`);

  console.log("\nStep 1b: Verifying session doc was written to Firestore...");
  const sessionAfterStage1 = await getSessionDoc();
  assert(sessionAfterStage1 !== null, "session doc exists in cache after Stage 1");
  const stage1Value = sessionAfterStage1 as any;
  assert(
    Array.isArray(stage1Value?.stage1Quiz) && stage1Value.stage1Quiz.length === stage1Result.quiz.length,
    "persisted stage1Quiz matches what was returned to the caller"
  );
  assert(
    Array.isArray(stage1Value?.stage1Answers) && stage1Value.stage1Answers.length === 0,
    "stage1Answers is empty before grading (not yet submitted)"
  );

  // ── Step 2: Stage 2 analysis + generation ───────────────────────────────
  console.log("\nStep 2: Submitting fake Stage 1 answers, generating Stage 2...");
  // Deliberately wrong answers so we get a non-trivial category score to
  // verify branching logic actually receives real data (not just zeros).
  const fakeStage1Answers = stage1Result.quiz.map((_, i) => (i % 2 === 0 ? "A" : "B"));
  const stage2Result = await analyzeStage1AndGenerateStage2(TEST_USER_ID, fakeStage1Answers);
  assert(stage2Result.stage === 2, "stage2Result.stage === 2");
  assert(Array.isArray(stage2Result.quiz) && stage2Result.quiz.length > 0, "Stage 2 quiz has questions");
  assert(typeof stage2Result.stage1Score === "number", "stage1Score is a number");
  assert(
    typeof stage2Result.stage1CategoryScores === "object",
    "stage1CategoryScores object returned"
  );
  console.log(`    Stage 1 graded score: ${stage2Result.stage1Score}%`);
  console.log(`    Stage 1 category scores: ${JSON.stringify(stage2Result.stage1CategoryScores)}`);
  console.log(`    Stage 2 adaptive: ${stage2Result.adaptive} (false = fell back to non-adaptive)`);
  console.log(`    Generated ${stage2Result.quiz.length} Stage 2 questions`);

  console.log("\nStep 2b: Verifying session was updated with graded Stage 1 data...");
  const sessionAfterStage2 = await getSessionDoc();
  const stage2Value = sessionAfterStage2 as any;
  assert(
    Array.isArray(stage2Value?.stage1Answers) && stage2Value.stage1Answers.length === fakeStage1Answers.length,
    "persisted stage1Answers now matches submitted answers"
  );
  assert(stage2Value?.stage1Score === stage2Result.stage1Score, "persisted stage1Score matches returned score");

  // ── Step 3: Final submit ────────────────────────────────────────────────
  console.log("\nStep 3: Submitting Stage 2 answers, getting final merged result...");
  const fakeStage2Answers = stage2Result.quiz.map((_, i) => (i % 2 === 0 ? "C" : "D"));
  const finalResult = await submitAdaptiveAssessment(TEST_USER_ID, stage2Result.quiz, fakeStage2Answers);
  assert(typeof finalResult.score === "number", "final result has a numeric score");
  assert(
    finalResult.breakdown.length === stage1Result.quiz.length + stage2Result.quiz.length,
    `breakdown merges both stages (${stage1Result.quiz.length} + ${stage2Result.quiz.length} = ${finalResult.breakdown.length} questions)`
  );
  assert(finalResult.isAdaptive === true, "final result flagged as adaptive");
  assert(finalResult.stage1Score === stage2Result.stage1Score, "final result carries forward the Stage 1 score");
  console.log(`    Final combined score: ${finalResult.score}%`);
  console.log(`    Misconception patterns: ${JSON.stringify(finalResult.misconceptionPatterns)}`);

  // ── Step 4: Session should be cleared after submit ──────────────────────
  console.log("\nStep 4: Verifying session was cleared after final submit...");
  const sessionAfterSubmit = await getSessionDoc();
  assert(sessionAfterSubmit === null, "session is cleared (null) immediately after submit");

  // ── Step 5: Calling Stage 2 / submit on a fresh user with no session ───
  console.log("\nStep 5: Verifying clean 'session expired' errors with no prior session...");
  const ghostUserId = `_test_ghost_${Date.now()}`;
  let stage2ThrewExpectedError = false;
  try {
    await analyzeStage1AndGenerateStage2(ghostUserId, ["A", "B", "C", "D", "A"]);
  } catch (e: any) {
    stage2ThrewExpectedError = /session/i.test(e.message);
    console.log(`    Stage 2 error message: "${e.message}"`);
  }
  assert(stage2ThrewExpectedError, "Stage 2 throws a session-related error with no prior Stage 1");

  let submitThrewExpectedError = false;
  try {
    await submitAdaptiveAssessment(ghostUserId, [], []);
  } catch (e: any) {
    submitThrewExpectedError = /session/i.test(e.message);
    console.log(`    Submit error message: "${e.message}"`);
  }
  assert(submitThrewExpectedError, "Submit throws a session-related error with no prior session");

  console.log("\n=== ALL CHECKS PASSED ===\n");
}

main()
  .catch((err) => {
    console.error("\n❌ TEST FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    // ── Cleanup: remove any test docs this run created, win or lose ──────
    try {
      await setPersistentCache(SESSION_COLLECTION.replace("ai_cache_", ""), TEST_USER_ID, null, 1);
      console.log(`Cleaned up test session doc for ${TEST_USER_ID}`);
    } catch (e) {
      console.warn("Cleanup warning (non-fatal):", (e as any)?.message);
    }
  });
