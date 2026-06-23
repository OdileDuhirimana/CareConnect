#!/usr/bin/env node

/**
 * CareConnect App Setup Script
 * This script helps you set up the entire CareConnect app
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupApp() {
  console.log('🏥 Welcome to CareConnect Setup!');
  console.log('This script will help you configure your Firebase project.\n');
  
  // Get Firebase configuration
  console.log('📋 Please provide your Firebase project configuration:');
  console.log('You can find these values in Firebase Console > Project Settings > General > Your apps\n');
  
  const apiKey = await question('Enter your Firebase API Key: ');
  const authDomain = await question('Enter your Firebase Auth Domain: ');
  const projectId = await question('Enter your Firebase Project ID: ');
  const storageBucket = await question('Enter your Firebase Storage Bucket: ');
  const messagingSenderId = await question('Enter your Firebase Messaging Sender ID: ');
  const appId = await question('Enter your Firebase App ID: ');
  
  // Create .env file
  const envContent = `# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=${apiKey}
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=${authDomain}
EXPO_PUBLIC_FIREBASE_PROJECT_ID=${projectId}
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=${storageBucket}
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${messagingSenderId}
EXPO_PUBLIC_FIREBASE_APP_ID=${appId}

# Optional: Stripe Configuration (for payments)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key

# Optional: Google Maps API Key (for location services)
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Optional: Gemini API Key (for AI features)
EXPO_PUBLIC_GEMINI_API_KEY=your-gemini-api-key
`;

  try {
    fs.writeFileSync('.env', envContent);
    console.log('✅ Created .env file with your Firebase configuration');
  } catch (error) {
    console.log('⚠️  Could not create .env file. Please create it manually.');
  }
  
  // Update Firebase config file
  const firebaseConfigContent = `import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';

// Firebase configuration
const firebaseConfig = {
  apiKey: "${apiKey}",
  authDomain: "${authDomain}",
  projectId: "${projectId}",
  storageBucket: "${storageBucket}",
  messagingSenderId: "${messagingSenderId}",
  appId: "${appId}"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

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
`;

  try {
    fs.writeFileSync('src/config/firebase.ts', firebaseConfigContent);
    console.log('✅ Updated Firebase configuration file');
  } catch (error) {
    console.log('⚠️  Could not update Firebase config. Please update src/config/firebase.ts manually.');
  }
  
  console.log('\n🎉 Setup completed successfully!');
  console.log('\n📋 Next steps:');
  console.log('1. Make sure Firebase is properly configured in Firebase Console');
  console.log('2. Enable Authentication, Firestore, and Storage in Firebase Console');
  console.log('3. Install dependencies: npm install');
  console.log('4. Run the app: npm start');
  console.log('5. Test the app by registering a new user');
  
  console.log('\n🔧 Firebase Console Setup Checklist:');
  console.log('□ Create Firebase project');
  console.log('□ Add web app to project');
  console.log('□ Enable Authentication (Email/Password)');
  console.log('□ Create Firestore database');
  console.log('□ Enable Storage');
  console.log('□ Configure security rules');
  
  rl.close();
}

setupApp().catch(console.error);


