import { adminDb } from "./firebaseAdmin";

const DEFAULT_LIMITS: Record<string, number> = {
  parser: 3,
  resumeTools: 3,
  careerMentor: 3,
  radar: 5,
  roadmap: 2,
  interviewPrep: 3,
  assessment: 3,
};

export class UsageLimitError extends Error {
  featureKey: string;
  limit: number;
  used: number;

  constructor(featureKey: string, limit: number, used: number) {
    super(`Usage limit reached for ${featureKey}. Limit: ${limit}.`);
    this.name = "UsageLimitError";
    this.featureKey = featureKey;
    this.limit = limit;
    this.used = used;
  }
}

export async function checkAndIncrementUsage(
  userId: string,
  featureKey: string,
  mode: "check" | "increment" = "increment"
): Promise<{ used: number; limit: number }> {
  const limit = DEFAULT_LIMITS[featureKey] ?? 3;
  const userRef = adminDb.collection("users").doc(userId);

  if (mode === "check") {
    const doc = await userRef.get();
    const used = doc.data()?.metadata?.usageCounts?.[featureKey] ?? 0;
    return { used, limit };
  }

  return adminDb.runTransaction(async (tx) => {
    const doc = await tx.get(userRef);
    const data = doc.data();
    const tier = data?.tier || "Free";
    if (tier === "Pro") {
      const used = data?.metadata?.usageCounts?.[featureKey] ?? 0;
      tx.set(userRef, { metadata: { usageCounts: { [featureKey]: used + 1 } } }, { merge: true });
      return { used: used + 1, limit: Infinity };
    }

    const used = data?.metadata?.usageCounts?.[featureKey] ?? 0;
    if (used >= limit) {
      throw new UsageLimitError(featureKey, limit, used);
    }
    tx.set(userRef, { metadata: { usageCounts: { [featureKey]: used + 1 } } }, { merge: true });
    return { used: used + 1, limit };
  });
}
