import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// Patient Screens
import PatientHomeScreen from '../screens/patient/PatientHomeScreen';
import DoctorDirectoryScreen from '../screens/patient/DoctorDirectoryScreen';
import AppointmentBookingScreen from '../screens/patient/AppointmentBookingScreen';
import MyAppointmentsScreen from '../screens/patient/MyAppointmentsScreen';
import HealthDashboardScreen from '../screens/patient/HealthDashboardScreen';
import WellnessTrackerScreen from '../screens/patient/WellnessTrackerScreen';
import MedicalRecordsScreen from '../screens/patient/MedicalRecordsScreen';
import ChatScreen from '../screens/shared/ChatScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import SettingsScreen from '../screens/shared/SettingsScreen';

// Doctor Screens
import DoctorHomeScreen from '../screens/doctor/DoctorHomeScreen';
import DoctorScheduleScreen from '../screens/doctor/DoctorScheduleScreen';
import DoctorPatientsScreen from '../screens/doctor/DoctorPatientsScreen';
import DoctorAnalyticsScreen from '../screens/doctor/DoctorAnalyticsScreen';

// Admin Screens
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminUsersScreen from '../screens/admin/AdminUsersScreen';
import AdminAnalyticsScreen from '../screens/admin/AdminAnalyticsScreen';

// Shared Screens
import AISymptomCheckerScreen from '../screens/shared/AISymptomCheckerScreen';
import PharmacyScreen from '../screens/shared/PharmacyScreen';
import PaymentScreen from '../screens/shared/PaymentScreen';

import {
  AdminDrawerParamList,
  DoctorTabParamList,
  PatientTabParamList,
  RootStackParamList,
} from './types';

const Stack = createStackNavigator<RootStackParamList>();
const PatientTab = createBottomTabNavigator<PatientTabParamList>();
const DoctorTab = createBottomTabNavigator<DoctorTabParamList>();
const AdminDrawer = createDrawerNavigator<AdminDrawerParamList>();

const PatientTabNavigator = () => (
  <PatientTab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName: keyof typeof Ionicons.glyphMap;

        if (route.name === 'Home') {
          iconName = focused ? 'home' : 'home-outline';
        } else if (route.name === 'Doctors') {
          iconName = focused ? 'medical' : 'medical-outline';
        } else if (route.name === 'Appointments') {
          iconName = focused ? 'calendar' : 'calendar-outline';
        } else if (route.name === 'Health') {
          iconName = focused ? 'heart' : 'heart-outline';
        } else if (route.name === 'Profile') {
          iconName = focused ? 'person' : 'person-outline';
        } else {
          iconName = 'help-outline';
        }

        return <Ionicons name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: '#2196F3',
      tabBarInactiveTintColor: 'gray',
    })}
  >
    <PatientTab.Screen name="Home" component={PatientHomeScreen} />
    <PatientTab.Screen name="Doctors" component={DoctorDirectoryScreen} />
    <PatientTab.Screen name="Appointments" component={MyAppointmentsScreen} />
    <PatientTab.Screen name="Health" component={HealthDashboardScreen} />
    <PatientTab.Screen name="Profile" component={ProfileScreen} />
  </PatientTab.Navigator>
);

const DoctorTabNavigator = () => (
  <DoctorTab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName: keyof typeof Ionicons.glyphMap;

        if (route.name === 'Home') {
          iconName = focused ? 'home' : 'home-outline';
        } else if (route.name === 'Schedule') {
          iconName = focused ? 'calendar' : 'calendar-outline';
        } else if (route.name === 'Patients') {
          iconName = focused ? 'people' : 'people-outline';
        } else if (route.name === 'Analytics') {
          iconName = focused ? 'analytics' : 'analytics-outline';
        } else if (route.name === 'Profile') {
          iconName = focused ? 'person' : 'person-outline';
        } else {
          iconName = 'help-outline';
        }

        return <Ionicons name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: '#2196F3',
      tabBarInactiveTintColor: 'gray',
    })}
  >
    <DoctorTab.Screen name="Home" component={DoctorHomeScreen} />
    <DoctorTab.Screen name="Schedule" component={DoctorScheduleScreen} />
    <DoctorTab.Screen name="Patients" component={DoctorPatientsScreen} />
    <DoctorTab.Screen name="Analytics" component={DoctorAnalyticsScreen} />
    <DoctorTab.Screen name="Profile" component={ProfileScreen} />
  </DoctorTab.Navigator>
);

const AdminDrawerNavigator = () => (
  <AdminDrawer.Navigator>
    <AdminDrawer.Screen name="Dashboard" component={AdminDashboardScreen} />
    <AdminDrawer.Screen name="Users" component={AdminUsersScreen} />
    <AdminDrawer.Screen name="Analytics" component={AdminAnalyticsScreen} />
    <AdminDrawer.Screen name="Profile" component={ProfileScreen} />
  </AdminDrawer.Navigator>
);

const AppNavigator = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return null; // You can add a loading screen here
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          // Auth Stack
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        ) : (
          // Main App Stack
          <>
            {user.role === 'patient' && (
              <Stack.Screen name="PatientMain" component={PatientTabNavigator} />
            )}
            {user.role === 'doctor' && (
              <Stack.Screen name="DoctorMain" component={DoctorTabNavigator} />
            )}
            {user.role === 'admin' && (
              <Stack.Screen name="AdminMain" component={AdminDrawerNavigator} />
            )}
            
            {/* Shared Screens */}
            <Stack.Screen name="AppointmentBooking" component={AppointmentBookingScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="WellnessTracker" component={WellnessTrackerScreen} />
            <Stack.Screen name="MedicalRecords" component={MedicalRecordsScreen} />
            <Stack.Screen name="AISymptomChecker" component={AISymptomCheckerScreen} />
            <Stack.Screen name="Pharmacy" component={PharmacyScreen} />
            <Stack.Screen name="Payment" component={PaymentScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;


