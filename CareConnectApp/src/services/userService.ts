import {
  collection,
  doc,
  DocumentData,
  getDocs,
  limit,
  orderBy,
  query,
  QueryDocumentSnapshot,
  startAfter,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { Doctor, Patient, User } from '../types';
import { mapDoc, ServiceError } from './firestoreHelpers';

/**
 * Data-access layer for the `users` collection (patients, doctors, admins
 * are all stored as `User` documents distinguished by `role`).
 *
 * Destructive/privileged actions (delete user, approve doctor) are routed
 * through callable Cloud Functions rather than direct client writes,
 * because Firestore security rules alone cannot express "only an admin may
 * delete another user's account" as safely as server-side code that can
 * also cascade-clean related data and write an audit log entry. See
 * functions/src/adminApproval.ts.
 */

const COLLECTION = 'users';

export interface UserPage {
  users: User[];
  nextCursor?: QueryDocumentSnapshot<DocumentData>;
}

export interface FetchUsersPageOptions {
  pageSize?: number;
  after?: QueryDocumentSnapshot<DocumentData>;
  /** Restrict to a single role (mirrors AdminUsersScreen's "Patients"/"Doctors"/"Admins" tabs). */
  roleFilter?: User['role'];
  /** `true` = verified users only, `false` = pending-verification users only ("Pending" tab). Mutually exclusive with `roleFilter` in the current UI. */
  verifiedFilter?: boolean;
  /**
   * Case-sensitive prefix match against `name`, evaluated as a Firestore
   * range query (`>= prefix`, `<= prefix + ''`) so search reflects
   * the *entire* users collection, not just the currently loaded page.
   *
   * This fixes the latent bug flagged in the code review: the previous
   * implementation fetched one page and then filtered it in memory, so an
   * admin searching for a user on a later, unfetched page saw no results
   * with no indication that more data existed. Firestore has no built-in
   * full-text search, so this is a real, if partial, fix — it correctly
   * finds any user whose name *starts with* the query across the whole
   * collection, but (a) it's prefix-only (a search for "smith" won't match
   * "John Smith" the way substring search would), and (b) it's
   * case-sensitive (searching "john" won't match "John"). A proper
   * case-insensitive/substring search would need either a normalized
   * lowercase field written at profile-update time or a dedicated search
   * service (e.g. Algolia) — noted as a follow-up in project.md.
   */
  searchPrefix?: string;
}

/**
 * Paginated, optionally filtered list of users — used by AdminUsersScreen.
 * Ordered by `name` ascending when a role/verified filter or search prefix
 * is active (required so the search's range query and the equality filter
 * share a single composite index — see firestore.indexes.json), and by
 * `createdAt` descending (newest first) otherwise, matching the original
 * default view.
 */
export async function fetchUsersPage(
  { pageSize = 20, after, roleFilter, verifiedFilter, searchPrefix }: FetchUsersPageOptions = {}
): Promise<UserPage> {
  try {
    const equalityConstraints = [];
    if (roleFilter) {
      equalityConstraints.push(where('role', '==', roleFilter));
    }
    if (verifiedFilter !== undefined) {
      equalityConstraints.push(where('isVerified', '==', verifiedFilter));
    }

    const trimmedPrefix = searchPrefix?.trim();
    const isFiltered = equalityConstraints.length > 0 || Boolean(trimmedPrefix);

    const orderingConstraints = isFiltered
      ? [orderBy('name', 'asc')]
      : [orderBy('createdAt', 'desc')];

    // '' is a very-high-codepoint character conventionally used as the
    // upper bound of a Firestore prefix ("starts with") range query — it
    // sorts after virtually any realistic human-name character.
    const rangeConstraints = trimmedPrefix
      ? [where('name', '>=', trimmedPrefix), where('name', '<=', `${trimmedPrefix}`)]
      : [];

    const pagingConstraints = after ? [startAfter(after), limit(pageSize)] : [limit(pageSize)];

    const snapshot = await getDocs(
      query(
        collection(db, COLLECTION),
        ...equalityConstraints,
        ...rangeConstraints,
        ...orderingConstraints,
        ...pagingConstraints
      )
    );
    const users = snapshot.docs.map((d) => mapDoc<User>(d));

    return {
      users,
      nextCursor: snapshot.docs.length === pageSize ? snapshot.docs[snapshot.docs.length - 1] : undefined,
    };
  } catch (error) {
    throw new ServiceError('Failed to load users.', error);
  }
}

/** Approved doctors available for patients to book, optionally filtered by specialty. */
export async function fetchApprovedDoctors(): Promise<Doctor[]> {
  try {
    const q = query(collection(db, COLLECTION), where('role', '==', 'doctor'), where('isApproved', '==', true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => mapDoc<Doctor>(d));
  } catch (error) {
    throw new ServiceError('Failed to load doctors.', error);
  }
}

/** All patients, alphabetically — used by DoctorPatientsScreen. */
export async function fetchPatients(): Promise<Patient[]> {
  try {
    const q = query(collection(db, COLLECTION), where('role', '==', 'patient'), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => mapDoc<Patient>(d));
  } catch (error) {
    throw new ServiceError('Failed to load patients.', error);
  }
}

/**
 * Marks a user's account verified/unverified (approve or suspend).
 * Note: this does not grant the `admin` role and cannot be used to
 * self-escalate — Firestore rules reject any client write that changes
 * `role`.
 */
export async function setUserVerified(userId: string, isVerified: boolean): Promise<void> {
  if (!userId) {
    throw new ServiceError('A user id is required.');
  }
  try {
    await updateDoc(doc(db, COLLECTION, userId), {
      isVerified,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    throw new ServiceError('Failed to update user status.', error);
  }
}

interface DeleteUserResponse {
  success: boolean;
}

/**
 * Permanently deletes a user account (Firebase Auth record + Firestore
 * profile). Implemented as a callable Cloud Function
 * (`functions/src/adminApproval.ts` -> `deleteUserAccount`) because
 * deleting another user's Firebase Auth record requires the Admin SDK,
 * which is never available to a client app. This replaces the previous
 * fabricated "User deleted successfully" alert that performed no deletion.
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  if (!userId) {
    throw new ServiceError('A user id is required.');
  }
  try {
    const callable = httpsCallable<{ userId: string }, DeleteUserResponse>(functions, 'deleteUserAccount');
    const result = await callable({ userId });
    if (!result.data.success) {
      throw new ServiceError('The server declined to delete this user.');
    }
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError('Failed to delete user. Please try again.', error);
  }
}

interface ApproveDoctorResponse {
  success: boolean;
}

/**
 * Grants doctor-role activation via the server-side admin-approval gate.
 * This is what actually enforces "doctors require admin approval before
 * activation" — previously `isApproved` was written by signUp and never
 * checked by any authority other than the client's own navigation logic.
 */
export async function approveDoctorRequest(doctorUserId: string): Promise<void> {
  if (!doctorUserId) {
    throw new ServiceError('A user id is required.');
  }
  try {
    const callable = httpsCallable<{ userId: string }, ApproveDoctorResponse>(functions, 'approveDoctorRequest');
    const result = await callable({ userId: doctorUserId });
    if (!result.data.success) {
      throw new ServiceError('The server declined to approve this doctor.');
    }
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError('Failed to approve doctor. Please try again.', error);
  }
}
