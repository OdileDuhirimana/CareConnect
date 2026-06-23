# 🔥 Firebase Setup Guide for CareConnect

This guide will help you set up Firebase for the CareConnect app with all necessary services and configuration.

## 📋 Prerequisites

- Google account
- Node.js installed
- Expo CLI installed
- Firebase CLI (optional but recommended)

## 🚀 Step 1: Create Firebase Project

### 1.1 Go to Firebase Console
1. Visit [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"** or **"Add project"**
3. Enter project name: `careconnect-app` (or your preferred name)
4. Click **"Continue"**

### 1.2 Configure Project
1. **Google Analytics**: Enable (recommended for analytics)
2. **Analytics Account**: Create new or use existing
3. Click **"Create project"**
4. Wait for project creation to complete

## 🔧 Step 2: Add Web App to Firebase Project

### 2.1 Add Web App
1. In your Firebase project dashboard, click **"Add app"**
2. Select **"Web"** (</>) icon
3. **App nickname**: `CareConnect Web App`
4. **Firebase Hosting**: Check "Set up Firebase Hosting" (optional)
5. Click **"Register app"**

### 2.2 Get Configuration
1. Copy the Firebase configuration object
2. It will look like this:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "careconnect-app.firebaseapp.com",
  projectId: "careconnect-app",
  storageBucket: "careconnect-app.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdefghijklmnop"
};
```

## 🔐 Step 3: Enable Authentication

### 3.1 Go to Authentication
1. In Firebase Console, click **"Authentication"** in the left sidebar
2. Click **"Get started"**

### 3.2 Enable Sign-in Methods
1. Click **"Sign-in method"** tab
2. Enable **"Email/Password"**:
   - Click on "Email/Password"
   - Toggle "Enable"
   - Click "Save"
3. Enable **"Phone"** (optional):
   - Click on "Phone"
   - Toggle "Enable"
   - Click "Save"

### 3.3 Configure Authentication Settings
1. Go to **"Settings"** tab
2. **Authorized domains**: Add your domains
3. **User actions**: Configure as needed

## 🗄️ Step 4: Set Up Firestore Database

### 4.1 Create Firestore Database
1. In Firebase Console, click **"Firestore Database"**
2. Click **"Create database"**
3. **Security rules**: Start in test mode (we'll configure later)
4. **Location**: Choose closest to your users
5. Click **"Done"**

### 4.2 Configure Firestore Security Rules
Replace the default rules with these:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Appointments - users can read/write their own appointments
    match /appointments/{appointmentId} {
      allow read, write: if request.auth != null && 
        (resource.data.patientId == request.auth.uid || 
         resource.data.doctorId == request.auth.uid);
    }
    
    // Messages - users can read/write messages they're part of
    match /messages/{messageId} {
      allow read, write: if request.auth != null && 
        (resource.data.senderId == request.auth.uid || 
         resource.data.receiverId == request.auth.uid);
    }
    
    // Medical records - patients can read their own records
    match /medical_records/{recordId} {
      allow read, write: if request.auth != null && 
        (resource.data.patientId == request.auth.uid || 
         resource.data.doctorId == request.auth.uid);
    }
    
    // Wellness entries - users can read/write their own entries
    match /wellness_entries/{entryId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
    
    // Public collections (doctors, pharmacies)
    match /doctors/{doctorId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == doctorId;
    }
    
    match /pharmacies/{pharmacyId} {
      allow read: if request.auth != null;
    }
  }
}
```

## 📁 Step 5: Set Up Firebase Storage

### 5.1 Enable Storage
1. In Firebase Console, click **"Storage"**
2. Click **"Get started"**
3. **Security rules**: Start in test mode
4. **Location**: Choose same as Firestore
5. Click **"Done"**

### 5.2 Configure Storage Security Rules
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Users can upload files to their own folder
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Medical files - patients and doctors can access
    match /medical_files/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 📱 Step 6: Configure Cloud Messaging

### 6.1 Enable Cloud Messaging
1. In Firebase Console, click **"Cloud Messaging"**
2. No additional setup needed for basic functionality

### 6.2 Get Server Key (Optional)
1. Go to **"Project Settings"**
2. Click **"Cloud Messaging"** tab
3. Copy **"Server key"** if needed for backend

## 🔧 Step 7: Update App Configuration

### 7.1 Update Firebase Config
Replace the content in `src/config/firebase.ts` with your actual Firebase config:

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const messaging = getMessaging(app);

export default app;
```

### 7.2 Create Environment File (Optional)
Create `.env` file in project root:

```env
FIREBASE_API_KEY=YOUR_API_KEY_HERE
FIREBASE_AUTH_DOMAIN=YOUR_PROJECT_ID.firebaseapp.com
FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
FIREBASE_STORAGE_BUCKET=YOUR_PROJECT_ID.appspot.com
FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID
FIREBASE_APP_ID=YOUR_APP_ID
```

## 🧪 Step 8: Test Firebase Integration

### 8.1 Install Dependencies
```bash
cd CareConnectApp
npm install
```

### 8.2 Test Authentication
1. Run the app: `npm start`
2. Try to register a new user
3. Check Firebase Console > Authentication > Users

### 8.3 Test Firestore
1. Create a test document
2. Check Firebase Console > Firestore Database

## 📊 Step 9: Set Up Initial Data Structure

### 9.1 Create Collections
In Firestore, create these collections:

1. **users** - User profiles
2. **appointments** - Appointment bookings
3. **messages** - Chat messages
4. **medical_records** - Medical documents
5. **wellness_entries** - Wellness tracking
6. **doctors** - Doctor profiles
7. **pharmacies** - Pharmacy information
8. **payments** - Payment records
9. **notifications** - Push notifications

### 9.2 Add Sample Data
Add some sample doctors to get started:

```javascript
// Sample doctor document
{
  name: "Dr. Sarah Johnson",
  email: "sarah.johnson@example.com",
  specialty: "Cardiology",
  hospital: "City General Hospital",
  rating: 4.8,
  experience: 10,
  consultationFee: 150,
  isApproved: true,
  role: "doctor",
  createdAt: new Date(),
  updatedAt: new Date()
}
```

## 🚀 Step 10: Deploy and Test

### 10.1 Run the App
```bash
npm start
```

### 10.2 Test Features
1. **Authentication**: Register/Login
2. **Firestore**: Create/Read data
3. **Storage**: Upload files
4. **Messaging**: Send notifications

## 🔒 Security Best Practices

1. **Never expose API keys** in client-side code
2. **Use environment variables** for sensitive data
3. **Implement proper Firestore rules**
4. **Enable App Check** for production
5. **Monitor usage** and set up alerts

## 🆘 Troubleshooting

### Common Issues:
1. **"Firebase not initialized"** - Check config values
2. **"Permission denied"** - Check Firestore rules
3. **"Network error"** - Check internet connection
4. **"Invalid API key"** - Verify config values

### Debug Steps:
1. Check Firebase Console for errors
2. Enable debug logging
3. Check network requests
4. Verify authentication state

## 📞 Support

If you encounter issues:
1. Check Firebase Console for errors
2. Review Firebase documentation
3. Check Expo Firebase integration guide
4. Contact support if needed

---

**Your Firebase setup is now complete!** 🎉

The CareConnect app should now be able to:
- ✅ Authenticate users
- ✅ Store data in Firestore
- ✅ Upload files to Storage
- ✅ Send push notifications
- ✅ Handle real-time updates


