import React from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  /** Disables the button and dims it. Distinct from `loading` so a caller
   * can disable a button for a reason unrelated to an in-flight request
   * (e.g. incomplete form) without also implying a spinner. */
  disabled?: boolean;
  /** Shows an ActivityIndicator in place of the label. Implies disabled. */
  loading?: boolean;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Standard primary-action button (the `#2196F3` blue used for every
 * "Sign In" / "Book Appointment" / "Save" call-to-action across the app).
 *
 * Why this exists: every screen re-implemented its own
 * `TouchableOpacity` + disabled-state style + loading-text-swap pattern
 * (see LoginScreen's `loginButton`, AppointmentBookingScreen's
 * `bookButton`, WellnessTrackerScreen's `saveButton`). Centralizing it
 * also fixes a latent inconsistency: some of those screens only ever
 * swapped the button's text to "Loading..." with no visual spinner, which
 * is a weaker loading signal than an ActivityIndicator.
 */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[styles.button, isDisabled && styles.buttonDisabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color="white" size="small" />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  label: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
