import express from 'express';
import { body, param, validationResult } from 'express-validator'; // Added param
import { createSession, updateSessionState, getSessionState } from '../services/sessionService.js';
import { selectNextQuestion, filterProducts } from '../services/ruleService.js';
import supabase from '../db/supabaseClient.js'; // Needed for PATCH route's product ID fetch & validation

const router = express.Router();

// --- Helper Function for Answer Validation ---
/**
 * Validates the type of an answer against the question definition.
 * @param {string} questionKey - The key of the question being answered.
 * @param {any} answerValue - The value provided by the user.
 * @returns {Promise<{isValid: boolean, message?: string}>} - Validation result.
 */
async function validateAnswer(questionKey, answerValue) {
  // Fetch question details for validation
  const { data: questionData, error: questionError } = await supabase
    .from('questions')
    .select('answer_type, validation_rules') // Select needed fields
    .eq('question_key', questionKey)
    .single();

  if (questionError || !questionData) {
    console.error(`Validation Error: Question with key '${questionKey}' not found.`);
    // Let the caller decide on 400 vs 404 based on context
    return { isValid: false, message: `Question with key '${questionKey}' not found.` };
  }

  // Basic Answer Type Validation (Expand later with validation_rules)
  const expectedType = questionData.answer_type;
  const receivedType = typeof answerValue;
  let isValid = false;
  let validationMessage = '';

  switch (expectedType) {
    case 'Number':
      isValid = receivedType === 'number';
      if (!isValid && receivedType === 'string') {
        const num = Number.parseFloat(answerValue);
        isValid = !Number.isNaN(num); // Allow valid numeric strings
      }
      break;
    case 'String':
      isValid = receivedType === 'string';
      break;
    case 'Boolean':
      isValid = receivedType === 'boolean';
      break;
    case 'List_String':
    case 'List_Number':
      isValid = Array.isArray(answerValue);
      // TODO: Add checks for element types within the array later
      break;
    default:
      console.warn(`Unknown expected answer type '${expectedType}' for question key '${questionKey}'. Skipping type validation.`);
      isValid = true; // Skip validation for unknown types for now
  }

  if (!isValid) {
    validationMessage = `Invalid answerValue type for questionKey '${questionKey}'. Expected ${expectedType} but received ${receivedType}.`;
  }
  // If basic type validation passed, apply specific rules from validation_rules
  if (isValid && questionData.validation_rules && typeof questionData.validation_rules === 'object') {
    const rules = questionData.validation_rules;
    let valueToValidate = answerValue;

    // Coerce string to number if expected type is Number for min/max checks
    if (expectedType === 'Number' && typeof valueToValidate === 'string') {
        valueToValidate = Number.parseFloat(valueToValidate);
        // No need to check isNaN again, as the initial type check allows valid numeric strings
    }

    for (const ruleKey in rules) {
      const ruleValue = rules[ruleKey];

      switch (ruleKey) {
        case 'minLength':
          if (typeof valueToValidate !== 'string' || valueToValidate.length < ruleValue) {
            isValid = false;
            validationMessage = `Answer for ${questionKey} must be at least ${ruleValue} characters long.`;
            console.log(`DEBUG validateAnswer: ${questionKey} failed minLength ${ruleValue}. Value: '${valueToValidate}'`);
          }
          break;
        case 'maxLength':
          if (typeof valueToValidate !== 'string' || valueToValidate.length > ruleValue) {
            isValid = false;
            validationMessage = `Answer for ${questionKey} must be no more than ${ruleValue} characters long.`;
            console.log(`DEBUG validateAnswer: ${questionKey} failed maxLength ${ruleValue}. Value: '${valueToValidate}'`);
          }
          break;
        case 'pattern':
          if (typeof valueToValidate !== 'string' || !new RegExp(ruleValue).test(valueToValidate)) {
            isValid = false;
            validationMessage = `Answer for ${questionKey} must match the required format.`; // Generic message for regex
            console.log(`DEBUG validateAnswer: ${questionKey} failed pattern ${ruleValue}. Value: '${valueToValidate}'`);
          }
          break;
        case 'min':
          if (typeof valueToValidate !== 'number' || valueToValidate < ruleValue) {
            isValid = false;
            validationMessage = `Answer for ${questionKey} must be at least ${ruleValue}.`;
            console.log(`DEBUG validateAnswer: ${questionKey} failed min ${ruleValue}. Value: ${valueToValidate}`);
          }
          break;
        case 'max':
          if (typeof valueToValidate !== 'number' || valueToValidate > ruleValue) {
            isValid = false;
            validationMessage = `Answer for ${questionKey} must be no more than ${ruleValue}.`;
            console.log(`DEBUG validateAnswer: ${questionKey} failed max ${ruleValue}. Value: ${valueToValidate}`);
          }
          break;
        case 'enum':
          if (!Array.isArray(ruleValue) || !ruleValue.includes(valueToValidate)) {
            isValid = false;
            validationMessage = `Answer for ${questionKey} must be one of the allowed values: ${ruleValue.join(', ')}.`;
            console.log(`DEBUG validateAnswer: ${questionKey} failed enum ${JSON.stringify(ruleValue)}. Value: '${valueToValidate}'`);
          }
          break;
        // Add more rule cases as needed
        default:
          console.warn(`Unknown validation rule key '${ruleKey}' for question ${questionKey}.`);
      }

      // Stop checking rules if one fails
      if (!isValid) break;
    }
  }


  // TODO: Implement more complex validation using questionData.validation_rules (e.g., min/max, regex)

  return { isValid, message: validationMessage };
}


/**
 * POST /sessions
 * Creates a new user session, gets the initial list of products,
 * selects the first question, and returns the session ID and first question.
 */
router.post('/sessions', async (req, res, next) => {
  try {
    // 1. Create the session
    const sessionId = await createSession();

    // 2. Retrieve the initial state needed for selectNextQuestion
    const initialState = await getSessionState(sessionId);
    if (!initialState) {
        const err = new Error('Internal Server Error: Failed to retrieve state immediately after session creation.');
        err.statusCode = 500;
        return next(err); // Pass to global error handler
    }

    // 3. Select the first question
    const firstQuestion = await selectNextQuestion(
      initialState.potential_product_ids,
      initialState.user_answers, // Should be {}
      null // No last asked group initially
    );

    // 4. Update session state with the group of the first question asked (if any)
    if (firstQuestion) {
      await updateSessionState(sessionId, { last_asked_question_group: firstQuestion.question_group });
    }

    // 5. Return response
    console.log(`DEBUG: Sending response for POST /sessions. nextQuestion.question_key = ${firstQuestion?.question_key}`);

    res.status(201).json({
      sessionId: sessionId,
      nextQuestion: firstQuestion // Send the first question object (or null if none)
    });

  } catch (error) {
    console.error('Error in POST /sessions:', error);
    next(error); // Pass error to the global error handler
  }
});


/**
 * GET /sessions/:sessionId/next_question
 * Retrieves the current session state and selects the next question to ask.
 */
router.get('/sessions/:sessionId/next_question', async (req, res, next) => {
  const { sessionId } = req.params;
  console.log('[next_question] Incoming request for sessionId:', sessionId);

  try {
    // 1. Get current session state
    const currentState = await getSessionState(sessionId);
    console.log('[next_question] Current session state:', currentState);
    if (!currentState) {
      // If session not found, return 404 with a user-friendly message
      return res.status(404).json({ error: { message: `Session with ID '${sessionId}' not found.` } });
    }

    // Handle case where session might be completed or abandoned
    if (currentState.status !== 'active') {
        // Return 400 Bad Request as the session state prevents this action
        return res.status(400).json({ error: { message: `Cannot get next question for session with status '${currentState.status}'. Session must be active.` }, nextQuestion: null });
    }

    // 2. Select the next question
    console.log('[next_question] Calling selectNextQuestion with potential_product_ids:', currentState.potential_product_ids, ', user_answers:', currentState.user_answers, ', last_asked_question_group:', currentState.last_asked_question_group);
    const nextQuestion = await selectNextQuestion(
      currentState.potential_product_ids,
      currentState.user_answers,
      currentState.last_asked_question_group
    );
    console.log('[next_question] selectNextQuestion returned:', nextQuestion);

    // 3. Update session state with the group of the question being asked (if any)
    if (nextQuestion) {
      // Restore the state update
      await updateSessionState(sessionId, { last_asked_question_group: nextQuestion.question_group });
    } else {
      // Optional: If no next question, update session status to 'completed'
      await updateSessionState(sessionId, { status: 'completed' });
      console.log(`Session ${sessionId} marked as completed.`);
    }

    // 4. Return the next question (or null if finished)
    console.log('[next_question] Responding with nextQuestion:', nextQuestion);
    res.status(200).json({ nextQuestion });

  } catch (error) {
    console.error(`Error in GET /sessions/${sessionId}/next_question:`, error);
    next(error);
  }
});


// Define validation rules for the POST /answers request body
const postAnswerValidationRules = [
  body('questionKey').isString().notEmpty().withMessage('questionKey must be a non-empty string'),
  body('answerValue').exists({ checkNull: true, checkFalsy: false }).withMessage('answerValue must exist')
];

/**
 * POST /sessions/:sessionId/answers
 * Submits an answer for a question, updates session state, and re-filters products.
 */
router.post('/sessions/:sessionId/answers',
  postAnswerValidationRules, // Apply validation rules
  async (req, res, next) => {
    // Check for validation errors first (from express-validator)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const formattedErrors = errors.array().map(err => ({ field: err.path, message: err.msg }));
      return res.status(400).json({ errors: formattedErrors });
    }

    const { sessionId } = req.params;
    const { questionKey, answerValue } = req.body; // Values already validated by middleware

    try {
      // 1. Get current session state
      const currentState = await getSessionState(sessionId);
      if (!currentState) {
        return res.status(404).json({ error: { message: `Session with ID '${sessionId}' not found.` } });
      }
      if (currentState.status !== 'active') {
          return res.status(400).json({ error: { message: `Cannot submit answers for session with status '${currentState.status}'. Session must be active.` } });
      }

      // 2. Validate the incoming answer type using helper
      const validationResult = await validateAnswer(questionKey, answerValue);
      if (!validationResult.isValid) {
        const message = validationResult.message || 'Invalid answer provided.';
        // If question not found or type mismatch, it's a client error -> 400
        // Include more detail in the 400 error response for easier debugging
        return res.status(400).json({
          error: {
            message,
            questionKey: questionKey, // Add failing key
            answerValue: answerValue   // Add failing value
          }
        });
      }

      console.log(`DEBUG POST /answers: Product IDs BEFORE filtering: [${currentState.potential_product_ids?.join(', ')}] for answer ${questionKey}=${JSON.stringify(answerValue)}`);
      // 3. Update userAnswers
      const updatedAnswers = {
        ...currentState.user_answers,
        [questionKey]: answerValue
      };

      // 4. Re-filter products based on the *updated* set of answers
      const filteredProductIds = await filterProducts(
        currentState.potential_product_ids,
        updatedAnswers // Use the newly updated answers
      );

      // --- Detailed Logging of Filtering Step ---
      console.log(`[FILTERING] Session: ${sessionId}`);
      console.log(`          Answer: ${questionKey} = ${JSON.stringify(answerValue)}`);
      console.log(`          Products BEFORE: [${currentState.potential_product_ids?.join(', ')}]`);
      console.log(`          Products AFTER:  [${filteredProductIds?.join(', ')}]`);
      // --- End Detailed Logging ---

      console.log(`DEBUG POST /answers: Product IDs AFTER filtering: [${filteredProductIds?.join(', ')}]`);
      // 5. Update session state in DB
      const updateData = {
        user_answers: updatedAnswers,
        potential_product_ids: filteredProductIds
      };
      await updateSessionState(sessionId, updateData);

      // 6. Return success
      res.status(200).json({ success: true, message: 'Answer submitted successfully.' });

    } catch (error) {
      console.error(`Error in POST /sessions/${sessionId}/answers:`, error);
      next(error);
    }
});


// Define validation rules for the PATCH request
const patchAnswerValidationRules = [
  param('questionKey').isString().notEmpty().withMessage('questionKey URL parameter must be a non-empty string'),
  body('answerValue').exists({ checkNull: true, checkFalsy: false }).withMessage('answerValue must exist in request body')
];

/**
 * PATCH /sessions/:sessionId/answers/:questionKey
 * Updates a specific previous answer, resets potential products, and re-filters.
 */
router.patch('/sessions/:sessionId/answers/:questionKey',
  patchAnswerValidationRules, // Apply validation rules
  async (req, res, next) => {
    // Check for validation errors first
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const formattedErrors = errors.array().map(err => ({ field: err.param || err.path, message: err.msg }));
      return res.status(400).json({ errors: formattedErrors });
    }

    const { sessionId, questionKey } = req.params; // questionKey validated by middleware
    const { answerValue } = req.body; // answerValue validated by middleware

    try {
      // 1. Get current session state
      const currentState = await getSessionState(sessionId);
      if (!currentState) {
        return res.status(404).json({ error: { message: `Session with ID '${sessionId}' not found.` } });
      }
       if (currentState.status !== 'active') {
          return res.status(400).json({ error: { message: `Cannot update answers for session with status '${currentState.status}'. Session must be active.` } });
      }

      // 2. Validate the incoming answer type using helper
      const validationResult = await validateAnswer(questionKey, answerValue);
      if (!validationResult.isValid) {
        const message = validationResult.message || 'Invalid answer provided.';
        // If question not found, return 404 as key is in URL path
        // If type mismatch, return 400
        const statusCode = message.includes('not found') ? 404 : 400;
        return res.status(statusCode).json({ error: { message } });
      }

      // 3. Update the specific answer
      const updatedAnswers = {
        ...currentState.user_answers,
        [questionKey]: answerValue
      };

      // 4. Reset potential products to baseline (fetch all initial product IDs again)
      console.log(`Resetting product list for session ${sessionId} due to answer change...`);
      const { data: allProducts, error: productFetchError } = await supabase
          .from('products')
          .select('product_id');
      if (productFetchError) {
          console.error('PATCH Error: Failed to fetch baseline product IDs:', productFetchError);
          throw new Error('Could not fetch baseline product list.'); // Let global handler catch this
      }
      const initialProductIds = allProducts ? allProducts.map(p => p.product_id) : [];

      // 5. Re-filter products from baseline using the fully updated answers
      const filteredProductIds = await filterProducts(
        initialProductIds, // Start from all products
        updatedAnswers   // Use the fully updated answer set
      );

      // 6. Update session state in DB
      const updateData = {
        user_answers: updatedAnswers,
        potential_product_ids: filteredProductIds
      };
      await updateSessionState(sessionId, updateData);

      // 7. Return success
      res.status(200).json({ success: true, message: 'Answer updated successfully.' });

    } catch (error) {
      console.error(`Error in PATCH /sessions/${sessionId}/answers/${questionKey}:`, error);
      next(error);
    }
});


/**
 * GET /sessions/:sessionId/eligible_products
 * Retrieves the list of currently eligible product IDs for the session.
 */
router.get('/sessions/:sessionId/eligible_products', async (req, res, next) => {
  const { sessionId } = req.params;

  try {
    // 1. Get current session state
    const currentState = await getSessionState(sessionId);
    if (!currentState) {
      return res.status(404).json({ error: { message: `Session with ID '${sessionId}' not found.` } });
    }

    // 2. Fetch details for the potential product IDs
    const eligibleProductIds = currentState.potential_product_ids || [];
    let eligibleProductsDetails = [];

    if (eligibleProductIds.length > 0) {
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select(`
          product_id,
          product_name,
          loan_type,
          min_loan_amount,
          max_loan_amount,
          min_term_months,
          max_term_months,
          base_rate,
          worst_case_rate,
          notes,
          lenders ( lender_id, lender_name ) 
        `)
        .in('product_id', eligibleProductIds);

      if (productsError) {
        console.error(`Error fetching product details for session ${sessionId}:`, productsError);
        // Don't fail the request, just return an empty list or the IDs?
        // Let's return empty details list for now.
      } else {
        // Flatten the lender details
        eligibleProductsDetails = products.map(p => ({
          ...p,
          lender_id: p.lenders?.lender_id,
          lender_name: p.lenders?.lender_name,
          lenders: undefined // Remove nested lender object
        }));
      }
    }

    // 3. Return the detailed list
    res.status(200).json({ eligibleProducts: eligibleProductsDetails }); // Changed key name

  } catch (error) {
    console.error(`Error in GET /sessions/${sessionId}/eligible_products:`, error);
    next(error);
  }
});


// --- CANVAS VISUALIZATION ENDPOINTS ---

/**
 * GET /canvas/data
 * Returns the data needed for canvas visualization: products, rules, and questions.
 */
router.get('/canvas/data', async (req, res, next) => {
  try {
    // Get all products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*');
    
    if (productsError) {
      throw new Error(`Error fetching products: ${productsError.message}`);
    }

    // Get all policy rules
    const { data: rules, error: rulesError } = await supabase
      .from('policy_rules')
      .select('*');
    
    if (rulesError) {
      throw new Error(`Error fetching rules: ${rulesError.message}`);
    }

    // Get all questions
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('*');
    
    if (questionsError) {
      throw new Error(`Error fetching questions: ${questionsError.message}`);
    }

    // Return all data
    res.status(200).json({
      products,
      rules,
      questions
    });
  } catch (error) {
    console.error('Error in GET /canvas/data:', error);
    next(error);
  }
});


import { getAvailableQuestions } from '../services/ruleService.js';

router.get('/sessions/:sessionId/available_questions', async (req, res, next) => {
  const { sessionId } = req.params;
  try {
    const session = await getSessionState(sessionId);
    if (!session) {
      return res.status(404).json({ error: { message: `Session with ID '${sessionId}' not found.` } });
    }

    const { scoredCandidates, candidateQuestionIds } = await getAvailableQuestions(
      session.potential_product_ids,
      session.user_answers,
      session.last_asked_question_group
    );

    res.status(200).json({
      availableQuestions: scoredCandidates,
      candidateQuestionIds
    });
  } catch (error) {
    console.error(`Error in GET /sessions/${sessionId}/available_questions:`, error);
    next(error);
  }
});

export default router;