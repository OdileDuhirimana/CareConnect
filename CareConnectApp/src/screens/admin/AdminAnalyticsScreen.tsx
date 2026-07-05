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
import { DrawerScreenProps } from '@react-navigation/drawer';
import { StackScreenProps } from '@react-navigation/stack';
import { AdminDrawerParamList, RootStackParamList } from '../../navigation/types';

const { width } = Dimensions.get('window');

type Props = CompositeScreenProps<
  DrawerScreenProps<AdminDrawerParamList, 'Analytics'>,
  StackScreenProps<RootStackParamList>
>;

const AdminAnalyticsScreen = ({ navigation }: Props) => {
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  // Illustrative static numbers (see README "Known Limitations" — there is
  // no live analytics aggregation backend yet), so there is intentionally
  // no setter: this is display data, not editable state.
  const [analytics] = useState({
    totalUsers: 1250,
    totalDoctors: 85,
    totalAppointments: 3420,
    totalRevenue: 125000,
    userGrowth: 12.5,
    appointmentGrowth: 8.3,
    revenueGrowth: 15.2,
    systemUptime: 99.5,
  });

  const periods = [
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'quarter', label: 'This Quarter' },
    { id: 'year', label: 'This Year' },
  ];

  const renderMetricCard = (title: string, value: string, subtitle: string, color: string, icon: string, growth?: number) => (
    <View style={styles.metricCard}>
      <View style={styles.metricHeader}>
        <View style={[styles.metricIcon, { backgroundColor: color }]}>
          <Ionicons name={icon as any} size={24} color="white" />
        </View>
        <Text style={styles.metricTitle}>{title}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricSubtitle}>{subtitle}</Text>
      {growth && (
        <View style={styles.growthContainer}>
          <Ionicons name="trending-up" size={16} color="#4CAF50" />
          <Text style={styles.growthText}>+{growth}%</Text>
        </View>
      )}
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
        <Text style={styles.headerTitle}>System Analytics</Text>
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
              'Total Users',
              analytics.totalUsers.toLocaleString(),
              'Registered users',
              '#2196F3',
              'people',
              analytics.userGrowth
            )}
            {renderMetricCard(
              'Active Doctors',
              analytics.totalDoctors.toString(),
              'Verified doctors',
              '#4CAF50',
              'medical'
            )}
            {renderMetricCard(
              'Total Appointments',
              analytics.totalAppointments.toLocaleString(),
              'Completed appointments',
              '#FF9800',
              'calendar',
              analytics.appointmentGrowth
            )}
            {renderMetricCard(
              'Total Revenue',
              `$${analytics.totalRevenue.toLocaleString()}`,
              'Platform earnings',
              '#9C27B0',
              'cash',
              analytics.revenueGrowth
            )}
          </View>
        </View>

        {/* System Performance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Performance</Text>
          <View style={styles.performanceGrid}>
            <View style={styles.performanceCard}>
              <LinearGradient
                colors={['#4CAF50', '#45A049']}
                style={styles.performanceGradient}
              >
                <Ionicons name="shield-checkmark" size={32} color="white" />
                <Text style={styles.performanceValue}>{analytics.systemUptime}%</Text>
                <Text style={styles.performanceLabel}>System Uptime</Text>
              </LinearGradient>
            </View>
            <View style={styles.performanceCard}>
              <LinearGradient
                colors={['#2196F3', '#1976D2']}
                style={styles.performanceGradient}
              >
                <Ionicons name="speedometer" size={32} color="white" />
                <Text style={styles.performanceValue}>2.1s</Text>
                <Text style={styles.performanceLabel}>Avg Response Time</Text>
              </LinearGradient>
            </View>
          </View>
        </View>

        {/* Charts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Analytics & Trends</Text>
          {renderChart('User Growth Over Time')}
          {renderChart('Appointment Trends')}
          {renderChart('Revenue Breakdown')}
          {renderChart('Doctor Performance')}
        </View>

        {/* User Demographics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Demographics</Text>
          <View style={styles.demographicsGrid}>
            <View style={styles.demographicCard}>
              <Text style={styles.demographicTitle}>Age Groups</Text>
              <View style={styles.demographicItem}>
                <Text style={styles.demographicLabel}>18-25</Text>
                <Text style={styles.demographicValue}>25%</Text>
              </View>
              <View style={styles.demographicItem}>
                <Text style={styles.demographicLabel}>26-35</Text>
                <Text style={styles.demographicValue}>35%</Text>
              </View>
              <View style={styles.demographicItem}>
                <Text style={styles.demographicLabel}>36-50</Text>
                <Text style={styles.demographicValue}>28%</Text>
              </View>
              <View style={styles.demographicItem}>
                <Text style={styles.demographicLabel}>50+</Text>
                <Text style={styles.demographicValue}>12%</Text>
              </View>
            </View>
            <View style={styles.demographicCard}>
              <Text style={styles.demographicTitle}>Geographic Distribution</Text>
              <View style={styles.demographicItem}>
                <Text style={styles.demographicLabel}>North America</Text>
                <Text style={styles.demographicValue}>45%</Text>
              </View>
              <View style={styles.demographicItem}>
                <Text style={styles.demographicLabel}>Europe</Text>
                <Text style={styles.demographicValue}>30%</Text>
              </View>
              <View style={styles.demographicItem}>
                <Text style={styles.demographicLabel}>Asia</Text>
                <Text style={styles.demographicValue}>20%</Text>
              </View>
              <View style={styles.demographicItem}>
                <Text style={styles.demographicLabel}>Other</Text>
                <Text style={styles.demographicValue}>5%</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Top Performing Doctors */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Performing Doctors</Text>
          <View style={styles.doctorsList}>
            <View style={styles.doctorItem}>
              <View style={styles.doctorInfo}>
                <Text style={styles.doctorName}>Dr. Sarah Johnson</Text>
                <Text style={styles.doctorSpecialty}>Cardiology</Text>
              </View>
              <View style={styles.doctorStats}>
                <Text style={styles.doctorRating}>4.9</Text>
                <Text style={styles.doctorAppointments}>156 appointments</Text>
              </View>
            </View>
            <View style={styles.doctorItem}>
              <View style={styles.doctorInfo}>
                <Text style={styles.doctorName}>Dr. Michael Chen</Text>
                <Text style={styles.doctorSpecialty}>Neurology</Text>
              </View>
              <View style={styles.doctorStats}>
                <Text style={styles.doctorRating}>4.8</Text>
                <Text style={styles.doctorAppointments}>142 appointments</Text>
              </View>
            </View>
            <View style={styles.doctorItem}>
              <View style={styles.doctorInfo}>
                <Text style={styles.doctorName}>Dr. Emily Davis</Text>
                <Text style={styles.doctorSpecialty}>Pediatrics</Text>
              </View>
              <View style={styles.doctorStats}>
                <Text style={styles.doctorRating}>4.7</Text>
                <Text style={styles.doctorAppointments}>128 appointments</Text>
              </View>
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
  growthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  growthText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 4,
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
  demographicsGrid: {
    flexDirection: 'row',
    gap: 15,
  },
  demographicCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  demographicTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  demographicItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  demographicLabel: {
    fontSize: 14,
    color: '#666',
  },
  demographicValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  doctorsList: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  doctorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  doctorSpecialty: {
    fontSize: 14,
    color: '#666',
  },
  doctorStats: {
    alignItems: 'flex-end',
  },
  doctorRating: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 2,
  },
  doctorAppointments: {
    fontSize: 12,
    color: '#666',
  },
});

export default AdminAnalyticsScreen;


