import { vi, describe, it, expect, beforeEach } from "vitest";
import { checkAssessmentLimit } from "../services/careerMentorAssessment";

const mockGet = vi.fn();
const mockDoc = vi.fn(() => ({
  get: mockGet
}));

vi.mock("../services/firebaseAdmin", () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: mockDoc
    }))
  },
  default: {
    firestore: {
      FieldValue: {
        increment: (x: number) => `increment_${x}`
      }
    }
  }
}));

describe("checkAssessmentLimit", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("permits assessment generation if user document does not exist", async () => {
    mockGet.mockResolvedValueOnce({
      exists: false,
      data: () => undefined
    });

    await expect(checkAssessmentLimit("user1")).resolves.not.toThrow();
  });

  it("permits assessment generation if assessmentCount is below threshold (e.g. 0)", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ metadata: { assessmentCount: 0 } })
    });

    await expect(checkAssessmentLimit("user1")).resolves.not.toThrow();
  });

  it("permits assessment generation if assessmentCount is below threshold (e.g. 2)", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ metadata: { assessmentCount: 2 } })
    });

    await expect(checkAssessmentLimit("user1")).resolves.not.toThrow();
  });

  it("throws error and prevents assessment generation if assessmentCount is exactly threshold (e.g. 3)", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ metadata: { assessmentCount: 3 } })
    });

    await expect(checkAssessmentLimit("user1")).rejects.toThrow(
      "Assessment limit reached. You can only perform up to 3 assessments."
    );
  });

  it("throws error and prevents assessment generation if assessmentCount exceeds threshold (e.g. 4)", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ metadata: { assessmentCount: 4 } })
    });

    await expect(checkAssessmentLimit("user1")).rejects.toThrow(
      "Assessment limit reached. You can only perform up to 3 assessments."
    );
  });
});
