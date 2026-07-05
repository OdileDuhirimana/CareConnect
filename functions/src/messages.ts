/**
 * Server-side validated message creation.
 *
 * Why this exists: the client previously wrote directly to `messages` with
 * only client-side non-empty checks and Firestore rules enforcing that
 * `senderId == request.auth.uid` — real, but it didn't verify the sender
 * is actually a participant (patient or doctor) on the referenced
 * appointment, so a signed-in patient could, in principle, send a message
 * tagged with any `appointmentId`/`receiverId` pair. This callable
 * re-derives `receiverId` server-side from the appointment record itself,
 * rather than trusting a client-supplied value.
 *
 * `firestore.rules`'s `messages` collection now denies client creates
 * (`allow create: if false`); reads and the real-time listener
 * (`subscribeToAppointmentMessages`) remain direct client Firestore
 * queries, since a signed-in participant reading their own thread carries
 * no similar integrity risk.
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {z} from "zod";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

const SendMessageSchema = z.object({
  appointmentId: z.string().min(1, "An appointment id is required."),
  content: z.string().trim().min(1, "Message cannot be empty.").max(2000, "Message is too long."),
});

export const sendMessage = onCall<z.infer<typeof SendMessageSchema>>(
  {enforceAppCheck: false /* see project.md "App Check" — no verified native attestation provider wired up yet */},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in to send a message.");
    }

    const parsed = SendMessageSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", parsed.error.issues.map((issue) => issue.message).join(" "));
    }
    const {appointmentId, content} = parsed.data;

    const appointmentSnapshot = await getFirestore().collection("appointments").doc(appointmentId).get();
    if (!appointmentSnapshot.exists) {
      throw new HttpsError("not-found", "The appointment for this conversation could not be found.");
    }
    const appointment = appointmentSnapshot.data() as { patientId: string; doctorId: string };

    const uid = request.auth.uid;
    if (appointment.patientId !== uid && appointment.doctorId !== uid) {
      throw new HttpsError("permission-denied", "You are not a participant in this conversation.");
    }
    const receiverId = appointment.patientId === uid ? appointment.doctorId : appointment.patientId;

    const docRef = await getFirestore().collection("messages").add({
      senderId: uid,
      receiverId,
      appointmentId,
      content,
      type: "text",
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    logger.info(`Message ${docRef.id} sent by ${uid} on appointment ${appointmentId}.`);
    return {success: true, messageId: docRef.id};
  }
);
