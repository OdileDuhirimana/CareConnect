import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { MedicalRecord } from '../types';
import { mapDoc, ServiceError } from './firestoreHelpers';

/** Data-access layer for the `medical_records` collection. */

const COLLECTION = 'medical_records';

/** All medical records for a patient, most recent first. */
export async function fetchMedicalRecordsForPatient(patientId: string): Promise<MedicalRecord[]> {
  if (!patientId) {
    throw new ServiceError('You must be signed in to view medical records.');
  }
  try {
    const q = query(collection(db, COLLECTION), where('patientId', '==', patientId), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => mapDoc<MedicalRecord>(d));
  } catch (error) {
    throw new ServiceError('Failed to load medical records.', error);
  }
}

/** A capped, recent slice of a patient's medical records — used on dashboard summaries. */
export async function fetchRecentMedicalRecords(patientId: string, count = 5): Promise<MedicalRecord[]> {
  if (!patientId) {
    throw new ServiceError('You must be signed in to view medical records.');
  }
  try {
    const q = query(
      collection(db, COLLECTION),
      where('patientId', '==', patientId),
      orderBy('date', 'desc'),
      limit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => mapDoc<MedicalRecord>(d));
  } catch (error) {
    throw new ServiceError('Failed to load recent medical records.', error);
  }
}
