/**
 * Firebase Setup Script for CareConnect
 * This script helps initialize the Firestore database with sample data
 * 
 * Run this script after setting up Firebase:
 * node scripts/setup-firebase.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, doc, setDoc } = require('firebase/firestore');

// Firebase configuration - replace with your actual config
const firebaseConfig = {
  apiKey: "your-api-key-here",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Sample data to populate the database
const sampleDoctors = [
  {
    name: "Dr. Sarah Johnson",
    email: "sarah.johnson@example.com",
    phone: "+1-555-0123",
    specialty: "Cardiology",
    hospital: "City General Hospital",
    licenseNumber: "MD123456",
    experience: 10,
    rating: 4.8,
    consultationFee: 150,
    bio: "Experienced cardiologist with expertise in heart disease treatment and prevention.",
    education: ["Harvard Medical School", "Johns Hopkins Residency"],
    languages: ["English", "Spanish"],
    isApproved: true,
    role: "doctor",
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: "Dr. Michael Chen",
    email: "michael.chen@example.com",
    phone: "+1-555-0124",
    specialty: "Neurology",
    hospital: "Metro Medical Center",
    licenseNumber: "MD123457",
    experience: 8,
    rating: 4.7,
    consultationFee: 140,
    bio: "Neurologist specializing in brain disorders and nervous system conditions.",
    education: ["Stanford Medical School", "UCLA Residency"],
    languages: ["English", "Mandarin"],
    isApproved: true,
    role: "doctor",
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: "Dr. Emily Davis",
    email: "emily.davis@example.com",
    phone: "+1-555-0125",
    specialty: "Pediatrics",
    hospital: "Children's Hospital",
    licenseNumber: "MD123458",
    experience: 12,
    rating: 4.9,
    consultationFee: 120,
    bio: "Pediatrician with a passion for children's health and development.",
    education: ["Yale Medical School", "Boston Children's Hospital Residency"],
    languages: ["English", "French"],
    isApproved: true,
    role: "doctor",
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const samplePharmacies = [
  {
    name: "City Pharmacy",
    address: "123 Main Street, City, State 12345",
    phone: "+1-555-0200",
    email: "info@citypharmacy.com",
    isPartner: true,
    rating: 4.5,
    deliveryAvailable: true
  },
  {
    name: "Metro Drug Store",
    address: "456 Oak Avenue, City, State 12345",
    phone: "+1-555-0201",
    email: "contact@metrodrug.com",
    isPartner: true,
    rating: 4.3,
    deliveryAvailable: true
  },
  {
    name: "Health Plus Pharmacy",
    address: "789 Pine Street, City, State 12345",
    phone: "+1-555-0202",
    email: "support@healthplus.com",
    isPartner: false,
    rating: 4.1,
    deliveryAvailable: false
  }
];

const sampleAdmin = {
  name: "Admin User",
  email: "admin@careconnect.com",
  phone: "+1-555-0000",
  role: "admin",
  isVerified: true,
  isApproved: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

async function setupFirebase() {
  try {
    console.log('🔥 Setting up Firebase for CareConnect...');
    
    // Add sample doctors
    console.log('👩‍⚕️ Adding sample doctors...');
    for (const doctor of sampleDoctors) {
      await addDoc(collection(db, 'users'), doctor);
      console.log(`✅ Added doctor: ${doctor.name}`);
    }
    
    // Add sample pharmacies
    console.log('💊 Adding sample pharmacies...');
    for (const pharmacy of samplePharmacies) {
      await addDoc(collection(db, 'pharmacies'), pharmacy);
      console.log(`✅ Added pharmacy: ${pharmacy.name}`);
    }
    
    // Add admin user
    console.log('👨‍💼 Adding admin user...');
    await addDoc(collection(db, 'users'), sampleAdmin);
    console.log(`✅ Added admin: ${sampleAdmin.name}`);
    
    console.log('🎉 Firebase setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Update your Firebase config in src/config/firebase.ts');
    console.log('2. Run the app: npm start');
    console.log('3. Test authentication and data access');
    
  } catch (error) {
    console.error('❌ Error setting up Firebase:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure Firebase is properly configured');
    console.log('2. Check your Firebase project settings');
    console.log('3. Verify Firestore is enabled');
    console.log('4. Check your internet connection');
  }
}

// Run the setup
setupFirebase();


