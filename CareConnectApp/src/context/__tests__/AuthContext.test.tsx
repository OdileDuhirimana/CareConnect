/**
 * Tests for AuthContext's signUp behavior, specifically the fix for
 * Critical Issue #3 in the code review: role assignment must never let a
 * client mark itself pre-verified/pre-approved. The Firestore rules file
 * is the ultimate backstop (rejecting any create where isVerified isn't
 * false), but this test locks down that the client also never attempts to
 * write a trusted-looking value in the first place, since a defense that
 * only exists in the rules and never in the code inviting a rules bypass
 * elsewhere would be a fragile single point of failure.
 *
 * Flakiness fix (portfolio-evaluation audit TEST-04): the previous version
 * of this file rendered two separate component trees (one per `it` block)
 * and never unmounted either of them or called RNTL's `cleanup()`
 * explicitly. `TestHarness`'s `onReady` effect also depended on the
 * `signUp`/`onReady` function identities, which are new on every render —
 * combined with no unmount between tests, a pending state update or
 * effect callback from the first test's tree could still be in flight
 * when the second test's tree mounted, occasionally producing an
 * intermittent `act()` warning or timing-dependent assertion failure
 * depending on how fast the two tests' microtasks interleaved. Every test
 * below now: (a) captures `unmount` from `render()` and calls it before
 * the test ends, (b) has an `afterEach(cleanup)` as a second,
 * belt-and-suspenders guarantee, and (c) guards `TestHarness`'s effect
 * with a ref so `onReady` fires exactly once per mounted tree regardless
 * of how many times its dependencies change identity.
 */

import React from 'react';
import { render, waitFor, act, cleanup } from '@testing-library/react-native';
import { Text } from 'react-native';
import { createUserWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { setDoc, onSnapshot } from 'firebase/firestore';
import { AuthProvider, useAuth } from '../AuthContext';

jest.mock('../../config/firebase', () => ({ auth: { currentUser: null }, db: {} }));

jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn((_auth, callback) => {
    callback(null);
    return jest.fn();
  }),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => 'user-doc-ref'),
  getDoc: jest.fn().mockResolvedValue({ exists: () => false }),
  setDoc: jest.fn().mockResolvedValue(undefined),
  onSnapshot: jest.fn(() => jest.fn()),
}));

function TestHarness({ onReady }: { onReady: (signUp: ReturnType<typeof useAuth>['signUp']) => void }) {
  const { signUp, loading } = useAuth();
  const hasFiredRef = React.useRef(false);
  React.useEffect(() => {
    if (!loading && !hasFiredRef.current) {
      hasFiredRef.current = true;
      onReady(signUp);
    }
  }, [loading, signUp, onReady]);
  return <Text>ready</Text>;
}

describe('AuthContext signUp', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('always writes isVerified: false regardless of what the caller passes', async () => {
    (createUserWithEmailAndPassword as jest.Mock).mockResolvedValue({ user: { uid: 'new-uid' } });

    let capturedSignUp: ReturnType<typeof useAuth>['signUp'] | undefined;

    const { unmount } = render(
      <AuthProvider>
        <TestHarness onReady={(signUp) => { capturedSignUp = signUp; }} />
      </AuthProvider>
    );

    await waitFor(() => expect(capturedSignUp).toBeDefined());

    await act(async () => {
      // Attempt to pass isVerified: true as if a malicious/buggy caller tried to self-verify.
      await capturedSignUp!('doc@example.com', 'password123', {
        name: 'Dr. Evil',
        role: 'doctor',
        isVerified: true as unknown as boolean,
      } as any);
    });

    expect(setDoc).toHaveBeenCalledWith(
      'user-doc-ref',
      expect.objectContaining({ isVerified: false, isApproved: false, role: 'doctor' })
    );

    unmount();
  });

  it('does not set isApproved for patient signups (the field is doctor-only)', async () => {
    (createUserWithEmailAndPassword as jest.Mock).mockResolvedValue({ user: { uid: 'patient-uid' } });

    let capturedSignUp: ReturnType<typeof useAuth>['signUp'] | undefined;

    const { unmount } = render(
      <AuthProvider>
        <TestHarness onReady={(signUp) => { capturedSignUp = signUp; }} />
      </AuthProvider>
    );

    await waitFor(() => expect(capturedSignUp).toBeDefined());

    await act(async () => {
      await capturedSignUp!('patient@example.com', 'password123', {
        name: 'Alice',
        role: 'patient',
      } as any);
    });

    const [, writtenDoc] = (setDoc as jest.Mock).mock.calls[0];
    expect(writtenDoc).not.toHaveProperty('isApproved');
    expect(writtenDoc.isVerified).toBe(false);

    unmount();
  });
});

describe('AuthContext custom-claims sync', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('forces an ID token refresh when claimsSyncedAt changes on the signed-in user\'s own document', async () => {
    const getIdToken = jest.fn().mockResolvedValue('fresh-token');
    const firebaseUser = { uid: 'doctor-uid', getIdToken };

    // Reconfigure the module-level mocks for this test: a signed-in user,
    // and an onSnapshot that we can trigger manually to simulate the
    // Firestore trigger (customClaims.ts) stamping `claimsSyncedAt`.
    (onAuthStateChanged as jest.Mock).mockImplementation((_auth, callback) => {
      callback(firebaseUser);
      return jest.fn();
    });

    const { getDoc } = jest.requireMock('firebase/firestore');
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ role: 'doctor', isApproved: false, isVerified: true }),
    });

    let snapshotCallback: ((snapshot: unknown) => void) | undefined;
    (onSnapshot as jest.Mock).mockImplementation((_ref, callback) => {
      snapshotCallback = callback;
      return jest.fn();
    });

    const mockFirebaseConfig = jest.requireMock('../../config/firebase');
    mockFirebaseConfig.auth.currentUser = firebaseUser;

    const { unmount } = render(
      <AuthProvider>
        <Text>ready</Text>
      </AuthProvider>
    );

    await waitFor(() => expect(onSnapshot).toHaveBeenCalled());

    act(() => {
      snapshotCallback?.({ data: () => ({ claimsSyncedAt: { seconds: 1 } }) });
    });

    await waitFor(() => expect(getIdToken).toHaveBeenCalledWith(true));

    unmount();
  });
});
