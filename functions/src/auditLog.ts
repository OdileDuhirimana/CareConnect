/**
 * Persisted, queryable audit trail for privileged admin actions.
 *
 * Why this exists: both audits flagged that `approveDoctorRequest` and
 * `deleteUserAccount` only produced ephemeral Cloud Logging entries
 * (`firebase-functions/logger`) — useful for debugging, but not a durable,
 * queryable record of "who approved/deleted which account and when" once
 * log retention expires. This module writes a permanent record to the
 * `auditLogs` Firestore collection for every privileged mutation, in
 * addition to (not instead of) the existing structured logs.
 *
 * `auditLogs` is admin-read-only and denies all client writes (see
 * firestore.rules) — only the Admin SDK (i.e. this Cloud Functions code)
 * can create entries, so a client can never forge or tamper with the
 * audit trail.
 */

import {getFirestore, FieldValue} from "firebase-admin/firestore";

export type AuditAction = "approveDoctorRequest" | "deleteUserAccount" | "setUserVerified";

export interface AuditLogEntry {
  /** uid of the admin who performed the action. */
  actorId: string;
  /** uid of the user the action was performed on. */
  targetUserId: string;
  action: AuditAction;
  /** Small, structured, non-PII-bearing details specific to the action (e.g. previous/new status). */
  details?: Record<string, string | number | boolean>;
}

/**
 * Appends an immutable audit log entry. Never throws on its own — a
 * failure to write the audit log should be logged but must not roll back
 * or block the privileged action it's describing (the action has already
 * succeeded by the time this is called), so callers should not `await`
 * this in a way that fails the whole request; see call sites in
 * adminApproval.ts for the intended fire-and-await-but-don't-fail pattern.
 * @param {AuditLogEntry} entry - The action being recorded.
 * @return {Promise<void>} Resolves once the entry is written.
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  await getFirestore().collection("auditLogs").add({
    ...entry,
    createdAt: FieldValue.serverTimestamp(),
  });
}
