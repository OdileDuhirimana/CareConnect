import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { StackScreenProps } from '@react-navigation/stack';
import { Appointment } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { fetchAppointmentsForPatient, updateAppointmentStatus, ServiceError } from '../../services';
import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { PatientTabParamList, RootStackParamList } from '../../navigation/types';

const PAGE_SIZE = 20;

type Props = CompositeScreenProps<
  BottomTabScreenProps<PatientTabParamList, 'Appointments'>,
  StackScreenProps<RootStackParamList>
>;

const MyAppointmentsScreen = ({ navigation }: Props) => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    if (!user?.id) return;
    setErrorMessage(null);
    try {
      const page = await fetchAppointmentsForPatient(user.id, { pageSize: PAGE_SIZE });
      setAppointments(page.appointments);
      setCursor(page.nextCursor);
      setHasMore(Boolean(page.nextCursor));
    } catch (error) {
      setErrorMessage(error instanceof ServiceError ? error.message : 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const fetchMoreAppointments = async () => {
    if (!user?.id || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchAppointmentsForPatient(user.id, { pageSize: PAGE_SIZE, after: cursor });
      setAppointments((prev) => [...prev, ...page.appointments]);
      setCursor(page.nextCursor);
      setHasMore(Boolean(page.nextCursor));
    } catch (error) {
      setErrorMessage(error instanceof ServiceError ? error.message : 'Failed to load more appointments.');
    } finally {
      setLoadingMore(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAppointments();
    setRefreshing(false);
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    Alert.alert(
      'Cancel Appointment',
      'Are you sure you want to cancel this appointment?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            try {
              await updateAppointmentStatus(appointmentId, 'cancelled');
              fetchAppointments();
            } catch (error) {
              const message = error instanceof ServiceError ? error.message : 'Failed to cancel appointment';
              Alert.alert('Error', message);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return '#4CAF50';
      case 'pending': return '#FF9800';
      case 'cancelled': return '#F44336';
      case 'completed': return '#2196F3';
      case 'no-show': return '#9E9E9E';
      default: return '#666';
    }
  };

  const renderAppointment = ({ item }: { item: Appointment }) => (
    // Note: this card is intentionally non-interactive as a whole. It
    // previously called navigate('AppointmentDetails', ...), a screen name
    // never registered in AppNavigator.tsx — tapping it would have crashed
    // at runtime. The per-status action buttons below remain fully
    // functional (Chat / Cancel).
    <View style={styles.appointmentCard}>
      <View style={styles.appointmentHeader}>
        <View style={styles.appointmentIcon}>
          <Ionicons
            name={item.type === 'video' ? 'videocam' : 'location'}
            size={24}
            color="#2196F3"
          />
        </View>
        <View style={styles.appointmentInfo}>
          <Text style={styles.appointmentDate}>
            {item.date.toLocaleDateString()} at {item.time}
          </Text>
          <Text style={styles.appointmentType}>
            {item.type === 'video' ? 'Video Consultation' : 'In-Person Visit'}
          </Text>
          <Text style={styles.appointmentReason}>{item.reason}</Text>
        </View>
        <View style={styles.appointmentStatus}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.status) },
            ]}
          >
            <Text style={styles.statusText}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>
      </View>

      {item.status === 'confirmed' && (
        <View style={styles.appointmentActions}>
          {/* Video calling was a non-functional UI shell (no WebRTC behind
              it) and has been removed rather than shipped as a dead-end
              button; messaging is the one real-time feature that actually
              works, so this replaces the old "Join Call" action. */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Chat', { appointment: item })}
            accessibilityRole="button"
            accessibilityLabel="Message doctor"
          >
            <Ionicons name="chatbubble" size={16} color="#4CAF50" />
            <Text style={styles.actionButtonText}>Message</Text>
          </TouchableOpacity>
        </View>
      )}

      {item.status === 'pending' && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => handleCancelAppointment(item.id)}
          accessibilityRole="button"
          accessibilityLabel="Cancel appointment"
        >
          <Text style={styles.cancelButtonText}>Cancel Appointment</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const upcomingAppointments = appointments.filter(
    apt => apt.status === 'confirmed' || apt.status === 'pending'
  );
  const pastAppointments = appointments.filter(
    apt => apt.status === 'completed' || apt.status === 'cancelled' || apt.status === 'no-show'
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Appointments</Text>
        <TouchableOpacity
          style={styles.bookButton}
          onPress={() => navigation.navigate('Doctors')}
          accessibilityRole="button"
          accessibilityLabel="Book a new appointment"
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {errorMessage && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color="#F44336" />
          <Text style={styles.errorBannerText}>{errorMessage}</Text>
        </View>
      )}

      <FlatList
        data={[
          ...upcomingAppointments.map(apt => ({ ...apt, section: 'upcoming' })),
          ...pastAppointments.map(apt => ({ ...apt, section: 'past' })),
        ]}
        renderItem={({ item }) => renderAppointment({ item })}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReachedThreshold={0.4}
        onEndReached={hasMore ? fetchMoreAppointments : undefined}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoader} /> : null}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={64} color="#BDBDBD" />
              <Text style={styles.emptyStateTitle}>No appointments yet</Text>
              <Text style={styles.emptyStateText}>
                Book your first appointment with a doctor
              </Text>
              <TouchableOpacity
                style={styles.bookFirstButton}
                onPress={() => navigation.navigate('Doctors')}
                accessibilityRole="button"
                accessibilityLabel="Book your first appointment"
              >
                <Text style={styles.bookFirstButtonText}>Book Appointment</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  errorBannerText: {
    color: '#C62828',
    fontSize: 14,
    flex: 1,
  },
  footerLoader: {
    marginVertical: 20,
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: 'white',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  bookButton: {
    backgroundColor: '#2196F3',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 20,
  },
  appointmentCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appointmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  appointmentIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  appointmentInfo: {
    flex: 1,
  },
  appointmentDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  appointmentType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  appointmentReason: {
    fontSize: 12,
    color: '#999',
  },
  appointmentStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  appointmentActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  actionButtonText: {
    marginLeft: 5,
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    marginBottom: 5,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  bookFirstButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  bookFirstButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default MyAppointmentsScreen;


