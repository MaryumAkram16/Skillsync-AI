import { vi, describe, it, expect, beforeEach } from "vitest";
import { checkAndIncrementUsage, UsageLimitError } from "../services/usageLimits";

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
      doc: vi.fn((id) => ({
        get: mockGet,
        id,
      }))
    })),
    runTransaction: (callback: any) => mockRunTransaction(callback)
  }
}));

describe("Usage Limits Service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("check mode", () => {
    it("should return 0 used and correct limit when no document exists", async () => {
      mockGet.mockResolvedValue({
        exists: false,
        data: () => undefined,
      });

      const res = await checkAndIncrementUsage("user123", "parser", "check");
      expect(res).toEqual({ used: 0, limit: 3 });
    });

    it("should return the correct used count and limit from user document", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({
          metadata: {
            usageCounts: {
              parser: 2,
            },
          },
        }),
      });

      const res = await checkAndIncrementUsage("user123", "parser", "check");
      expect(res).toEqual({ used: 2, limit: 3 });
    });
  });

  describe("increment mode (Free tier)", () => {
    it("should increment and save usage if below limit", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({
          tier: "Free",
          metadata: {
            usageCounts: {
              parser: 1,
            },
          },
        }),
      });

      const res = await checkAndIncrementUsage("user123", "parser", "increment");
      expect(res).toEqual({ used: 2, limit: 3 });
      expect(mockSet).toHaveBeenCalledWith(
        expect.anything(),
        { metadata: { usageCounts: { parser: 2 } } },
        { merge: true }
      );
    });

    it("should throw UsageLimitError if usage is already at limit", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({
          tier: "Free",
          metadata: {
            usageCounts: {
              parser: 3,
            },
          },
        }),
      });

      await expect(
        checkAndIncrementUsage("user123", "parser", "increment")
      ).rejects.toThrow(UsageLimitError);

      expect(mockSet).not.toHaveBeenCalled();
    });

    it("should throw UsageLimitError if usage exceeds limit", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({
          tier: "Free",
          metadata: {
            usageCounts: {
              parser: 4,
            },
          },
        }),
      });

      await expect(
        checkAndIncrementUsage("user123", "parser", "increment")
      ).rejects.toThrow(UsageLimitError);
    });
  });

  describe("increment mode (Pro tier)", () => {
    it("should bypass limits and always increment successfully", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({
          tier: "Pro",
          metadata: {
            usageCounts: {
              parser: 10,
            },
          },
        }),
      });

      const res = await checkAndIncrementUsage("user123", "parser", "increment");
      expect(res).toEqual({ used: 11, limit: Infinity });
      expect(mockSet).toHaveBeenCalledWith(
        expect.anything(),
        { metadata: { usageCounts: { parser: 11 } } },
        { merge: true }
      );
    });
  });
});
