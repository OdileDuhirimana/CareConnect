/**
 * Tests for the pharmacy service layer. Previously 0% covered.
 */

import { getDocs, where } from 'firebase/firestore';
import { fetchPartnerPharmacies } from '../pharmacyService';
import { ServiceError } from '../firestoreHelpers';

jest.mock('../../config/firebase', () => ({ db: {} }));

jest.mock('firebase/firestore', () => {
  // Must be a real class — firestoreHelpers.ts uses `instanceof Timestamp`.
  class FakeTimestamp {}
  return {
    collection: jest.fn(() => 'pharmacies-collection'),
    query: jest.fn((...args) => ({ __query: args })),
    where: jest.fn((...args) => ({ __where: args })),
    getDocs: jest.fn(),
    Timestamp: FakeTimestamp,
  };
});

function makeSnapshot(docs: { id: string; data: Record<string, unknown> }[]) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
}

describe('fetchPartnerPharmacies', () => {
  beforeEach(() => jest.clearAllMocks());

  it('filters to partner pharmacies only', async () => {
    (getDocs as jest.Mock).mockResolvedValue(
      makeSnapshot([{ id: 'pharm-1', data: { name: 'CarePlus', isPartner: true } }])
    );

    const pharmacies = await fetchPartnerPharmacies();

    expect(where).toHaveBeenCalledWith('isPartner', '==', true);
    expect(pharmacies).toEqual([{ id: 'pharm-1', name: 'CarePlus', isPartner: true }]);
  });

  it('wraps a Firestore failure in a ServiceError', async () => {
    (getDocs as jest.Mock).mockRejectedValue(new Error('network down'));

    await expect(fetchPartnerPharmacies()).rejects.toThrow(ServiceError);
  });
});
