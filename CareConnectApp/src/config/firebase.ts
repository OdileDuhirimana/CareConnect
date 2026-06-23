import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';
import { getAnalytics } from "firebase/analytics";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDcZ5PevGbiGVEknLYTLzc5RhnhxTN-vXI",
  authDomain: "careconnect-app-2cb30.firebaseapp.com",
  projectId: "careconnect-app-2cb30",
  storageBucket: "careconnect-app-2cb30.firebasestorage.app",
  messagingSenderId: "523637063095",
  appId: "1:523637063095:web:960bd00d5b24f9d7d7fc32",
  measurementId: "G-C533VN2H0X"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const messaging = getMessaging(app);

// Export the app instance
export default app;

// Helper function to check if Firebase is properly configured
export const isFirebaseConfigured = () => {
  return (
    firebaseConfig.apiKey !== "your-api-key-here" &&
    firebaseConfig.projectId !== "your-project-id" &&
    firebaseConfig.appId !== "your-app-id"
  );
};
