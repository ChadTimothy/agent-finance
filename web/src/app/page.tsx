"use client";

import React, { useEffect, useState } from "react";
import {
  createSession,
  submitAnswer,
  getNextQuestion,
  getEligibleProducts,
} from "@/lib/api";
import type { EligibleProduct } from "@/lib/api";

interface LocalQuestion {
  question_key: string;
  question_text: string;
  answer_type: string;
  possible_answers?: { label: string; value: string | number | boolean | null }[];
  validation_rules?: Record<string, unknown>;
  question_group: string;
}

interface QAHistoryItem {
  questionText: string;
  question_group: string;
  answerValue: string | number | boolean | null;
}

interface KnockedOutProduct {
  product: EligibleProduct;
  knockoutQuestion: string;
}


interface AvailableQuestion {
  question_key: string;
  question_text: string;
  answer_type: string;
  possible_answers?: { label: string; value: string | number | boolean | null }[];
  validation_rules?: Record<string, unknown>;
  question_group: string;
  display_priority: number;
  score: number;
}

export default function LoanProductFinder() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<LocalQuestion | null>(null);
  // Removed unused userAnswers state
  const [qaHistory, setQaHistory] = useState<QAHistoryItem[]>([]);
  const [allProducts, setAllProducts] = useState<EligibleProduct[]>([]);
  const [eligibleProducts, setEligibleProducts] = useState<EligibleProduct[]>([]);
  const [knockedOutProducts, setKnockedOutProducts] = useState<KnockedOutProduct[]>([]);
  const [isResultsScreenActive, setIsResultsScreenActive] = useState(false);
  const [status, setStatus] = useState("Initializing...");
  const [availableQuestions, setAvailableQuestions] = useState<AvailableQuestion[]>([]);
  const [candidateQuestionIds, setCandidateQuestionIds] = useState<string[]>([]);

  useEffect(() => {
    async function init() {
      setStatus("Creating session...");
      try {
        const { sessionId, nextQuestion } = await createSession();
        setSessionId(sessionId);
        setCurrentQuestion(nextQuestion as LocalQuestion);
        setStatus("Session created.");
        fetchEligibleProducts(sessionId);
        fetchAvailableQuestions(sessionId);
      } catch (error: unknown) {
        if (error instanceof Error) setStatus(`Error creating session: ${error.message}`);
        else setStatus("Unknown error creating session");
      }
    }
    init();
  }, []);

  async function fetchEligibleProducts(sessionId: string) {
    try {
      const products = await getEligibleProducts(sessionId);
      
      // On first fetch, store all products
      if (allProducts.length === 0) {
        setAllProducts(products);
        setEligibleProducts(products);
        return;
      }

      // Compare with all known products to detect knockouts
      const prevProducts = eligibleProducts;
      // Find products that were previously eligible but aren't in the new list
      const prevProductCount = prevProducts.length;
      const newProductCount = products.length;
      console.log(`Previous products: ${prevProductCount}, New products: ${newProductCount}`);

      const newlyKnockedOut = prevProducts.filter(prev => {
        const isStillEligible = products.some(cur =>
          cur.lender_name === prev.lender_name &&
          cur.product_name === prev.product_name
        );
        if (!isStillEligible) {
          console.log(`Product knocked out: ${prev.lender_name} - ${prev.product_name}`);
        }
        return !isStillEligible;
      });
      
      if (newlyKnockedOut.length > 0) {
        console.log(`${newlyKnockedOut.length} products knocked out by question: ${currentQuestion?.question_text ?? 'Unknown'}`);
        const knockoutQuestion = currentQuestion?.question_text ?? "Unknown question";
        setKnockedOutProducts(prev => [
          ...prev,
          ...newlyKnockedOut.map(product => ({
            product,
            knockoutQuestion
          }))
        ]);
      }
      
      setEligibleProducts(products);
    } catch (error: unknown) {
      console.error(error);
    }
  }

  async function fetchAvailableQuestions(sessionId: string) {
    try {
      const res = await fetch(`http://localhost:3001/api/sessions/${sessionId}/available_questions`);
      const data = await res.json();
      setAvailableQuestions(data.availableQuestions || []);
      setCandidateQuestionIds(data.candidateQuestionIds || []);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleSubmit(answerValue: string | number | boolean | null) {
    if (!sessionId || !currentQuestion) return;
    setStatus("Submitting answer...");
    try {
      await submitAnswer(sessionId, currentQuestion.question_key, answerValue);
      // Removed unused setUserAnswers call
      setQaHistory((prev) => [
        ...prev,
        {
          questionText: currentQuestion.question_text,
          question_group: currentQuestion.question_group,
          answerValue,
        },
      ]);
      fetchEligibleProducts(sessionId);
      fetchAvailableQuestions(sessionId);
      setStatus("Fetching next question...");
      const nextQ = await getNextQuestion(sessionId);
      if (nextQ) {
        setCurrentQuestion(nextQ as LocalQuestion);
        setStatus("Awaiting answer...");
      } else {
        setIsResultsScreenActive(true);
        setStatus("Fetching final results...");
        const products = await getEligibleProducts(sessionId);
        setEligibleProducts(products);
      }
    } catch (error: unknown) {
      if (error instanceof Error) setStatus(`Error submitting answer: ${error.message}`);
      else setStatus("Unknown error submitting answer");
    }
  }

  // Removed toggle products function

  return (
    <main className="flex h-screen">
      {/* Left sidebar: answered questions */}
      <aside className="w-1/4 border-r p-4 overflow-y-auto">
        <h2 className="font-semibold mb-2">Answered Questions</h2>
        <ul className="space-y-2">
          {qaHistory.map((item, idx) => (
            <li key={`${item.questionText}-${idx}`}>
              <div className="font-semibold">Q: {item.questionText}</div>
              <div className="text-xs text-gray-500">Group: {item.question_group}</div>
              <div>A: {JSON.stringify(item.answerValue)}</div>
            </li>
          ))}
        </ul>
      </aside>

      {/* Main content */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        <h1 className="text-2xl font-bold">Loan Product Finder</h1>
        <div className="text-yellow-600">{status}</div>

        {!isResultsScreenActive && currentQuestion && (
          <div className="border p-4 rounded space-y-2">
            <div className="font-semibold">{currentQuestion.question_text}</div>
            <div className="text-xs text-gray-500">Group: {currentQuestion.question_group}</div>
            {currentQuestion.validation_rules && (
              <div className="text-sm text-gray-500">
                Validation:{" "}
                {Object.entries(currentQuestion.validation_rules)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(", ")}
              </div>
            )}

            {currentQuestion.possible_answers && currentQuestion.possible_answers.length > 0 ? (
              <ul className="space-y-2">
                {currentQuestion.possible_answers.map((ans) => (
                  <li key={ans.label}>
                    <button
                      type="button"
                      className="px-3 py-1 border rounded hover:bg-blue-100"
                      onClick={() => handleSubmit(ans.value)}
                    >
                      {ans.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const value = formData.get("answer") as string;
                  let processed: string | number | boolean | null = value;
                  if (currentQuestion.answer_type === "Number") {
                    const num = Number.parseFloat(value);
                    if (!Number.isNaN(num)) processed = num;
                    else {
                      setStatus(`Invalid number: "${value}"`);
                      return;
                    }
                  }
                  handleSubmit(processed);
                }}
                className="space-y-2"
              >
                <input
                  name="answer"
                  className="border p-2 rounded w-full"
                  placeholder="Type your answer"
                />
                <button type="submit" className="px-3 py-1 border rounded hover:bg-blue-100">
                  Submit
                </button>
              </form>
            )}
          </div>
        )}

        {/* Product Results Section */}
        {(isResultsScreenActive || eligibleProducts.length > 0) && (
          <div className="border p-4 rounded space-y-6">
            {/* Summary Header */}
            <div>
              <h2 className="font-semibold mb-2">Product Summary</h2>
              <div className="text-sm text-gray-500 mb-4">
                Initial Products: {allProducts.length} |
                Currently Eligible: {eligibleProducts.length} |
                Eliminated: {knockedOutProducts.length}
              </div>
            </div>

            {/* Product Tables */}
            <div className="space-y-6">
              {/* Eligible Products */}
              <div>
                <h3 className="font-semibold text-green-600 mb-2">Eligible Products</h3>
                {eligibleProducts.length > 0 ? (
                  <table className="w-full border">
                    <thead>
                      <tr>
                        <th className="border px-2">Lender</th>
                        <th className="border px-2">Product</th>
                        <th className="border px-2">Type</th>
                        <th className="border px-2">Min Amt</th>
                        <th className="border px-2">Max Amt</th>
                        <th className="border px-2">Terms</th>
                        <th className="border px-2">Rates</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eligibleProducts.map((p) => (
                        <tr key={`${p.lender_name}-${p.product_name}`} className="text-sm">
                          <td className="border px-2">{p.lender_name}</td>
                          <td className="border px-2">{p.product_name}</td>
                          <td className="border px-2">{p.loan_type}</td>
                          <td className="border px-2">${p.min_loan_amount?.toLocaleString()}</td>
                          <td className="border px-2">${p.max_loan_amount?.toLocaleString()}</td>
                          <td className="border px-2">{p.min_term_months}-{p.max_term_months} months</td>
                          <td className="border px-2">{p.base_rate}% - {p.worst_case_rate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-red-600">No eligible products found.</div>
                )}
              </div>

              {/* Eliminated Products */}
              {knockedOutProducts.length > 0 && (
                <div>
                  <h3 className="font-semibold text-red-600 mb-2">Eliminated Products</h3>
                  <table className="w-full border">
                    <thead>
                      <tr>
                        <th className="border px-2">Lender</th>
                        <th className="border px-2">Product</th>
                        <th className="border px-2">Type</th>
                        <th className="border px-2">Eliminated By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {knockedOutProducts.map(({product: p, knockoutQuestion}) => (
                        <tr key={`${p.lender_name}-${p.product_name}`} className="text-sm">
                          <td className="border px-2 text-red-600">{p.lender_name}</td>
                          <td className="border px-2 text-red-600">{p.product_name}</td>
                          <td className="border px-2 text-red-600">{p.loan_type}</td>
                          <td className="border px-2 text-gray-500">{knockoutQuestion}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right sidebar: available questions */}
      <aside className="w-1/4 border-l p-4 overflow-y-auto">
        <h2 className="font-semibold mb-2">Available Questions</h2>
        <h3 className="font-semibold mb-1">Scored Available Questions</h3>
        <ul className="space-y-2 mb-4">
          {availableQuestions.map((q) => (
            <li key={q.question_key}>
              <div className="font-semibold">{q.question_text}</div>
              <div className="text-xs text-gray-500">Group: {q.question_group}</div>
              <div className="text-sm text-gray-500">
                Score: {q.score.toFixed(2)} | Priority: {q.display_priority}
              </div>
            </li>
          ))}
        </ul>

        <h3 className="font-semibold mb-1">Unanswered Candidate IDs</h3>
        <ul className="space-y-1">
          {candidateQuestionIds.map((id) => (
            <li key={id} className="text-xs">{id}</li>
          ))}
        </ul>
      </aside>
    </main>
  );
}
