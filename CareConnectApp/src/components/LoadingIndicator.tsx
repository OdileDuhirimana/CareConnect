import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface LoadingIndicatorProps {
  /** Optional caption shown under the spinner, e.g. "Loading appointments...". */
  message?: string;
}

/**
 * Full-screen centered loading spinner.
 *
 * Why this exists: several screens (e.g. DoctorPatientsScreen,
 * PharmacyScreen prior to this remediation pass) set a `loading` state
 * variable but never rendered anything for it — a real missing-loading-
 * state defect (flagged as FE-01 in the code review), not just unused-
 * variable noise. This component gives every screen a one-line way to
 * show a real loading state instead of a blank screen during the initial
 * fetch.
 */
export function LoadingIndicator({ message }: LoadingIndicatorProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2196F3" />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  message: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
});
