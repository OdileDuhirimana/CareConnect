/**
 * Unit tests for the `createWellnessEntry` callable — closes the SEC-03
 * gap flagged in the code review, where mood/energy/stress/sleepHours/
 * exerciseMinutes were typed `number` client-side but never range-checked
 * anywhere a modified client couldn't bypass.
 */

import {HttpsError} from "firebase-functions/v2/https";

const mockAdd = jest.fn().mockResolvedValue({id: "new-entry-id"});
const mockCollection = jest.fn(() => ({add: mockAdd}));

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(() => ({collection: mockCollection})),
  FieldValue: {serverTimestamp: jest.fn(() => "mock-server-timestamp")},
}));

// eslint-disable-next-line import/first
import {createWellnessEntry} from "../wellness";

const validInput = {
  mood: 4,
  energy: 3,
  stress: 2,
  sleepHours: 7.5,
  exerciseMinutes: 30,
};

describe("createWellnessEntry", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects an unauthenticated caller", async () => {
    await expect(
      (createWellnessEntry as any).run({data: validInput, auth: undefined})
    ).rejects.toThrow(HttpsError);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("rejects a mood value outside the 1-5 range", async () => {
    await expect(
      (createWellnessEntry as any).run({data: {...validInput, mood: -50}, auth: {uid: "patient-1"}})
    ).rejects.toThrow(HttpsError);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range sleepHours value", async () => {
    await expect(
      (createWellnessEntry as any).run({data: {...validInput, sleepHours: 9999}, auth: {uid: "patient-1"}})
    ).rejects.toThrow(HttpsError);
  });

  it("rejects a negative exerciseMinutes value", async () => {
    await expect(
      (createWellnessEntry as any).run({data: {...validInput, exerciseMinutes: -10}, auth: {uid: "patient-1"}})
    ).rejects.toThrow(HttpsError);
  });

  it("saves a valid entry with userId derived from the authenticated caller", async () => {
    const result = await (createWellnessEntry as any).run({data: validInput, auth: {uid: "patient-1"}});

    expect(result).toEqual({success: true, entryId: "new-entry-id"});
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({userId: "patient-1", mood: 4}));
  });
});
