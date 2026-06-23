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
   - Start in test mode

## ⚙️ Step 2: Configure App

### 2.1 Update Firebase Config
Edit `src/config/firebase.ts` and replace the placeholder values:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 2.2 Install Dependencies
```bash
cd CareConnectApp
npm install
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

## 🎯 Next Steps

1. **Add sample data** (doctors, pharmacies)
2. **Configure push notifications**
3. **Set up payment processing**
4. **Deploy to app stores**

## 🆘 Need Help?

1. Check the [Firebase Setup Guide](FIREBASE_SETUP.md)
2. Review [Firebase Documentation](https://firebase.google.com/docs)
3. Check [Expo Firebase Guide](https://docs.expo.dev/guides/using-firebase/)

---

**Your CareConnect app is now ready!** 🎉

Start building amazing healthcare experiences!


