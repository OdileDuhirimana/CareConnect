import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EmptyStateProps {
  /** Any valid Ionicons glyph name, e.g. "calendar-outline". */
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
}

/**
 * Centered icon + title + subtitle empty-state block.
 *
 * Why this exists: nearly every list screen (DoctorDirectoryScreen,
 * MedicalRecordsScreen, MyAppointmentsScreen, PharmacyScreen, ...)
 * duplicated the same "big muted icon + bold title + gray caption"
 * layout for its `ListEmptyComponent`. Centralizing it keeps that visual
 * language consistent and removes ~15 lines of repeated styling per
 * screen that adopts it.
 */
export function EmptyState({ icon, title, message }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={64} color="#BDBDBD" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    marginBottom: 5,
  },
  message: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
