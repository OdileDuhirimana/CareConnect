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
import { Appointment } from '../types';
import { mapDoc, ServiceError } from './firestoreHelpers';

/**
 * Data-access layer for the `appointments` collection.
 *
 * Why this exists: previously every screen (AppointmentBookingScreen,
 * MyAppointmentsScreen, DoctorHomeScreen, DoctorScheduleScreen,
 * PatientHomeScreen) imported the Firestore SDK directly and duplicated
 * near-identical query/mapping code, with no single place to fix a bug in
 * how appointments are fetched or to add pagination. Centralizing it here
 * means UI components depend on a typed, testable interface instead of the
 * Firestore SDK, satisfying the "service/repository layer" requirement
 * from the code review (AR-02/AR-03/ARC-01..06).
 */

const COLLECTION = 'appointments';

export interface AppointmentPage {
  appointments: Appointment[];
  /** Cursor to pass as `after` to fetch the next page; undefined when there are no more results. */
  nextCursor?: QueryDocumentSnapshot<DocumentData>;
}

export interface FetchAppointmentsOptions {
  pageSize?: number;
  after?: QueryDocumentSnapshot<DocumentData>;
}

async function fetchPage(
  constraints: Parameters<typeof query>[1][],
  { pageSize = 20, after }: FetchAppointmentsOptions = {}
): Promise<AppointmentPage> {
  try {
    const baseConstraints = after
      ? [...constraints, startAfter(after), limit(pageSize)]
      : [...constraints, limit(pageSize)];

    const q = query(collection(db, COLLECTION), ...baseConstraints);
    const snapshot = await getDocs(q);
    const appointments = snapshot.docs.map((d) => mapDoc<Appointment>(d));

    return {
      appointments,
      nextCursor: snapshot.docs.length === pageSize ? snapshot.docs[snapshot.docs.length - 1] : undefined,
    };
  } catch (error) {
    throw new ServiceError('Failed to load appointments.', error);
  }
}

/**
 * Paginated list of a patient's appointments, most recent first.
 *
 * Declared `async` (rather than returning `fetchPage(...)` directly from a
 * sync function) so that the input-validation error below is delivered as
 * a rejected Promise, not a synchronous throw. Callers uniformly `await`
 * these functions inside try/catch, so a sync throw would already be
 * caught in practice — but a mixed sync/async error-signaling contract
 * within the same module is a foot-gun for any future caller that doesn't
 * wrap the call (e.g. `.then()/.catch()` chaining), so every exported
 * function in this module rejects rather than throws synchronously.
 */
export async function fetchAppointmentsForPatient(
  patientId: string,
  options?: FetchAppointmentsOptions
): Promise<AppointmentPage> {
  if (!patientId) {
    throw new ServiceError('A patient id is required to fetch appointments.');
  }
  return fetchPage([where('patientId', '==', patientId), orderBy('date', 'desc')], options);
}

/** Paginated list of a doctor's upcoming appointments (today onward), soonest first. */
export async function fetchUpcomingAppointmentsForDoctor(
  doctorId: string,
  fromDate: Date,
  options?: FetchAppointmentsOptions
): Promise<AppointmentPage> {
  if (!doctorId) {
    throw new ServiceError('A doctor id is required to fetch appointments.');
  }
  return fetchPage(
    [where('doctorId', '==', doctorId), where('date', '>=', fromDate), orderBy('date', 'asc')],
    options
  );
}

/**
 * A doctor's appointments for one specific calendar day.
 *
 * `date` is stored as a Firestore Timestamp (see createAppointment), so
 * "on this day" is expressed as a `[startOfDay, startOfNextDay)` range
 * rather than an exact-match on a date string. The previous implementation
 * in DoctorScheduleScreen compared the Timestamp field directly to a
 * `YYYY-MM-DD` string, which cannot match and would have silently
 * returned zero appointments for any real data.
 */
export async function fetchAppointmentsForDoctorOnDate(doctorId: string, isoDate: string): Promise<Appointment[]> {
  if (!doctorId) {
    throw new ServiceError('A doctor id is required to fetch appointments.');
  }
  try {
    const startOfDay = new Date(`${isoDate}T00:00:00`);
    const startOfNextDay = new Date(startOfDay);
    startOfNextDay.setDate(startOfNextDay.getDate() + 1);

    const q = query(
      collection(db, COLLECTION),
      where('doctorId', '==', doctorId),
      where('date', '>=', startOfDay),
      where('date', '<', startOfNextDay),
      orderBy('date', 'asc'),
      orderBy('time', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => mapDoc<Appointment>(d));
  } catch (error) {
    throw new ServiceError('Failed to load schedule for the selected date.', error);
  }
}

/** A patient's upcoming (confirmed or pending) appointments, capped to `count`. */
export async function fetchUpcomingAppointmentsForPatient(
  patientId: string,
  count = 3
): Promise<Appointment[]> {
  if (!patientId) {
    throw new ServiceError('A patient id is required to fetch appointments.');
  }
  try {
    const q = query(
      collection(db, COLLECTION),
      where('patientId', '==', patientId),
      where('status', 'in', ['confirmed', 'pending']),
      orderBy('date', 'asc'),
      limit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => mapDoc<Appointment>(d));
  } catch (error) {
    throw new ServiceError('Failed to load upcoming appointments.', error);
  }
}

/** Time slots already booked for a doctor on a given date, used to compute availability. */
export async function fetchBookedSlots(doctorId: string, isoDate: string): Promise<string[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('doctorId', '==', doctorId),
      where('date', '==', isoDate),
      where('status', 'in', ['confirmed', 'pending'])
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data().time as string);
  } catch (error) {
    throw new ServiceError('Failed to load available time slots.', error);
  }
}

export interface CreateAppointmentInput {
  patientId: string;
  doctorId: string;
  date: string;
  time: string;
  duration: number;
  type: Appointment['type'];
  reason: string;
  notes?: string;
}

interface CreateAppointmentResponse {
  success: boolean;
  appointmentId: string;
}

/**
 * Creates a new appointment request in `pending` status.
 *
 * Implemented as a callable Cloud Function
 * (`functions/src/appointments.ts`) rather than a direct `addDoc`, so the
 * doctorId/date/time/duration/reason are validated server-side (Zod schema
 * + re-verifying the doctor exists, has role 'doctor', and is
 * admin-approved) instead of relying solely on client-side TypeScript and
 * Firestore rules' ownership check, which cannot express field-shape or
 * cross-document validation. See firestore.rules, where `appointments`
 * `allow create` is `false` — this callable is now the only way an
 * appointment can be created.
 */
export async function createAppointment(input: CreateAppointmentInput): Promise<void> {
  if (!input.patientId) {
    throw new ServiceError('You must be signed in to book an appointment.');
  }
  if (!input.doctorId || !input.date || !input.time || !input.reason.trim()) {
    throw new ServiceError('Please fill in all required fields.');
  }

  try {
    const callable = httpsCallable<Omit<CreateAppointmentInput, 'patientId'>, CreateAppointmentResponse>(
      functions,
      'createAppointment'
    );
    const result = await callable({
      doctorId: input.doctorId,
      date: input.date,
      time: input.time,
      duration: input.duration,
      type: input.type,
      reason: input.reason.trim(),
      notes: input.notes?.trim(),
    });
    if (!result.data.success) {
      throw new ServiceError('The server declined to book this appointment.');
    }
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError('Failed to book appointment. Please try again.', error);
  }
}

/** Updates the status of an existing appointment (confirm, cancel, complete, etc.). */
export async function updateAppointmentStatus(
  appointmentId: string,
  status: Appointment['status']
): Promise<void> {
  if (!appointmentId) {
    throw new ServiceError('An appointment id is required.');
  }
  try {
    await updateDoc(doc(db, COLLECTION, appointmentId), {
      status,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    throw new ServiceError('Failed to update the appointment. Please try again.', error);
  }
}
