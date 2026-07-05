/**
 * Per-user token-bucket rate limiting for billable/sensitive callable
 * functions.
 *
 * Why this exists: the code review and portfolio audit both flagged that
 * `analyzeSymptoms` (a billable Gemini call) had no abuse protection beyond
 * requiring authentication — a single compromised or malicious account
 * could drive unbounded API cost by calling it in a tight loop.
 * `setGlobalOptions({maxInstances: 10})` in index.ts is a cost ceiling on
 * *concurrent* invocations, not a per-caller rate limit, so it does nothing
 * to stop one uid from sequentially exhausting the limit.
 *
 * Design: a classic token bucket, persisted per-uid in the `rate_limits`
 * Firestore collection (never exposed to clients — see the `allow read,
 * write: if false` rule in firestore.rules; only the Admin SDK, which
 * bypasses rules, can touch this collection). Each call:
 *   1. Reads the caller's bucket (or treats a missing bucket as "full").
 *   2. Refills tokens based on elapsed time since the last refill
 *      (`refillRatePerSecond`), capped at `capacity`.
 *   3. If at least one token is available, consumes it and allows the call.
 *      Otherwise throws `resource-exhausted`.
 * The read-modify-write happens inside a Firestore transaction so
 * concurrent invocations from the same uid (e.g. a double-tap or a scripted
 * abuse attempt) can't race past the limit.
 *
 * This is intentionally simple (no external dependency like Redis) because
 * Cloud Functions for Firebase have no built-in shared memory across
 * instances — Firestore is the only consistent, serverless-friendly place
 * to keep this state without standing up additional infrastructure, which
 * would be disproportionate for this project's scale.
 */

import {HttpsError} from "firebase-functions/v2/https";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

export interface RateLimitOptions {
  /** Maximum number of tokens the bucket can hold (i.e. burst allowance). */
  capacity: number;
  /** Tokens restored per second. */
  refillRatePerSecond: number;
  /** Logical name of the limited action, used as part of the Firestore doc id and in logs. */
  action: string;
}

const COLLECTION = "rate_limits";

/**
 * Consumes one token from the caller's bucket for the given action,
 * creating the bucket (full, minus the token just consumed) on first use.
 * Throws an `HttpsError` with code `resource-exhausted` if no token is
 * available.
 * @param {string} uid - The authenticated caller's uid. Never trust a
 * client-supplied identifier here — always pass `request.auth.uid`.
 * @param {RateLimitOptions} options - Bucket capacity/refill configuration
 * for this action.
 * @return {Promise<void>} Resolves if a token was successfully consumed.
 */
export async function consumeRateLimitToken(uid: string, options: RateLimitOptions): Promise<void> {
  const {capacity, refillRatePerSecond, action} = options;
  const docRef = getFirestore().collection(COLLECTION).doc(`${uid}_${action}`);

  await getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef);
    const now = Timestamp.now();

    let tokens = capacity;
    let lastRefill = now;

    if (snapshot.exists) {
      const data = snapshot.data() as { tokens: number; lastRefill: Timestamp };
      const elapsedSeconds = Math.max(0, now.seconds - data.lastRefill.seconds);
      const refilled = data.tokens + elapsedSeconds * refillRatePerSecond;
      tokens = Math.min(capacity, refilled);
      lastRefill = now;
    }

    if (tokens < 1) {
      logger.warn(`Rate limit exceeded for uid ${uid} on action "${action}".`);
      throw new HttpsError(
        "resource-exhausted",
        "Too many requests. Please wait a moment before trying again."
      );
    }

    transaction.set(docRef, {
      tokens: tokens - 1,
      lastRefill,
      action,
      uid,
    });
  });
}
