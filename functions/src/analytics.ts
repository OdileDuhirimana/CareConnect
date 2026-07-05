/**
 * Scheduled analytics aggregation — replaces illustrative static numbers.
 *
 * Why this exists: `project.md`/README both honestly disclosed that the
 * admin and doctor analytics screens show static, illustrative data
 * because no aggregation pipeline existed. This scheduled Cloud Function
 * is that pipeline: once a day it computes real counts directly from
 * Firestore (appointments by status, new users, per-doctor appointment
 * load) and writes a single rollup document, so the client can read one
 * cheap document instead of running expensive aggregate queries (counting
 * every appointment) on every screen visit.
 *
 * Design notes:
 * - Runs server-side on a schedule (`onSchedule`) rather than being
 *   computed on-demand by a client request, so it has predictable,
 *   bounded cost regardless of how many admins/doctors open the analytics
 *   screen, and so it can use the Admin SDK to read across all users'
 *   appointments (which no single client's security rules would permit).
 * - Writes to `analytics_daily/{YYYY-MM-DD}`, one immutable-per-day
 *   document, so historical trend data accumulates automatically instead
 *   of being overwritten.
 * - `firestore.rules` allows any signed-in user to *read* this collection
 *   (it contains no PII, only aggregate counts) but denies all client
 *   writes — only this function can produce rollups.
 *
 * Honesty note: this function has been written and unit-tested against a
 * mocked Admin SDK/Firestore, but has never actually executed on a
 * schedule against a live Firebase project in this environment (Cloud
 * Scheduler requires a deployed, billed Firebase project) — flagged here
 * rather than claimed as a running, verified pipeline. `runAnalyticsAggregation`
 * is exported separately from the scheduled trigger specifically so it can be
 * unit-tested directly without needing to invoke Cloud Scheduler machinery.
 */

import {onSchedule} from "firebase-functions/v2/scheduler";
import {getFirestore} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

export interface DailyAnalyticsSnapshot {
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

/**
 * Computes and persists one day's analytics rollup. Exported as a plain
 * async function (separate from the `onSchedule` trigger below) so it can
 * be invoked directly from tests and, if ever needed, from a manually
 * triggered admin callable without duplicating the aggregation logic.
 * @return {Promise<DailyAnalyticsSnapshot>} The snapshot that was written.
 */
export async function runAnalyticsAggregation(): Promise<DailyAnalyticsSnapshot> {
  const db = getFirestore();
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [usersSnapshot, appointmentsSnapshot] = await Promise.all([
    db.collection("users").get(),
    db.collection("appointments").get(),
  ]);

  let totalPatients = 0;
  let totalDoctors = 0;
  let totalAdmins = 0;
  let newUsersLast24h = 0;

  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    if (data.role === "patient") totalPatients += 1;
    else if (data.role === "doctor") totalDoctors += 1;
    else if (data.role === "admin") totalAdmins += 1;

    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
    if (createdAt && createdAt >= oneDayAgo) {
      newUsersLast24h += 1;
    }
  }

  const appointmentsByStatus: Record<string, number> = {};
  const appointmentCountByDoctor: Record<string, number> = {};

  for (const doc of appointmentsSnapshot.docs) {
    const data = doc.data();
    const status = typeof data.status === "string" ? data.status : "unknown";
    appointmentsByStatus[status] = (appointmentsByStatus[status] ?? 0) + 1;

    if (typeof data.doctorId === "string") {
      appointmentCountByDoctor[data.doctorId] = (appointmentCountByDoctor[data.doctorId] ?? 0) + 1;
    }
  }

  const topDoctorsByAppointmentCount = Object.entries(appointmentCountByDoctor)
    .map(([doctorId, count]) => ({doctorId, count}))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const snapshot: DailyAnalyticsSnapshot = {
    date: dateKey,
    totalUsers: usersSnapshot.size,
    totalPatients,
    totalDoctors,
    totalAdmins,
    newUsersLast24h,
    totalAppointments: appointmentsSnapshot.size,
    appointmentsByStatus,
    topDoctorsByAppointmentCount,
    generatedAt: now.toISOString(),
  };

  await db.collection("analytics_daily").doc(dateKey).set(snapshot);
  logger.info(`Analytics rollup written for ${dateKey}`, {
    totalUsers: snapshot.totalUsers,
    totalAppointments: snapshot.totalAppointments,
  });

  return snapshot;
}

/** Runs the aggregation once every 24 hours. */
export const aggregateDailyAnalytics = onSchedule("every 24 hours", async () => {
  await runAnalyticsAggregation();
});
