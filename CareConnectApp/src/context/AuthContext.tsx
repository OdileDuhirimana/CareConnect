import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setUser({ id: firebaseUser.uid, ...userDoc.data() } as User);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Custom claims (functions/src/customClaims.ts) are set by a Firestore
  // trigger that runs *after* an admin's write to this user's document
  // (e.g. approveDoctorRequest flipping isApproved) has already committed.
  // A client's cached ID token can be up to an hour stale, so without this
  // listener a freshly approved doctor's app wouldn't see its own new
  // claims take effect until the token happened to refresh naturally.
  // Watching `claimsSyncedAt` (a marker the trigger stamps onto the same
  // document specifically for this purpose) lets the client force an
  // immediate token refresh the moment the server-side sync completes,
  // rather than polling or waiting.
  useEffect(() => {
    if (!user?.id) return;

    let previousClaimsSyncedAt: unknown;
    const unsubscribe = onSnapshot(doc(db, 'users', user.id), (snapshot) => {
      const claimsSyncedAt = snapshot.data()?.claimsSyncedAt;
      if (claimsSyncedAt !== undefined && claimsSyncedAt !== previousClaimsSyncedAt) {
        previousClaimsSyncedAt = claimsSyncedAt;
        // `true` forces a round-trip to fetch a fresh token instead of
        // returning the cached one, which is the whole point here.
        auth.currentUser?.getIdToken(true).catch(() => {
          // Best-effort: if this fails, the token will still refresh
          // naturally within its normal lifetime, so this is not
          // surfaced as a user-facing error.
        });
      }
    });

    return unsubscribe;
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string, userData: Partial<User>) => {
    const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, password);

    // isVerified/isApproved always default to false regardless of what the
    // caller passes in userData: activation is granted only through the
    // server-side admin-approval Cloud Function (see
    // functions/src/adminApproval.ts -> approveDoctorRequest), never by a
    // value the client chooses at signup. Firestore rules independently
    // enforce that `role` itself can only be 'patient' or 'doctor' on
    // create, so self-registering as 'admin' is rejected at the database
    // layer even if this client-side default were bypassed.
    const userDoc = {
      ...userData,
      email,
      isVerified: false,
      ...(userData.role === 'doctor' ? { isApproved: false } : {}),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await setDoc(doc(db, 'users', firebaseUser.uid), userDoc);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};


