/**
 * Tests for the payment service client. The server-side amount
 * computation and ownership check are covered by
 * functions/src/__tests__/payments.test.ts.
 */

import { httpsCallable } from 'firebase/functions';
import { createPaymentIntent } from '../paymentService';
import { ServiceError } from '../firestoreHelpers';

jest.mock('../../config/firebase', () => ({ functions: {} }));

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(),
}));

// paymentService.ts doesn't call the Firestore SDK directly, but it
// imports `ServiceError` from `./firestoreHelpers`, which itself imports
// types/values from 'firebase/firestore' — this must be mocked here too,
// or Jest attempts to load the real ESM package and fails to parse it.
jest.mock('firebase/firestore', () => ({
  Timestamp: class FakeTimestamp {},
}));

describe('createPaymentIntent', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects locally when no appointmentId is given', async () => {
    await expect(createPaymentIntent({ appointmentId: '' })).rejects.toThrow(
      'An appointment is required to make a payment.'
    );
    expect(httpsCallable).not.toHaveBeenCalled();
  });

  it('calls the createPaymentIntent callable and returns its result', async () => {
    const mockCallable = jest
      .fn()
      .mockResolvedValue({ data: { clientSecret: 'secret_abc', paymentIntentId: 'pi_123', amount: 80 } });
    (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

    const result = await createPaymentIntent({ appointmentId: 'appt-1' });

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'createPaymentIntent');
    expect(mockCallable).toHaveBeenCalledWith({ appointmentId: 'appt-1' });
    expect(result).toEqual({ clientSecret: 'secret_abc', paymentIntentId: 'pi_123', amount: 80 });
  });

  it('wraps a Cloud Function failure in a ServiceError', async () => {
    const mockCallable = jest.fn().mockRejectedValue(new Error('not-found'));
    (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

    await expect(createPaymentIntent({ appointmentId: 'appt-1' })).rejects.toThrow(ServiceError);
  });
});
