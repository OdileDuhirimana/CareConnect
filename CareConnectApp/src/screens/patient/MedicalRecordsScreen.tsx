import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StackScreenProps } from '@react-navigation/stack';
import { MedicalRecord } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { fetchMedicalRecordsForPatient, ServiceError } from '../../services';
import { RootStackParamList } from '../../navigation/types';

type Props = StackScreenProps<RootStackParamList, 'MedicalRecords'>;

const MedicalRecordsScreen = ({ navigation }: Props) => {
  const { user } = useAuth();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filters = ['All', 'Prescription', 'Lab Result', 'Scan', 'Vaccination', 'Other'];

  const fetchRecords = useCallback(async () => {
    if (!user?.id) return;
    setErrorMessage(null);
    try {
      const recordsData = await fetchMedicalRecordsForPatient(user.id);
      setRecords(recordsData);
    } catch (error) {
      setErrorMessage(error instanceof ServiceError ? error.message : 'Failed to load medical records.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const getFilteredRecords = () => {
    if (selectedFilter === 'All') return records;
    return records.filter(record => record.type === selectedFilter.toLowerCase().replace(' ', '_'));
  };

  const getRecordIcon = (type: string) => {
    switch (type) {
      case 'prescription': return 'medical';
      case 'lab_result': return 'flask';
      case 'scan': return 'scan';
      case 'vaccination': return 'shield';
      default: return 'document';
    }
  };

  const getRecordColor = (type: string) => {
    switch (type) {
      case 'prescription': return '#4CAF50';
      case 'lab_result': return '#2196F3';
      case 'scan': return '#FF9800';
      case 'vaccination': return '#9C27B0';
      default: return '#666';
    }
  };

  const renderRecord = ({ item }: { item: MedicalRecord }) => (
    <TouchableOpacity style={styles.recordCard}>
      <View style={styles.recordIcon}>
        <Ionicons
          name={getRecordIcon(item.type) as any}
          size={24}
          color={getRecordColor(item.type)}
        />
      </View>
      <View style={styles.recordInfo}>
        <Text style={styles.recordTitle}>{item.title}</Text>
        <Text style={styles.recordDate}>
          {item.date.toLocaleDateString()}
        </Text>
        {item.description && (
          <Text style={styles.recordDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  const renderFilter = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        selectedFilter === item && styles.filterButtonActive,
      ]}
      onPress={() => setSelectedFilter(item)}
    >
      <Text
        style={[
          styles.filterButtonText,
          selectedFilter === item && styles.filterButtonTextActive,
        ]}
      >
        {item}
      </Text>
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color="#2196F3" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Medical Records</Text>
        <TouchableOpacity
          style={styles.addButton}
          accessibilityRole="button"
          accessibilityLabel="Add medical record"
        >
          <Ionicons name="add" size={24} color="#2196F3" />
        </TouchableOpacity>
      </View>

      {errorMessage && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color="#F44336" />
          <Text style={styles.errorBannerText}>{errorMessage}</Text>
        </View>
      )}

      <FlatList
        data={filters}
        renderItem={renderFilter}
        keyExtractor={(item) => item}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersList}
        contentContainerStyle={styles.filtersContainer}
      />

      <FlatList
        data={getFilteredRecords()}
        renderItem={renderRecord}
        keyExtractor={(item) => item.id}
        style={styles.recordsList}
        contentContainerStyle={styles.recordsContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={64} color="#BDBDBD" />
            <Text style={styles.emptyStateTitle}>No records found</Text>
            <Text style={styles.emptyStateText}>
              Your medical records will appear here
            </Text>
          </View>
        }
      />
    </View>
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
  addButton: {
    padding: 8,
  },
  filtersList: {
    backgroundColor: 'white',
    paddingVertical: 15,
  },
  filtersContainer: {
    paddingHorizontal: 20,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 10,
  },
  filterButtonActive: {
    backgroundColor: '#2196F3',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  recordsList: {
    flex: 1,
  },
  recordsContainer: {
    padding: 20,
  },
  recordCard: {
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
  recordIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  recordInfo: {
    flex: 1,
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  recordDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  recordDescription: {
    fontSize: 12,
    color: '#999',
    lineHeight: 16,
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
  },
});

export default MedicalRecordsScreen;


