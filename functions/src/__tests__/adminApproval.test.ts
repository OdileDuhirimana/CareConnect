/**
 * Unit tests for the admin-approval Cloud Functions.
 *
 * These exercise the exported `onCall` handlers directly via their `.run()`
 * method (the standard way to unit test Firebase Functions v2 callables
 * without needing the Firebase Emulator Suite, which is not runnable in
 * this sandboxed environment — no network access to download/launch the
 * emulator JAR). `firebase-admin` is mocked so no real GCP project or
 * network call is involved.
 *
 * What these tests lock down: the exact security property the original
 * code review flagged as missing — that a non-admin caller (or an
 * unauthenticated one) is rejected before any mutation happens, and that
 * the caller's admin status is derived from their own Firestore document,
 * never trusted from client-supplied request data.
 */

import {HttpsError} from "firebase-functions/v2/https";

const mockGet = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockAdd = jest.fn().mockResolvedValue({id: "mock-audit-log-id"});
const mockDoc = jest.fn(() => ({get: mockGet, update: mockUpdate, delete: mockDelete}));
const mockCollection = jest.fn(() => ({doc: mockDoc, add: mockAdd}));
const mockDeleteUser = jest.fn();

jest.mock("firebase-admin/app", () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn(() => []),
}));

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(() => ({collection: mockCollection})),
  FieldValue: {serverTimestamp: jest.fn(() => "mock-server-timestamp")},
}));

jest.mock("firebase-admin/auth", () => ({
  getAuth: jest.fn(() => ({deleteUser: mockDeleteUser})),
}));

// eslint-disable-next-line import/first
import {approveDoctorRequest, deleteUserAccount} from "../adminApproval";

function adminDocSnapshot(role = "admin") {
  return {exists: true, data: () => ({role})};
}

function doctorDocSnapshot(overrides: Record<string, unknown> = {}) {
  return {exists: true, data: () => ({role: "doctor", isApproved: false, ...overrides})};
}

describe("approveDoctorRequest", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects an unauthenticated caller", async () => {
    await expect(
      (approveDoctorRequest as any).run({data: {userId: "doc-1"}, auth: undefined})
    ).rejects.toThrow(HttpsError);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects a caller whose own user document is not role admin", async () => {
    mockGet.mockResolvedValueOnce({exists: true, data: () => ({role: "patient"})});

    await expect(
      (approveDoctorRequest as any).run({data: {userId: "doc-1"}, auth: {uid: "not-admin-uid"}})
    ).rejects.toThrow("Only an administrator");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects when the target user does not exist", async () => {
    mockGet
      .mockResolvedValueOnce(adminDocSnapshot()) // caller lookup
      .mockResolvedValueOnce({exists: false}); // target lookup

    await expect(
      (approveDoctorRequest as any).run({data: {userId: "missing-user"}, auth: {uid: "admin-uid"}})
    ).rejects.toThrow("User not found");
  });

  it("rejects approving a non-doctor account through this endpoint", async () => {
    mockGet
      .mockResolvedValueOnce(adminDocSnapshot())
      .mockResolvedValueOnce({exists: true, data: () => ({role: "patient"})});

    await expect(
      (approveDoctorRequest as any).run({data: {userId: "patient-1"}, auth: {uid: "admin-uid"}})
    ).rejects.toThrow("Only doctor accounts");
  });

  it("approves a doctor when called by a verified admin", async () => {
    mockGet.mockResolvedValueOnce(adminDocSnapshot()).mockResolvedValueOnce(doctorDocSnapshot());

    const result = await (approveDoctorRequest as any).run({
      data: {userId: "doc-1"},
      auth: {uid: "admin-uid"},
    });

    expect(result).toEqual({success: true});
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({isApproved: true, isVerified: true})
    );
    // SEC-06/SEC-08 fix: a persisted, queryable audit log entry is written
    // in addition to the ephemeral structured log, so "who approved which
    // account and when" survives past Cloud Logging's retention window.
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({actorId: "admin-uid", targetUserId: "doc-1", action: "approveDoctorRequest"})
    );
  });
});

describe("deleteUserAccount", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects an unauthenticated caller", async () => {
    await expect(
      (deleteUserAccount as any).run({data: {userId: "user-1"}, auth: undefined})
    ).rejects.toThrow(HttpsError);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("rejects a non-admin caller", async () => {
    mockGet.mockResolvedValueOnce({exists: true, data: () => ({role: "doctor"})});

    await expect(
      (deleteUserAccount as any).run({data: {userId: "user-1"}, auth: {uid: "doctor-uid"}})
    ).rejects.toThrow("Only an administrator");
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("refuses to let an admin delete their own account through this endpoint", async () => {
    mockGet.mockResolvedValueOnce(adminDocSnapshot());

    await expect(
      (deleteUserAccount as any).run({data: {userId: "admin-uid"}, auth: {uid: "admin-uid"}})
    ).rejects.toThrow("cannot delete their own account");
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("deletes the Auth user and Firestore profile when called by an admin targeting someone else", async () => {
    mockGet.mockResolvedValueOnce(adminDocSnapshot());
    mockDeleteUser.mockResolvedValueOnce(undefined);

    const result = await (deleteUserAccount as any).run({
      data: {userId: "target-uid"},
      auth: {uid: "admin-uid"},
    });

    expect(result).toEqual({success: true});
    expect(mockDeleteUser).toHaveBeenCalledWith("target-uid");
    expect(mockDelete).toHaveBeenCalled();
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({actorId: "admin-uid", targetUserId: "target-uid", action: "deleteUserAccount"})
    );
  });

  it("still cleans up the Firestore profile if the Auth user was already deleted", async () => {
    mockGet.mockResolvedValueOnce(adminDocSnapshot());
    mockDeleteUser.mockRejectedValueOnce({code: "auth/user-not-found"});

    const result = await (deleteUserAccount as any).run({
      data: {userId: "already-gone"},
      auth: {uid: "admin-uid"},
    });

    expect(result).toEqual({success: true});
    expect(mockDelete).toHaveBeenCalled();
  });

  it("surfaces an internal error for unexpected Auth deletion failures", async () => {
    mockGet.mockResolvedValueOnce(adminDocSnapshot());
    mockDeleteUser.mockRejectedValueOnce({code: "auth/internal-error"});

    await expect(
      (deleteUserAccount as any).run({data: {userId: "target-uid"}, auth: {uid: "admin-uid"}})
    ).rejects.toThrow(HttpsError);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
