// Manual mock for src/config/firebase.ts. Service-layer tests import the
// Firestore/Functions SDK functions directly and mock those (see
// jest.mock('firebase/firestore') in each test file); this file exists so
// that any module importing `db`/`auth`/`functions` from config/firebase
// doesn't attempt to call the real `initializeApp`, which would throw due
// to the required-env-var check in the real module.
export const auth = {};
export const db = {};
export const storage = {};
export const messaging = {};
export const functions = {};
export const isFirebaseConfigured = () => true;
export default {};
