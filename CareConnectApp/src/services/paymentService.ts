import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import { ServiceError } from './firestoreHelpers';

/**
 * Client for the `createPaymentIntent` Cloud Function
 * (functions/src/payments.ts). Replaces the previous PaymentScreen
 * implementation, which ran a bare `setTimeout` and showed a fabricated
 * "Payment Successful" alert without ever calling the Stripe API despite
 * `@stripe/stripe-react-native` being a listed dependency.
 *
 * The server computes the charge amount itself (from the doctor's own
 * `consultationFee` plus a fixed platform fee) rather than accepting an
 * amount from the client, so this function's request shape intentionally
 * carries no `amount` field — the amount returned in the response is
 * informational for display, not something the caller can influence.
 */

export interface CreatePaymentIntentInput {
  appointmentId: string;
}

export interface CreatePaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
}

export async function createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
  if (!input.appointmentId) {
    throw new ServiceError('An appointment is required to make a payment.');
  }
  try {
    const callable = httpsCallable<CreatePaymentIntentInput, CreatePaymentIntentResult>(
      functions,
      'createPaymentIntent'
    );
    const result = await callable(input);
    return result.data;
  } catch (error) {
    throw new ServiceError('Failed to start payment. Please check your connection and try again.', error);
  }
}
