import { getDocs, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { fetchRecentWellnessEntries, createWellnessEntry } from '../wellnessService';
import { ServiceError } from '../firestoreHelpers';

jest.mock('../../config/firebase', () => ({ db: {}, functions: {} }));

jest.mock('firebase/firestore', () => {
  return {
    collection: jest.fn(() => 'wellness-collection'),
    query: jest.fn((...args) => ({ __query: args })),
    where: jest.fn((...args) => ({ __where: args })),
    orderBy: jest.fn((...args) => ({ __orderBy: args })),
    limit: jest.fn((...args) => ({ __limit: args })),
    getDocs: jest.fn(),
  };
});

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(),
}));

function makeSnapshot(docs: { id: string; data: Record<string, unknown> }[]) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
}

describe('wellnessService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('fetchRecentWellnessEntries', () => {
    it('rejects when not signed in', async () => {
      await expect(fetchRecentWellnessEntries('')).rejects.toThrow(
        'You must be signed in to view wellness entries.'
      );
    });

    it('scopes the query to the given user id', async () => {
      (getDocs as jest.Mock).mockResolvedValue(makeSnapshot([]));

      await fetchRecentWellnessEntries('user-1', 5);

      expect(where).toHaveBeenCalledWith('userId', '==', 'user-1');
    });
  });

  describe('createWellnessEntry', () => {
    // `createWellnessEntry` is a thin client around the
    // `createWellnessEntry` Cloud Function (functions/src/wellness.ts) —
    // the server-side range validation (mood/energy/stress 1-5, etc.) is
    // covered by functions/src/__tests__/wellness.test.ts. These tests
    // verify the client-side contract only.
    const validInput = {
      userId: 'user-1',
      mood: 4,
      energy: 3,
      stress: 2,
      sleepHours: 7,
      exerciseMinutes: 20,
    };

    beforeEach(() => jest.clearAllMocks());

    it('rejects when not signed in, without calling the Cloud Function', async () => {
      await expect(createWellnessEntry({ ...validInput, userId: '' })).rejects.toThrow(ServiceError);
      expect(httpsCallable).not.toHaveBeenCalled();
    });

    it('calls the createWellnessEntry callable without sending userId', async () => {
      const mockCallable = jest.fn().mockResolvedValue({ data: { success: true, entryId: 'entry-1' } });
      (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

      await createWellnessEntry(validInput);

      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'createWellnessEntry');
      expect(mockCallable).toHaveBeenCalledWith({
        mood: 4,
        energy: 3,
        stress: 2,
        sleepHours: 7,
        exerciseMinutes: 20,
        notes: undefined,
        symptoms: undefined,
      });
    });

    it('surfaces a ServiceError when the server declines to save the entry', async () => {
      const mockCallable = jest.fn().mockResolvedValue({ data: { success: false } });
      (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

      await expect(createWellnessEntry(validInput)).rejects.toThrow(ServiceError);
    });

    it('wraps a Cloud Function failure in a ServiceError', async () => {
      const mockCallable = jest.fn().mockRejectedValue(new Error('offline'));
      (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

      await expect(createWellnessEntry(validInput)).rejects.toThrow(
        'Failed to save wellness entry. Please try again.'
      );
    });
  });
});
