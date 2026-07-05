/**
 * Tests for the message service layer. `sendMessage` is a thin client
 * around the `sendMessage` Cloud Function (functions/src/messages.ts) —
 * the server-side participant check is covered there. This file covers
 * the client-side contract and the real-time subscription wrapper, which
 * previously had zero test coverage (both audits flagged
 * `collectCoverageFrom` as excluding untested service files).
 */

import { onSnapshot, where, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { subscribeToAppointmentMessages, sendMessage } from '../messageService';
import { ServiceError } from '../firestoreHelpers';

jest.mock('../../config/firebase', () => ({ db: {}, functions: {} }));

jest.mock('firebase/firestore', () => {
  // Must be a real class — firestoreHelpers.ts uses `instanceof Timestamp`.
  class FakeTimestamp {}
  return {
    collection: jest.fn(() => 'messages-collection'),
    query: jest.fn((...args) => ({ __query: args })),
    where: jest.fn((...args) => ({ __where: args })),
    orderBy: jest.fn((...args) => ({ __orderBy: args })),
    onSnapshot: jest.fn(),
    Timestamp: FakeTimestamp,
  };
});

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(),
}));

describe('subscribeToAppointmentMessages', () => {
  beforeEach(() => jest.clearAllMocks());

  it('queries messages for the given appointment, ordered oldest-first', () => {
    (onSnapshot as jest.Mock).mockReturnValue(jest.fn());

    subscribeToAppointmentMessages('appt-1', jest.fn(), jest.fn());

    expect(where).toHaveBeenCalledWith('appointmentId', '==', 'appt-1');
    expect(orderBy).toHaveBeenCalledWith('createdAt', 'asc');
  });

  it('maps snapshot documents and invokes onUpdate', () => {
    let capturedOnNext: ((snapshot: unknown) => void) | undefined;
    (onSnapshot as jest.Mock).mockImplementation((_q, onNext) => {
      capturedOnNext = onNext;
      return jest.fn();
    });

    const onUpdate = jest.fn();
    subscribeToAppointmentMessages('appt-1', onUpdate, jest.fn());

    capturedOnNext?.({
      docs: [{ id: 'msg-1', data: () => ({ content: 'hi', senderId: 'u1' }) }],
    });

    expect(onUpdate).toHaveBeenCalledWith([{ id: 'msg-1', content: 'hi', senderId: 'u1' }]);
  });

  it('wraps a listener error in a ServiceError and invokes onError', () => {
    let capturedOnError: ((error: unknown) => void) | undefined;
    (onSnapshot as jest.Mock).mockImplementation((_q, _onNext, onError) => {
      capturedOnError = onError;
      return jest.fn();
    });

    const onError = jest.fn();
    subscribeToAppointmentMessages('appt-1', jest.fn(), onError);

    capturedOnError?.(new Error('offline'));

    expect(onError).toHaveBeenCalledWith(expect.any(ServiceError));
  });

  it('returns the Firestore unsubscribe function for cleanup', () => {
    const unsubscribe = jest.fn();
    (onSnapshot as jest.Mock).mockReturnValue(unsubscribe);

    const result = subscribeToAppointmentMessages('appt-1', jest.fn(), jest.fn());

    expect(result).toBe(unsubscribe);
  });
});

describe('sendMessage', () => {
  const validInput = {
    senderId: 'patient-1',
    receiverId: 'doctor-1',
    appointmentId: 'appt-1',
    content: 'Hello doctor',
  };

  beforeEach(() => jest.clearAllMocks());

  it('rejects when not signed in, without calling the Cloud Function', async () => {
    await expect(sendMessage({ ...validInput, senderId: '' })).rejects.toThrow(
      'You must be signed in to send a message.'
    );
    expect(httpsCallable).not.toHaveBeenCalled();
  });

  it('rejects an empty message locally before calling the Cloud Function', async () => {
    await expect(sendMessage({ ...validInput, content: '   ' })).rejects.toThrow('Message cannot be empty.');
    expect(httpsCallable).not.toHaveBeenCalled();
  });

  it('calls the sendMessage callable with only appointmentId and trimmed content', async () => {
    const mockCallable = jest.fn().mockResolvedValue({ data: { success: true, messageId: 'msg-1' } });
    (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

    await sendMessage({ ...validInput, content: '  Hello doctor  ' });

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'sendMessage');
    expect(mockCallable).toHaveBeenCalledWith({ appointmentId: 'appt-1', content: 'Hello doctor' });
  });

  it('surfaces a ServiceError when the server declines to send the message', async () => {
    const mockCallable = jest.fn().mockResolvedValue({ data: { success: false } });
    (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

    await expect(sendMessage(validInput)).rejects.toThrow(ServiceError);
  });

  it('wraps a Cloud Function failure in a ServiceError', async () => {
    const mockCallable = jest.fn().mockRejectedValue(new Error('permission-denied'));
    (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

    await expect(sendMessage(validInput)).rejects.toThrow('Failed to send message. Please try again.');
  });
});
