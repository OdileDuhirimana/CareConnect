import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StackScreenProps } from '@react-navigation/stack';
import { useStripe } from '@stripe/stripe-react-native';
import { createPaymentIntent, ServiceError } from '../../services';
import { RootStackParamList } from '../../navigation/types';
import { ErrorBanner } from '../../components';

/**
 * Real Stripe PaymentSheet integration, replacing the previous screen's
 * fake `setTimeout` "Payment Successful" flow and hand-rolled raw
 * card-number/CVV `TextInput` fields (which were never wired to the
 * Stripe API despite `@stripe/stripe-react-native` being a listed
 * dependency — see the code review's payments finding).
 *
 * Flow: on mount, ask the server (`createPaymentIntent`) to create a
 * Stripe PaymentIntent for this appointment and initialize the payment
 * sheet with the returned client secret. Once that's ready, "Pay Now"
 * simply presents Stripe's own PaymentSheet UI — this app's code never
 * collects or even sees raw card data, which is both a security property
 * and a PCI-DSS scope reduction.
 *
 * The dollar amounts shown here (consultation fee / platform fee / total)
 * are for the user's information only. The *authoritative* amount is
 * computed server-side in `createPaymentIntent` (functions/src/payments.ts)
 * from the doctor's own `consultationFee` plus a fixed platform fee — the
 * client never sends an amount at all (see `CreatePaymentIntentInput`),
 * so a tampered client value has nothing to tamper: the server-derived
 * `amount` returned in the response is what's rendered here.
 */

const PLATFORM_FEE = 5;

type Props = StackScreenProps<RootStackParamList, 'Payment'>;

type InitState =
  | { status: 'loading' }
  | { status: 'ready'; totalAmount: number }
  | { status: 'error'; message: string };

const PaymentScreen = ({ navigation, route }: Props) => {
  const { appointment } = route.params;
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [initState, setInitState] = useState<InitState>({ status: 'loading' });
  const [paying, setPaying] = useState(false);

  const setUpPaymentSheet = useCallback(async () => {
    setInitState({ status: 'loading' });
    try {
      const result = await createPaymentIntent({ appointmentId: appointment.id });
      const { error } = await initPaymentSheet({
        paymentIntentClientSecret: result.clientSecret,
        merchantDisplayName: 'CareConnect',
      });
      if (error) {
        setInitState({ status: 'error', message: error.message });
        return;
      }
      setInitState({ status: 'ready', totalAmount: result.amount });
    } catch (error) {
      const message = error instanceof ServiceError ? error.message : 'Failed to start payment. Please try again.';
      setInitState({ status: 'error', message });
    }
  }, [appointment.id, initPaymentSheet]);

  useEffect(() => {
    setUpPaymentSheet();
  }, [setUpPaymentSheet]);

  const handlePayNow = async () => {
    setPaying(true);
    try {
      const { error } = await presentPaymentSheet();
      if (error) {
        // A cancellation is not a failure worth alarming the user about;
        // any other error (declined card, network issue, etc.) is shown
        // verbatim from Stripe rather than a fabricated success message.
        if (error.code !== 'Canceled') {
          Alert.alert('Payment Failed', error.message);
        }
        return;
      }
      Alert.alert(
        'Payment Successful',
        'Your payment has been processed successfully!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } finally {
      setPaying(false);
    }
  };

  const consultationFee = initState.status === 'ready' ? initState.totalAmount - PLATFORM_FEE : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color="#2196F3" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Payment Summary</Text>
          <Text style={styles.appointmentContext}>
            Appointment on {appointment.date.toLocaleDateString()} at {appointment.time}
          </Text>

          {initState.status === 'loading' && (
            <View style={styles.pendingRow}>
              <ActivityIndicator size="small" color="#2196F3" />
              <Text style={styles.pendingText}>Calculating your total&hellip;</Text>
            </View>
          )}

          {initState.status === 'error' && <ErrorBanner message={initState.message} />}

          {initState.status === 'ready' && consultationFee !== null && (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Consultation Fee</Text>
                <Text style={styles.summaryValue}>${consultationFee.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Platform Fee</Text>
                <Text style={styles.summaryValue}>${PLATFORM_FEE.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryTotalLabel}>Total</Text>
                <Text style={styles.summaryTotalValue}>${initState.totalAmount.toFixed(2)}</Text>
              </View>
            </>
          )}
        </View>

        {initState.status === 'error' && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={setUpPaymentSheet}
            accessibilityRole="button"
            accessibilityLabel="Retry setting up payment"
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        )}

        <View style={styles.methodNotice}>
          <Ionicons name="card" size={20} color="#2196F3" />
          <Text style={styles.methodNoticeText}>
            Card via Stripe. Apple Pay and Google Pay are coming soon.
          </Text>
        </View>

        <View style={styles.securityNotice}>
          <Ionicons name="shield-checkmark" size={20} color="#4CAF50" />
          <Text style={styles.securityText}>
            Your card details are entered directly into Stripe&apos;s secure payment
            sheet — CareConnect never sees or stores them.
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.payButton,
            (initState.status !== 'ready' || paying) && styles.payButtonDisabled,
          ]}
          onPress={handlePayNow}
          disabled={initState.status !== 'ready' || paying}
          accessibilityRole="button"
          accessibilityLabel="Pay now"
          accessibilityState={{ disabled: initState.status !== 'ready' || paying }}
        >
          <LinearGradient
            colors={['#4CAF50', '#45A049']}
            style={styles.payButtonGradient}
          >
            <Ionicons name="card" size={20} color="white" />
            <Text style={styles.payButtonText}>
              {paying
                ? 'Processing...'
                : initState.status === 'ready'
                  ? `Pay $${initState.totalAmount.toFixed(2)}`
                  : 'Preparing Payment...'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: 'white',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  appointmentContext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 10,
  },
  summaryTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    marginBottom: 20,
  },
  retryButtonText: {
    color: '#1976D2',
    fontSize: 14,
    fontWeight: '600',
  },
  methodNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    gap: 10,
  },
  methodNoticeText: {
    flex: 1,
    fontSize: 14,
    color: '#1565C0',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
  },
  securityText: {
    flex: 1,
    fontSize: 14,
    color: '#2E7D32',
  },
  payButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  payButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default PaymentScreen;
