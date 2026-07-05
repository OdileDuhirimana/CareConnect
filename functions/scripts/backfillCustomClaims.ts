/**
 * One-time admin backfill: sets Firebase custom claims for every existing
 * user document, for accounts created before `syncUserClaims`
 * (src/customClaims.ts) started running on every write.
 *
 * Why this is a standalone script rather than a Cloud Function: it's a
 * single manual maintenance operation (run once after deploying
 * `syncUserClaims`), not something that should run on a schedule or be
 * reachable by any client — running it requires direct Admin SDK
 * credentials on the machine invoking it, which is the correct trust
 * boundary for a bulk privilege-mirroring operation like this.
 *
 * Usage (requires a service account key or `gcloud auth application-default
 * login` credentials for the target Firebase project — see
 * https://firebase.google.com/docs/admin/setup):
 *
 *   npx tsx scripts/backfillCustomClaims.ts
 *
 * Honesty note: this script has been written and is ready to run, but has
 * NOT been executed against a live Firebase project in this environment —
 * doing so requires real project credentials that are not available here.
 * It is included so the custom-claims migration is complete and
 * operable, not merely designed.
 */

import {initializeApp, getApps} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";

interface BackfillResult {
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
}

/**
 * Iterates every document in the `users` collection and sets custom claims
 * to match `{ role, isApproved }`, batching reads via Firestore's default
 * query cursor to avoid loading an unbounded number of documents into
 * memory at once for larger user bases.
 * @return {Promise<BackfillResult>} Summary counts for the operation.
 */
async function backfill(): Promise<BackfillResult> {
  if (getApps().length === 0) {
    initializeApp();
  }

  const db = getFirestore();
  const auth = getAuth();
  const pageSize = 200;
  const result: BackfillResult = {processed: 0, updated: 0, skipped: 0, failed: 0};

  let lastDocId: string | undefined;

  for (;;) {
    let query = db.collection("users").orderBy("__name__").limit(pageSize);
    if (lastDocId) {
      query = query.startAfter(lastDocId);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      result.processed += 1;
      const data = doc.data();

      if (typeof data.role !== "string") {
        result.skipped += 1;
        continue;
      }

      try {
        await auth.setCustomUserClaims(doc.id, {
          role: data.role,
          isApproved: Boolean(data.isApproved),
        });
        result.updated += 1;
        // eslint-disable-next-line no-console
        console.log(`Backfilled claims for ${doc.id} (role=${data.role})`);
      } catch (error) {
        result.failed += 1;
        // eslint-disable-next-line no-console
        console.error(`Failed to backfill claims for ${doc.id}:`, error);
      }
    }

    lastDocId = snapshot.docs[snapshot.docs.length - 1].id;
    if (snapshot.docs.length < pageSize) break;
  }

  return result;
}

backfill()
  .then((result) => {
    // eslint-disable-next-line no-console
    console.log("Backfill complete:", result);
    process.exit(result.failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Backfill failed to run:", error);
    process.exit(1);
  });
