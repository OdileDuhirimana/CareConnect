/**
 * Tests for the appointment service layer.
 *
 * These are unit tests against a mocked `firebase/firestore` module rather
 * than a live/emulated Firestore instance. A Firebase Emulator-based
 * integration test suite would give higher-fidelity coverage (e.g. real
 * security rule enforcement, real composite-index errors) but is called
 * out as future work in project.md — it could not be run in this sandboxed
 * environment (no network access, no ability to launch the Firebase
 * emulator here). These tests instead lock down the contract this module
 * promises to its callers: which Firestore query constraints get built,
 * how errors are translated, and the critical edge cases a reviewer would
 * expect to see covered (missing ids, empty results, pagination cursors).
 */

import { where, orderBy, getDocs, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  fetchAppointmentsForPatient,
  fetchUpcomingAppointmentsForDoctor,
  fetchAppointmentsForDoctorOnDate,
  fetchBookedSlots,
  createAppointment,
  updateAppointmentStatus,
} from '../appointmentService';
import { ServiceError } from '../firestoreHelpers';

jest.mock('../../config/firebase', () => ({ db: {}, functions: {} }));

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(),
}));

jest.mock('firebase/firestore', () => {
  // A minimal stand-in for the real Firestore Timestamp class. It must be
  // an actual class (not a plain object) because firestoreHelpers.ts uses
  // `instanceof Timestamp` to decide which fields to convert to Date —
  // a plain object there would make `instanceof` throw at runtime.
  class FakeTimestamp {
    static now() {
      return 'mock-timestamp';
    }
  }
  return {
    collection: jest.fn(() => 'appointments-collection'),
    query: jest.fn((...args) => ({ __query: args })),
    where: jest.fn((...args) => ({ __where: args })),
    orderBy: jest.fn((...args) => ({ __orderBy: args })),
    limit: jest.fn((...args) => ({ __limit: args })),
    startAfter: jest.fn((...args) => ({ __startAfter: args })),
    getDocs: jest.fn(),
    addDoc: jest.fn(),
    updateDoc: jest.fn(),
    doc: jest.fn(() => 'appointment-doc-ref'),
    Timestamp: FakeTimestamp,
  };
});

function makeSnapshot(docs: { id: string; data: Record<string, unknown> }[]) {
  return {
    docs: docs.map((d) => ({
      id: d.id,
      data: () => d.data,
    })),
  };
}

describe('appointmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchAppointmentsForPatient', () => {
    it('rejects when no patient id is provided', async () => {
      await expect(fetchAppointmentsForPatient('')).rejects.toThrow(ServiceError);
    });

    it('maps Firestore documents into Appointment objects with a pagination cursor', async () => {
      (getDocs as jest.Mock).mockResolvedValue(
        makeSnapshot([
          { id: 'apt-1', data: { patientId: 'p1', doctorId: 'd1', status: 'pending' } },
        ])
      );

      const page = await fetchAppointmentsForPatient('p1', { pageSize: 1 });

      expect(where).toHaveBeenCalledWith('patientId', '==', 'p1');
      expect(orderBy).toHaveBeenCalledWith('date', 'desc');
      expect(page.appointments).toHaveLength(1);
      expect(page.appointments[0]).toMatchObject({ id: 'apt-1', patientId: 'p1' });
      // A full page (docs.length === pageSize) implies more results may exist.
      expect(page.nextCursor).toBeDefined();
    });

    it('returns no cursor when the page is not full (last page)', async () => {
      (getDocs as jest.Mock).mockResolvedValue(makeSnapshot([{ id: 'apt-1', data: {} }]));

      const page = await fetchAppointmentsForPatient('p1', { pageSize: 20 });

      expect(page.nextCursor).toBeUndefined();
    });

    it('wraps unexpected Firestore failures in a ServiceError', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('network down'));

      await expect(fetchAppointmentsForPatient('p1')).rejects.toThrow(ServiceError);
    });
  });

  describe('fetchUpcomingAppointmentsForDoctor', () => {
    it('rejects when no doctor id is provided', async () => {
      await expect(fetchUpcomingAppointmentsForDoctor('', new Date())).rejects.toThrow(ServiceError);
    });

    it('queries by doctorId and a date lower bound, ascending', async () => {
      (getDocs as jest.Mock).mockResolvedValue(makeSnapshot([]));

      await fetchUpcomingAppointmentsForDoctor('doc-1', new Date('2026-07-02'));

      expect(where).toHaveBeenCalledWith('doctorId', '==', 'doc-1');
      expect(where).toHaveBeenCalledWith('date', '>=', new Date('2026-07-02'));
      expect(orderBy).toHaveBeenCalledWith('date', 'asc');
    });
  });

  describe('fetchAppointmentsForDoctorOnDate', () => {
    it('builds a [startOfDay, startOfNextDay) range rather than an exact string match', async () => {
      (getDocs as jest.Mock).mockResolvedValue(makeSnapshot([]));

      await fetchAppointmentsForDoctorOnDate('doc-1', '2026-07-01');

      expect(where).toHaveBeenCalledWith('doctorId', '==', 'doc-1');
      expect(where).toHaveBeenCalledWith('date', '>=', new Date('2026-07-01T00:00:00'));
      expect(where).toHaveBeenCalledWith('date', '<', new Date('2026-07-02T00:00:00'));
    });
  });

  describe('fetchBookedSlots', () => {
    it('returns only the time field of matching appointments', async () => {
      (getDocs as jest.Mock).mockResolvedValue(
        makeSnapshot([
          { id: 'a', data: { time: '09:00' } },
          { id: 'b', data: { time: '10:30' } },
        ])
      );

      const slots = await fetchBookedSlots('doc-1', '2026-07-01');

      expect(slots).toEqual(['09:00', '10:30']);
    });
  });

  describe('createAppointment', () => {
    // `createAppointment` is a thin client around the `createAppointment`
    // Cloud Function (see functions/src/appointments.ts) — the server-side
    // Zod validation/doctor-approval re-verification is covered by
    // functions/src/__tests__/appointments.test.ts. These tests verify the
    // client-side contract: local pre-flight checks, correct callable name/
    // payload (patientId is never sent — the server derives it from the
    // authenticated caller), and error translation.
    const validInput = {
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      date: '2026-08-01',
      time: '09:00',
      duration: 30,
      type: 'video' as const,
      reason: 'Follow-up checkup',
    };

    beforeEach(() => jest.clearAllMocks());

    it('rejects when patientId is missing (caller not signed in), without calling the Cloud Function', async () => {
      await expect(createAppointment({ ...validInput, patientId: '' })).rejects.toThrow(
        'You must be signed in to book an appointment.'
      );
      expect(httpsCallable).not.toHaveBeenCalled();
    });

    it('rejects when reason is blank', async () => {
      await expect(createAppointment({ ...validInput, reason: '   ' })).rejects.toThrow(
        'Please fill in all required fields.'
      );
    });

    it('rejects when required date/time fields are missing', async () => {
      await expect(createAppointment({ ...validInput, date: '' })).rejects.toThrow(ServiceError);
    });

    it('calls the createAppointment callable without sending patientId', async () => {
      const mockCallable = jest.fn().mockResolvedValue({ data: { success: true, appointmentId: 'new-apt' } });
      (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

      await createAppointment(validInput);

      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'createAppointment');
      expect(mockCallable).toHaveBeenCalledWith({
        doctorId: 'doctor-1',
        date: '2026-08-01',
        time: '09:00',
        duration: 30,
        type: 'video',
        reason: 'Follow-up checkup',
        notes: undefined,
      });
    });

    it('surfaces a ServiceError when the server declines to book the appointment', async () => {
      const mockCallable = jest.fn().mockResolvedValue({ data: { success: false } });
      (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

      await expect(createAppointment(validInput)).rejects.toThrow(ServiceError);
    });

    it('wraps a Cloud Function failure in a ServiceError with an actionable message', async () => {
      const mockCallable = jest.fn().mockRejectedValue(new Error('permission-denied'));
      (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

      await expect(createAppointment(validInput)).rejects.toThrow(
        'Failed to book appointment. Please try again.'
      );
    });
  });

  describe('updateAppointmentStatus', () => {
    it('rejects when no appointment id is provided', async () => {
      await expect(updateAppointmentStatus('', 'cancelled')).rejects.toThrow(ServiceError);
    });

    it('updates status and updatedAt', async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await updateAppointmentStatus('apt-1', 'confirmed');

      expect(updateDoc).toHaveBeenCalledWith(
        'appointment-doc-ref',
        expect.objectContaining({ status: 'confirmed', updatedAt: 'mock-timestamp' })
      );
    });
  });
});
