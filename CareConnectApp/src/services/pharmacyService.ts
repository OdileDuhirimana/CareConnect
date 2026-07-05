import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Pharmacy } from '../types';
import { mapDoc, ServiceError } from './firestoreHelpers';

/** Data-access layer for the `pharmacies` collection. */

const COLLECTION = 'pharmacies';

/** Partner pharmacies available to patients. */
export async function fetchPartnerPharmacies(): Promise<Pharmacy[]> {
  try {
    const q = query(collection(db, COLLECTION), where('isPartner', '==', true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => mapDoc<Pharmacy>(d));
  } catch (error) {
    throw new ServiceError('Failed to load pharmacies.', error);
  }
}
