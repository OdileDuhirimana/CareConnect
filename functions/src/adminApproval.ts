/**
 * Server-side admin-approval gate and account deletion.
 *
 * Why this exists: the code review's Critical Issue #3 found that role
 * assignment was entirely client-controlled — `AuthContext.signUp` writes
 * `role` straight from client input into Firestore with no server-side
 * check, and `AdminUsersScreen`'s "approve" action only ever flipped the
 * client-writable `isVerified` boolean, which Firestore rules could not
 * meaningfully gate without a source of truth for "who is allowed to
 * approve." These callable functions are that source of truth: they run
 * with the Admin SDK (bypassing client-side security rules entirely) and
 * independently re-verify, from the *caller's own* Firestore user
 * document, that the caller is an admin before mutating another user's
 * account — the client's claim of being an admin is never trusted.
 *
 * `deleteUserAccount` also fixes Critical Issue #6 (the fabricated
 * "User deleted successfully" alert that performed no deletion): it now
 * actually removes the Firebase Auth record and the Firestore profile.
 *
 * Both functions also now write a persisted `auditLogs` entry (see
 * auditLog.ts) in addition to the existing structured `logger` calls —
 * closing the previously-flagged gap (SEC-06/SEC-08) where "who
 * approved/deleted which account and when" was only visible in ephemeral
 * Cloud Logging, not in a durable, queryable record.
 *
 * `enforceAppCheck` is left `false` here (not omitted — see project.md's
 * "App Check" section): this is an Expo-managed React Native app using the
 * Firebase *Web* SDK, which has no verified native attestation provider
 * (Play Integrity / DeviceCheck) available without ejecting to
 * `@react-native-firebase`. Setting `enforceAppCheck: true` without a
 * matching client-side provider would reject 100% of legitimate calls, so
 * flipping this on is left as a documented follow-up rather than a
 * dishonest no-op flag flip.
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {getAuth} from "firebase-admin/auth";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {initializeApp, getApps} from "firebase-admin/app";
import {writeAuditLog} from "./auditLog";

if (getApps().length === 0) {
  initializeApp();
}

/**
 * Verifies that the calling user is signed in and has role "admin" on
 * their own Firestore user document. Throws an HttpsError otherwise.
 * @param {string | undefined} callerUid - The uid of the calling user, as
 * reported by the Cloud Functions auth context (never trusted from
 * client-supplied request data).
 * @return {Promise<void>} Resolves if the caller is a verified admin.
 */
async function assertCallerIsAdmin(callerUid: string | undefined): Promise<void> {
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "You must be signed in to perform this action.");
  }

  const callerDoc = await getFirestore().collection("users").doc(callerUid).get();
  if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
    logger.warn(`Non-admin uid ${callerUid} attempted an admin-only action.`);
    throw new HttpsError("permission-denied", "Only an administrator may perform this action.");
  }
}

/**
 * Grants doctor-role activation. This is the actual enforcement point for
 * "doctors require admin approval before activation" — previously
 * `isApproved` was set at signup and never checked by any authority.
 */
export const approveDoctorRequest = onCall<{ userId: string }>({enforceAppCheck: false}, async (request) => {
  await assertCallerIsAdmin(request.auth?.uid);

  const {userId} = request.data;
  if (!userId || typeof userId !== "string") {
    throw new HttpsError("invalid-argument", "A valid userId is required.");
  }

  const userRef = getFirestore().collection("users").doc(userId);
  const userSnapshot = await userRef.get();
  if (!userSnapshot.exists) {
    throw new HttpsError("not-found", "User not found.");
  }
  if (userSnapshot.data()?.role !== "doctor") {
    throw new HttpsError("failed-precondition", "Only doctor accounts can be approved through this action.");
  }

  await userRef.update({
    isApproved: true,
    isVerified: true,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const adminUid = request.auth!.uid;
  logger.info(`Doctor ${userId} approved by admin ${adminUid}.`);
  await writeAuditLog({actorId: adminUid, targetUserId: userId, action: "approveDoctorRequest"});
  return {success: true};
});

/**
 * Permanently deletes a user's Firebase Auth record and Firestore profile.
 * Requires the Admin SDK because deleting another user's Auth record is
 * not something a client app can ever legitimately do.
 */
export const deleteUserAccount = onCall<{ userId: string }>({enforceAppCheck: false}, async (request) => {
  await assertCallerIsAdmin(request.auth?.uid);

  const {userId} = request.data;
  if (!userId || typeof userId !== "string") {
    throw new HttpsError("invalid-argument", "A valid userId is required.");
  }
  if (userId === request.auth!.uid) {
    throw new HttpsError(
      "failed-precondition",
      "An administrator cannot delete their own account through this action."
    );
  }

  try {
    await getAuth().deleteUser(userId);
  } catch (error) {
    // If the Auth user is already gone, proceed to clean up the Firestore
    // profile rather than leaving an orphaned document — but surface any
    // other failure.
    const code = (error as { code?: string }).code;
    if (code !== "auth/user-not-found") {
      logger.error(`Failed to delete auth user ${userId}`, error);
      throw new HttpsError("internal", "Failed to delete the user account.");
    }
  }

  await getFirestore().collection("users").doc(userId).delete();

  const adminUid = request.auth!.uid;
  logger.info(`User ${userId} deleted by admin ${adminUid}.`);
  await writeAuditLog({actorId: adminUid, targetUserId: userId, action: "deleteUserAccount"});
  return {success: true};
});
