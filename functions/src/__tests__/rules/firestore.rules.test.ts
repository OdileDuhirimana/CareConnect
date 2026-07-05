/**
 * Integration tests for firestore.rules against a real (emulated)
 * Firestore instance, using @firebase/rules-unit-testing.
 *
 * Why this exists: every unit test elsewhere in this repository mocks the
 * Firestore SDK entirely, so `firestore.rules` itself — the single most
 * security-critical file in the project — had zero automated verification
 * that it actually enforces what project.md and the README claim it
 * enforces. Both external audits named this as the most consequential
 * remaining testing gap.
 *
 * Requires the Firebase Emulator Suite to be running (see
 * package.json's "test:rules:local" script, or CI's "firestore-rules"
 * job) with `FIRESTORE_EMULATOR_HOST` set — `firebase emulators:exec`
 * sets this automatically for the wrapped command.
 */

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {readFileSync} from "fs";
import {setLogLevel} from "firebase/firestore";
import * as path from "path";

const [emulatorHost, emulatorPortRaw] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8085").split(":");
const emulatorPort = Number(emulatorPortRaw);

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  setLogLevel("error"); // Quiets the SDK's expected PERMISSION_DENIED console noise from assertFails() cases.
  testEnv = await initializeTestEnvironment({
    projectId: "demo-careconnect",
    firestore: {
      rules: readFileSync(path.resolve(__dirname, "../../../../firestore.rules"), "utf8"),
      host: emulatorHost,
      port: emulatorPort,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

afterEach(async () => {
  await testEnv?.clearFirestore();
});

describe("users/{userId}", () => {
  it("lets a signed-in user create their own patient profile with isVerified: false", async () => {
    const alice = testEnv.authenticatedContext("alice");
    await assertSucceeds(
      alice.firestore().collection("users").doc("alice").set({
        role: "patient",
        isVerified: false,
        name: "Alice",
      })
    );
  });

  it("rejects self-registering as admin", async () => {
    const eve = testEnv.authenticatedContext("eve");
    await assertFails(
      eve.firestore().collection("users").doc("eve").set({
        role: "admin",
        isVerified: false,
        name: "Eve",
      })
    );
  });

  it("rejects creating a profile that is already isVerified: true", async () => {
    const mallory = testEnv.authenticatedContext("mallory");
    await assertFails(
      mallory.firestore().collection("users").doc("mallory").set({
        role: "doctor",
        isVerified: true,
        name: "Dr. Mallory",
      })
    );
  });

  it("rejects an unauthenticated read of another user's profile", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("users").doc("bob").set({role: "patient", isVerified: true, name: "Bob"});
    });

    const anonymous = testEnv.unauthenticatedContext();
    await assertFails(anonymous.firestore().collection("users").doc("bob").get());
  });

  it("does not let one patient read another patient's profile", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("users").doc("bob").set({role: "patient", isVerified: true, name: "Bob"});
    });

    const carol = testEnv.authenticatedContext("carol");
    await assertFails(carol.firestore().collection("users").doc("bob").get());
  });

  it("lets an admin (via custom claim) read any user's profile", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("users").doc("bob").set({role: "patient", isVerified: true, name: "Bob"});
    });

    const admin = testEnv.authenticatedContext("admin-1", {role: "admin"});
    await assertSucceeds(admin.firestore().collection("users").doc("bob").get());
  });

  it("does not let a non-admin escalate their own role to admin via update", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("users").doc("dave").set({role: "patient", isVerified: true, name: "Dave"});
    });

    const dave = testEnv.authenticatedContext("dave");
    await assertFails(dave.firestore().collection("users").doc("dave").update({role: "admin"}));
  });
});

describe("appointments/{appointmentId} — writes are server-side only", () => {
  it("rejects a direct client create (must go through the createAppointment callable)", async () => {
    const patient = testEnv.authenticatedContext("patient-1");
    await assertFails(
      patient.firestore().collection("appointments").add({
        patientId: "patient-1",
        doctorId: "doctor-1",
        status: "pending",
      })
    );
  });

  it("lets the patient on an appointment read it", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("appointments").doc("appt-1").set({
        patientId: "patient-1",
        doctorId: "doctor-1",
        status: "pending",
      });
    });

    const patient = testEnv.authenticatedContext("patient-1");
    await assertSucceeds(patient.firestore().collection("appointments").doc("appt-1").get());
  });

  it("does not let an unrelated signed-in user read someone else's appointment", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("appointments").doc("appt-1").set({
        patientId: "patient-1",
        doctorId: "doctor-1",
        status: "pending",
      });
    });

    const stranger = testEnv.authenticatedContext("stranger");
    await assertFails(stranger.firestore().collection("appointments").doc("appt-1").get());
  });
});

describe("wellness_entries/{entryId} — writes are server-side only", () => {
  it("rejects a direct client create, even for the entry's own userId", async () => {
    const patient = testEnv.authenticatedContext("patient-1");
    await assertFails(
      patient.firestore().collection("wellness_entries").add({
        userId: "patient-1",
        mood: 3,
      })
    );
  });

  it("lets the owning user read their own wellness entry", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("wellness_entries").doc("entry-1").set({userId: "patient-1", mood: 3});
    });

    const patient = testEnv.authenticatedContext("patient-1");
    await assertSucceeds(patient.firestore().collection("wellness_entries").doc("entry-1").get());
  });
});

describe("messages/{messageId} — writes are server-side only", () => {
  it("rejects a direct client create (must go through the sendMessage callable)", async () => {
    const sender = testEnv.authenticatedContext("patient-1");
    await assertFails(
      sender.firestore().collection("messages").add({
        senderId: "patient-1",
        receiverId: "doctor-1",
        content: "hello",
      })
    );
  });
});

describe("auditLogs/{logId}", () => {
  it("denies a client write, even from an admin", async () => {
    const admin = testEnv.authenticatedContext("admin-1", {role: "admin"});
    await assertFails(
      admin.firestore().collection("auditLogs").add({actorId: "admin-1", targetUserId: "x", action: "test"})
    );
  });

  it("lets an admin read the audit log", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("auditLogs").doc("log-1").set({
        actorId: "admin-1",
        targetUserId: "patient-1",
        action: "deleteUserAccount",
      });
    });

    const admin = testEnv.authenticatedContext("admin-1", {role: "admin"});
    await assertSucceeds(admin.firestore().collection("auditLogs").doc("log-1").get());
  });

  it("denies a non-admin read of the audit log", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("auditLogs").doc("log-1").set({
        actorId: "admin-1",
        targetUserId: "patient-1",
        action: "deleteUserAccount",
      });
    });

    const patient = testEnv.authenticatedContext("patient-1");
    await assertFails(patient.firestore().collection("auditLogs").doc("log-1").get());
  });
});

describe("rate_limits/{bucketId}", () => {
  it("denies all client access, including to the caller's own bucket", async () => {
    const patient = testEnv.authenticatedContext("patient-1");
    await assertFails(patient.firestore().collection("rate_limits").doc("patient-1_analyzeSymptoms").get());
  });
});

describe("analytics_daily/{dateKey}", () => {
  it("lets any signed-in user read a rollup", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("analytics_daily").doc("2026-01-01").set({totalUsers: 10});
    });

    const patient = testEnv.authenticatedContext("patient-1");
    await assertSucceeds(patient.firestore().collection("analytics_daily").doc("2026-01-01").get());
  });

  it("denies a client write", async () => {
    const patient = testEnv.authenticatedContext("patient-1");
    await assertFails(patient.firestore().collection("analytics_daily").doc("2026-01-01").set({totalUsers: 999}));
  });
});

describe("default-deny catch-all", () => {
  // Two separate `it` blocks (rather than two assertions against the same
  // authenticatedContext instance in one test) deliberately avoid a known
  // SDK quirk where issuing a `get()` immediately followed by a `set()` on
  // the same client instance can throw "Firestore has already been
  // started and its settings can no longer be changed" — an SDK-internal
  // state issue unrelated to the rules being tested.
  it("denies reading a collection with no matching rule", async () => {
    const patient = testEnv.authenticatedContext("patient-1");
    await assertFails(patient.firestore().collection("some_unmodeled_collection").doc("x").get());
  });

  it("denies writing to a collection with no matching rule", async () => {
    const patient = testEnv.authenticatedContext("patient-1");
    await assertFails(patient.firestore().collection("some_unmodeled_collection").doc("x").set({a: 1}));
  });
});
