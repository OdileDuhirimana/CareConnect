/**
 * Real server-side Stripe PaymentIntent creation, replacing the fabricated
 * "Payment Successful" alert that previously ran a bare `setTimeout` with
 * no Stripe API call at all despite `@stripe/stripe-react-native` being a
 * listed dependency.
 *
 * Why the amount is computed here, not accepted from the client: a
 * PaymentScreen that sent `{ amount: 55 }` straight from client state
 * would let a modified client pay any amount it chooses for someone
 * else's consultation fee. This function re-derives the amount from the
 * doctor's own `consultationFee` field (already trusted, since only an
 * approved doctor's own profile write path sets it) plus a fixed platform
 * fee, and verifies the caller actually owns the appointment being paid
 * for.
 *
 * `createPaymentIntent` returns a `client_secret` for the Stripe React
 * Native SDK's PaymentSheet to confirm client-side — card details
 * themselves are never seen by this backend or by CareConnect's own code
 * at any point, which is both a security property and a PCI-DSS scope
 * reduction (this is exactly why the previous screen's hand-rolled
 * card-number/CVV `TextInput`s were a design smell independent of the
 * "fake" payment issue: even a *real* implementation should never collect
 * raw card data itself).
 *
 * `stripeWebhook` is the production-correct way to learn a payment's final
 * status (client-reported success is not trustworthy on its own — a
 * dropped network response after a real charge, or a manually forged
 * client call, could otherwise mark a `payments` document `completed`
 * without Stripe actually confirming the charge). Signature verification
 * (`stripe.webhooks.constructEvent`) ensures the request genuinely
 * originated from Stripe.
 *
 * Honesty note (see project.md "Known Limitations"): this code is written
 * and unit-tested against a mocked Stripe SDK, but has never been run
 * against a real Stripe account or received a live webhook in this
 * environment — there is no `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`
 * configured here, so "payments actually work end-to-end" is unverified,
 * not claimed.
 */

import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import Stripe from "stripe";

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

/** Flat platform fee in cents, matching the UI copy already shown on PaymentScreen ("$5.00 Platform Fee"). */
const PLATFORM_FEE_CENTS = 500;
const DEFAULT_CONSULTATION_FEE = 50;

interface CreatePaymentIntentRequest {
  appointmentId: string;
}

export const createPaymentIntent = onCall<CreatePaymentIntentRequest>(
  {secrets: [stripeSecretKey], enforceAppCheck: false},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in to make a payment.");
    }

    const appointmentId = request.data?.appointmentId;
    if (!appointmentId || typeof appointmentId !== "string") {
      throw new HttpsError("invalid-argument", "A valid appointmentId is required.");
    }

    const appointmentSnapshot = await getFirestore().collection("appointments").doc(appointmentId).get();
    if (!appointmentSnapshot.exists) {
      throw new HttpsError("not-found", "Appointment not found.");
    }
    const appointment = appointmentSnapshot.data() as { patientId: string; doctorId: string };
    if (appointment.patientId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "You may only pay for your own appointments.");
    }

    const doctorSnapshot = await getFirestore().collection("users").doc(appointment.doctorId).get();
    const consultationFee =
      typeof doctorSnapshot.data()?.consultationFee === "number" ?
        (doctorSnapshot.data()!.consultationFee as number) :
        DEFAULT_CONSULTATION_FEE;
    const amountCents = Math.round(consultationFee * 100) + PLATFORM_FEE_CENTS;

    const stripe = new Stripe(stripeSecretKey.value());
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      metadata: {
        appointmentId,
        patientId: request.auth.uid,
        doctorId: appointment.doctorId,
      },
    });

    await getFirestore().collection("payments").add({
      userId: request.auth.uid,
      appointmentId,
      amount: amountCents / 100,
      currency: "usd",
      status: "pending",
      paymentMethod: "card",
      stripePaymentIntentId: paymentIntent.id,
      createdAt: FieldValue.serverTimestamp(),
    });

    logger.info(`PaymentIntent ${paymentIntent.id} created for appointment ${appointmentId}.`);
    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amountCents / 100,
    };
  }
);

/**
 * Stripe webhook receiver. Verifies the request signature before trusting
 * any payload, then reconciles the matching `payments` document's status —
 * this is the source of truth for "did this payment actually succeed,"
 * not any client-reported confirmation.
 */
export const stripeWebhook = onRequest(
  {secrets: [stripeSecretKey, stripeWebhookSecret]},
  async (req, res) => {
    const stripe = new Stripe(stripeSecretKey.value());
    const signature = req.headers["stripe-signature"];

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, signature as string, stripeWebhookSecret.value());
    } catch (error) {
      logger.warn("Rejected Stripe webhook with invalid signature.", error);
      res.status(400).send("Invalid signature");
      return;
    }

    if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const status = event.type === "payment_intent.succeeded" ? "completed" : "failed";

      const matching = await getFirestore()
        .collection("payments")
        .where("stripePaymentIntentId", "==", paymentIntent.id)
        .limit(1)
        .get();

      if (!matching.empty) {
        await matching.docs[0].ref.update({status, updatedAt: FieldValue.serverTimestamp()});
        logger.info(`Payment ${matching.docs[0].id} marked ${status} via webhook.`);
      } else {
        logger.warn(`No matching payment document found for PaymentIntent ${paymentIntent.id}.`);
      }
    }

    res.status(200).send("ok");
  }
);
