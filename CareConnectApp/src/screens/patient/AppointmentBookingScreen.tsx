import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Doctor, Appointment } from '../../types';
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');

const AppointmentBookingScreen = ({ navigation, route }: any) => {
  const { doctor } = route.params;
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [appointmentType, setAppointmentType] = useState<'in-person' | 'video'>('video');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  ];

  useEffect(() => {
    if (selectedDate) {
      fetchAvailableSlots();
    }
  }, [selectedDate]);

  const fetchAvailableSlots = async () => {
    try {
      const appointmentsRef = collection(db, 'appointments');
      const q = query(
        appointmentsRef,
        where('doctorId', '==', doctor.id),
        where('date', '==', selectedDate),
        where('status', 'in', ['confirmed', 'pending'])
      );
      
      const querySnapshot = await getDocs(q);
      const bookedSlots = querySnapshot.docs.map(doc => doc.data().time);
      
      const available = timeSlots.filter(slot => !bookedSlots.includes(slot));
      setAvailableSlots(available);
    } catch (error) {
      console.error('Error fetching available slots:', error);
    }
  };

  const handleBookAppointment = async () => {
    if (!selectedDate || !selectedTime || !reason.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const appointmentData: Omit<Appointment, 'id'> = {
        patientId: user?.id ?? '',
        doctorId: doctor.id,
        date: new Date(selectedDate),
        time: selectedTime,
        duration: 30,
        type: appointmentType,
        status: 'pending',
        reason: reason.trim(),
        notes: notes.trim(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await addDoc(collection(db, 'appointments'), appointmentData);
      
      Alert.alert(
        'Success',
        'Appointment request sent! The doctor will confirm your appointment.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to book appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    return maxDate.toISOString().split('T')[0];
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#2196F3" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Appointment</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.doctorInfo}>
        <View style={styles.doctorImageContainer}>
          <Ionicons name="person" size={40} color="#666" />
        </View>
        <View style={styles.doctorDetails}>
          <Text style={styles.doctorName}>{doctor.name}</Text>
          <Text style={styles.doctorSpecialty}>{doctor.specialty}</Text>
          <Text style={styles.doctorHospital}>{doctor.hospital}</Text>
        </View>
        <View style={styles.consultationFee}>
          <Text style={styles.feeText}>${doctor.consultationFee}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appointment Type</Text>
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[
              styles.typeButton,
              appointmentType === 'video' && styles.typeButtonActive,
            ]}
            onPress={() => setAppointmentType('video')}
          >
            <Ionicons
              name="videocam"
              size={24}
              color={appointmentType === 'video' ? 'white' : '#2196F3'}
            />
            <Text
              style={[
                styles.typeButtonText,
                appointmentType === 'video' && styles.typeButtonTextActive,
              ]}
            >
              Video Call
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeButton,
              appointmentType === 'in-person' && styles.typeButtonActive,
            ]}
            onPress={() => setAppointmentType('in-person')}
          >
            <Ionicons
              name="location"
              size={24}
              color={appointmentType === 'in-person' ? 'white' : '#2196F3'}
            />
            <Text
              style={[
                styles.typeButtonText,
                appointmentType === 'in-person' && styles.typeButtonTextActive,
              ]}
            >
              In-Person
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select Date</Text>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowCalendar(true)}
        >
          <Ionicons name="calendar-outline" size={20} color="#2196F3" />
          <Text style={styles.dateButtonText}>
            {selectedDate ? new Date(selectedDate).toLocaleDateString() : 'Choose Date'}
          </Text>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {selectedDate && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Time</Text>
          <View style={styles.timeSlotsContainer}>
            {availableSlots.map((slot) => (
              <TouchableOpacity
                key={slot}
                style={[
                  styles.timeSlot,
                  selectedTime === slot && styles.timeSlotSelected,
                ]}
                onPress={() => setSelectedTime(slot)}
              >
                <Text
                  style={[
                    styles.timeSlotText,
                    selectedTime === slot && styles.timeSlotTextSelected,
                  ]}
                >
                  {slot}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reason for Visit *</Text>
        <TextInput
          style={styles.reasonInput}
          placeholder="Briefly describe your symptoms or reason for the appointment"
          value={reason}
          onChangeText={setReason}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Any additional information you'd like to share with the doctor"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <TouchableOpacity
        style={[styles.bookButton, loading && styles.bookButtonDisabled]}
        onPress={handleBookAppointment}
        disabled={loading}
      >
        <Text style={styles.bookButtonText}>
          {loading ? 'Booking...' : 'Book Appointment'}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={showCalendar}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCalendar(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={(day) => {
                setSelectedDate(day.dateString);
                setShowCalendar(false);
              }}
              minDate={getMinDate()}
              maxDate={getMaxDate()}
              markedDates={{
                [selectedDate]: {
                  selected: true,
                  selectedColor: '#2196F3',
                },
              }}
              theme={{
                selectedDayBackgroundColor: '#2196F3',
                todayTextColor: '#2196F3',
                arrowColor: '#2196F3',
              }}
            />
          </View>
        </View>
      </Modal>
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
  doctorInfo: {
    backgroundColor: 'white',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  doctorImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  doctorDetails: {
    flex: 1,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  doctorSpecialty: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
    marginBottom: 2,
  },
  doctorHospital: {
    fontSize: 14,
    color: '#666',
  },
  consultationFee: {
    alignItems: 'center',
  },
  feeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  section: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  typeSelector: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    padding: 4,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  typeButtonActive: {
    backgroundColor: '#2196F3',
  },
  typeButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: '#2196F3',
  },
  typeButtonTextActive: {
    color: 'white',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  dateButtonText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  timeSlotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timeSlot: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  timeSlotSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  timeSlotText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  timeSlotTextSelected: {
    color: 'white',
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FAFAFA',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FAFAFA',
  },
  bookButton: {
    backgroundColor: '#2196F3',
    margin: 20,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  bookButtonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  bookButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: width * 0.9,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
});

export default AppointmentBookingScreen;


