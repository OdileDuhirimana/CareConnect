/**
 * Unit tests for the `createAppointment` callable — the server-side
 * validated replacement for the previous direct-client `addDoc` write
 * (SEC-01/SEC-03 fix). Covers: authentication requirement, Zod schema
 * rejection of malformed input, and the doctor-existence/approval
 * re-verification that a modified client could otherwise bypass.
 */

import {HttpsError} from "firebase-functions/v2/https";

const mockGet = jest.fn();
const mockAdd = jest.fn().mockResolvedValue({id: "new-appointment-id"});
const mockDoc = jest.fn(() => ({get: mockGet}));
const mockCollection = jest.fn(() => ({doc: mockDoc, add: mockAdd}));

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(() => ({collection: mockCollection})),
  FieldValue: {serverTimestamp: jest.fn(() => "mock-server-timestamp")},
}));

// eslint-disable-next-line import/first
import {createAppointment} from "../appointments";

function approvedDoctorSnapshot() {
  return {exists: true, data: () => ({role: "doctor", isApproved: true})};
}

const validInput = {
  doctorId: "doctor-1",
  date: "2099-06-15",
  time: "10:30",
  duration: 30,
  type: "video" as const,
  reason: "Annual checkup",
};

describe("createAppointment", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects an unauthenticated caller", async () => {
    await expect(
      (createAppointment as any).run({data: validInput, auth: undefined})
    ).rejects.toThrow(HttpsError);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("rejects input that fails Zod validation (invalid time format)", async () => {
    await expect(
      (createAppointment as any).run({
        data: {...validInput, time: "not-a-time"},
        auth: {uid: "patient-1"},
      })
    ).rejects.toThrow(HttpsError);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("rejects a reason that is too short", async () => {
    await expect(
      (createAppointment as any).run({data: {...validInput, reason: "hi"}, auth: {uid: "patient-1"}})
    ).rejects.toThrow(HttpsError);
  });

  it("rejects booking against a doctorId that doesn't exist", async () => {
    mockGet.mockResolvedValueOnce({exists: false});

    await expect(
      (createAppointment as any).run({data: validInput, auth: {uid: "patient-1"}})
    ).rejects.toThrow("not currently available");
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("rejects booking against a doctor who is not yet admin-approved", async () => {
    mockGet.mockResolvedValueOnce({exists: true, data: () => ({role: "doctor", isApproved: false})});

    await expect(
      (createAppointment as any).run({data: validInput, auth: {uid: "patient-1"}})
    ).rejects.toThrow("not currently available");
  });

  it("rejects a date in the past", async () => {
    mockGet.mockResolvedValueOnce(approvedDoctorSnapshot());

    await expect(
      (createAppointment as any).run({
        data: {...validInput, date: "2000-01-01"},
        auth: {uid: "patient-1"},
      })
    ).rejects.toThrow("cannot be in the past");
  });

  it("creates the appointment with patientId derived from the authenticated caller, not client input", async () => {
    mockGet.mockResolvedValueOnce(approvedDoctorSnapshot());

    const result = await (createAppointment as any).run({data: validInput, auth: {uid: "patient-1"}});

    expect(result).toEqual({success: true, appointmentId: "new-appointment-id"});
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: "patient-1",
        doctorId: "doctor-1",
        status: "pending",
        time: "10:30",
      })
    );
  });
});
