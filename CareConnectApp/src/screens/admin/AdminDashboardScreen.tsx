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
  DrawerScreenProps<AdminDrawerParamList, 'Dashboard'>,
  StackScreenProps<RootStackParamList>
>;

const AdminDashboardScreen = ({ navigation }: Props) => {
  // Illustrative static numbers (see README "Known Limitations" — there is
  // no live analytics aggregation backend yet), so there is intentionally
  // no setter: this is display data, not editable state.
  const [dashboardData] = useState({
    totalUsers: 1250,
    totalDoctors: 85,
    totalAppointments: 3420,
    totalRevenue: 125000,
    pendingApprovals: 12,
    systemHealth: 99.5,
  });

  const renderStatCard = (title: string, value: string, subtitle: string, color: string, icon: string) => (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <View style={[styles.statIcon, { backgroundColor: color }]}>
          <Ionicons name={icon as any} size={24} color="white" />
        </View>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statSubtitle}>{subtitle}</Text>
    </View>
  );

  const renderQuickAction = (title: string, subtitle: string, icon: string, color: string, onPress: () => void) => (
    <TouchableOpacity
      style={styles.quickActionCard}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: color }]}>
        <Ionicons name={icon as any} size={24} color="white" />
      </View>
      <Text style={styles.quickActionTitle}>{title}</Text>
      <Text style={styles.quickActionSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <TouchableOpacity
          style={styles.notificationButton}
          accessibilityRole="button"
          accessibilityLabel="View notifications"
        >
          <Ionicons name="notifications-outline" size={24} color="#2196F3" />
          <View style={styles.notificationBadge} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* System Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Overview</Text>
          <View style={styles.statsGrid}>
            {renderStatCard(
              'Total Users',
              dashboardData.totalUsers.toLocaleString(),
              'Registered users',
              '#2196F3',
              'people'
            )}
            {renderStatCard(
              'Active Doctors',
              dashboardData.totalDoctors.toString(),
              'Verified doctors',
              '#4CAF50',
              'medical'
            )}
            {renderStatCard(
              'Total Appointments',
              dashboardData.totalAppointments.toLocaleString(),
              'Completed appointments',
              '#FF9800',
              'calendar'
            )}
            {renderStatCard(
              'Total Revenue',
              `$${dashboardData.totalRevenue.toLocaleString()}`,
              'Platform earnings',
              '#9C27B0',
              'cash'
            )}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {renderQuickAction(
              'Manage Users',
              'View and manage user accounts',
              'people-outline',
              '#2196F3',
              () => navigation.navigate('Users')
            )}
            {renderQuickAction(
              'Doctor Approvals',
              `${dashboardData.pendingApprovals} pending`,
              'checkmark-circle-outline',
              '#FF9800',
              () => {
                // Navigate to approvals
              }
            )}
            {renderQuickAction(
              'System Analytics',
              'View detailed analytics',
              'analytics-outline',
              '#4CAF50',
              () => navigation.navigate('Analytics')
            )}
            {renderQuickAction(
              'Support Tickets',
              'Handle user support',
              'help-circle-outline',
              '#E91E63',
              () => {
                // Navigate to support
              }
            )}
          </View>
        </View>

        {/* System Health */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Health</Text>
          <View style={styles.healthCard}>
            <LinearGradient
              colors={['#4CAF50', '#45A049']}
              style={styles.healthGradient}
            >
              <Ionicons name="shield-checkmark" size={32} color="white" />
              <Text style={styles.healthValue}>{dashboardData.systemHealth}%</Text>
              <Text style={styles.healthLabel}>System Uptime</Text>
            </LinearGradient>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.activityList}>
            <View style={styles.activityItem}>
              <View style={styles.activityIcon}>
                <Ionicons name="person-add" size={16} color="#4CAF50" />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>New doctor registration: Dr. Sarah Johnson</Text>
                <Text style={styles.activityTime}>2 hours ago</Text>
              </View>
            </View>
            <View style={styles.activityItem}>
              <View style={styles.activityIcon}>
                <Ionicons name="checkmark-circle" size={16} color="#2196F3" />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>Doctor approval: Dr. Michael Chen</Text>
                <Text style={styles.activityTime}>4 hours ago</Text>
              </View>
            </View>
            <View style={styles.activityItem}>
              <View style={styles.activityIcon}>
                <Ionicons name="warning" size={16} color="#FF9800" />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>System maintenance scheduled</Text>
                <Text style={styles.activityTime}>6 hours ago</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Pending Approvals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Approvals</Text>
          <View style={styles.approvalCard}>
            <View style={styles.approvalHeader}>
              <Text style={styles.approvalTitle}>Doctor Applications</Text>
              <Text style={styles.approvalCount}>{dashboardData.pendingApprovals}</Text>
            </View>
            <Text style={styles.approvalSubtitle}>
              {dashboardData.pendingApprovals} doctor applications waiting for approval
            </Text>
            <TouchableOpacity
              style={styles.approvalButton}
              accessibilityRole="button"
              accessibilityLabel="Review doctor applications"
            >
              <Text style={styles.approvalButtonText}>Review Applications</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* System Alerts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Alerts</Text>
          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <Ionicons name="information-circle" size={20} color="#2196F3" />
              <Text style={styles.alertTitle}>System Update Available</Text>
            </View>
            <Text style={styles.alertText}>
              A new system update is available. Schedule maintenance window to apply updates.
            </Text>
            <TouchableOpacity
              style={styles.alertButton}
              accessibilityRole="button"
              accessibilityLabel="Schedule system update"
            >
              <Text style={styles.alertButtonText}>Schedule Update</Text>
            </TouchableOpacity>
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
    padding: 20,
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
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
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  statTitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  statSubtitle: {
    fontSize: 12,
    color: '#999',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
    textAlign: 'center',
  },
  quickActionSubtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  healthCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  healthGradient: {
    padding: 30,
    alignItems: 'center',
  },
  healthValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 10,
    marginBottom: 5,
  },
  healthLabel: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
  },
  activityList: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#666',
  },
  approvalCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  approvalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  approvalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  approvalCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  approvalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  approvalButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  approvalButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  alertCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  alertText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    lineHeight: 20,
  },
  alertButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  alertButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default AdminDashboardScreen;


