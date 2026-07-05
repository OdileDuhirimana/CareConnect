# 🚀 CareConnect Quick Start Guide

Get your CareConnect app running in 5 minutes!

## 📋 Prerequisites

- Node.js (v16 or higher)
- Expo CLI: `npm install -g @expo/cli`
- Google account for Firebase

## 🔥 Step 1: Set Up Firebase

### 1.1 Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"**
3. Name: `careconnect-app`
4. Enable Google Analytics (optional)
5. Click **"Create project"**

### 1.2 Add Web App
1. Click **"Add app"** → **"Web"** (</>)
2. App nickname: `CareConnect Web App`
3. Click **"Register app"**
4. **Copy the config object** (you'll need this!)

### 1.3 Enable Services
1. **Authentication**:
   - Go to Authentication → Sign-in method
   - Enable "Email/Password"
   
2. **Firestore Database**:
   - Go to Firestore Database
   - Click "Create database"
   - Start in test mode
   - Choose location

3. **Storage**:
   - Go to Storage
   - Click "Get started"
   - Start in test mode (you will replace the default rules in the next step — do not skip that)

### 1.4 Apply the real security rules (do this before testing with any real data)
"Test mode" leaves your database open to anyone with your project's public config for 30 days, then locked entirely. Before doing anything else:

```bash
firebase deploy --only firestore:rules,storage:rules
```

This deploys the ownership-scoped rules already checked into `firestore.rules` and `storage.rules` at the repo root — do not leave the console's default test-mode rules in place.

## ⚙️ Step 2: Configure App

### 2.1 Set Firebase Config via Environment Variables
This project reads Firebase config from environment variables (`src/config/firebase.ts`), not hardcoded values. Copy `env.example` to `.env` and fill in your project's values:

```bash
cp env.example .env
```

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your-actual-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
```

`.env` is gitignored — never commit real credentials.

### 2.2 Install Dependencies
```bash
cd CareConnectApp
npm install
cd ../functions
npm install
```

### 2.3 Set the Gemini API key (for the AI Symptom Checker)
The symptom-checker Cloud Function needs a Gemini API key, stored as a Cloud Functions secret — never as a client env var:
```bash
cd functions
firebase functions:secrets:set GOOGLE_GENAI_API_KEY
```

## 🚀 Step 3: Run the App

```bash
npm start
```

## 🧪 Step 4: Test the App

1. **Register a new user** (Patient role)
2. **Check Firebase Console** → Authentication → Users
3. **Try booking an appointment**
4. **Check Firestore** → Collections

## 🔧 Troubleshooting

### Common Issues:

**"Firebase not initialized"**
- Check your config values
- Make sure all fields are filled

**"Permission denied"**
- Check Firestore security rules
- Make sure Authentication is enabled

**"Network error"**
- Check internet connection
- Verify Firebase project is active

### Quick Fixes:

1. **Clear cache**: `expo start -c`
2. **Restart Metro**: `npm start -- --reset-cache`
3. **Check Firebase Console** for errors

## 📱 Testing Features

### ✅ Authentication
- [ ] Register new user
- [ ] Login with credentials
- [ ] Password reset

### ✅ Database
- [ ] Create user profile
- [ ] Book appointment
- [ ] Send message

### ✅ Storage
- [ ] Upload profile image
- [ ] Upload medical document

## ✅ Running Tests

```bash
cd CareConnectApp && npm test        # service-layer + context tests
cd functions && npm test              # Cloud Function authorization tests
```

## 🎯 Next Steps

1. **Add sample data** (doctors, pharmacies) directly in the Firestore console
2. **Configure push notifications** (not yet wired up in this project)
3. **Wire up real payment processing** (currently a UI-only screen — see `project.md` "Known Limitations")
4. **Deploy to app stores** (not yet done for this project)

## 🆘 Need Help?

1. Check the [Firebase Setup Guide](FIREBASE_SETUP.md)
2. Review [Firebase Documentation](https://firebase.google.com/docs)
3. Check [Expo Firebase Guide](https://docs.expo.dev/guides/using-firebase/)

---

**Your CareConnect app is now ready!** 🎉

Start building amazing healthcare experiences!


