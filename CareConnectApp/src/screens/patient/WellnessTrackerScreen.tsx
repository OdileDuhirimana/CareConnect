import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, addDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { WellnessEntry } from '../../types';

const { width } = Dimensions.get('window');

const WellnessTrackerScreen = ({ navigation }: any) => {
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [stress, setStress] = useState(3);
  const [sleepHours, setSleepHours] = useState(8);
  const [exerciseMinutes, setExerciseMinutes] = useState(30);
  const [notes, setNotes] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentEntries, setRecentEntries] = useState<WellnessEntry[]>([]);

  const moodOptions = [
    { label: 'Very Sad', value: 1, emoji: '😢', color: '#F44336' },
    { label: 'Sad', value: 2, emoji: '😔', color: '#FF9800' },
    { label: 'Neutral', value: 3, emoji: '😐', color: '#FFC107' },
    { label: 'Happy', value: 4, emoji: '😊', color: '#4CAF50' },
    { label: 'Very Happy', value: 5, emoji: '😄', color: '#2196F3' },
  ];

  const energyOptions = [
    { label: 'Very Low', value: 1, emoji: '😴', color: '#F44336' },
    { label: 'Low', value: 2, emoji: '😑', color: '#FF9800' },
    { label: 'Moderate', value: 3, emoji: '😌', color: '#FFC107' },
    { label: 'High', value: 4, emoji: '😃', color: '#4CAF50' },
    { label: 'Very High', value: 5, emoji: '🚀', color: '#2196F3' },
  ];

  const stressOptions = [
    { label: 'Very Low', value: 1, emoji: '😌', color: '#4CAF50' },
    { label: 'Low', value: 2, emoji: '😊', color: '#8BC34A' },
    { label: 'Moderate', value: 3, emoji: '😐', color: '#FFC107' },
    { label: 'High', value: 4, emoji: '😰', color: '#FF9800' },
    { label: 'Very High', value: 5, emoji: '😱', color: '#F44336' },
  ];

  const commonSymptoms = [
    'Headache', 'Fatigue', 'Nausea', 'Dizziness', 'Chest Pain',
    'Shortness of Breath', 'Muscle Pain', 'Joint Pain', 'Fever',
    'Cough', 'Sore Throat', 'Runny Nose', 'Insomnia', 'Anxiety',
  ];

  useEffect(() => {
    fetchRecentEntries();
  }, []);

  const fetchRecentEntries = async () => {
    try {
      const entriesRef = collection(db, 'wellness_entries');
      const q = query(
        entriesRef,
        where('userId', '==', 'current-user-id'), // This should come from auth context
        orderBy('date', 'desc'),
        limit(7)
      );
      
      const querySnapshot = await getDocs(q);
      const entries = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate(),
      })) as WellnessEntry[];
      
      setRecentEntries(entries);
    } catch (error) {
      console.error('Error fetching wellness entries:', error);
    }
  };

  const handleSaveEntry = async () => {
    if (!mood || !energy || !stress) {
      Alert.alert('Error', 'Please rate your mood, energy, and stress levels');
      return;
    }

    setLoading(true);
    try {
      const entryData: Omit<WellnessEntry, 'id'> = {
        userId: 'current-user-id', // This should come from auth context
        date: new Date(),
        mood,
        energy,
        stress,
        sleepHours,
        exerciseMinutes,
        notes: notes.trim(),
        symptoms,
      };

      await addDoc(collection(db, 'wellness_entries'), entryData);
      
      Alert.alert('Success', 'Wellness entry saved successfully!');
      setNotes('');
      setSymptoms([]);
      fetchRecentEntries();
    } catch (error) {
      Alert.alert('Error', 'Failed to save wellness entry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSymptom = (symptom: string) => {
    setSymptoms(prev => 
      prev.includes(symptom) 
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  const renderRatingSelector = (
    title: string,
    value: number,
    options: any[],
    onValueChange: (value: number) => void
  ) => (
    <View style={styles.ratingSection}>
      <Text style={styles.ratingTitle}>{title}</Text>
      <View style={styles.ratingContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.ratingButton,
              value === option.value && styles.ratingButtonSelected,
              { borderColor: option.color },
            ]}
            onPress={() => onValueChange(option.value)}
          >
            <Text style={styles.ratingEmoji}>{option.emoji}</Text>
            <Text style={[
              styles.ratingLabel,
              value === option.value && styles.ratingLabelSelected,
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderRecentEntry = (entry: WellnessEntry) => (
    <View key={entry.id} style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <Text style={styles.entryDate}>
          {entry.date.toLocaleDateString()}
        </Text>
        <View style={styles.entryMood}>
          {moodOptions.find(m => m.value === entry.mood)?.emoji}
        </View>
      </View>
      <View style={styles.entryStats}>
        <View style={styles.statItem}>
          <Ionicons name="heart" size={16} color="#E91E63" />
          <Text style={styles.statText}>Mood: {entry.mood}/5</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="flash" size={16} color="#FF9800" />
          <Text style={styles.statText}>Energy: {entry.energy}/5</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="trending-up" size={16} color="#F44336" />
          <Text style={styles.statText}>Stress: {entry.stress}/5</Text>
        </View>
      </View>
      {entry.symptoms && entry.symptoms.length > 0 && (
        <View style={styles.entrySymptoms}>
          <Text style={styles.symptomsLabel}>Symptoms:</Text>
          <Text style={styles.symptomsText}>{entry.symptoms.join(', ')}</Text>
        </View>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#2196F3" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wellness Tracker</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How are you feeling today?</Text>
          
          {renderRatingSelector('Mood', mood, moodOptions, setMood)}
          {renderRatingSelector('Energy Level', energy, energyOptions, setEnergy)}
          {renderRatingSelector('Stress Level', stress, stressOptions, setStress)}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sleep & Exercise</Text>
          
          <View style={styles.inputRow}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Sleep Hours</Text>
              <View style={styles.numberInputContainer}>
                <TouchableOpacity
                  style={styles.numberButton}
                  onPress={() => setSleepHours(Math.max(0, sleepHours - 0.5))}
                >
                  <Ionicons name="remove" size={20} color="#666" />
                </TouchableOpacity>
                <Text style={styles.numberInput}>{sleepHours}</Text>
                <TouchableOpacity
                  style={styles.numberButton}
                  onPress={() => setSleepHours(Math.min(24, sleepHours + 0.5))}
                >
                  <Ionicons name="add" size={20} color="#666" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Exercise (minutes)</Text>
              <View style={styles.numberInputContainer}>
                <TouchableOpacity
                  style={styles.numberButton}
                  onPress={() => setExerciseMinutes(Math.max(0, exerciseMinutes - 15))}
                >
                  <Ionicons name="remove" size={20} color="#666" />
                </TouchableOpacity>
                <Text style={styles.numberInput}>{exerciseMinutes}</Text>
                <TouchableOpacity
                  style={styles.numberButton}
                  onPress={() => setExerciseMinutes(Math.min(300, exerciseMinutes + 15))}
                >
                  <Ionicons name="add" size={20} color="#666" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Any symptoms today?</Text>
          <View style={styles.symptomsGrid}>
            {commonSymptoms.map((symptom) => (
              <TouchableOpacity
                key={symptom}
                style={[
                  styles.symptomButton,
                  symptoms.includes(symptom) && styles.symptomButtonSelected,
                ]}
                onPress={() => toggleSymptom(symptom)}
              >
                <Text style={[
                  styles.symptomButtonText,
                  symptoms.includes(symptom) && styles.symptomButtonTextSelected,
                ]}>
                  {symptom}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="How are you feeling? Any other observations..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSaveEntry}
          disabled={loading}
        >
          <LinearGradient
            colors={['#4CAF50', '#45A049']}
            style={styles.saveButtonGradient}
          >
            <Ionicons name="checkmark" size={20} color="white" />
            <Text style={styles.saveButtonText}>
              {loading ? 'Saving...' : 'Save Entry'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {recentEntries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Entries</Text>
            {recentEntries.map(renderRecentEntry)}
          </View>
        )}
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
  placeholder: {
    width: 40,
  },
  content: {
    padding: 20,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  ratingSection: {
    marginBottom: 25,
  },
  ratingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ratingButton: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
    minWidth: 60,
  },
  ratingButtonSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  ratingEmoji: {
    fontSize: 24,
    marginBottom: 5,
  },
  ratingLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
  },
  ratingLabelSelected: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  inputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 10,
  },
  numberInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  numberButton: {
    padding: 5,
  },
  numberInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  symptomsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  symptomButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  symptomButtonSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  symptomButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  symptomButtonTextSelected: {
    color: '#2196F3',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FAFAFA',
    minHeight: 80,
  },
  saveButton: {
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  entryCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
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
    marginLeft: 5,
  },
  entrySymptoms: {
    marginTop: 10,
  },
  symptomsLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  symptomsText: {
    fontSize: 12,
    color: '#333',
    marginTop: 2,
  },
});

export default WellnessTrackerScreen;


