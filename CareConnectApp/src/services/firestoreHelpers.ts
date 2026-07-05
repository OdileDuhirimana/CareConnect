import { DocumentData, QueryDocumentSnapshot, Timestamp } from 'firebase/firestore';

/**
 * Shared helpers for converting Firestore documents into typed domain
 * objects. Centralizing this avoids repeating the same
 * `{ id: doc.id, ...doc.data(), date: doc.data().date.toDate() }` boilerplate
 * (and its associated risk of forgetting a Timestamp conversion) across
 * every screen, which was the original source of the "36 raw Firestore SDK
 * calls scattered across src/screens" finding in the code review.
 */

/** Converts every own-enumerable Firestore Timestamp field on an object to a JS Date. */
export function convertTimestamps<T extends Record<string, unknown>>(data: T): T {
  const result: Record<string, unknown> = { ...data };
  for (const key of Object.keys(result)) {
    const value = result[key];
    if (value instanceof Timestamp) {
      result[key] = value.toDate();
    }
  }
  return result as T;
}

/** Maps a Firestore document snapshot to a typed domain object, including its id. */
export function mapDoc<T>(snapshot: QueryDocumentSnapshot<DocumentData>): T {
  return {
    id: snapshot.id,
    ...convertTimestamps(snapshot.data()),
  } as T;
}

/**
 * A generic error thrown by the service layer so screens can distinguish
 * "the operation failed for a known, actionable reason" (e.g. not signed
 * in) from an unexpected Firestore/network failure, without leaking
 * Firestore's internal error shape into UI code.
 */
export class ServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ServiceError';
  }
}
