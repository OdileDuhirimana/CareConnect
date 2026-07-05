/**
 * Server-side validated wellness-entry creation.
 *
 * Why this exists: `wellnessService.ts`'s `mood`/`energy`/`stress` fields
 * were typed `number` but never range-checked anywhere — Firestore rules
 * enforce *ownership* (`request.resource.data.userId == request.auth.uid`)
 * but not *shape*, so a modified client could previously write
 * `mood: -50` or `sleepHours: 9999` directly to Firestore. This was named
 * explicitly in the code review (SEC-03) as a real, if low-severity, gap.
 *
 * `firestore.rules`'s `wellness_entries` collection now denies client
 * writes outright (`allow create, update: if false`), forcing all writes
 * through this validated callable. Reads remain direct client queries
 * (each user reads only their own entries, already correctly scoped by
 * the existing ownership rule).
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {z} from "zod";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

const CreateWellnessEntrySchema = z.object({
  mood: z.number().int().min(1, "Mood must be between 1 and 5.").max(5, "Mood must be between 1 and 5."),
  energy: z.number().int().min(1, "Energy must be between 1 and 5.").max(5, "Energy must be between 1 and 5."),
  stress: z.number().int().min(1, "Stress must be between 1 and 5.").max(5, "Stress must be between 1 and 5."),
  sleepHours: z.number().min(0, "Sleep hours cannot be negative.").max(24, "Sleep hours cannot exceed 24."),
  exerciseMinutes: z
    .number()
    .int()
    .min(0, "Exercise minutes cannot be negative.")
    .max(1440, "Exercise minutes cannot exceed 1440 (24 hours)."),
  notes: z.string().trim().max(1000).optional(),
  symptoms: z.array(z.string().trim().max(100)).max(20).optional(),
});

export const createWellnessEntry = onCall<z.infer<typeof CreateWellnessEntrySchema>>(
  {enforceAppCheck: false /* see project.md "App Check" — no verified native attestation provider wired up yet */},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in to save a wellness entry.");
    }

    const parsed = CreateWellnessEntrySchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", parsed.error.issues.map((issue) => issue.message).join(" "));
    }
    const input = parsed.data;

    const docRef = await getFirestore().collection("wellness_entries").add({
      userId: request.auth.uid,
      date: FieldValue.serverTimestamp(),
      mood: input.mood,
      energy: input.energy,
      stress: input.stress,
      sleepHours: input.sleepHours,
      exerciseMinutes: input.exerciseMinutes,
      notes: input.notes ?? "",
      symptoms: input.symptoms ?? [],
    });

    logger.info(`Wellness entry ${docRef.id} recorded for user ${request.auth.uid}.`);
    return {success: true, entryId: docRef.id};
  }
);
