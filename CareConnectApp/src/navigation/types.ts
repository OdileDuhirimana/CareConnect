import { Appointment, Doctor } from '../types';

/**
 * Centralized navigation param types for every navigator in the app.
 *
 * Why this exists: all 24 screens previously typed their `navigation`/`route`
 * props as `any`, which meant `navigation.navigate('SomeTypo', {})` was a
 * silent runtime crash instead of a compile-time error. Defining the param
 * lists once here and threading them through `createStackNavigator<T>()` /
 * `createBottomTabNavigator<T>()` / `createDrawerNavigator<T>()` in
 * AppNavigator.tsx gives every screen's `navigation.navigate(...)` call
 * real autocomplete and type-checking.
 */

/** Screens reachable from the root stack, available regardless of role. */
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  // Role-specific tab/drawer navigators are mounted as single nested
  // screens on the root stack; they take no params of their own.
  PatientMain: undefined;
  DoctorMain: undefined;
  AdminMain: undefined;
  AppointmentBooking: { doctor: Doctor };
  Chat: { appointment: Appointment };
  WellnessTracker: undefined;
  MedicalRecords: undefined;
  AISymptomChecker: undefined;
  Pharmacy: undefined;
  Payment: { appointment: Appointment };
  Settings: undefined;
};

/** Bottom tabs available to a signed-in patient. */
export type PatientTabParamList = {
  Home: undefined;
  Doctors: undefined;
  Appointments: undefined;
  Health: undefined;
  Profile: undefined;
};

/** Bottom tabs available to a signed-in doctor. */
export type DoctorTabParamList = {
  Home: undefined;
  Schedule: undefined;
  Patients: undefined;
  Analytics: undefined;
  Profile: undefined;
};

/** Drawer items available to a signed-in admin. */
export type AdminDrawerParamList = {
  Dashboard: undefined;
  Users: undefined;
  Analytics: undefined;
  Profile: undefined;
};
