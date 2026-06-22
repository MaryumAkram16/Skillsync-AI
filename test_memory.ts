import { generateAssessmentStage1, analyzeStage1AndGenerateStage2, submitAdaptiveAssessment } from "./services/careerMentorService";
import { getPersistentCache } from "./services/persistentCache";

async function run() {
  console.log("Running in memory...");
  const TEST_USER_ID = "memory_test_123";
  try {
    const stage1 = await generateAssessmentStage1(
      TEST_USER_ID,
      [{ name: "React", level: "Beginner" }],
      "Degree",
      "USA"
    );
    console.log("Stage 1 generated", stage1.quiz?.length, "questions.");

    // See if session cached in persistentCache
    const sessionDoc = await getPersistentCache("assessment_session", TEST_USER_ID);
    console.log("Session in cache after Stage 1:", !!sessionDoc);

  } catch(e) {
    console.error(e);
  }
}
run();
