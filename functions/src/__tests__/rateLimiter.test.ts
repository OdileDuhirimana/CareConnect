/**
 * Unit tests for the Firestore-backed token-bucket rate limiter, since
 * this is the mechanism the portfolio audit's "Fastest Path to 110+"
 * specifically asked for (per-user rate limiting on analyzeSymptoms) and
 * it had zero coverage before this pass.
 */

import {HttpsError} from "firebase-functions/v2/https";

const mockGet = jest.fn();
const mockSet = jest.fn();
const mockRunTransaction = jest.fn();
const mockDoc = jest.fn(() => ({}));
const mockCollection = jest.fn(() => ({doc: mockDoc}));

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(() => ({
    collection: mockCollection,
    runTransaction: mockRunTransaction,
  })),
  Timestamp: {
    now: jest.fn(() => ({seconds: 1000, toDate: () => new Date(1000 * 1000)})),
  },
}));

// eslint-disable-next-line import/first
import {consumeRateLimitToken} from "../rateLimiter";

function fakeTransaction() {
  return {get: mockGet, set: mockSet};
}

describe("consumeRateLimitToken", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates a full-minus-one bucket on first use and allows the call", async () => {
    mockRunTransaction.mockImplementation(async (callback) => callback(fakeTransaction()));
    mockGet.mockResolvedValue({exists: false});

    await expect(
      consumeRateLimitToken("uid-1", {capacity: 5, refillRatePerSecond: 1, action: "analyzeSymptoms"})
    ).resolves.toBeUndefined();

    expect(mockSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({tokens: 4, uid: "uid-1", action: "analyzeSymptoms"})
    );
  });

  it("allows a call when the existing bucket still has tokens", async () => {
    mockRunTransaction.mockImplementation(async (callback) => callback(fakeTransaction()));
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({tokens: 2, lastRefill: {seconds: 1000}}),
    });

    await expect(
      consumeRateLimitToken("uid-1", {capacity: 5, refillRatePerSecond: 1, action: "analyzeSymptoms"})
    ).resolves.toBeUndefined();

    expect(mockSet).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({tokens: 1}));
  });

  it("throws resource-exhausted when the bucket has no tokens left and no time has passed to refill", async () => {
    mockRunTransaction.mockImplementation(async (callback) => callback(fakeTransaction()));
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({tokens: 0, lastRefill: {seconds: 1000}}), // same "now" as Timestamp.now() mock -> 0 elapsed seconds
    });

    await expect(
      consumeRateLimitToken("uid-1", {capacity: 5, refillRatePerSecond: 1, action: "analyzeSymptoms"})
    ).rejects.toThrow(HttpsError);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("refills tokens proportional to elapsed time, capped at capacity", async () => {
    mockRunTransaction.mockImplementation(async (callback) => callback(fakeTransaction()));
    // lastRefill 900s ago (relative to the mocked "now" of 1000s) at a
    // refill rate of 1/sec would refill 100 tokens — capped at capacity 5.
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({tokens: 0, lastRefill: {seconds: 100}}),
    });

    await consumeRateLimitToken("uid-1", {capacity: 5, refillRatePerSecond: 1, action: "analyzeSymptoms"});

    // Capped at capacity 5, minus the 1 token just consumed by this call.
    expect(mockSet).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({tokens: 4}));
  });

  it("scopes buckets per-action so one action's limit doesn't starve another for the same uid", async () => {
    mockRunTransaction.mockImplementation(async (callback) => callback(fakeTransaction()));
    mockGet.mockResolvedValue({exists: false});

    await consumeRateLimitToken("uid-1", {capacity: 5, refillRatePerSecond: 1, action: "analyzeSymptoms"});
    await consumeRateLimitToken("uid-1", {capacity: 10, refillRatePerSecond: 1, action: "otherAction"});

    expect(mockDoc).toHaveBeenNthCalledWith(1, "uid-1_analyzeSymptoms");
    expect(mockDoc).toHaveBeenNthCalledWith(2, "uid-1_otherAction");
  });
});
