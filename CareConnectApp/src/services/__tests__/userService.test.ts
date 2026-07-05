/**
 * Tests for the user service layer, focused on the two actions that were
 * previously fabricated/unenforced in the audited codebase:
 * `deleteUserAccount` (was a fake success alert with no deletion) and
 * `approveDoctorRequest` (the admin-approval gate). Both are thin clients
 * around callable Cloud Functions, so these tests verify the client-side
 * contract — correct function name, correct payload, and correct error
 * translation — while the server-side authorization logic itself is
 * covered by functions/src/__tests__/adminApproval.test.ts.
 */

import { httpsCallable } from 'firebase/functions';
import { getDocs, updateDoc, where, orderBy } from 'firebase/firestore';
import { fetchUsersPage, setUserVerified, deleteUserAccount, approveDoctorRequest } from '../userService';
import { ServiceError } from '../firestoreHelpers';

jest.mock('../../config/firebase', () => ({ db: {}, functions: {} }));

jest.mock('firebase/firestore', () => {
  // Must be a real class — firestoreHelpers.ts uses `instanceof Timestamp`.
  class FakeTimestamp {
    static now() {
      return 'mock-timestamp';
    }
  }
  return {
    collection: jest.fn(() => 'users-collection'),
    query: jest.fn((...args) => ({ __query: args })),
    where: jest.fn((...args) => ({ __where: args })),
    orderBy: jest.fn((...args) => ({ __orderBy: args })),
    limit: jest.fn((...args) => ({ __limit: args })),
    startAfter: jest.fn((...args) => ({ __startAfter: args })),
    getDocs: jest.fn(),
    updateDoc: jest.fn(),
    doc: jest.fn(() => 'user-doc-ref'),
    Timestamp: FakeTimestamp,
  };
});

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(),
}));

function makeSnapshot(docs: { id: string; data: Record<string, unknown> }[]) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
}

describe('userService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchUsersPage', () => {
    it('returns a page of users ordered by createdAt desc when unfiltered', async () => {
      (getDocs as jest.Mock).mockResolvedValue(
        makeSnapshot([{ id: 'u1', data: { name: 'Alice', role: 'patient' } }])
      );

      const page = await fetchUsersPage({ pageSize: 10 });

      expect(page.users).toEqual([{ id: 'u1', name: 'Alice', role: 'patient' }]);
      expect(page.nextCursor).toBeUndefined();
      expect(where).not.toHaveBeenCalled();
      expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    });

    // Regression test for the code-review-flagged bug: AdminUsersScreen
    // previously filtered an already-fetched page in memory, so a search
    // for a user on a later, unfetched page silently returned nothing.
    // `fetchUsersPage` now pushes the role/status filter into the query
    // itself, so this test locks down that the filter is server-side, not
    // applied to an already-fetched array.
    it('applies a role filter as a Firestore query constraint, ordered by name', async () => {
      (getDocs as jest.Mock).mockResolvedValue(makeSnapshot([]));

      await fetchUsersPage({ roleFilter: 'doctor' });

      expect(where).toHaveBeenCalledWith('role', '==', 'doctor');
      expect(orderBy).toHaveBeenCalledWith('name', 'asc');
    });

    it('applies a verified-status filter as a Firestore query constraint (the "Pending" tab)', async () => {
      (getDocs as jest.Mock).mockResolvedValue(makeSnapshot([]));

      await fetchUsersPage({ verifiedFilter: false });

      expect(where).toHaveBeenCalledWith('isVerified', '==', false);
    });

    it('applies a name-prefix search as a Firestore range query covering the full collection', async () => {
      (getDocs as jest.Mock).mockResolvedValue(makeSnapshot([]));

      await fetchUsersPage({ searchPrefix: 'Ali' });

      expect(where).toHaveBeenCalledWith('name', '>=', 'Ali');
      expect(where).toHaveBeenCalledWith('name', '<=', expect.stringMatching(/^Ali/));
      expect(orderBy).toHaveBeenCalledWith('name', 'asc');
    });

    it('trims whitespace from the search prefix and ignores an empty search', async () => {
      (getDocs as jest.Mock).mockResolvedValue(makeSnapshot([]));

      await fetchUsersPage({ searchPrefix: '   ' });

      expect(where).not.toHaveBeenCalled();
      expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    });
  });

  describe('setUserVerified', () => {
    it('rejects when no user id is given', async () => {
      await expect(setUserVerified('', true)).rejects.toThrow(ServiceError);
    });

    it('updates isVerified and updatedAt', async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await setUserVerified('user-1', true);

      expect(updateDoc).toHaveBeenCalledWith(
        'user-doc-ref',
        expect.objectContaining({ isVerified: true, updatedAt: 'mock-timestamp' })
      );
    });
  });

  describe('deleteUserAccount', () => {
    it('rejects locally when no user id is given, without calling the Cloud Function', async () => {
      await expect(deleteUserAccount('')).rejects.toThrow(ServiceError);
      expect(httpsCallable).not.toHaveBeenCalled();
    });

    it('calls the deleteUserAccount callable with the target user id', async () => {
      const mockCallable = jest.fn().mockResolvedValue({ data: { success: true } });
      (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

      await deleteUserAccount('user-to-delete');

      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'deleteUserAccount');
      expect(mockCallable).toHaveBeenCalledWith({ userId: 'user-to-delete' });
    });

    it('surfaces a ServiceError when the server declines the deletion', async () => {
      const mockCallable = jest.fn().mockResolvedValue({ data: { success: false } });
      (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

      await expect(deleteUserAccount('user-1')).rejects.toThrow(ServiceError);
    });

    it('translates a Cloud Function error (e.g. permission-denied) into a ServiceError', async () => {
      const mockCallable = jest.fn().mockRejectedValue(new Error('permission-denied'));
      (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

      await expect(deleteUserAccount('user-1')).rejects.toThrow(
        'Failed to delete user. Please try again.'
      );
    });
  });

  describe('approveDoctorRequest', () => {
    it('calls the approveDoctorRequest callable with the doctor user id', async () => {
      const mockCallable = jest.fn().mockResolvedValue({ data: { success: true } });
      (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

      await approveDoctorRequest('doctor-1');

      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'approveDoctorRequest');
      expect(mockCallable).toHaveBeenCalledWith({ userId: 'doctor-1' });
    });

    it('rejects locally when no user id is given', async () => {
      await expect(approveDoctorRequest('')).rejects.toThrow(ServiceError);
    });
  });
});
