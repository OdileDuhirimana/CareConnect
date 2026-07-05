/**
 * Server-side validated appointment creation.
 *
 * Why this exists: both audits flagged (SEC-01 / SEC-03) that most writes
 * — appointments included — went straight from the client SDK to
 * Firestore, validated only by client-side TypeScript and by Firestore
 * Rules' *ownership* checks (not field-shape/bounds checks). A modified
 * client could previously write a malformed `date`/`time`/`duration`, or
 * book an appointment against a doctorId that doesn't exist, isn't
 * actually a doctor, or isn't yet admin-approved.
 *
 * This callable is now the only way appointments are created — see
 * firestore.rules, where `appointments` `allow create` is now `if false`,
 * forcing every creation through this validated path. Reads remain
 * direct client Firestore queries (see appointmentService.ts), since reads
 * are already correctly scoped by ownership rules and gain nothing
 * security-wise from being proxied through a function.
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {z} from "zod";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

const CreateAppointmentSchema = z.object({
  doctorId: z.string().min(1, "A doctor must be selected."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format."),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time must be in HH:MM 24-hour format."),
  duration: z.number().int()
    .min(10, "Minimum appointment length is 10 minutes.")
    .max(240, "Maximum appointment length is 240 minutes."),
  type: z.enum(["in-person", "video", "phone"]),
  reason: z.string().trim().min(3, "Please describe the reason for your visit.").max(500),
  notes: z.string().trim().max(1000).optional(),
});

export const createAppointment = onCall<z.infer<typeof CreateAppointmentSchema>>(
  {enforceAppCheck: false /* see project.md "App Check" — no verified native attestation provider wired up yet */},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in to book an appointment.");
    }

    const parsed = CreateAppointmentSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", parsed.error.issues.map((issue) => issue.message).join(" "));
    }
    const input = parsed.data;

    // Re-verify the doctor server-side: exists, has role 'doctor', and is
    // admin-approved. A client that tampered with the doctorId sent to
    // this call (or replayed a stale one) cannot book against a
    // nonexistent or not-yet-approved doctor this way.
    const doctorSnapshot = await getFirestore().collection("users").doc(input.doctorId).get();
    const doctorData = doctorSnapshot.exists ? doctorSnapshot.data() : undefined;
    if (!doctorSnapshot.exists || doctorData?.role !== "doctor" || doctorData?.isApproved !== true) {
      throw new HttpsError("failed-precondition", "The selected doctor is not currently available for booking.");
    }

    // Reject dates in the past (server clock, not trusting client date math).
    const appointmentDate = new Date(`${input.date}T00:00:00`);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (appointmentDate < startOfToday) {
      throw new HttpsError("invalid-argument", "Appointment date cannot be in the past.");
    }

    const docRef = await getFirestore().collection("appointments").add({
      patientId: request.auth.uid,
      doctorId: input.doctorId,
      date: appointmentDate,
      time: input.time,
      duration: input.duration,
      type: input.type,
      status: "pending",
      reason: input.reason,
      notes: input.notes ?? "",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info(`Appointment ${docRef.id} created by patient ${request.auth.uid} with doctor ${input.doctorId}.`);
    return {success: true, appointmentId: docRef.id};
  }
);
