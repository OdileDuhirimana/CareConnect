/**
 * Unit tests for `createPaymentIntent` — verifies the server computes the
 * charge amount itself (never trusting a client-supplied amount) and
 * verifies appointment ownership before creating a Stripe PaymentIntent.
 * The Stripe SDK itself is mocked; no real Stripe account is used or
 * required (see payments.ts's honesty note — this has not been run
 * against a live Stripe account in this environment).
 */

import {HttpsError} from "firebase-functions/v2/https";

const mockCreatePaymentIntent = jest.fn();
const mockAdd = jest.fn().mockResolvedValue({id: "payment-doc-id"});
const mockGet = jest.fn();
const mockDoc = jest.fn(() => ({get: mockGet}));
const mockCollection = jest.fn(() => ({doc: mockDoc, add: mockAdd}));

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(() => ({collection: mockCollection})),
  FieldValue: {serverTimestamp: jest.fn(() => "mock-server-timestamp")},
}));

jest.mock("firebase-functions/params", () => ({
  defineSecret: jest.fn(() => ({value: () => "mock-stripe-secret"})),
}));

jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {create: mockCreatePaymentIntent},
  }));
});

// eslint-disable-next-line import/first
import {createPaymentIntent} from "../payments";

describe("createPaymentIntent", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects an unauthenticated caller", async () => {
    await expect(
      (createPaymentIntent as any).run({data: {appointmentId: "appt-1"}, auth: undefined})
    ).rejects.toThrow(HttpsError);
  });

  it("rejects when the appointment does not exist", async () => {
    mockGet.mockResolvedValueOnce({exists: false});

    await expect(
      (createPaymentIntent as any).run({data: {appointmentId: "missing"}, auth: {uid: "patient-1"}})
    ).rejects.toThrow("not found");
  });

  it("rejects a caller who is not the patient on the appointment", async () => {
    mockGet.mockResolvedValueOnce({exists: true, data: () => ({patientId: "patient-1", doctorId: "doctor-1"})});

    await expect(
      (createPaymentIntent as any).run({data: {appointmentId: "appt-1"}, auth: {uid: "stranger"}})
    ).rejects.toThrow("your own appointments");
  });

  it("computes the amount server-side from the doctor's fee, ignoring any client-supplied amount", async () => {
    mockGet
      // appointment
      .mockResolvedValueOnce({exists: true, data: () => ({patientId: "patient-1", doctorId: "doctor-1"})})
      // doctor
      .mockResolvedValueOnce({exists: true, data: () => ({consultationFee: 75})});

    mockCreatePaymentIntent.mockResolvedValue({id: "pi_123", client_secret: "secret_abc"});

    const result = await (createPaymentIntent as any).run({
      data: {appointmentId: "appt-1", amount: 1}, // a tampered client-supplied amount, which must be ignored
      auth: {uid: "patient-1"},
    });

    // $75 consultation fee + $5 flat platform fee = $80 = 8000 cents.
    expect(mockCreatePaymentIntent).toHaveBeenCalledWith(expect.objectContaining({amount: 8000, currency: "usd"}));
    expect(result).toEqual({clientSecret: "secret_abc", paymentIntentId: "pi_123", amount: 80});
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({userId: "patient-1", amount: 80, status: "pending"}));
  });

  it("falls back to the default consultation fee if the doctor record has no numeric fee", async () => {
    mockGet
      .mockResolvedValueOnce({exists: true, data: () => ({patientId: "patient-1", doctorId: "doctor-1"})})
      .mockResolvedValueOnce({exists: true, data: () => ({})});

    mockCreatePaymentIntent.mockResolvedValue({id: "pi_456", client_secret: "secret_def"});

    const result = await (createPaymentIntent as any).run({
      data: {appointmentId: "appt-1"},
      auth: {uid: "patient-1"},
    });

    // $50 default + $5 platform fee = $55 = 5500 cents.
    expect(result.amount).toBe(55);
  });
});
