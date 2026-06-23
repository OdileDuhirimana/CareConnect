export interface User {
  id: string;
  email: string;
  name: string;
  role: 'patient' | 'doctor' | 'admin';
  profileImage?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  address?: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Doctor extends User {
  role: 'doctor';
  specialty: string;
  licenseNumber: string;
  hospital: string;
  experience: number;
  rating: number;
  consultationFee: number;
  availability: DoctorAvailability[];
  bio?: string;
  education?: string[];
  languages?: string[];
  isApproved: boolean;
}

export interface DoctorAvailability {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export interface Patient extends User {
  role: 'patient';
  medicalHistory?: MedicalRecord[];
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  insuranceInfo?: {
    provider: string;
    policyNumber: string;
  };
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  date: Date;
  time: string;
  duration: number; // in minutes
  type: 'in-person' | 'video' | 'phone';
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no-show';
  reason: string;
  notes?: string;
  meetingLink?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentId?: string;
  type: 'prescription' | 'lab_result' | 'scan' | 'vaccination' | 'other';
  title: string;
  description?: string;
  fileUrl?: string;
  date: Date;
  createdAt: Date;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  appointmentId?: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'prescription';
  fileUrl?: string;
  isRead: boolean;
  createdAt: Date;
}

export interface WellnessEntry {
  id: string;
  userId: string;
  date: Date;
  mood: number; // 1-5 scale
  energy: number; // 1-5 scale
  stress: number; // 1-5 scale
  sleepHours: number;
  exerciseMinutes: number;
  notes?: string;
  symptoms?: string[];
}

export interface Payment {
  id: string;
  userId: string;
  appointmentId?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentMethod: string;
  stripePaymentIntentId?: string;
  createdAt: Date;
}

export interface Pharmacy {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  isPartner: boolean;
  rating: number;
  deliveryAvailable: boolean;
}

export interface PrescriptionRefill {
  id: string;
  patientId: string;
  pharmacyId: string;
  prescriptionId: string;
  status: 'pending' | 'approved' | 'ready' | 'delivered' | 'cancelled';
  requestedAt: Date;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
}

export interface NotificationData {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'appointment' | 'reminder' | 'message' | 'prescription' | 'general';
  data?: any;
  isRead: boolean;
  createdAt: Date;
}

export interface AIHealthAnalysis {
  id: string;
  userId: string;
  symptoms: string[];
  analysis: string;
  recommendations: string[];
  suggestedSpecialists: string[];
  confidence: number; // 0-1
  createdAt: Date;
}


