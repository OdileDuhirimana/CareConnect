/**
 * Unit tests for the `sendMessage` callable — verifies the participant
 * check (a caller must actually be the patient or doctor on the
 * referenced appointment) that a direct client `addDoc` could not enforce
 * beyond "senderId matches the caller," and that `receiverId` is derived
 * server-side rather than trusted from client input.
 */

import {HttpsError} from "firebase-functions/v2/https";

const mockGet = jest.fn();
const mockAdd = jest.fn().mockResolvedValue({id: "new-message-id"});
const mockDoc = jest.fn(() => ({get: mockGet}));
const mockCollection = jest.fn(() => ({doc: mockDoc, add: mockAdd}));

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(() => ({collection: mockCollection})),
  FieldValue: {serverTimestamp: jest.fn(() => "mock-server-timestamp")},
}));

// eslint-disable-next-line import/first
import {sendMessage} from "../messages";

describe("sendMessage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects an unauthenticated caller", async () => {
    await expect(
      (sendMessage as any).run({data: {appointmentId: "appt-1", content: "hi"}, auth: undefined})
    ).rejects.toThrow(HttpsError);
  });

  it("rejects an empty message", async () => {
    await expect(
      (sendMessage as any).run({data: {appointmentId: "appt-1", content: "   "}, auth: {uid: "patient-1"}})
    ).rejects.toThrow(HttpsError);
  });

  it("rejects when the referenced appointment does not exist", async () => {
    mockGet.mockResolvedValueOnce({exists: false});

    await expect(
      (sendMessage as any).run({data: {appointmentId: "missing", content: "hi"}, auth: {uid: "patient-1"}})
    ).rejects.toThrow("could not be found");
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("rejects a caller who is not a participant on the appointment", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({patientId: "patient-1", doctorId: "doctor-1"}),
    });

    await expect(
      (sendMessage as any).run({data: {appointmentId: "appt-1", content: "hi"}, auth: {uid: "stranger"}})
    ).rejects.toThrow("not a participant");
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("derives receiverId from the appointment record, not from client input", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({patientId: "patient-1", doctorId: "doctor-1"}),
    });

    const result = await (sendMessage as any).run({
      data: {appointmentId: "appt-1", content: "Hello doctor"},
      auth: {uid: "patient-1"},
    });

    expect(result).toEqual({success: true, messageId: "new-message-id"});
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({senderId: "patient-1", receiverId: "doctor-1", content: "Hello doctor"})
    );
  });

  it("works symmetrically when the doctor is the sender", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({patientId: "patient-1", doctorId: "doctor-1"}),
    });

    await (sendMessage as any).run({
      data: {appointmentId: "appt-1", content: "Please arrive 10 minutes early."},
      auth: {uid: "doctor-1"},
    });

    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({senderId: "doctor-1", receiverId: "patient-1"}));
  });
});
