# Cloud Functions Incident Response & Rollback Runbook

**Status: documented, not battle-tested.** CareConnect has no live production deployment (see `CareConnectApp/README.md`'s "Known Limitations"), so this runbook has never been exercised against a real incident. It exists so the *procedure* is defined ahead of the first real deployment, rather than being improvised during an actual outage — but every step below should be treated as "believed correct, unverified in production" until it has actually been run once against a live project.

This document covers the `functions/` Cloud Functions codebase specifically. It assumes a deployed Firebase project reachable via `firebase deploy --only functions` (see `functions/package.json`'s `deploy` script) — none of the steps below can be run against this sandboxed development environment.

---

## 1. Severity triage

| Severity | Definition | Example | Response time target |
|---|---|---|---|
| **SEV-1** | A privileged/security-boundary function is failing open, or is completely down and blocking a core user flow | `approveDoctorRequest`/`deleteUserAccount` throwing on every call; `assertCallerIsAdmin` silently returning true | Immediate — page, don't wait for business hours |
| **SEV-2** | A single function is erroring for a subset of users, or degraded (slow/rate-limited) | `analyzeSymptoms` returning `internal` errors for some requests; the `aggregateDailyAnalytics` scheduled function failing silently | Same business day |
| **SEV-3** | Non-blocking defect, cosmetic, or a documented known limitation surfacing as expected | Stripe webhook not configured yet (expected — see Known Limitations) | Normal backlog |

**First action for any SEV-1/SEV-2:** check Cloud Functions logs (`npm run logs` → `firebase functions:log`, or the GCP Console's Cloud Logging, filtered to the affected function name) for the structured `firebase-functions/logger` output already emitted by every function in this codebase (`adminApproval.ts`, `symptomChecker.ts`, `appointments.ts`, `wellness.ts`, `messages.ts`, `customClaims.ts`, `analytics.ts`, `payments.ts` all log at meaningful boundaries — auth rejection, validation failure, successful mutation).

---

## 2. Rollback procedure

Firebase Cloud Functions does not have a built-in one-command "rollback to previous revision" the way some platforms do; the procedure here is git-based:

1. **Identify the last known-good commit.** `git log --oneline -- functions/` to find the commit before the suspected regression.
2. **Check out that commit's `functions/` directory into a clean state** (do this on a fresh branch, not by resetting `main`):
   ```bash
   git checkout <last-good-sha> -- functions/
   cd functions && npm ci && npm run build
   ```
3. **Re-run the full verification suite before redeploying anything** — do not skip this under incident pressure, since a bad rollback is worse than a slow one:
   ```bash
   npx tsc --noEmit
   npm run lint
   npm test
   npm run test:rules:local   # requires firebase-tools + Java locally; see package.json
   ```
4. **Deploy only the affected function(s), not the whole codebase**, to minimize blast radius and deploy time:
   ```bash
   firebase deploy --only functions:approveDoctorRequest,functions:deleteUserAccount
   ```
   (Cloud Functions deploys are per-function; deploying an unrelated function is unnecessary risk during an incident.)
5. **Verify the rollback in production** by tailing logs for the affected function immediately after deploy and confirming the error pattern has stopped, then exercising the affected flow manually (e.g. approve a test doctor account) before declaring the incident resolved.
6. **Restore forward.** Once stable, cherry-pick or re-apply the intended fix on top of the known-good state, going back through the full verification suite before redeploying again.

---

## 3. Function-specific playbooks

### `approveDoctorRequest` / `deleteUserAccount` (adminApproval.ts)

- **Symptom: legitimate admins getting `permission-denied`.** Check whether `syncUserClaims` (customClaims.ts) has run for that admin's account — `assertCallerIsAdmin` falls back to the Firestore-document role lookup if the custom claim isn't set, so this should be rare, but if the Firestore document itself was somehow corrupted (role field missing/wrong), that's the first thing to check via the Firestore console.
- **Symptom: a non-admin successfully mutated another user.** This is a SEV-1 — `assertCallerIsAdmin` is the only gate. Immediately check Cloud Logging for the `logger.warn("Non-admin uid ... attempted an admin-only action.")` line — if it's *absent* for the incident window despite a mutation having occurred, the gate itself was bypassed (check for a bad deploy that changed `adminApproval.ts`) rather than merely a slow response. Roll back immediately per Section 2.
- **Audit trail:** every successful call writes to the `auditLogs` Firestore collection (see `auditLog.ts`) — this is the first place to look to answer "who did what, when" during investigation, since it's a persisted record independent of Cloud Logging's retention window.

### `analyzeSymptoms` (symptomChecker.ts)

- **Symptom: users reporting `resource-exhausted` unexpectedly.** Check the caller's `rate_limits/{uid}_analyzeSymptoms` document (only visible via the Admin SDK/Firebase console, never client-readable) for `tokens`/`lastRefill`. If a bug in `rateLimiter.ts`'s refill math caused buckets to under-refill, this is a SEV-2 — the fix is code, not data (do not manually edit `rate_limits` documents in production as a workaround; fix and redeploy the refill logic).
- **Symptom: Gemini API cost spike.** Since rate limiting is the primary defense (App Check is not enforced — see project.md), check whether a specific uid or set of uids is bypassing the expected 5-requests/hour ceiling (would indicate a bug in `symptomCheckerAuthPolicy`, not a security bypass of Firestore rules, since this function's authorization is entirely in application code, not `firestore.rules`).

### `createAppointment` / `createWellnessEntry` / `sendMessage`

- **Symptom: valid-looking requests rejected with `invalid-argument`.** These are Zod-validated; check the exact Zod error message returned (it's passed through verbatim to the client) against the schema in the corresponding file — a client/server schema drift (e.g. the app changed its input shape without a matching backend update) is the most likely cause, not a data problem.
- **Symptom: a message/appointment/wellness entry appears with wrong `receiverId`/`patientId`/`userId`.** These are server-derived from `request.auth.uid` or the referenced appointment record, never from client input — if one of these fields is wrong, it points to a logic bug in the function itself, and is a SEV-1 (a trust-boundary defect) rather than a data-quality issue.

### `syncUserClaims` (customClaims.ts)

- **Symptom: an approved doctor still can't access doctor-only screens.** This can be a claims-propagation delay (client needs to call `getIdToken(true)`, which `AuthContext.tsx` does automatically on `claimsSyncedAt` change — check whether that Firestore trigger actually fired and updated `claimsSyncedAt`) rather than a `syncUserClaims` failure. Check Cloud Logging for `"Synced custom claims for <uid>"` — if present, the issue is client-side token refresh, not the trigger.
- **Symptom: repeated/looping trigger invocations.** `syncUserClaims` guards against this by comparing before/after `role`/`isApproved` and returning early if unchanged (see `claimsDiffer`) — if this guard has a bug, it would manifest as a runaway write loop on the `users` collection, visible as an unexpected spike in Firestore write volume for a single document. This is a SEV-1 (cost + potential rate-limit exhaustion for that user) — disable the trigger (`firebase functions:delete syncUserClaims` or redeploy without exporting it) as an immediate mitigation, then fix and redeploy.

### `aggregateDailyAnalytics` (analytics.ts)

- **Symptom: `analytics_daily` stops updating.** This is a scheduled (Cloud Scheduler-triggered) function — check the Cloud Scheduler job's execution history in the GCP Console first (a disabled/misconfigured schedule looks identical to a failing function from the app's perspective). This is a SEV-3 at most (degrades a non-critical, already-optional analytics display) — do not treat it with the same urgency as an auth/data-integrity incident.

### `createPaymentIntent` / `stripeWebhook` (payments.ts)

- **Symptom: a payment appears stuck in `pending` status indefinitely.** The `payments` document is only updated to `completed`/`failed` by `stripeWebhook`, which requires Stripe's webhook to actually reach this function (correct URL configured in the Stripe dashboard, `STRIPE_WEBHOOK_SECRET` matching). Since this has never been configured against a live Stripe account in this project's history, a stuck-pending payment in a real deployment should first prompt checking the Stripe dashboard's webhook delivery log, not assuming a bug in this codebase.
- **Symptom: webhook signature verification failing for genuinely-Stripe-originated requests.** Check that the raw request body is being passed to `stripe.webhooks.constructEvent` unmodified — a common cause in Cloud Functions is an upstream body-parsing middleware (e.g. `express.json()`) consuming/re-serializing the body before the webhook handler sees it, which changes the byte-for-byte content the signature was computed over. `stripeWebhook` is a separate `onRequest` function specifically to avoid this shared-Express-app risk (it does not go through `index.ts`'s `app` with its `express.json()` middleware).

---

## 4. Post-incident

- File a summary in the format: **what happened, what was the trust-boundary/data-integrity impact (if any), what was the fix, what test now exists to catch a regression of this specific defect.** The last item is non-negotiable — every incident should leave behind a new test case (unit test for application logic, or a new `assertFails`/`assertSucceeds` case in the rules-unit-testing suite for a rules defect), consistent with this project's testing philosophy.
- Update this runbook if the incident revealed a gap in the playbook itself.
