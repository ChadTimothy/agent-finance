import axios from 'axios';

// Environment-based API configuration
const getApiBaseUrl = () => {
  // For server-side rendering
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  }

  // For local development
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:3001/api';
  }

  // For all other cases (including ngrok), use relative URL
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

export interface ValidationRules {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  [key: string]: unknown;
}

export interface Question {
  question_key: string;
  question_text: string;
  answer_type: string;
  possible_answers?: { label: string; value: string | number | boolean | null }[];
  validation_rules?: ValidationRules;
}

export interface EligibleProduct {
  lender_name: string;
  product_name: string;
  loan_type: string;
  min_loan_amount: number;
  max_loan_amount: number;
  min_term_months: number;
  max_term_months: number;
  base_rate: number;
  worst_case_rate: number;
}

export async function createSession(): Promise<{ sessionId: string; nextQuestion: Question }> {
  const res = await axios.post(`${API_BASE_URL}/sessions`);
  return {
    sessionId: res.data.sessionId,
    nextQuestion: res.data.nextQuestion,
  };
}

export async function submitAnswer(
  sessionId: string,
  questionKey: string,
  answerValue: string | number | boolean | null
): Promise<void> {
  await axios.post(`${API_BASE_URL}/sessions/${sessionId}/answers`, {
    questionKey,
    answerValue,
  });
}

export async function getNextQuestion(sessionId: string): Promise<Question | null> {
  const res = await axios.get(`${API_BASE_URL}/sessions/${sessionId}/next_question`);
  return res.data.nextQuestion || null;
}

export async function getEligibleProducts(sessionId: string): Promise<EligibleProduct[]> {
  const res = await axios.get(`${API_BASE_URL}/sessions/${sessionId}/eligible_products`);
  return res.data.eligibleProducts || [];
}