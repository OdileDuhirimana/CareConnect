/**
 * Firebase custom claims for tamper-proof RBAC.
 *
 * Why this exists: this was the #1 item in project.md's own "Future
 * Improvements" list and the top item named in both external audits'
 * "Fastest Path to Staff-Level" sections. Until now, "role" was read
 * exclusively from each user's own Firestore document
 * (`currentUserRole()` in firestore.rules, `assertCallerIsAdmin` in
 * adminApproval.ts) — a defensible design (the document itself is
 * protected by rules that block self-escalation), but one extra layer
 * removed from Firebase's purpose-built mechanism for exactly this
 * problem: claims baked into the signed ID token itself, settable only by
 * the Admin SDK, and readable synchronously by both Firestore rules
 * (`request.auth.token.<claim>`) and Cloud Functions
 * (`request.auth.token.<claim>`) without an extra Firestore read.
 *
 * How it works:
 *   1. `syncUserClaims` is a Firestore trigger on `users/{userId}` writes.
 *      Whenever `role` or `isApproved` changes (including on document
 *      creation), it calls `getAuth().setCustomUserClaims(...)` so the
 *      *next* ID token that user's client requests will carry the new
 *      claims.
 *   2. Because ID tokens are cached client-side for up to an hour, the
 *      trigger also stamps `claimsSyncedAt` back onto the same document.
 *      The client (`AuthContext.tsx`) listens for that field changing on
 *      its own document and calls `getIdToken(true)` to force an immediate
 *      refresh — this closes the "admin approves a doctor but the doctor's
 *      app doesn't notice for up to an hour" gap that a naive
 *      claims-only implementation would have.
 *   3. `firestore.rules` reads `request.auth.token.role` first and falls
 *      back to the Firestore-document lookup (`currentUserRole()`) only if
 *      the claim isn't present yet — this keeps existing accounts (created
 *      before this feature shipped) working without a hard migration
 *      cutover; see `scripts/backfillCustomClaims.ts` for a one-time
 *      backfill for pre-existing users.
 *
 * Honesty note (see project.md "Known Limitations"): this code is written
 * and unit-tested against a mocked Admin SDK, but has never been deployed
 * to or exercised against a live Firebase project in this environment, so
 * "custom claims are actually set on live user accounts" is unverified —
 * flagged explicitly rather than claimed as working in production.
 */

import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {getAuth} from "firebase-admin/auth";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

export interface SyncedClaims {
  role: "patient" | "doctor" | "admin";
  isApproved: boolean;
}

/**
 * Extracts the subset of a Firestore user-document's fields that should be
 * mirrored into Firebase Auth custom claims.
 * @param {FirebaseFirestore.DocumentData | undefined} data - The
 * document's field data, or undefined if the document doesn't exist.
 * @return {SyncedClaims | null} The claims to set, or null if `data` has
 * no usable `role`.
 */
function toClaims(data: FirebaseFirestore.DocumentData | undefined): SyncedClaims | null {
  if (!data || typeof data.role !== "string") {
    return null;
  }
  return {
    role: data.role as SyncedClaims["role"],
    isApproved: Boolean(data.isApproved),
  };
}

/**
 * Returns true if the two claim sets differ (or exactly one is null),
 * i.e. whether a `setCustomUserClaims` call is actually needed.
 * @param {SyncedClaims | null} a - First claim set.
 * @param {SyncedClaims | null} b - Second claim set.
 * @return {boolean} Whether the two claim sets differ.
 */
function claimsDiffer(a: SyncedClaims | null, b: SyncedClaims | null): boolean {
  if (a === null || b === null) return a !== b;
  return a.role !== b.role || a.isApproved !== b.isApproved;
}

export const syncUserClaims = onDocumentWritten("users/{userId}", async (event) => {
  const userId = event.params.userId;
  const beforeData = event.data?.before?.data();
  const afterData = event.data?.after?.data();

  const beforeClaims = toClaims(beforeData);
  const afterClaims = toClaims(afterData);

  // Document deleted, or never had a usable role (shouldn't happen given
  // firestore.rules requires `role` on create, but defensive nonetheless).
  if (!afterData || !afterClaims) {
    if (beforeClaims) {
      try {
        await getAuth().setCustomUserClaims(userId, null);
      } catch (error) {
        // The Auth user is very likely already gone too (deleteUserAccount
        // deletes the Auth record before the Firestore document), which is
        // the expected, non-error path here.
        logger.info(`Skipped claim revocation for ${userId} (Auth user likely already deleted).`, error);
      }
    }
    return;
  }

  if (!claimsDiffer(beforeClaims, afterClaims)) {
    // Nothing relevant changed (e.g. this write only touched
    // `updatedAt`/`profileImage`) — skip both the Auth call and the
    // claimsSyncedAt write, which would otherwise re-trigger this function
    // in an infinite loop of no-op writes.
    return;
  }

  try {
    await getAuth().setCustomUserClaims(userId, afterClaims);
    logger.info(`Synced custom claims for ${userId}`, afterClaims);
  } catch (error) {
    logger.error(`Failed to sync custom claims for ${userId}`, error);
    return;
  }

  // Stamp a marker field so the client can detect "my claims just changed
  // server-side" and force an ID token refresh, rather than waiting up to
  // an hour for the cached token to expire naturally.
  await getFirestore().collection("users").doc(userId).update({
    claimsSyncedAt: FieldValue.serverTimestamp(),
  });
});
