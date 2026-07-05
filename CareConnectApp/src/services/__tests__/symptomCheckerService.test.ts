/**
 * Tests for the AI Symptom Checker client. This is the client-side half of
 * the security-relevant `analyzeSymptoms` Cloud Function pairing — the
 * server-side Zod validation and rate-limit/auth gate are covered by
 * functions/src/__tests__/symptomChecker.test.ts. Previously 0% covered on
 * the client side despite calling a billable, rate-limited endpoint.
 */

import { httpsCallable } from 'firebase/functions';
import { analyzeSymptoms } from '../symptomCheckerService';
import { ServiceError } from '../firestoreHelpers';

jest.mock('../../config/firebase', () => ({ functions: {} }));

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(),
}));

// symptomCheckerService.ts doesn't call the Firestore SDK directly, but it
// imports `ServiceError` from `./firestoreHelpers`, which itself imports
// types/values from 'firebase/firestore' — this must be mocked here too,
// or Jest attempts to load the real ESM package and fails to parse it.
jest.mock('firebase/firestore', () => ({
  Timestamp: class FakeTimestamp {},
}));

describe('analyzeSymptoms', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects blank symptoms locally, without calling the Cloud Function', async () => {
    await expect(analyzeSymptoms({ symptoms: '   ' })).rejects.toThrow('Please describe your symptoms.');
    expect(httpsCallable).not.toHaveBeenCalled();
  });

  it('calls the analyzeSymptoms callable and returns its result', async () => {
    const mockResult = {
      possibleConditions: [{ name: 'Tension headache', likelihood: 'moderate', description: 'Common' }],
      recommendations: ['Rest and hydrate'],
      suggestedSpecialists: ['General Practitioner'],
      urgency: 'low',
      disclaimer: 'Not a diagnosis.',
    };
    const mockCallable = jest.fn().mockResolvedValue({ data: mockResult });
    (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

    const result = await analyzeSymptoms({ symptoms: 'Headache for 2 days' });

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'analyzeSymptoms');
    expect(mockCallable).toHaveBeenCalledWith({ symptoms: 'Headache for 2 days' });
    expect(result).toEqual(mockResult);
  });

  it('wraps a Cloud Function failure (e.g. rate-limited or unauthenticated) in a ServiceError', async () => {
    const mockCallable = jest.fn().mockRejectedValue(new Error('resource-exhausted'));
    (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

    await expect(analyzeSymptoms({ symptoms: 'Headache' })).rejects.toThrow(ServiceError);
  });
});
