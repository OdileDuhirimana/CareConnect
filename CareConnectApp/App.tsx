import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StripeProvider } from '@stripe/stripe-react-native';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Stripe payments require a real publishable key to function (see
          env.example / README "Known Limitations"). Falling back to an
          empty string keeps the app running without one — PaymentScreen's
          own createPaymentIntent/initPaymentSheet calls will surface a
          clear error rather than silently pretending to charge a card. */}
      <StripeProvider
        publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''}
        merchantIdentifier="merchant.com.careconnect"
      >
        <AuthProvider>
          <AppNavigator />
          <StatusBar style="auto" />
        </AuthProvider>
      </StripeProvider>
    </GestureHandlerRootView>
  );
}