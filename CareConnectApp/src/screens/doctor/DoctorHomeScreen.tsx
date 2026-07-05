import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { StackScreenProps } from '@react-navigation/stack';
import { Appointment, Doctor } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { fetchAppointmentsForDoctorOnDate, fetchUpcomingAppointmentsForDoctor, ServiceError } from '../../services';
import { DoctorTabParamList, RootStackParamList } from '../../navigation/types';

const { width } = Dimensions.get('window');

type Props = CompositeScreenProps<
  BottomTabScreenProps<DoctorTabParamList, 'Home'>,
  StackScreenProps<RootStackParamList>
>;

const DoctorHomeScreen = ({ navigation }: Props) => {
  const { user } = useAuth();
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    if (!user?.id) return;
    setErrorMessage(null);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayIso = today.toISOString().split('T')[0];

      const [todayData, upcomingPage] = await Promise.all([
        fetchAppointmentsForDoctorOnDate(user.id, todayIso),
        fetchUpcomingAppointmentsForDoctor(user.id, tomorrow, { pageSize: 5 }),
      ]);

      setTodayAppointments(todayData);
      setUpcomingAppointments(upcomingPage.appointments);
    } catch (error) {
      setErrorMessage(error instanceof ServiceError ? error.message : 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const quickActions = [
    {
      title: 'Today\'s Schedule',
      subtitle: `${todayAppointments.length} appointments`,
      icon: 'calendar-outline',
      color: '#2196F3',
      onPress: () => navigation.navigate('Schedule'),
    },
    {
      title: 'My Patients',
      subtitle: 'View patient list',
      icon: 'people-outline',
      color: '#4CAF50',
      onPress: () => navigation.navigate('Patients'),
    },
    {
      title: 'Analytics',
      subtitle: 'View performance',
      icon: 'analytics-outline',
      color: '#FF9800',
      onPress: () => navigation.navigate('Analytics'),
    },
    {
      title: 'Messages',
      subtitle: 'Chat with patients',
      icon: 'chatbubble-outline',
      color: '#E91E63',
      onPress: () => {
        // Navigate to messages
      },
    },
  ];

  const renderAppointment = (appointment: Appointment) => (
    <TouchableOpacity
      key={appointment.id}
      style={styles.appointmentCard}
      onPress={() => {
        // Navigate to appointment details
      }}
    >
      <View style={styles.appointmentTime}>
        <Text style={styles.appointmentTimeText}>{appointment.time}</Text>
      </View>
      <View style={styles.appointmentInfo}>
        <Text style={styles.appointmentPatient}>Patient Name</Text>
        <Text style={styles.appointmentType}>
          {appointment.type === 'video' ? 'Video Consultation' : 'In-Person Visit'}
        </Text>
        <Text style={styles.appointmentReason}>{appointment.reason}</Text>
      </View>
      <View style={styles.appointmentStatus}>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: appointment.status === 'confirmed' ? '#4CAF50' : '#FF9800' },
          ]}
        >
          <Text style={styles.statusText}>
            {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#2196F3', '#E3F2FD']} style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.doctorName}>{user?.name ?? 'Doctor'}</Text>
            <Text style={styles.doctorSpecialty}>{(user as Doctor | null)?.specialty ?? ''}</Text>
          </View>
          <TouchableOpacity
            style={styles.notificationButton}
            accessibilityRole="button"
            accessibilityLabel="View notifications"
          >
            <Ionicons name="notifications-outline" size={24} color="white" />
            <View style={styles.notificationBadge} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {errorMessage && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color="#F44336" />
          <Text style={styles.errorBannerText}>{errorMessage}</Text>
        </View>
      )}

      <View style={styles.content}>
        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.quickActionCard, { borderLeftColor: action.color }]}
                onPress={action.onPress}
              >
                <Ionicons name={action.icon as any} size={32} color={action.color} />
                <Text style={styles.quickActionTitle}>{action.title}</Text>
                <Text style={styles.quickActionSubtitle}>{action.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Today's Appointments */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today&apos;s Appointments</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Schedule')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          {todayAppointments.length > 0 ? (
            todayAppointments.map(renderAppointment)
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color="#BDBDBD" />
              <Text style={styles.emptyStateText}>No appointments today</Text>
            </View>
          )}
        </View>

        {/* Upcoming Appointments */}
        {upcomingAppointments.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Schedule')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            {upcomingAppointments.slice(0, 3).map(renderAppointment)}
          </View>
        )}

        {/* Performance Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>This Week&apos;s Performance</Text>
          <View style={styles.performanceGrid}>
            <View style={styles.performanceCard}>
              <Text style={styles.performanceValue}>24</Text>
              <Text style={styles.performanceLabel}>Appointments</Text>
            </View>
            <View style={styles.performanceCard}>
              <Text style={styles.performanceValue}>4.8</Text>
              <Text style={styles.performanceLabel}>Rating</Text>
            </View>
            <View style={styles.performanceCard}>
              <Text style={styles.performanceValue}>95%</Text>
              <Text style={styles.performanceLabel}>Satisfaction</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
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
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
  },
  doctorName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 5,
  },
  doctorSpecialty: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
    marginTop: 2,
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F44336',
  },
  content: {
    flex: 1,
    padding: 20,
    marginTop: -20,
  },
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  seeAllText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionCard: {
    width: (width - 60) / 2,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 15,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
    textAlign: 'center',
  },
  quickActionSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  appointmentCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appointmentTime: {
    width: 60,
    alignItems: 'center',
    marginRight: 15,
  },
  appointmentTimeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  appointmentInfo: {
    flex: 1,
  },
  appointmentPatient: {
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
  emptyState: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginTop: 15,
  },
  performanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  performanceCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  performanceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 5,
  },
  performanceLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});

export default DoctorHomeScreen;


