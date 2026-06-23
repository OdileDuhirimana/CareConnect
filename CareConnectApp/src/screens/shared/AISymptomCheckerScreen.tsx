import React, { useState } from 'react';
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

const { width } = Dimensions.get('window');

const AISymptomCheckerScreen = ({ navigation }: any) => {
  const [symptoms, setSymptoms] = useState('');
  const [duration, setDuration] = useState('');
  const [severity, setSeverity] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const severityOptions = [
    { label: 'Mild', value: 'mild', color: '#4CAF50' },
    { label: 'Moderate', value: 'moderate', color: '#FF9800' },
    { label: 'Severe', value: 'severe', color: '#F44336' },
  ];

  const durationOptions = [
    'Less than 1 day',
    '1-3 days',
    '3-7 days',
    '1-2 weeks',
    'More than 2 weeks',
  ];

  const handleAnalyze = async () => {
    if (!symptoms.trim()) {
      Alert.alert('Error', 'Please describe your symptoms');
      return;
    }

    setLoading(true);
    
    // Simulate AI analysis (in real app, this would call Gemini API)
    setTimeout(() => {
      const mockAnalysis = {
        possibleConditions: [
          {
            name: 'Common Cold',
            probability: 75,
            description: 'Viral infection affecting the upper respiratory tract',
          },
          {
            name: 'Allergic Rhinitis',
            probability: 60,
            description: 'Allergic reaction causing nasal congestion and sneezing',
          },
          {
            name: 'Sinusitis',
            probability: 45,
            description: 'Inflammation of the sinuses',
          },
        ],
        recommendations: [
          'Get plenty of rest and stay hydrated',
          'Use a humidifier to ease congestion',
          'Consider over-the-counter pain relievers',
          'Monitor your temperature regularly',
        ],
        suggestedSpecialists: [
          'General Practitioner',
          'ENT Specialist',
          'Allergist',
        ],
        urgency: severity === 'severe' ? 'high' : severity === 'moderate' ? 'medium' : 'low',
        confidence: 78,
      };
      
      setAnalysis(mockAnalysis);
      setLoading(false);
    }, 2000);
  };

  const renderConditionCard = (condition: any, index: number) => (
    <View key={index} style={styles.conditionCard}>
      <View style={styles.conditionHeader}>
        <Text style={styles.conditionName}>{condition.name}</Text>
        <View style={styles.probabilityContainer}>
          <Text style={styles.probabilityText}>{condition.probability}%</Text>
        </View>
      </View>
      <Text style={styles.conditionDescription}>{condition.description}</Text>
      <View style={styles.probabilityBar}>
        <View
          style={[
            styles.probabilityFill,
            { width: `${condition.probability}%` },
          ]}
        />
      </View>
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
        <Text style={styles.headerTitle}>AI Symptom Checker</Text>
        <View style={styles.placeholder} />
      </View>

      {!analysis ? (
        <View style={styles.formContainer}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Describe Your Symptoms</Text>
            <TextInput
              style={styles.symptomsInput}
              placeholder="Tell us about your symptoms in detail..."
              value={symptoms}
              onChangeText={setSymptoms}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How long have you had these symptoms?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.optionsContainer}>
                {durationOptions.map((option, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.optionButton,
                      duration === option && styles.optionButtonSelected,
                    ]}
                    onPress={() => setDuration(option)}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        duration === option && styles.optionButtonTextSelected,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How severe are your symptoms?</Text>
            <View style={styles.severityContainer}>
              {severityOptions.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.severityButton,
                    severity === option.value && styles.severityButtonSelected,
                    { borderColor: option.color },
                  ]}
                  onPress={() => setSeverity(option.value)}
                >
                  <View style={[styles.severityIndicator, { backgroundColor: option.color }]} />
                  <Text
                    style={[
                      styles.severityButtonText,
                      severity === option.value && styles.severityButtonTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Information (Optional)</Text>
            <TextInput
              style={styles.additionalInput}
              placeholder="Any other relevant information about your health..."
              value={additionalInfo}
              onChangeText={setAdditionalInfo}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.analyzeButton, loading && styles.analyzeButtonDisabled]}
            onPress={handleAnalyze}
            disabled={loading}
          >
            <LinearGradient
              colors={['#2196F3', '#1976D2']}
              style={styles.analyzeButtonGradient}
            >
              <Ionicons name="bulb-outline" size={20} color="white" />
              <Text style={styles.analyzeButtonText}>
                {loading ? 'Analyzing...' : 'Analyze Symptoms'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.resultsContainer}>
          <View style={styles.resultsHeader}>
            <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
            <Text style={styles.resultsTitle}>Analysis Complete</Text>
            <Text style={styles.confidenceText}>
              Confidence: {analysis.confidence}%
            </Text>
          </View>

          <View style={styles.urgencyContainer}>
            <View style={[
              styles.urgencyBadge,
              { backgroundColor: analysis.urgency === 'high' ? '#F44336' : 
                              analysis.urgency === 'medium' ? '#FF9800' : '#4CAF50' }
            ]}>
              <Text style={styles.urgencyText}>
                {analysis.urgency.toUpperCase()} PRIORITY
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Possible Conditions</Text>
            {analysis.possibleConditions.map(renderConditionCard)}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            {analysis.recommendations.map((recommendation: string, index: number) => (
              <View key={index} style={styles.recommendationItem}>
                <Ionicons name="checkmark" size={16} color="#4CAF50" />
                <Text style={styles.recommendationText}>{recommendation}</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Suggested Specialists</Text>
            <View style={styles.specialistsContainer}>
              {analysis.suggestedSpecialists.map((specialist: string, index: number) => (
                <TouchableOpacity
                  key={index}
                  style={styles.specialistButton}
                  onPress={() => navigation.navigate('Doctors', { specialty: specialist })}
                >
                  <Ionicons name="medical-outline" size={20} color="#2196F3" />
                  <Text style={styles.specialistButtonText}>{specialist}</Text>
                  </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.disclaimerContainer}>
            <Ionicons name="warning-outline" size={20} color="#FF9800" />
            <Text style={styles.disclaimerText}>
              This analysis is for informational purposes only and should not replace professional medical advice. Please consult a healthcare provider for proper diagnosis and treatment.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.newAnalysisButton}
            onPress={() => {
              setAnalysis(null);
              setSymptoms('');
              setDuration('');
              setSeverity('');
              setAdditionalInfo('');
            }}
          >
            <Text style={styles.newAnalysisButtonText}>Start New Analysis</Text>
          </TouchableOpacity>
        </View>
      )}
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
  formContainer: {
    padding: 20,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  symptomsInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FAFAFA',
    minHeight: 100,
  },
  optionsContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  optionButtonSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  optionButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  optionButtonTextSelected: {
    color: 'white',
  },
  severityContainer: {
    gap: 10,
  },
  severityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: '#FAFAFA',
  },
  severityButtonSelected: {
    backgroundColor: '#E3F2FD',
  },
  severityIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  severityButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  severityButtonTextSelected: {
    color: '#2196F3',
  },
  additionalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FAFAFA',
    minHeight: 80,
  },
  analyzeButton: {
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  analyzeButtonDisabled: {
    opacity: 0.6,
  },
  analyzeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  analyzeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  resultsContainer: {
    padding: 20,
  },
  resultsHeader: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
    marginBottom: 5,
  },
  confidenceText: {
    fontSize: 14,
    color: '#666',
  },
  urgencyContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  urgencyBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  urgencyText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  conditionCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  conditionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  conditionName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  probabilityContainer: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  probabilityText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  conditionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  probabilityBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  probabilityFill: {
    height: '100%',
    backgroundColor: '#2196F3',
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  recommendationText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 10,
    flex: 1,
  },
  specialistsContainer: {
    gap: 10,
  },
  specialistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 12,
  },
  specialistButtonText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '500',
    marginLeft: 10,
  },
  disclaimerContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#E65100',
    marginLeft: 10,
    flex: 1,
    lineHeight: 16,
  },
  newAnalysisButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  newAnalysisButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AISymptomCheckerScreen;


