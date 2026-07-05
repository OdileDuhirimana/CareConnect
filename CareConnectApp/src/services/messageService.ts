import { collection, onSnapshot, orderBy, query, Unsubscribe, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { Message } from '../types';
import { convertTimestamps, ServiceError } from './firestoreHelpers';

/** Data-access layer for the `messages` collection (per-appointment chat threads). */

const COLLECTION = 'messages';

/**
 * Subscribes to real-time messages for an appointment thread. Returns the
 * Firestore unsubscribe function so the caller can clean up in a
 * `useEffect` return, matching the pattern the original ChatScreen already
 * used — this wraps it in the service layer instead of importing
 * `onSnapshot` directly in the component.
 */
export function subscribeToAppointmentMessages(
  appointmentId: string,
  onUpdate: (messages: Message[]) => void,
  onError: (error: ServiceError) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION),
    where('appointmentId', '==', appointmentId),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const messages = snapshot.docs.map((d) => ({
        id: d.id,
        ...convertTimestamps(d.data()),
      })) as Message[];
      onUpdate(messages);
    },
    (error) => onError(new ServiceError('Failed to load messages.', error))
  );
}

export interface SendMessageInput {
  senderId: string;
  receiverId: string;
  appointmentId: string;
  content: string;
}

interface SendMessageResponse {
  success: boolean;
  messageId: string;
}

/**
 * Sends a text message within an appointment's chat thread.
 *
 * Implemented as a callable Cloud Function (`functions/src/messages.ts`)
 * rather than a direct `addDoc`. The function re-derives `receiverId`
 * server-side from the appointment record itself instead of trusting the
 * client-supplied value, and verifies the caller is actually a participant
 * (patient or doctor) on the appointment before allowing the write. See
 * firestore.rules, where `messages` `allow create` is `false`.
 */
export async function sendMessage(input: SendMessageInput): Promise<void> {
  if (!input.senderId) {
    throw new ServiceError('You must be signed in to send a message.');
  }
  if (!input.content.trim()) {
    throw new ServiceError('Message cannot be empty.');
  }
  try {
    const callable = httpsCallable<{ appointmentId: string; content: string }, SendMessageResponse>(
      functions,
      'sendMessage'
    );
    const result = await callable({
      appointmentId: input.appointmentId,
      content: input.content.trim(),
    });
    if (!result.data.success) {
      throw new ServiceError('The server declined to send this message.');
    }
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError('Failed to send message. Please try again.', error);
  }
}
