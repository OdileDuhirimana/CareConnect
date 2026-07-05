/**
 * Tests for the analytics service client, which reads the rollups written
 * by the `aggregateDailyAnalytics` scheduled Cloud Function
 * (functions/src/analytics.ts).
 */

import { getDoc, getDocs } from 'firebase/firestore';
import { fetchLatestAnalyticsSnapshot, fetchAnalyticsSnapshotForDate } from '../analyticsService';
import { ServiceError } from '../firestoreHelpers';

jest.mock('../../config/firebase', () => ({ db: {} }));

jest.mock('firebase/firestore', () => {
  // Must be a real class — firestoreHelpers.ts uses `instanceof Timestamp`.
  class FakeTimestamp {}
  return {
    collection: jest.fn(() => 'analytics-collection'),
    doc: jest.fn(() => 'analytics-doc-ref'),
    query: jest.fn((...args) => ({ __query: args })),
    orderBy: jest.fn((...args) => ({ __orderBy: args })),
    limit: jest.fn((...args) => ({ __limit: args })),
    getDocs: jest.fn(),
    getDoc: jest.fn(),
    Timestamp: FakeTimestamp,
  };
});

describe('fetchLatestAnalyticsSnapshot', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when no rollup has been generated yet', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ empty: true, docs: [] });

    const snapshot = await fetchLatestAnalyticsSnapshot();

    expect(snapshot).toBeNull();
  });

  it('returns the most recent rollup', async () => {
    (getDocs as jest.Mock).mockResolvedValue({
      empty: false,
      docs: [{ id: '2026-07-04', data: () => ({ totalUsers: 42 }) }],
    });

    const snapshot = await fetchLatestAnalyticsSnapshot();

    expect(snapshot).toEqual({ id: '2026-07-04', totalUsers: 42 });
  });

  it('wraps a Firestore failure in a ServiceError', async () => {
    (getDocs as jest.Mock).mockRejectedValue(new Error('offline'));

    await expect(fetchLatestAnalyticsSnapshot()).rejects.toThrow(ServiceError);
  });
});

describe('fetchAnalyticsSnapshotForDate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when that day has not been aggregated', async () => {
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

    const snapshot = await fetchAnalyticsSnapshotForDate('2026-01-01');

    expect(snapshot).toBeNull();
  });

  it('returns the rollup for the requested date', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      id: '2026-01-01',
      data: () => ({ totalUsers: 10 }),
    });

    const snapshot = await fetchAnalyticsSnapshotForDate('2026-01-01');

    expect(snapshot).toEqual({ id: '2026-01-01', totalUsers: 10 });
  });
});
