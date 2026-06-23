import React, { useState, useEffect } from 'react';
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
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { WellnessEntry, MedicalRecord } from '../../types';

const { width } = Dimensions.get('window');

const HealthDashboardScreen = ({ navigation }: any) => {
  const [wellnessEntries, setWellnessEntries] = useState<WellnessEntry[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealthData();
  }, []);

  const fetchHealthData = async () => {
    try {
      // Fetch wellness entries
      const wellnessRef = collection(db, 'wellness_entries');
      const wellnessQuery = query(
        wellnessRef,
        where('userId', '==', 'current-user-id'), // This should come from auth context
        orderBy('date', 'desc'),
        limit(7)
      );
      
      const wellnessSnapshot = await getDocs(wellnessQuery);
      const wellnessData = wellnessSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate(),
      })) as WellnessEntry[];
      
      setWellnessEntries(wellnessData);

      // Fetch medical records
      const recordsRef = collection(db, 'medical_records');
      const recordsQuery = query(
        recordsRef,
        where('patientId', '==', 'current-user-id'), // This should come from auth context
        orderBy('date', 'desc'),
        limit(5)
      );
      
      const recordsSnapshot = await getDocs(recordsQuery);
      const recordsData = recordsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate(),
        createdAt: doc.data().createdAt.toDate(),
      })) as MedicalRecord[];
      
      setMedicalRecords(recordsData);
    } catch (error) {
      console.error('Error fetching health data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAverageMood = () => {
    if (wellnessEntries.length === 0) return 0;
    const sum = wellnessEntries.reduce((acc, entry) => acc + entry.mood, 0);
    return (sum / wellnessEntries.length).toFixed(1);
  };

  const getAverageEnergy = () => {
    if (wellnessEntries.length === 0) return 0;
    const sum = wellnessEntries.reduce((acc, entry) => acc + entry.energy, 0);
    return (sum / wellnessEntries.length).toFixed(1);
  };

  const getAverageStress = () => {
    if (wellnessEntries.length === 0) return 0;
    const sum = wellnessEntries.reduce((acc, entry) => acc + entry.stress, 0);
    return (sum / wellnessEntries.length).toFixed(1);
  };

  const getAverageSleep = () => {
    if (wellnessEntries.length === 0) return 0;
    const sum = wellnessEntries.reduce((acc, entry) => acc + entry.sleepHours, 0);
    return (sum / wellnessEntries.length).toFixed(1);
  };

  const getHealthScore = () => {
    const mood = parseFloat(getAverageMood());
    const energy = parseFloat(getAverageEnergy());
    const stress = parseFloat(getAverageStress());
    const sleep = parseFloat(getAverageSleep());
    
    if (mood === 0) return 0;
    
    // Calculate health score based on various factors
    const score = ((mood + energy + (5 - stress) + (sleep / 8) * 5) / 4) * 20;
    return Math.min(100, Math.max(0, score)).toFixed(0);
  };

  const renderHealthMetric = (title: string, value: string, icon: string, color: string) => (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: color }]}>
        <Ionicons name={icon as any} size={24} color="white" />
      </View>
      <View style={styles.metricInfo}>
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricTitle}>{title}</Text>
      </View>
    </View>
  );

  const renderWellnessEntry = (entry: WellnessEntry) => (
    <View key={entry.id} style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <Text style={styles.entryDate}>
          {entry.date.toLocaleDateString()}
        </Text>
        <View style={styles.entryMood}>
          {entry.mood === 1 ? '😢' : entry.mood === 2 ? '😔' : 
           entry.mood === 3 ? '😐' : entry.mood === 4 ? '😊' : '😄'}
        </View>
      </View>
      <View style={styles.entryStats}>
        <View style={styles.statItem}>
          <Ionicons name="heart" size={14} color="#E91E63" />
          <Text style={styles.statText}>{entry.mood}/5</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="flash" size={14} color="#FF9800" />
          <Text style={styles.statText}>{entry.energy}/5</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="trending-up" size={14} color="#F44336" />
          <Text style={styles.statText}>{entry.stress}/5</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="moon" size={14} color="#9C27B0" />
          <Text style={styles.statText}>{entry.sleepHours}h</Text>
        </View>
      </View>
    </View>
  );

  const renderMedicalRecord = (record: MedicalRecord) => (
    <TouchableOpacity key={record.id} style={styles.recordCard}>
      <View style={styles.recordIcon}>
        <Ionicons
          name={
            record.type === 'prescription' ? 'medical' :
            record.type === 'lab_result' ? 'flask' :
            record.type === 'scan' ? 'scan' : 'document'
          }
          size={20}
          color="#2196F3"
        />
      </View>
      <View style={styles.recordInfo}>
        <Text style={styles.recordTitle}>{record.title}</Text>
        <Text style={styles.recordDate}>
          {record.date.toLocaleDateString()}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#666" />
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Health Dashboard</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={fetchHealthData}
        >
          <Ionicons name="refresh" size={24} color="#2196F3" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Health Score */}
        <View style={styles.healthScoreContainer}>
          <LinearGradient
            colors={['#4CAF50', '#45A049']}
            style={styles.healthScoreCard}
          >
            <Text style={styles.healthScoreTitle}>Health Score</Text>
            <Text style={styles.healthScoreValue}>{getHealthScore()}</Text>
            <Text style={styles.healthScoreSubtitle}>Based on your recent entries</Text>
          </LinearGradient>
        </View>

        {/* Health Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Health Metrics</Text>
          <View style={styles.metricsGrid}>
            {renderHealthMetric('Mood', getAverageMood(), 'heart', '#E91E63')}
            {renderHealthMetric('Energy', getAverageEnergy(), 'flash', '#FF9800')}
            {renderHealthMetric('Stress', getAverageStress(), 'trending-up', '#F44336')}
            {renderHealthMetric('Sleep', `${getAverageSleep()}h`, 'moon', '#9C27B0')}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('WellnessTracker')}
            >
              <Ionicons name="heart-outline" size={32} color="#E91E63" />
              <Text style={styles.quickActionTitle}>Log Wellness</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('MedicalRecords')}
            >
              <Ionicons name="document-outline" size={32} color="#2196F3" />
              <Text style={styles.quickActionTitle}>View Records</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('AISymptomChecker')}
            >
              <Ionicons name="bulb-outline" size={32} color="#FF9800" />
              <Text style={styles.quickActionTitle}>Symptom Check</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('Doctors')}
            >
              <Ionicons name="medical-outline" size={32} color="#4CAF50" />
              <Text style={styles.quickActionTitle}>Find Doctor</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Wellness Entries */}
        {wellnessEntries.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Wellness</Text>
              <TouchableOpacity onPress={() => navigation.navigate('WellnessTracker')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            {wellnessEntries.slice(0, 3).map(renderWellnessEntry)}
          </View>
        )}

        {/* Recent Medical Records */}
        {medicalRecords.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Records</Text>
              <TouchableOpacity onPress={() => navigation.navigate('MedicalRecords')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            {medicalRecords.slice(0, 3).map(renderMedicalRecord)}
          </View>
        )}

        {/* Health Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Health Tips</Text>
          <View style={styles.tipCard}>
            <Ionicons name="bulb-outline" size={24} color="#FF9800" />
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Stay Hydrated</Text>
              <Text style={styles.tipDescription}>
                Drink at least 8 glasses of water daily to maintain optimal health and energy levels.
              </Text>
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
  refreshButton: {
    padding: 8,
  },
  content: {
    padding: 20,
  },
  healthScoreContainer: {
    marginBottom: 20,
  },
  healthScoreCard: {
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
  },
  healthScoreTitle: {
    fontSize: 18,
    color: 'white',
    fontWeight: '500',
    marginBottom: 10,
  },
  healthScoreValue: {
    fontSize: 48,
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  healthScoreSubtitle: {
    fontSize: 14,
    color: 'white',
    opacity: 0.9,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  seeAllText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  metricInfo: {
    flex: 1,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  metricTitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginTop: 8,
    textAlign: 'center',
  },
  entryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  entryDate: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  entryMood: {
    fontSize: 20,
  },
  entryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  recordCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  recordIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recordInfo: {
    flex: 1,
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  recordDate: {
    fontSize: 12,
    color: '#666',
  },
  tipCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tipContent: {
    flex: 1,
    marginLeft: 15,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  tipDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default HealthDashboardScreen;


