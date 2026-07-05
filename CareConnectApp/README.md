# CareConnect — Healthcare Appointment & Wellness App

A cross-platform (iOS/Android/Web) healthcare companion app built with React Native (Expo), Firebase, and Cloud Functions. Patients can find doctors, book appointments, track wellness, and get AI-generated (non-diagnostic) symptom guidance; doctors manage their schedule and patients; admins approve doctor accounts and manage users.

This document describes only what is actually implemented in this repository. See "Known Limitations" below for what is intentionally out of scope.

## Problem Validation

**The problem.** Booking a doctor's appointment in most small-to-mid-size clinics still happens over the phone during business hours, with no visibility into whether a slot is actually free until the call connects. Patients have no single place to see their appointment history, message their doctor between visits, or track how their day-to-day wellness (sleep, mood, stress) correlates with health outcomes discussed at their next visit.

**Who this is for.**
- **Primary: patients** who want to browse doctors by specialty, book a slot without a phone call, and keep a running log of appointments and informal wellness check-ins in one app.
- **Secondary: doctors**, who need a simple queue of pending/confirmed appointments and a patient list, without adopting a full practice-management suite.
- **Tertiary: admins**, who need to approve new doctor accounts before they can accept bookings (self-registration alone is not a sufficient trust signal for a healthcare app).

**Why existing solutions don't fully fit.** Consumer telehealth platforms (Zocdoc, Practo, Teladoc) are built for large multi-provider networks with heavy onboarding and business-side sales cycles; they are not something a small clinic or an independent developer can stand up in a weekend. CareConnect explores the same core booking/communication loop at a much smaller scale, using a serverless (Firebase) backend instead of a provisioned server fleet — a deliberate architectural tradeoff documented below.

**Success signal for this project as a portfolio piece.** The measure of success here is not user growth (it has none — it is unreleased) but engineering quality: can a reviewer read the code, the security rules, and the tests and conclude the author understands authentication vs. authorization, client/server trust boundaries, and how to structure a mobile app's data layer. The "Known Limitations" section is written for that audience.

## What's Actually Implemented

### Authentication & Roles
- Firebase Authentication (email/password) for sign-up, login, logout, and password reset.
- Three roles — `patient`, `doctor`, `admin` — stored on each user's Firestore document.
- Doctor accounts require admin approval (`isApproved`) before they appear in the patient-facing directory. Approval is enforced server-side by a Cloud Function (`approveDoctorRequest`), not merely hidden in the UI.

### Appointments
- Patients browse approved doctors, pick a date/time from that doctor's open slots, and submit a booking request (`pending` status).
- Doctors confirm or cancel pending requests from their schedule screen.
- Patients can cancel their own pending appointments.
- Paginated appointment lists (cursor-based, 20 per page) for patients and admins.

### Wellness Tracking
- Patients log daily mood, energy, stress, sleep hours, exercise minutes, and free-text symptoms.
- A simple health score is computed client-side from recent entries.

### Medical Records
- Patients can view medical records (prescriptions, lab results, scans, vaccinations) attached to their account by a doctor.

### Messaging
- Real-time, per-appointment text chat between a patient and their doctor, backed by a Firestore listener.

### AI Symptom Guidance
- A "Symptom Checker" screen sends the user's described symptoms to a callable Cloud Function (`analyzeSymptoms`), which calls Google's Gemini model server-side (via Genkit) and returns a structured, clearly non-diagnostic response (possible conditions with a likelihood band, general recommendations, suggested specialist types, and an embedded disclaimer).
- The Gemini API key lives only in Cloud Functions secrets — it is never bundled into the mobile app.
- This endpoint requires authentication; unauthenticated calls are rejected before any model call is made.

### Admin Tools
- User list (paginated) with search/filter by role and verification status — filtering is now a server-side Firestore query (role/status equality + a name-prefix range query), not an in-memory filter over one already-fetched page, so search reflects the whole collection rather than silently missing users on unfetched pages.
- Approve/suspend a user's verification status.
- Delete a user account — this performs a real deletion (Firebase Auth record + Firestore profile) via a Cloud Function, gated on the caller's own Firestore document/custom claim having `role: admin`, and now writes a durable `auditLogs` entry.

### Data Access Layer
- All Firestore reads/writes go through a typed service layer (`src/services/*`) rather than being called directly from screen components. Screens depend on functions like `fetchAppointmentsForPatient(...)` or `createAppointment(...)`, not on the Firebase SDK directly.
- **Server-side validated writes.** `createAppointment`, `createWellnessEntry`, and `sendMessage` are Cloud Functions (Zod-validated, re-verifying referenced ids server-side) rather than direct client Firestore writes — Firestore rules now deny client `create` on these three collections outright, so this is enforced, not merely conventional.

### Security Hardening (this remediation pass)
- **Firebase custom claims for RBAC.** A Firestore trigger (`syncUserClaims`) mirrors each user's `role`/`isApproved` into their Firebase Auth ID token, and `firestore.rules` checks the tamper-proof claim first. *Written and unit-tested, but never exercised against a live Firebase project in this environment — see Known Limitations.*
- **Per-user rate limiting.** A Firestore-backed token bucket throttles `analyzeSymptoms` (the one billable third-party API call) to 5 requests/hour per user.
- **Durable audit logging.** Every `approveDoctorRequest`/`deleteUserAccount` call now writes a permanent, admin-read-only `auditLogs` entry.
- **Firestore/Storage Security Rules integration tests.** A real Firebase Emulator Suite test suite (`@firebase/rules-unit-testing`) now exercises `firestore.rules`/`storage.rules` directly — 29 tests, actually run against local emulators, not mocked. See "Testing" below.
- **App Check — implemented, intentionally not enforced.** Every privileged/billable callable explicitly documents `enforceAppCheck: false` with the reason (no native attestation provider available without ejecting from Expo's managed workflow) rather than silently omitting App Check consideration entirely.

## Known Limitations

Being explicit about what is *not* built is part of the engineering signal this project is meant to demonstrate:

- **Role self-selection at signup.** A user still chooses `patient` or `doctor` at registration. The mitigating control is that doctor accounts are inert (excluded from the patient-facing directory and blocked by Firestore rules from certain actions) until an admin approves them via the server-side gate, and the resulting role is now mirrored into a tamper-proof custom claim once approved (see above) — but self-selection as the *initial* signal is unchanged.
- **Custom claims and the claims-backfill script are unverified against a live project.** `functions/src/customClaims.ts` and `functions/scripts/backfillCustomClaims.ts` are written and unit-tested against a mocked Admin SDK, but this environment has no live Firebase project/credentials to deploy to or run the backfill script against. Treat "custom claims are set on real user accounts" as unverified, not working-in-production.
- **Payments are real but unverified end-to-end.** `functions/src/payments.ts`'s `createPaymentIntent` computes the charge amount server-side (never trusting a client-supplied amount) and creates a real Stripe PaymentIntent via the Stripe Node SDK; the client uses `@stripe/stripe-react-native`'s PaymentSheet rather than collecting raw card data itself. This has never been run against a real Stripe account (no `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` configured here) — the code is complete and unit-tested against a mocked Stripe SDK, but "a real charge succeeds end-to-end" is unverified.
- **No video calling implementation — removed rather than shipped as a non-functional shell.** The previous video-call screen was a `setTimeout`-simulated UI shell with no WebRTC signaling. Rather than leave a "sketch-only" screen in the app, it has been removed entirely; the "join call" entry points now route to the one real-time feature that does work (in-app chat).
- **Analytics aggregation is real but the two analytics screens haven't been rewired to it yet.** `functions/src/analytics.ts`'s `aggregateDailyAnalytics` scheduled function computes and persists genuine daily rollups (user/appointment counts by status, top doctors by volume) to `analytics_daily`, and a client `analyticsService.ts` exists to read it — but `AdminAnalyticsScreen`/`DoctorAnalyticsScreen` still display their original illustrative static numbers pending a follow-up UI wiring pass.
- **AI guidance is exactly that — guidance.** `analyzeSymptoms` calls a general-purpose LLM. It is not a regulatory-approved clinical decision-support tool, and the response schema embeds a disclaimer to that effect rather than relying on client-side UI text alone.
- **No production deployment.** This has not been deployed to a live Firebase project, TestFlight, or the Play Store; it is a local-development portfolio project.
- **No screenshots or screen recording.** This environment has no iOS/Android simulator, physical device, or display server available to run Expo and capture the running app — screenshots could not be produced here. This is disclosed rather than worked around with placeholder/stock imagery.
- **App Check is not enforced** (see "Security Hardening" above) — implemented and documented, not silently absent, but not a working abuse-prevention layer on native clients today.
- **No end-to-end or screen-level tests.** Service-layer, Cloud Functions, and now security-rules logic are tested; the 24 screen components and full user journeys (sign-up → approval → booking → chat) are not.

## Tech Stack

- **Mobile app:** React Native + Expo (SDK 50), TypeScript, React Navigation (fully typed navigation props — no `any` route/navigation params)
- **Backend:** Firebase Authentication (+ custom claims), Firestore, Cloud Storage, Cloud Functions (Node.js/TypeScript)
- **AI:** Google Gemini via Genkit, called from a rate-limited Cloud Function
- **Payments:** Stripe (server-side PaymentIntent creation + client PaymentSheet), unverified against a live Stripe account
- **Testing:** Jest, @testing-library/react-native (app); Jest + ts-jest (Cloud Functions); `@firebase/rules-unit-testing` against the real Firebase Emulator Suite (security rules)
- **CI:** GitHub Actions — typecheck + lint + test for the app, typecheck + lint + test for Cloud Functions, and a dedicated Emulator Suite job for security-rules tests, on every push/PR

## Project Structure

```
CareConnect/
├── CareConnectApp/           # Expo app
│   ├── src/
│   │   ├── components/         # Shared UI library (Card, PrimaryButton, ErrorBanner, EmptyState, LoadingIndicator)
│   │   ├── config/            # Firebase initialization
│   │   ├── context/            # AuthContext (React context for auth state + custom-claims sync)
│   │   ├── navigation/          # Role-based navigation stacks + typed ParamList definitions
│   │   ├── screens/            # UI screens, grouped by patient/doctor/admin/shared
│   │   ├── services/            # Typed data-access layer (Firestore/Functions calls)
│   │   └── types/              # Shared TypeScript domain types
│   └── package.json
├── functions/                 # Firebase Cloud Functions (TypeScript)
│   ├── RUNBOOK.md              # Incident-response / rollback runbook for the Cloud Functions layer
│   ├── scripts/
│   │   └── backfillCustomClaims.ts  # One-time admin script to backfill custom claims for existing users
│   └── src/
│       ├── index.ts            # Function exports + health/docs HTTP endpoints
│       ├── adminApproval.ts     # Server-side admin-approval and account-deletion gates (+ audit log)
│       ├── appointments.ts      # Server-validated appointment creation
│       ├── wellness.ts          # Server-validated wellness-entry creation
│       ├── messages.ts          # Server-validated message creation
│       ├── customClaims.ts      # Firestore trigger syncing role/isApproved into Auth custom claims
│       ├── analytics.ts         # Scheduled daily analytics aggregation
│       ├── payments.ts          # Stripe PaymentIntent creation + webhook handler
│       ├── rateLimiter.ts       # Shared Firestore-backed token-bucket rate limiter
│       ├── auditLog.ts          # Shared audit-log write helper
│       ├── symptomChecker.ts    # Gemini-backed, rate-limited symptom analysis callable
│       └── __tests__/
│           └── rules/           # Firestore/Storage security-rules integration tests (Emulator Suite)
├── firestore.rules            # Ownership/role/custom-claim-scoped security rules
├── storage.rules              # Cloud Storage security rules
├── firestore.indexes.json     # Composite indexes for the app's compound queries
├── firebase.json              # Emulator Suite + rules/functions configuration
└── .github/workflows/ci.yml   # CI: typecheck + lint + test for app and functions, + Emulator Suite rules tests
```

## Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI (`npx expo`)
- A Firebase project with Authentication, Firestore, Storage, and Cloud Functions enabled
- iOS Simulator, Android Emulator, or the Expo Go app

### Setup

1. **Install dependencies**
   ```bash
   cd CareConnectApp && npm install
   cd ../functions && npm install
   ```

2. **Configure Firebase.** Copy `CareConnectApp/env.example` to `CareConnectApp/.env` and fill in your Firebase project's web config values. See `FIREBASE_SETUP.md` for full console setup steps, including applying `firestore.rules` and `storage.rules`.

3. **Set secrets as Cloud Functions secrets** (never as client-side env vars):
   ```bash
   cd functions
   firebase functions:secrets:set GOOGLE_GENAI_API_KEY
   firebase functions:secrets:set STRIPE_SECRET_KEY
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   ```

4. **Run the app**
   ```bash
   cd CareConnectApp && npm start
   ```

5. **Run Cloud Functions locally** (optional, requires the Firebase Emulator Suite):
   ```bash
   cd functions && npm run serve
   ```

### Testing

```bash
# App: service-layer and context unit tests (with coverage + a threshold gate)
cd CareConnectApp && npm test -- --coverage

# Cloud Functions: unit tests for every function (mocked Admin SDK)
cd functions && npm test

# Cloud Functions: Firestore/Storage security-rules integration tests
# against the REAL Firebase Emulator Suite (requires firebase-tools + a JDK)
cd functions && npm run test:rules:local
```

### Type Checking & Linting

```bash
cd CareConnectApp && npm run typecheck && npm run lint
cd functions && npx tsc --noEmit && npm run lint
```

## Security Notes

- `firestore.rules` scopes every collection to the authenticated owner (or an admin, where applicable) instead of allowing any authenticated/unauthenticated client to read or write arbitrary documents; `isAdmin()` checks a tamper-proof custom claim first, falling back to the Firestore-document role for accounts whose claim hasn't synced yet.
- Privileged actions (deleting a user, approving a doctor) run through Cloud Functions using the Admin SDK, which independently re-verifies the caller's authority — a client's self-reported role is never trusted — and now write a durable `auditLogs` entry.
- `createAppointment`/`createWellnessEntry`/`sendMessage` are server-side Zod-validated Cloud Functions, not direct client writes; Firestore rules deny client `create` on these collections.
- `analyzeSymptoms` is rate-limited per user (5 requests/hour) via a Firestore-backed token bucket, in addition to requiring authentication.
- The Gemini API key, Stripe secret key, and Stripe webhook secret are all stored via Firebase Functions secrets, not `EXPO_PUBLIC_*` environment variables, so they are never bundled into the client app.
- `firestore.rules`/`storage.rules` are exercised by real Firebase Emulator Suite integration tests (`@firebase/rules-unit-testing`), not just inferred from reading the rules file.

## Roadmap

- A native App Check attestation provider (requires ejecting from the Firebase Web SDK to `@react-native-firebase/app-check`) so `enforceAppCheck: true` can be safely turned on
- A genuine end-to-end test suite (Detox/Maestro) covering sign-up → approval → booking → chat
- Screen-level component tests (React Native Testing Library) — currently 0% covered
- A real CD pipeline with separate dev/staging/prod Firebase projects
- Wiring `AdminAnalyticsScreen`/`DoctorAnalyticsScreen` to the already-implemented `analytics_daily` rollups instead of their current static illustrative numbers
- Verifying the Stripe payment flow and custom-claims sync against a real Firebase/Stripe project (both are implemented and unit-tested, but unverified end-to-end in this environment)
- Firebase Performance Monitoring + Sentry/Crashlytics client-side error tracking
