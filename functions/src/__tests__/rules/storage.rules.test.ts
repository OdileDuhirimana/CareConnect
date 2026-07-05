/**
 * Integration tests for storage.rules against a real (emulated) Cloud
 * Storage instance, using @firebase/rules-unit-testing. See
 * firestore.rules.test.ts for the rationale — storage.rules was a
 * completely untested file before this pass, same as firestore.rules.
 */

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {ref, uploadBytes} from "firebase/storage";
import {readFileSync} from "fs";
import * as path from "path";

const [emulatorHost, emulatorPortRaw] = (process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? "127.0.0.1:9199").split(":");
const emulatorPort = Number(emulatorPortRaw);

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-careconnect",
    storage: {
      rules: readFileSync(path.resolve(__dirname, "../../../../storage.rules"), "utf8"),
      host: emulatorHost,
      port: emulatorPort,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

afterEach(async () => {
  await testEnv?.clearStorage();
});

const SMALL_IMAGE = Buffer.alloc(1024, 1); // 1 KB, well under the 10 MB user-upload limit
const OVERSIZED_FILE = Buffer.alloc(11 * 1024 * 1024, 1); // 11 MB, over the 10 MB user-upload limit

describe("users/{userId}/{allPaths=**}", () => {
  it("lets a user upload a small image to their own folder", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const fileRef = ref(alice.storage(), "users/alice/profile.jpg");
    await assertSucceeds(uploadBytes(fileRef, SMALL_IMAGE, {contentType: "image/jpeg"}));
  });

  it("rejects a user uploading into another user's folder", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const fileRef = ref(alice.storage(), "users/bob/profile.jpg");
    await assertFails(uploadBytes(fileRef, SMALL_IMAGE, {contentType: "image/jpeg"}));
  });

  it("rejects an oversized upload even to the user's own folder", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const fileRef = ref(alice.storage(), "users/alice/too-big.jpg");
    await assertFails(uploadBytes(fileRef, OVERSIZED_FILE, {contentType: "image/jpeg"}));
  });

  it("rejects a disallowed content type", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const fileRef = ref(alice.storage(), "users/alice/script.js");
    await assertFails(uploadBytes(fileRef, SMALL_IMAGE, {contentType: "application/javascript"}));
  });

  it("rejects an unauthenticated upload", async () => {
    const anon = testEnv.unauthenticatedContext();
    const fileRef = ref(anon.storage(), "users/alice/profile.jpg");
    await assertFails(uploadBytes(fileRef, SMALL_IMAGE, {contentType: "image/jpeg"}));
  });
});

describe("medical_files/{patientId}/{allPaths=**}", () => {
  it("lets a patient upload their own medical file within the size limit", async () => {
    const patient = testEnv.authenticatedContext("patient-1");
    const fileRef = ref(patient.storage(), "medical_files/patient-1/scan.pdf");
    await assertSucceeds(uploadBytes(fileRef, SMALL_IMAGE, {contentType: "application/pdf"}));
  });

  it("rejects a different user uploading into a patient's medical_files folder", async () => {
    const stranger = testEnv.authenticatedContext("stranger");
    const fileRef = ref(stranger.storage(), "medical_files/patient-1/scan.pdf");
    await assertFails(uploadBytes(fileRef, SMALL_IMAGE, {contentType: "application/pdf"}));
  });
});

describe("default-deny catch-all", () => {
  it("denies access to a path with no matching rule", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const fileRef = ref(alice.storage(), "unmodeled/path/file.txt");
    await assertFails(uploadBytes(fileRef, SMALL_IMAGE, {contentType: "text/plain"}));
  });
});
