import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import { ServiceError } from './firestoreHelpers';

/**
 * Client for the `analyzeSymptoms` Cloud Function
 * (functions/src/symptomChecker.ts). This replaces the previous
 * implementation, which was a `setTimeout` returning a hardcoded mock
 * object regardless of user input — a fabricated "AI" feature. The real
 * Gemini call happens server-side so the API key never ships in the app
 * bundle; this file is a thin, typed wrapper around the callable.
 */

export interface SymptomAnalysisRequest {
  symptoms: string;
  durationDescription?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  additionalInfo?: string;
}

export interface PossibleCondition {
  name: string;
  likelihood: 'low' | 'moderate' | 'high';
  description: string;
}

export interface SymptomAnalysisResult {
  possibleConditions: PossibleCondition[];
  recommendations: string[];
  suggestedSpecialists: string[];
  urgency: 'low' | 'medium' | 'high';
  disclaimer: string;
}

export async function analyzeSymptoms(input: SymptomAnalysisRequest): Promise<SymptomAnalysisResult> {
  if (!input.symptoms.trim()) {
    throw new ServiceError('Please describe your symptoms.');
  }

  try {
    const callable = httpsCallable<SymptomAnalysisRequest, SymptomAnalysisResult>(functions, 'analyzeSymptoms');
    const result = await callable(input);
    return result.data;
  } catch (error) {
    throw new ServiceError(
      'Failed to analyze symptoms. Please check your connection and try again.',
      error
    );
  }
}
