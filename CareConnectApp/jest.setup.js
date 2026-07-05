// Jest setup for CareConnectApp.
//
// react-native-calendars and a handful of other native modules touch
// platform APIs that jest-expo's default environment does not fully stub;
// this file is the single place to add such shims as they're discovered,
// rather than repeating boilerplate at the top of every test file.

// Silences the expected act() warnings that some async Firebase mocks
// produce in tests that don't need to assert on the warning itself.
jest.spyOn(console, 'error').mockImplementation((...args) => {
  const message = args[0];
  if (typeof message === 'string' && message.includes('not wrapped in act')) {
    return;
  }
  // eslint-disable-next-line no-console
  console.warn(...args);
});
