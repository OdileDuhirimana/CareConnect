import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  /** Optional style override, merged after the base card styling. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Standard elevated-card container.
 *
 * Why this exists: the code review's Top 10 flagged that every screen
 * re-implemented an identical white/rounded/shadowed card style from
 * scratch (see e.g. AdminUsersScreen's `userCard`, DoctorDirectoryScreen's
 * `doctorCard`, AppointmentBookingScreen's `doctorInfo` section) with the
 * same hardcoded values. Centralizing it here means a future visual tweak
 * (radius, shadow depth) happens in one place instead of 20+.
 */
export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
