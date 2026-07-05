/**
 * Unit tests for the `syncUserClaims` Firestore trigger — the mechanism
 * behind this project's Firebase custom-claims RBAC implementation (the
 * #1 item on project.md's own "Future Improvements" list). These tests
 * exercise the trigger function directly with mocked before/after
 * snapshots, since a real Firestore-triggered invocation requires the
 * Emulator Suite (covered separately by the rules-unit-testing
 * integration tests, which don't exercise Cloud Functions triggers).
 */

const mockSetCustomUserClaims = jest.fn();
const mockUpdate = jest.fn();
const mockDoc = jest.fn(() => ({update: mockUpdate}));
const mockCollection = jest.fn(() => ({doc: mockDoc}));

jest.mock("firebase-admin/auth", () => ({
  getAuth: jest.fn(() => ({setCustomUserClaims: mockSetCustomUserClaims})),
}));

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(() => ({collection: mockCollection})),
  FieldValue: {serverTimestamp: jest.fn(() => "mock-server-timestamp")},
}));

// eslint-disable-next-line import/first
import {syncUserClaims} from "../customClaims";

function snapshot(data: Record<string, unknown> | undefined) {
  return data === undefined ? undefined : {data: () => data};
}

type MaybeData = Record<string, unknown> | undefined;

function fakeEvent(userId: string, before: MaybeData, after: MaybeData) {
  return {
    params: {userId},
    data: {before: snapshot(before), after: snapshot(after)},
  };
}

describe("syncUserClaims", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sets claims on document creation", async () => {
    const event = fakeEvent("uid-1", undefined, {role: "patient", isApproved: false});

    await (syncUserClaims as any).run(event);

    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("uid-1", {role: "patient", isApproved: false});
    expect(mockUpdate).toHaveBeenCalledWith({claimsSyncedAt: "mock-server-timestamp"});
  });

  it("re-syncs claims when isApproved flips true (the approveDoctorRequest flow)", async () => {
    const event = fakeEvent(
      "doctor-1",
      {role: "doctor", isApproved: false},
      {role: "doctor", isApproved: true}
    );

    await (syncUserClaims as any).run(event);

    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("doctor-1", {role: "doctor", isApproved: true});
  });

  it("does nothing when neither role nor isApproved changed (e.g. only updatedAt/profileImage changed)", async () => {
    const event = fakeEvent(
      "uid-1",
      {role: "patient", isApproved: false, profileImage: "old.jpg"},
      {role: "patient", isApproved: false, profileImage: "new.jpg"}
    );

    await (syncUserClaims as any).run(event);

    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("revokes claims when the document is deleted", async () => {
    const event = fakeEvent("uid-1", {role: "patient", isApproved: false}, undefined);

    await (syncUserClaims as any).run(event);

    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("uid-1", null);
  });

  it("does not throw if revoking claims fails because the Auth user is already gone", async () => {
    mockSetCustomUserClaims.mockRejectedValueOnce({code: "auth/user-not-found"});
    const event = fakeEvent("uid-1", {role: "patient", isApproved: false}, undefined);

    await expect((syncUserClaims as any).run(event)).resolves.toBeUndefined();
  });

  it("does not crash and skips claim revocation entirely if the document never had a usable role", async () => {
    const event = fakeEvent("uid-1", undefined, undefined);

    await expect((syncUserClaims as any).run(event)).resolves.toBeUndefined();
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });
});
