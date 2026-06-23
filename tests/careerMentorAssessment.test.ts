import { vi, describe, it, expect, beforeEach } from "vitest";
import { checkAndIncrementAssessmentLimit } from "../services/careerMentorAssessment";

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockRunTransaction = vi.fn((callback) => {
  const transaction = {
    get: mockGet,
    set: mockSet,
  };
  return callback(transaction);
});

vi.mock("../services/firebaseAdmin", () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn((id) => `doc_ref_${id}`)
    })),
    runTransaction: (callback: any) => mockRunTransaction(callback)
  },
  default: {
    firestore: {
      FieldValue: {
        increment: (x: number) => `increment_${x}`
      }
    }
  }
}));

describe("checkAndIncrementAssessmentLimit", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("permits assessment generation if user document does not exist", async () => {
    mockGet.mockResolvedValueOnce({
      exists: false,
      data: () => undefined
    });

    await expect(checkAndIncrementAssessmentLimit("user1")).resolves.not.toThrow();
    expect(mockSet).toHaveBeenCalled();
  });

  it("permits assessment generation if assessmentCount is below threshold (e.g. 0)", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ metadata: { assessmentCount: 0 } })
    });

    await expect(checkAndIncrementAssessmentLimit("user1")).resolves.not.toThrow();
    expect(mockSet).toHaveBeenCalled();
  });

  it("permits assessment generation if assessmentCount is below threshold (e.g. 2)", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ metadata: { assessmentCount: 2 } })
    });

    await expect(checkAndIncrementAssessmentLimit("user1")).resolves.not.toThrow();
    expect(mockSet).toHaveBeenCalled();
  });

  it("throws error and prevents assessment generation if assessmentCount is exactly threshold (e.g. 3)", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ metadata: { assessmentCount: 3 } })
    });

    await expect(checkAndIncrementAssessmentLimit("user1")).rejects.toThrow(
      "Assessment limit reached. You can only perform up to 3 assessments."
    );
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("throws error and prevents assessment generation if assessmentCount exceeds threshold (e.g. 4)", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ metadata: { assessmentCount: 4 } })
    });

    await expect(checkAndIncrementAssessmentLimit("user1")).rejects.toThrow(
      "Assessment limit reached. You can only perform up to 3 assessments."
    );
    expect(mockSet).not.toHaveBeenCalled();
  });
});
