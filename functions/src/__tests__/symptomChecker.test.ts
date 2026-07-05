/**
 * Unit tests for symptomChecker.ts, closing the coverage gap both audits
 * flagged (a security-relevant file — the only billable third-party API
 * call in the codebase — had zero tests). Covers the two things the
 * portfolio-evaluation audit's "Fastest Path to 90+" specifically named:
 * Zod validation rejection, and the `authPolicy` gate (unauthenticated
 * rejection + rate limiting).
 *
 * The full Genkit/Gemini flow itself is intentionally not exercised here
 * (that would require either a live Gemini API key or mocking Genkit's
 * internals deeply enough that the test would mostly verify the mock, not
 * real behavior) — `authPolicy` and the Zod schema are extracted and
 * exported specifically so they can be tested in isolation without that
 * tradeoff.
 */

const mockConsumeRateLimitToken = jest.fn();

jest.mock("../rateLimiter", () => ({
  consumeRateLimitToken: mockConsumeRateLimitToken,
}));

// symptomChecker.ts calls `genkit({...})` and `ai.defineFlow(...)` at
// module load time, which would otherwise try to configure a real Genkit
// instance during `import`. Mocking `genkit`/`@genkit-ai/googleai` keeps
// this test focused on `authPolicy`/the Zod schema without needing a real
// Gemini API key or network access.
jest.mock("genkit", () => {
  const actualZod = jest.requireActual("zod");
  return {
    genkit: jest.fn(() => ({
      defineFlow: jest.fn(() => jest.fn()),
      generate: jest.fn(),
    })),
    z: actualZod.z,
  };
});

jest.mock("@genkit-ai/googleai", () => ({
  googleAI: jest.fn(() => ({})),
  gemini15Flash: "mock-gemini-model",
}));

jest.mock("firebase-functions/https", () => ({
  onCallGenkit: jest.fn((_options, flow) => flow),
}));

jest.mock("firebase-functions/params", () => ({
  defineSecret: jest.fn(() => ({value: () => "mock-secret"})),
}));

// eslint-disable-next-line import/first
import {symptomCheckerAuthPolicy, SymptomAnalysisInputSchema} from "../symptomChecker";

describe("SymptomAnalysisInputSchema", () => {
  it("accepts valid input", () => {
    const result = SymptomAnalysisInputSchema.safeParse({
      symptoms: "Persistent headache for 3 days",
      severity: "moderate",
    });
    expect(result.success).toBe(true);
  });

  it("rejects symptoms shorter than the minimum length", () => {
    const result = SymptomAnalysisInputSchema.safeParse({symptoms: "hi"});
    expect(result.success).toBe(false);
  });

  it("rejects an invalid severity enum value", () => {
    const result = SymptomAnalysisInputSchema.safeParse({
      symptoms: "Persistent headache for 3 days",
      severity: "catastrophic",
    });
    expect(result.success).toBe(false);
  });

  it("rejects symptoms exceeding the maximum length", () => {
    const result = SymptomAnalysisInputSchema.safeParse({symptoms: "a".repeat(2001)});
    expect(result.success).toBe(false);
  });
});

describe("symptomCheckerAuthPolicy", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects an unauthenticated caller without consuming a rate-limit token", async () => {
    const allowed = await symptomCheckerAuthPolicy(null);

    expect(allowed).toBe(false);
    expect(mockConsumeRateLimitToken).not.toHaveBeenCalled();
  });

  it("allows an authenticated caller with tokens remaining", async () => {
    mockConsumeRateLimitToken.mockResolvedValue(undefined);

    const allowed = await symptomCheckerAuthPolicy({uid: "patient-1"});

    expect(allowed).toBe(true);
    expect(mockConsumeRateLimitToken).toHaveBeenCalledWith(
      "patient-1",
      expect.objectContaining({capacity: 5, action: "analyzeSymptoms"})
    );
  });

  it("propagates the resource-exhausted error when the caller is rate-limited", async () => {
    mockConsumeRateLimitToken.mockRejectedValue(new Error("resource-exhausted"));

    await expect(symptomCheckerAuthPolicy({uid: "patient-1"})).rejects.toThrow("resource-exhausted");
  });
});
