import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { mapDoc, ServiceError } from './firestoreHelpers';

const COLLECTION = 'analytics_daily';

/**
 * Data-access layer for the `analytics_daily` rollup collection, written
 * once a day by the `aggregateDailyAnalytics` scheduled Cloud Function
 * (functions/src/analytics.ts). This replaces the illustrative static
 * numbers previously hardcoded into the admin/doctor analytics screens.
 */
export interface DailyAnalyticsSnapshot {
  id: string;
  date: string;
  totalUsers: number;
  totalPatients: number;
  totalDoctors: number;
  totalAdmins: number;
  newUsersLast24h: number;
  totalAppointments: number;
  appointmentsByStatus: Record<string, number>;
  topDoctorsByAppointmentCount: Array<{ doctorId: string; count: number }>;
  generatedAt: string;
}

/** The most recently generated daily analytics rollup, or null if none has run yet. */
export async function fetchLatestAnalyticsSnapshot(): Promise<DailyAnalyticsSnapshot | null> {
  try {
    const q = query(collection(db, COLLECTION), orderBy('date', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return mapDoc<DailyAnalyticsSnapshot>(snapshot.docs[0]);
  } catch (error) {
    throw new ServiceError('Failed to load analytics.', error);
  }
}

/** A specific day's analytics rollup (YYYY-MM-DD), or null if that day hasn't been aggregated. */
export async function fetchAnalyticsSnapshotForDate(dateKey: string): Promise<DailyAnalyticsSnapshot | null> {
  try {
    const snapshot = await getDoc(doc(db, COLLECTION, dateKey));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as DailyAnalyticsSnapshot;
  } catch (error) {
    throw new ServiceError('Failed to load analytics for the selected date.', error);
  }
}
