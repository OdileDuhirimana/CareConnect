import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { WellnessEntry } from '../types';
import { mapDoc, ServiceError } from './firestoreHelpers';

/** Data-access layer for the `wellness_entries` collection. */

const COLLECTION = 'wellness_entries';

/** Recent wellness entries for a user, newest first. */
export async function fetchRecentWellnessEntries(userId: string, count = 7): Promise<WellnessEntry[]> {
  if (!userId) {
    throw new ServiceError('You must be signed in to view wellness entries.');
  }
  try {
    const q = query(
      collection(db, COLLECTION),
      where('userId', '==', userId),
      orderBy('date', 'desc'),
      limit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => mapDoc<WellnessEntry>(d));
  } catch (error) {
    throw new ServiceError('Failed to load wellness entries.', error);
  }
}

export interface CreateWellnessEntryInput {
  userId: string;
  mood: number;
  energy: number;
  stress: number;
  sleepHours: number;
  exerciseMinutes: number;
  notes?: string;
  symptoms?: string[];
}

interface CreateWellnessEntryResponse {
  success: boolean;
  entryId: string;
}

/**
 * Records a new wellness check-in entry for the signed-in user.
 *
 * Implemented as a callable Cloud Function (`functions/src/wellness.ts`)
 * rather than a direct `addDoc`, so mood/energy/stress/sleepHours/
 * exerciseMinutes are range-validated server-side (e.g. mood must be an
 * integer 1-5) instead of relying only on client-side TypeScript typing,
 * which does nothing to stop a modified client from writing out-of-range
 * values directly to Firestore. See firestore.rules, where
 * `wellness_entries` `allow create` is `false`.
 */
export async function createWellnessEntry(input: CreateWellnessEntryInput): Promise<void> {
  if (!input.userId) {
    throw new ServiceError('You must be signed in to save a wellness entry.');
  }
  try {
    const callable = httpsCallable<Omit<CreateWellnessEntryInput, 'userId'>, CreateWellnessEntryResponse>(
      functions,
      'createWellnessEntry'
    );
    const result = await callable({
      mood: input.mood,
      energy: input.energy,
      stress: input.stress,
      sleepHours: input.sleepHours,
      exerciseMinutes: input.exerciseMinutes,
      notes: input.notes?.trim(),
      symptoms: input.symptoms,
    });
    if (!result.data.success) {
      throw new ServiceError('The server declined to save this wellness entry.');
    }
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError('Failed to save wellness entry. Please try again.', error);
  }
}
