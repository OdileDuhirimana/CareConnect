// Separate Jest config for Firestore/Storage security-rules integration
// tests (src/__tests__/rules/**). These tests require a running Firebase
// Emulator Suite (see package.json's "test:rules" script and
// .github/workflows/ci.yml's "firestore-rules" job) and are intentionally
// excluded from the default `npm test` run (see the main "jest" config in
// package.json, which ignores this directory) so the fast, emulator-free
// unit-test suite for application code never accidentally depends on the
// emulator being available.
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/__tests__/rules/**/*.test.ts"],
  // Rules-unit-testing spins up real emulator connections per test file;
  // give it more headroom than the default 5s unit-test timeout.
  testTimeout: 30000,
  globals: {
    "ts-jest": {
      isolatedModules: true,
    },
  },
};
