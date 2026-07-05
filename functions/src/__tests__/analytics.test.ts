/**
 * Unit tests for `runAnalyticsAggregation` — the real aggregation logic
 * behind the scheduled `aggregateDailyAnalytics` function, which replaces
 * the previously-static illustrative numbers on the admin/doctor analytics
 * screens. Exported and tested separately from the `onSchedule` wrapper so
 * the aggregation math itself is verifiable without any Cloud Scheduler
 * machinery.
 */

const mockSet = jest.fn();
const mockDoc = jest.fn(() => ({set: mockSet}));
const mockGetUsers = jest.fn();
const mockGetAppointments = jest.fn();

const mockCollection = jest.fn((name: string) => {
  if (name === "users") return {get: mockGetUsers};
  if (name === "appointments") return {get: mockGetAppointments};
  return {doc: mockDoc};
});

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(() => ({collection: mockCollection})),
}));

// eslint-disable-next-line import/first
import {runAnalyticsAggregation} from "../analytics";

function userDoc(role: string, createdAt: Date) {
  return {data: () => ({role, createdAt: {toDate: () => createdAt}})};
}

function appointmentDoc(doctorId: string, status: string) {
  return {data: () => ({doctorId, status})};
}

describe("runAnalyticsAggregation", () => {
  beforeEach(() => jest.clearAllMocks());

  it("counts users by role and appointments by status, and ranks doctors by appointment volume", async () => {
    const now = new Date();
    const longAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    mockGetUsers.mockResolvedValue({
      size: 4,
      docs: [
        userDoc("patient", longAgo),
        userDoc("patient", now), // within the last 24h
        userDoc("doctor", longAgo),
        userDoc("admin", longAgo),
      ],
    });

    mockGetAppointments.mockResolvedValue({
      size: 3,
      docs: [
        appointmentDoc("doctor-1", "confirmed"),
        appointmentDoc("doctor-1", "pending"),
        appointmentDoc("doctor-2", "confirmed"),
      ],
    });

    const snapshot = await runAnalyticsAggregation();

    expect(snapshot.totalUsers).toBe(4);
    expect(snapshot.totalPatients).toBe(2);
    expect(snapshot.totalDoctors).toBe(1);
    expect(snapshot.totalAdmins).toBe(1);
    expect(snapshot.newUsersLast24h).toBe(1);
    expect(snapshot.totalAppointments).toBe(3);
    expect(snapshot.appointmentsByStatus).toEqual({confirmed: 2, pending: 1});
    expect(snapshot.topDoctorsByAppointmentCount[0]).toEqual({doctorId: "doctor-1", count: 2});

    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({totalUsers: 4, totalAppointments: 3}));
  });

  it("handles an empty database without throwing", async () => {
    mockGetUsers.mockResolvedValue({size: 0, docs: []});
    mockGetAppointments.mockResolvedValue({size: 0, docs: []});

    const snapshot = await runAnalyticsAggregation();

    expect(snapshot.totalUsers).toBe(0);
    expect(snapshot.appointmentsByStatus).toEqual({});
    expect(snapshot.topDoctorsByAppointmentCount).toEqual([]);
  });
});
