import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseResumeAndFindJobs } from '../../services/parserService';

// Mock Firebase Admin
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockRunTransaction = vi.fn((callback) => {
  const transaction = {
    get: mockGet,
    set: mockSet,
  };
  return callback(transaction);
});

vi.mock('../../services/firebaseAdmin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn((id) => ({
        get: mockGet,
        set: mockSet,
        id,
      }))
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

describe('Job Search Service - Graceful Error & Fallback Handling', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.RAPIDAPI_KEY = 'mock-api-key';
    
    // Default mock behavior for limit checks
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        metadata: {
          parserCount: 0,
        },
      }),
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('should handle zero-results from API gracefully and return fallback empty result instead of throwing', async () => {
    // Mock global fetch to return an empty JSON response (data: [])
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    // Call the parseResumeAndFindJobs function which performs the job fetch and resumes parse
    const result = await parseResumeAndFindJobs(
      'test-user-id',
      'Developed react apps. Experience 2 years.',
      'Software Engineer',
      'United States',
      'Full-time',
      'Remote'
    );

    // Verify it returned a valid fallback result structure instead of throwing
    expect(result).toBeDefined();
    expect(result.topJobs).toEqual([]);
    expect(result.missingSkills).toEqual([]);
    expect(result.aggregatedSkills).toEqual({
      jobSkills: { high: [], medium: [], low: [] },
      candidateSkills: [],
      gapScore: 0,
    });

    // Ensure fetch was actually called (it attempts to call and then retries)
    expect(mockFetch).toHaveBeenCalled();
  });

  it('should handle JSearch API keys missing error gracefully and return fallback empty result', async () => {
    // Remove API keys to simulate unconfigured environment
    delete process.env.RAPIDAPI_KEY;
    delete process.env.RAPID_API_KEY;
    delete process.env.RAPIDAPI_KEY_2;
    delete process.env.RAPID_API_KEY_2;

    const result = await parseResumeAndFindJobs(
      'test-user-id',
      'Developed react apps. Experience 2 years.',
      'Software Engineer',
      'United States',
      'Full-time',
      'Remote'
    );

    // Should return fallback empty result
    expect(result).toBeDefined();
    expect(result.topJobs).toEqual([]);
    expect(result.missingSkills).toEqual([]);
  });
});
