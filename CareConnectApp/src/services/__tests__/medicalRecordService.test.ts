/**
 * Tests for the medical-records service layer. Previously 0% covered
 * (both audits flagged excluded/untested service files as a real gap).
 */

import { getDocs, where, orderBy, limit } from 'firebase/firestore';
import { fetchMedicalRecordsForPatient, fetchRecentMedicalRecords } from '../medicalRecordService';
import { ServiceError } from '../firestoreHelpers';

jest.mock('../../config/firebase', () => ({ db: {} }));

jest.mock('firebase/firestore', () => {
  // Must be a real class — firestoreHelpers.ts uses `instanceof Timestamp`.
  class FakeTimestamp {}
  return {
    collection: jest.fn(() => 'medical-records-collection'),
    query: jest.fn((...args) => ({ __query: args })),
    where: jest.fn((...args) => ({ __where: args })),
    orderBy: jest.fn((...args) => ({ __orderBy: args })),
    limit: jest.fn((...args) => ({ __limit: args })),
    getDocs: jest.fn(),
    Timestamp: FakeTimestamp,
  };
});

function makeSnapshot(docs: { id: string; data: Record<string, unknown> }[]) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
}

describe('fetchMedicalRecordsForPatient', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects when no patient id is given', async () => {
    await expect(fetchMedicalRecordsForPatient('')).rejects.toThrow(
      'You must be signed in to view medical records.'
    );
  });

  it('queries by patientId, newest first', async () => {
    (getDocs as jest.Mock).mockResolvedValue(makeSnapshot([{ id: 'rec-1', data: { type: 'lab_result' } }]));

    const records = await fetchMedicalRecordsForPatient('patient-1');

    expect(where).toHaveBeenCalledWith('patientId', '==', 'patient-1');
    expect(orderBy).toHaveBeenCalledWith('date', 'desc');
    expect(records).toHaveLength(1);
  });

  it('wraps a Firestore failure in a ServiceError', async () => {
    (getDocs as jest.Mock).mockRejectedValue(new Error('network down'));

    await expect(fetchMedicalRecordsForPatient('patient-1')).rejects.toThrow(ServiceError);
  });
});

describe('fetchRecentMedicalRecords', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects when no patient id is given', async () => {
    await expect(fetchRecentMedicalRecords('')).rejects.toThrow(ServiceError);
  });

  it('caps results using the provided count', async () => {
    (getDocs as jest.Mock).mockResolvedValue(makeSnapshot([]));

    await fetchRecentMedicalRecords('patient-1', 3);

    expect(limit).toHaveBeenCalledWith(3);
  });

  it('defaults to a count of 5 when not specified', async () => {
    (getDocs as jest.Mock).mockResolvedValue(makeSnapshot([]));

    await fetchRecentMedicalRecords('patient-1');

    expect(limit).toHaveBeenCalledWith(5);
  });
});
