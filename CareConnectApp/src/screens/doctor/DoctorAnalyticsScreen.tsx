import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { StackScreenProps } from '@react-navigation/stack';
import { DoctorTabParamList, RootStackParamList } from '../../navigation/types';

const { width } = Dimensions.get('window');

type Props = CompositeScreenProps<
  BottomTabScreenProps<DoctorTabParamList, 'Analytics'>,
  StackScreenProps<RootStackParamList>
>;

const DoctorAnalyticsScreen = ({ navigation }: Props) => {
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  // Illustrative static numbers (see README "Known Limitations" — there is
  // no live analytics aggregation backend yet), so there is intentionally
  // no setter: this is display data, not editable state.
  const [analytics] = useState({
    totalAppointments: 24,
    completedAppointments: 22,
    cancelledAppointments: 2,
    averageRating: 4.8,
    totalRevenue: 1200,
    patientSatisfaction: 95,
  });

  const periods = [
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'quarter', label: 'This Quarter' },
    { id: 'year', label: 'This Year' },
  ];

  const renderMetricCard = (title: string, value: string, subtitle: string, color: string, icon: string) => (
    <View style={styles.metricCard}>
      <View style={styles.metricHeader}>
        <View style={[styles.metricIcon, { backgroundColor: color }]}>
          <Ionicons name={icon as any} size={24} color="white" />
        </View>
        <Text style={styles.metricTitle}>{title}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricSubtitle}>{subtitle}</Text>
    </View>
  );

  const renderChart = (title: string) => (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>{title}</Text>
      <View style={styles.chartPlaceholder}>
        <Ionicons name="bar-chart" size={48} color="#BDBDBD" />
        <Text style={styles.chartPlaceholderText}>Chart would be displayed here</Text>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color="#2196F3" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
        <TouchableOpacity
          style={styles.exportButton}
          accessibilityRole="button"
          accessibilityLabel="Export analytics"
        >
          <Ionicons name="download" size={24} color="#2196F3" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {periods.map((period) => (
            <TouchableOpacity
              key={period.id}
              style={[
                styles.periodButton,
                selectedPeriod === period.id && styles.periodButtonActive,
              ]}
              onPress={() => setSelectedPeriod(period.id)}
              accessibilityRole="button"
              accessibilityLabel={period.label}
              accessibilityState={{ selected: selectedPeriod === period.id }}
            >
              <Text
                style={[
                  styles.periodButtonText,
                  selectedPeriod === period.id && styles.periodButtonTextActive,
                ]}
              >
                {period.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Key Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          <View style={styles.metricsGrid}>
            {renderMetricCard(
              'Total Appointments',
              analytics.totalAppointments.toString(),
              'Appointments scheduled',
              '#2196F3',
              'calendar'
            )}
            {renderMetricCard(
              'Completion Rate',
              `${Math.round((analytics.completedAppointments / analytics.totalAppointments) * 100)}%`,
              'Appointments completed',
              '#4CAF50',
              'checkmark-circle'
            )}
            {renderMetricCard(
              'Average Rating',
              analytics.averageRating.toString(),
              'Patient satisfaction',
              '#FF9800',
              'star'
            )}
            {renderMetricCard(
              'Total Revenue',
              `$${analytics.totalRevenue}`,
              'Earnings this period',
              '#9C27B0',
              'cash'
            )}
          </View>
        </View>

        {/* Performance Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance Overview</Text>
          <View style={styles.performanceGrid}>
            <View style={styles.performanceCard}>
              <LinearGradient
                colors={['#4CAF50', '#45A049']}
                style={styles.performanceGradient}
              >
                <Ionicons name="trending-up" size={32} color="white" />
                <Text style={styles.performanceValue}>+12%</Text>
                <Text style={styles.performanceLabel}>vs Last Period</Text>
              </LinearGradient>
            </View>
            <View style={styles.performanceCard}>
              <LinearGradient
                colors={['#2196F3', '#1976D2']}
                style={styles.performanceGradient}
              >
                <Ionicons name="people" size={32} color="white" />
                <Text style={styles.performanceValue}>18</Text>
                <Text style={styles.performanceLabel}>New Patients</Text>
              </LinearGradient>
            </View>
          </View>
        </View>

        {/* Charts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trends & Insights</Text>
          {renderChart('Appointments Over Time')}
          {renderChart('Patient Satisfaction')}
          {renderChart('Revenue Breakdown')}
        </View>

        {/* Patient Feedback */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Patient Feedback</Text>
          <View style={styles.feedbackCard}>
            <View style={styles.feedbackHeader}>
              <Text style={styles.feedbackPatient}>John Doe</Text>
              <View style={styles.feedbackRating}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.feedbackRatingText}>5.0</Text>
              </View>
            </View>
            <Text style={styles.feedbackText}>
              &quot;Dr. Smith was very professional and helpful. The consultation was thorough and I felt well taken care of.&quot;
            </Text>
            <Text style={styles.feedbackDate}>2 days ago</Text>
          </View>
        </View>

        {/* Goals & Targets */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Goals & Targets</Text>
          <View style={styles.goalsGrid}>
            <View style={styles.goalCard}>
              <Text style={styles.goalTitle}>Monthly Appointments</Text>
              <View style={styles.goalProgress}>
                <View style={styles.goalProgressBar}>
                  <View style={[styles.goalProgressFill, { width: '75%' }]} />
                </View>
                <Text style={styles.goalProgressText}>75%</Text>
              </View>
              <Text style={styles.goalTarget}>Target: 100 appointments</Text>
            </View>
            <View style={styles.goalCard}>
              <Text style={styles.goalTitle}>Patient Satisfaction</Text>
              <View style={styles.goalProgress}>
                <View style={styles.goalProgressBar}>
                  <View style={[styles.goalProgressFill, { width: '95%' }]} />
                </View>
                <Text style={styles.goalProgressText}>95%</Text>
              </View>
              <Text style={styles.goalTarget}>Target: 90% satisfaction</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
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
  exportButton: {
    padding: 8,
  },
  content: {
    padding: 20,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#2196F3',
  },
  periodButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  periodButtonTextActive: {
    color: 'white',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: (width - 60) / 2,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  metricTitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  metricSubtitle: {
    fontSize: 12,
    color: '#999',
  },
  performanceGrid: {
    flexDirection: 'row',
    gap: 15,
  },
  performanceCard: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  performanceGradient: {
    padding: 20,
    alignItems: 'center',
  },
  performanceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 10,
    marginBottom: 5,
  },
  performanceLabel: {
    fontSize: 12,
    color: 'white',
    opacity: 0.9,
  },
  chartCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  chartPlaceholder: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  chartPlaceholderText: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
  },
  feedbackCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  feedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  feedbackPatient: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  feedbackRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedbackRatingText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  feedbackText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 10,
  },
  feedbackDate: {
    fontSize: 12,
    color: '#999',
  },
  goalsGrid: {
    gap: 15,
  },
  goalCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  goalProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  goalProgressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginRight: 10,
  },
  goalProgressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  goalProgressText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  goalTarget: {
    fontSize: 12,
    color: '#666',
  },
});

export default DoctorAnalyticsScreen;


