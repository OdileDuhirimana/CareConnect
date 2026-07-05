import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ErrorBannerProps {
  message: string;
}

/**
 * Inline error banner (red background, alert-circle icon).
 *
 * Why this exists: this exact markup — `backgroundColor: '#FFEBEE'`,
 * `alert-circle` icon, `#C62828` text — was duplicated near-verbatim
 * across AdminUsersScreen, AppointmentBookingScreen, ChatScreen, and most
 * other data-fetching screens. Centralizing it means the visual language
 * for "something went wrong" is guaranteed consistent app-wide.
 */
export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Ionicons name="alert-circle" size={18} color="#F44336" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  text: {
    color: '#C62828',
    fontSize: 14,
    flex: 1,
  },
});
