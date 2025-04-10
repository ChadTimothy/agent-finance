import supabase from '../db/supabaseClient.js'; // Needed for getProductRules

// --- Load Scoring Configuration from Environment Variables ---

// Helper function to safely parse JSON from env var
function parseJsonEnvVar(envVar, defaultValue) {
  try {
    return envVar ? JSON.parse(envVar) : defaultValue;
  } catch (e) {
    console.error(`Error parsing JSON env var: ${e.message}. Using default.`);
    return defaultValue;
  }
}

// Helper function to safely parse Float from env var
function parseFloatEnvVar(envVar, defaultValue) {
  const value = Number.parseFloat(envVar);
  return !Number.isNaN(value) ? value : defaultValue;
}

// Helper function to safely parse Comma-Separated List from env var
function parseListEnvVar(envVar, defaultValue) {
    return envVar ? envVar.split(',').map(item => item.trim()) : defaultValue;
}

// Define Default Configuration
// Cache for question IDs to avoid repeated DB calls
const questionIdCache = new Map();

// Credit history question key constants
const CREDIT_QUESTIONS = {
  DEFAULT_OVER_1K: 'has_default_over_1k',
  DEFAULT_LAST_6M: 'has_default_last_6_months',
  RHI_LAST_12M: 'has_rhi_2_last_12_months',
  COURT_WRIT: 'has_court_writ_judgement',
  ADVERSE_CREDIT: 'has_adverse_credit',
  ADVERSE_EXPLANATION: 'has_adverse_credit_explanation',
  BANKRUPTCY: 'bankruptcy_status'
};

const DEFAULT_SCORING_CONFIG = {
  WEIGHT_ELIMINATION: 0.2,
  WEIGHT_RATE_DIFF: 0.4,
  WEIGHT_FLOW: 0.4,
  WEIGHT_DEPENDENCY: 3.0,
  RATE_INFLUENCING_CATEGORIES: [
    'CreditScore',
    'LVR',
    'LoanPurpose',
    'SecurityValue',
    'IncomeVerification',
    'Income'
  ],
  QUESTION_GROUP_ORDER: [
    'ApplicantInfo',
    'Employment',
    'Income',
    'Expenses',
    'Assets',
    'Liabilities',
    'LoanDetails'
  ]
};

// Load configuration from process.env, using defaults if not set or invalid
const SCORING_CONFIG = {
  WEIGHT_ELIMINATION: parseFloatEnvVar(process.env.SCORING_WEIGHT_ELIMINATION, DEFAULT_SCORING_CONFIG.WEIGHT_ELIMINATION),
  WEIGHT_RATE_DIFF: parseFloatEnvVar(process.env.SCORING_WEIGHT_RATE_DIFF, DEFAULT_SCORING_CONFIG.WEIGHT_RATE_DIFF),
  WEIGHT_FLOW: parseFloatEnvVar(process.env.SCORING_WEIGHT_FLOW, DEFAULT_SCORING_CONFIG.WEIGHT_FLOW),
  WEIGHT_DEPENDENCY: parseFloatEnvVar(process.env.SCORING_WEIGHT_DEPENDENCY, DEFAULT_SCORING_CONFIG.WEIGHT_DEPENDENCY),
  RATE_INFLUENCING_CATEGORIES: parseJsonEnvVar(process.env.SCORING_RATE_INFLUENCING_CATEGORIES, DEFAULT_SCORING_CONFIG.RATE_INFLUENCING_CATEGORIES),
  QUESTION_GROUP_ORDER: parseListEnvVar(process.env.SCORING_QUESTION_GROUP_ORDER, DEFAULT_SCORING_CONFIG.QUESTION_GROUP_ORDER)
};

// Log the loaded configuration (optional, for debugging)
// console.log('Loaded Scoring Configuration:', SCORING_CONFIG);

// --- Helper Functions ---

/**
 * Parses the rule_value based on the value_type.
 * Handles simple types and JSON array strings.
 * @param {string} ruleValue - The raw value from the policy_rules table.
 * @param {string} valueType - The type indicator (e.g., 'Number', 'String', 'List_String').
 * @returns {any} The parsed value.
 * @throws {Error} If valueType is unknown or parsing fails.
 */
function parseRuleValue(ruleValue, valueType) {
  try {
    switch (valueType) {
      case 'Number': { // Add block scope
        // Use Number.parseFloat for potential decimals
        const num = Number.parseFloat(ruleValue);
        if (Number.isNaN(num)) throw new Error(`Invalid number format: ${ruleValue}`);
        return num;
      } // Close block scope
      case 'String':
        return ruleValue; // Already a string
      case 'Boolean':
        if (ruleValue.toLowerCase() === 'true') return true;
        if (ruleValue.toLowerCase() === 'false') return false;
        throw new Error(`Invalid boolean format: ${ruleValue}`);
      case 'List_String':
      case 'List_Number':
        // Assuming rule_value is stored as a valid JSON array string, e.g., '["a", "b"]' or '[1, 2]'
        return JSON.parse(ruleValue);
      default:
        throw new Error(`Unknown value_type: ${valueType}`);
    }
  } catch (parseError) {
    console.error(`Failed to parse ruleValue "${ruleValue}" as ${valueType}:`, parseError);
    throw new Error(`Parsing error for rule value: ${parseError.message}`);
  }
}

/**
 * Attempts to coerce the user's answer to match the expected type for comparison.
 * @param {any} userAnswer - The value provided by the user.
 * @param {string} expectedType - The target type ('Number', 'String', 'Boolean', etc.).
 * @returns {any} The coerced answer, or the original answer if no coercion needed/possible.
 * @throws {Error} If coercion fails for required types (like Number).
 */
function coerceAnswerType(userAnswer, expectedType) {
  if (userAnswer === null || userAnswer === undefined) {
    return userAnswer; // Cannot coerce null/undefined
  }

  const answerType = typeof userAnswer;

  try {
    switch (expectedType) {
      case 'Number':
        if (answerType === 'number') return userAnswer;
        if (answerType === 'string') {
          const num = Number.parseFloat(userAnswer);
          // Allow coercion only if it results in a valid number
          if (!Number.isNaN(num)) return num;
          // No need for else here as the previous if returns
          throw new Error(`Cannot coerce string "${userAnswer}" to Number.`);
        }
        // Cannot coerce other types (boolean, object) to Number reliably
        throw new Error(`Cannot coerce type ${answerType} to Number.`);
      case 'String':
        // Convert numbers or booleans to string for comparison if needed
        if (answerType === 'string') return userAnswer;
        return String(userAnswer);
      case 'Boolean':
        if (answerType === 'boolean') return userAnswer;
        if (answerType === 'string') {
          if (userAnswer.toLowerCase() === 'true') return true;
          if (userAnswer.toLowerCase() === 'false') return false;
        }
        // Treat non-empty strings/non-zero numbers as potentially true? Or require strict 'true'/'false'?
        // Let's be strict for now.
        throw new Error(`Cannot reliably coerce ${answerType} "${userAnswer}" to Boolean.`);
      case 'List_String':
      case 'List_Number':
        // Usually, the comparison happens against the list, so the answer itself
        // might remain a single string or number. Coercion might happen inside the operator logic.
        // If the answer itself is expected to be an array (e.g., multi-select), handle that here.
        // For now, assume the comparison logic handles single answer vs list value.
        // If comparing array answer to array rule value, ensure answer is array.
        if (expectedType.startsWith('List_') && !Array.isArray(userAnswer)) {
           // If the operator expects an array answer (e.g. CONTAINS_ALL), this might be an issue.
           // For IN/NOT IN, a single value answer is expected. Let operator logic handle it.
           // Return the value as-is regardless - the operator logic will handle comparison appropriately
           return userAnswer;
        }
        return userAnswer; // Return as is for now
      default:
        return userAnswer; // Return original for unknown types
    }
  } catch (coerceError) {
     throw new Error(`Type coercion error: ${coerceError.message}`);
  }
}

// Helper to determine value_type from JSON value (used in evaluateComplexRule)
function determineValueType(value) {
  if (Array.isArray(value)) {
    if (value.length === 0 || typeof value[0] === 'number') return 'List_Number';
    return 'List_String'; // Assume string if not number
  }
  if (typeof value === 'number') return 'Number';
  if (typeof value === 'boolean') return 'Boolean';
  return 'String'; // Default to string
}

// --- Rule Evaluation Functions ---

/**
 * Evaluates a simple policy rule against the user's answers.
 * Implements the "Pass by Default" logic for missing answers.
 * @param {object} rule - A policy_rules object from the database.
 * @param {object} userAnswers - The user's answers map { question_key: value }.
 * @returns {boolean} True if the rule passes, false otherwise.
 */
// Added optional usePassByDefault parameter
function evaluateRule(rule, userAnswers, usePassByDefault = true) {
  const userAnswer = userAnswers[rule.policy_attribute]; // Get answer using question_key

  // --- Missing Answer Handling ---
  const answerExists = userAnswer !== undefined && userAnswer !== null && userAnswer !== ''; // Define existence

  if (rule.operator === 'Exists') {
    return answerExists;
  }
  if (rule.operator === 'NotExists') {
    return !answerExists;
  }
  // For all other operators, handle missing answer based on usePassByDefault
  if (!answerExists) {
    return usePassByDefault; // Pass only if flag is true
  }

  // --- Answer Exists - Proceed with Evaluation ---
  try {
    const parsedRuleValue = parseRuleValue(rule.rule_value, rule.value_type);
    const coercedAnswer = coerceAnswerType(userAnswer, rule.value_type);

    // --- Operator Logic ---
    switch (rule.operator) {
      case '==':
        return coercedAnswer === parsedRuleValue; // Use strict equality
      case '!=':
        return coercedAnswer !== parsedRuleValue; // Use strict inequality
      case '>':
      case '<':
      case '>=':
      case '<=':
        // Ensure both are numbers after coercion/parsing
        if (typeof coercedAnswer !== 'number' || typeof parsedRuleValue !== 'number') {
          console.warn(`Type mismatch for comparison operator ${rule.operator}. Rule ${rule.rule_id}. Answer: ${coercedAnswer}, RuleValue: ${parsedRuleValue}`);
          return false; // Cannot compare non-numbers
        }
        if (rule.operator === '>') return coercedAnswer > parsedRuleValue;
        if (rule.operator === '<') return coercedAnswer < parsedRuleValue;
        if (rule.operator === '>=') return coercedAnswer >= parsedRuleValue;
        if (rule.operator === '<=') return coercedAnswer <= parsedRuleValue;
        break; // Should not be reached
      case 'IN':
        if (!Array.isArray(parsedRuleValue)) {
           console.warn(`Rule value for IN operator is not an array. Rule ${rule.rule_id}.`);
           return false;
        }
        // Check if the single coerced answer is present in the rule's list value
        return parsedRuleValue.includes(coercedAnswer);
      case 'NOT IN':
         if (!Array.isArray(parsedRuleValue)) {
           console.warn(`Rule value for NOT IN operator is not an array. Rule ${rule.rule_id}.`);
           return false;
        }
        // Check if the single coerced answer is NOT present in the rule's list value
        return !parsedRuleValue.includes(coercedAnswer);

      // Add cases for other operators like CONTAINS_ANY, CONTAINS_ALL if implemented later

      default:
        console.warn(`Unsupported operator: ${rule.operator} in rule ${rule.rule_id}`);
        return false; // Fail safe for unknown operators
    }
  } catch (error) {
    // console.error(`Error evaluating rule ${rule.rule_id}:`, error); // Commented out to avoid noise in tests for expected errors
    return false; // Fail rule if any error occurs during parsing, coercion, or evaluation
  }

  return false; // Should not be reached if switch is exhaustive
}

/**
 * Evaluates a complex policy rule (with AND/OR logic) against user answers.
 * @param {object} complexRule - A complex_policy_rules object.
 * @param {object} userAnswers - The user's answers map { question_key: value }.
 * @returns {boolean} True if the complex rule passes, false otherwise.
 */
async function evaluateComplexRule(complexRule, userAnswers) { // Make async
  const logic = complexRule.logic_structure;

  // Helper function to evaluate a single condition from the logic_structure
  async function evaluateCondition(condition) { // Make helper async
    // Check if this condition is itself a nested complex rule
    if (condition.operator && condition.conditions) {
      // Create a temporary complex rule object to pass to evaluateComplexRule recursively
      const nestedComplexRule = {
        complex_rule_id: complexRule.complex_rule_id, // Pass parent ID for context/logging
        logic_structure: condition,
        // is_hard_knockout is determined by the top-level rule
      };
      return await evaluateComplexRule(nestedComplexRule, userAnswers); // Await the recursive call
    }

    // Otherwise, it's a simple condition { attribute, op, value }
    if (!condition.attribute || !condition.op) {
       console.error(`Invalid simple condition structure in complex rule ${complexRule.complex_rule_id}:`, condition);
       return false; // Invalid condition fails
    }

    // Check for missing answer BEFORE evaluating, unless it's an existence check
    const userAnswer = userAnswers[condition.attribute];
    const answerExists = userAnswer !== undefined && userAnswer !== null && userAnswer !== '';
    const isExistenceCheck = condition.op === 'Exists' || condition.op === 'NotExists';

    if (!answerExists && !isExistenceCheck) {
      // If answer is missing for a non-existence check, the condition for the complex rule fails
      // (meaning the knockout condition is NOT met by this specific part)
      return false;
    }

    // Simulate a simple 'policy_rules' object to reuse evaluateRule
    const simulatedSimpleRule = {
      rule_id: `complex_${complexRule.complex_rule_id}_cond`, // Synthetic ID for logging
      policy_attribute: condition.attribute,
      operator: condition.op,
      rule_value: (typeof condition.value === 'string')
                    ? condition.value
                    : JSON.stringify(condition.value),
      value_type: determineValueType(condition.value),
    };

    // Evaluate using the standard evaluateRule.
    // The standard evaluateRule already handles Exists/NotExists correctly.
    // For other operators, if the answer exists (checked above), evaluateRule's default passByDefault=true is fine.
    // The key change is returning false *before* calling evaluateRule if a non-existence answer is missing.
    // Note: evaluateRule is synchronous, so no await needed here despite being in an async function
    return evaluateRule(simulatedSimpleRule, userAnswers);
  }

  if (!logic || !logic.operator || !Array.isArray(logic.conditions)) {
    console.error(`Invalid logic_structure in complex rule ${complexRule.complex_rule_id}:`, logic);
    return false; // Invalid structure fails
  }

  // --- Check for Missing Answers ---
  // Fetch question keys related to this rule IF related_question_ids exists
  let requiredKeys = [];
  if (complexRule.related_question_ids && complexRule.related_question_ids.length > 0) {
      const { data: questionsData, error: questionsError } = await supabase
          .from('questions')
          .select('question_key')
          .in('question_id', complexRule.related_question_ids);

      if (questionsError) {
          console.error(`Error fetching question keys for complex rule ${complexRule.complex_rule_id}:`, questionsError);
          // Fail safe: assume answers might be missing if we can't check
          return false; // Treat as passing eligibility if we can't verify keys
      }
      requiredKeys = questionsData ? questionsData.map(q => q.question_key) : [];
  }

  // Check if any condition uses Exists/NotExists - these can be evaluated even with missing data
  // Recursive check for nested Exists/NotExists
  const checkForExistenceOps = (conditions) => {
      if (!conditions) return false;
      return conditions.some(cond => {
          if (cond.op === 'Exists' || cond.op === 'NotExists') return true;
          if (cond.conditions) return checkForExistenceOps(cond.conditions);
          return false;
      });
  };
  const hasExistenceCheck = checkForExistenceOps(logic.conditions);

  // If not an existence check, and any required answer is missing, treat rule as passing (return false)
  if (!hasExistenceCheck && requiredKeys.length > 0) {
      const allAnswersPresent = requiredKeys.every(key => userAnswers[key] !== undefined && userAnswers[key] !== null && userAnswers[key] !== '');
      if (!allAnswersPresent) {
          // console.log(`Complex rule ${complexRule.complex_rule_id} deferred (returns false/pass) due to missing answers.`);
          return false; // Treat as passing eligibility if answers are missing
      }
  }
  // --- End Missing Answer Check ---

  // If all answers are present OR there's an existence check, proceed with evaluation:

  try {
    // Evaluate based on the top-level operator inside the try block
    if (logic.operator.toUpperCase() === 'AND') {
      // For AND, all conditions must pass. Use Promise.all with map.
      const results = await Promise.all(logic.conditions.map(condition => evaluateCondition(condition)));
      return results.every(result => result === true);
    }

    if (logic.operator.toUpperCase() === 'OR') {
      // For OR, at least one condition must pass. Use a for...of loop to allow short-circuiting.
      for (const condition of logic.conditions) {
        if (await evaluateCondition(condition)) {
          return true; // Short-circuit if one condition passes
        }
      }
      return false; // None passed
    }

    // If neither AND nor OR, it's unsupported
    console.error(`Unsupported top-level operator in complex rule ${complexRule.complex_rule_id}: ${logic.operator}`);
    return false; // Unsupported operator fails
  } catch (error) {
      console.error(`Error during complex rule evaluation for rule ${complexRule.complex_rule_id}:`, error);
      return false; // Fail rule on any evaluation error
  }
}

// --- Database Interaction Functions ---

// This function fetches rules applicable to a given product ID.
// In a larger app, this might be in a dedicated db service file.
async function getProductRules(productId) {
  console.log(`Fetching rules for productId: ${productId}`);

  // 1. Get the product's lender_id first
  const { data: productData, error: productError } = await supabase
    .from('products')
    .select('lender_id')
    .eq('product_id', productId)
    .single();

  if (productError || !productData) {
    console.error(`Error fetching product details for productId ${productId}:`, productError);
    throw new Error(`Could not find product or its lender for ID ${productId}.`);
  }
  const lenderId = productData.lender_id;

  // 2. Fetch applicable simple rules (Global OR Lender-specific OR Product-specific)
  const simpleOrFilter = `rule_scope.eq.Global,and(rule_scope.eq.Lender,lender_id.eq.${lenderId}),and(rule_scope.eq.Product,product_id.eq.${productId})`;
  const { data: simpleRules, error: simpleRulesError } = await supabase
      .from('policy_rules')
      .select('*')
      .or(simpleOrFilter);

  if (simpleRulesError) {
    console.error(`Error fetching simple rules for productId ${productId}:`, simpleRulesError);
    throw new Error('Failed to fetch simple policy rules.');
  }

   // 3. Fetch applicable complex rules (Global OR Lender-specific OR Product-specific)
   const complexOrFilter = `rule_scope.eq.Global,and(rule_scope.eq.Lender,lender_id.eq.${lenderId}),and(rule_scope.eq.Product,product_id.eq.${productId})`;
   const { data: complexRules, error: complexRulesError } = await supabase
       .from('complex_policy_rules')
       .select('*')
       .or(complexOrFilter);

  if (complexRulesError) {
    console.error(`Error fetching complex rules for productId ${productId}:`, complexRulesError);
    throw new Error('Failed to fetch complex policy rules.');
  }

  console.log(`Fetched ${simpleRules?.length ?? 0} simple rules and ${complexRules?.length ?? 0} complex rules for productId ${productId}.`);
  return {
    simpleRules: simpleRules || [],
    complexRules: complexRules || []
  };
} // End of getProductRules function

// Placeholder for DB Dependency Check
// This function would typically reside in a separate db service file
/**
 * Checks if a question's prerequisites are met, including value-based dependencies.
 * @param {number} dependentQuestionId - The ID of the question being checked
 * @param {string[]} answeredQuestionKeys - Array of question keys that have been answered
 * @param {object} [userAnswers={}] - Map of user answers where key is question_key and value is the answer
 * @returns {Promise<boolean>} True if prerequisites are met, false otherwise
 */
async function checkQuestionPrerequisites(dependentQuestionId, answeredQuestionKeys, userAnswers = {}) {
  // Fetch prerequisite question IDs and details for the dependent question
  const { data: prerequisites, error: prereqError } = await supabase
    .from('question_dependencies')
    .select('prerequisite_question_id')
    .eq('dependent_question_id', dependentQuestionId);

  if (prereqError) {
    console.error(`Error fetching prerequisites for question ${dependentQuestionId}:`, prereqError);
    return false;
  }

  if (!prerequisites || prerequisites.length === 0) {
    return true; // No prerequisites, so they are met
  }

  // Fetch the question details for each prerequisite ID
  const prereqIds = prerequisites.map(p => p.prerequisite_question_id);
  const { data: prereqQuestions, error: questionsError } = await supabase
    .from('questions')
    .select('question_id, question_key')
    .in('question_id', prereqIds);

  if (questionsError || !prereqQuestions || prereqQuestions.length !== prereqIds.length) {
    console.error(`Error fetching prerequisite question details for ${dependentQuestionId}`);
    return false;
  }

 // Initialize cache with these prereq questions if not already cached
 for (const prereq of prereqQuestions) {
   if (!questionIdCache.has(prereq.question_key)) {
     questionIdCache.set(prereq.question_key, prereq.question_id);
   }
 }

 // Standard prerequisite check
 for (const prereq of prereqQuestions) {
   // First check if the prerequisite is answered
   if (!answeredQuestionKeys.includes(prereq.question_key)) {
     console.log(`Prerequisite ${prereq.question_key} not answered for ${dependentQuestionId}`);
     return false;
   }
 }

 // Value-based Dependencies for Credit History Flow
 
 // Find if this is a credit question
 const questionKey = Object.entries(CREDIT_QUESTIONS)
   .find(([, key]) => questionIdCache.get(key) === dependentQuestionId)?.[1];

 if (questionKey) {
   // 1. Check bankruptcy status impact on adverse credit questions
   if (Object.prototype.hasOwnProperty.call(userAnswers, CREDIT_QUESTIONS.BANKRUPTCY)) {
     const bankruptcyStatus = userAnswers[CREDIT_QUESTIONS.BANKRUPTCY];
     const skipAdverseQuestions = bankruptcyStatus === 'Never' || bankruptcyStatus === 'Current';
     
     // Skip adverse credit related questions for non-discharged bankrupts
     if (skipAdverseQuestions &&
         [CREDIT_QUESTIONS.DEFAULT_OVER_1K, CREDIT_QUESTIONS.DEFAULT_LAST_6M,
          CREDIT_QUESTIONS.RHI_LAST_12M, CREDIT_QUESTIONS.COURT_WRIT,
          CREDIT_QUESTIONS.ADVERSE_CREDIT].includes(questionKey)) {
       console.log(`Skipping ${questionKey} as bankruptcy status is ${bankruptcyStatus}`);
       return false;
     }
   }

   // 2. Check adverse credit explanation dependency
   if (questionKey === CREDIT_QUESTIONS.ADVERSE_EXPLANATION) {
     if (Object.prototype.hasOwnProperty.call(userAnswers, CREDIT_QUESTIONS.ADVERSE_CREDIT)) {
       const hasAdverseCredit = userAnswers[CREDIT_QUESTIONS.ADVERSE_CREDIT];
       if (!hasAdverseCredit) {
         console.log('Skipping adverse credit explanation as no adverse credit reported');
         return false;
       }
     }
   }
 }

 // If we get here, all checks have passed
 console.log(`Prerequisites met for question ${dependentQuestionId}`);
 return true;
}

/**
 * Helper to get question ID by key with caching
 * @param {string} questionKey - The question key to look up
 * @returns {Promise<number|null>} The question ID if found, null otherwise
 */
async function getQuestionIdByKey(questionKey) {
  // Check cache first
  if (questionIdCache.has(questionKey)) {
    return questionIdCache.get(questionKey);
  }
  const { data, error } = await supabase
    .from('questions')
    .select('question_id')
    .eq('question_key', questionKey)
    .single();

  if (error || !data) {
    console.error(`Error getting question ID for key ${questionKey}:`, error);
    return null;
  }

  // If found, cache and return the ID
  const questionId = data.question_id;
  questionIdCache.set(questionKey, questionId);
  return questionId;
}

// This function fetches full details for a given question ID.
// In a larger app, this might be in a dedicated db service file.
async function getQuestionDetails(questionId) {
   console.log(`Fetching details for questionId: ${questionId}`);
   // Fetch actual data from DB
   const { data, error } = await supabase
     .from('questions')
     .select('*')
     .eq('question_id', questionId)
     .single();
   if (error || !data) {
     console.error(`Error fetching details for question ${questionId}:`, error);
     // Throw an error so the calling function (selectNextQuestion) can handle it
     throw new Error(`Failed to fetch details for question ID ${questionId}.`);
   }
   return data; // Return full question object
}


// --- Core Logic Functions ---

/**
 * Checks if a specific product is eligible based on user answers and defined rules.
 * @param {number} productId - The ID of the product to check.
 * @param {object} userAnswers - The user's answers map { question_key: value }.
 * @returns {Promise<boolean>} True if the product is eligible, false otherwise.
 */
async function isProductEligible(productId, userAnswers) { // Already async, no change needed here
  if (!productId) {
    console.error("isProductEligible called without productId.");
    return false; // Cannot determine eligibility without a product ID
  }

  console.log(`DEBUG isProductEligible: Checking Product ${productId} with answers: ${JSON.stringify(userAnswers)}`);
  try {
    // 1. Fetch all applicable rules for the product
    const { simpleRules, complexRules } = await getProductRules(productId);
        // console.log(`DEBUG isProductEligible: Product ${productId} failed hard knockout simple rule ${rule.rule_id} (${rule.policy_attribute} ${rule.operator} ${rule.rule_value}). Answer: ${userAnswers[rule.policy_attribute]}`); // Moved log inside loop

    console.log(`DEBUG isProductEligible: Evaluating ${simpleRules.length} simple rules and ${complexRules.length} complex rules for Product ${productId}`);
    // 2. Evaluate simple rules
    for (const rule of simpleRules) {
      const passes = evaluateRule(rule, userAnswers);
      if (!passes && rule.is_hard_knockout) {
        console.log(`Product ${productId} failed hard knockout simple rule ${rule.rule_id}`);
        console.log(`DEBUG isProductEligible: Product ${productId} failed hard knockout simple rule ${rule.rule_id} (${rule.policy_attribute} ${rule.operator} ${rule.rule_value}). Answer: ${userAnswers[rule.policy_attribute]}`); // Log failure details
        return false; // Immediate failure on hard knockout
      }
    }

    // 3. Evaluate complex rules
    for (const complexRule of complexRules) {
      const passes = await evaluateComplexRule(complexRule, userAnswers); // Add await
      // If the rule represents knockout conditions, and it PASSES, then the product is ineligible.
      if (passes && complexRule.is_hard_knockout) {
         console.log(`Product ${productId} failed hard knockout complex rule ${complexRule.complex_rule_id} because knockout conditions were met.`);
        return false; // Immediate failure on hard knockout
      }
    }

    // 4. If no hard knockouts failed, the product is considered eligible
    console.log(`Product ${productId} passed all hard knockout rules.`);
    return true;

  } catch (error) {
    console.error(`Error checking eligibility for product ${productId}:`, error);
    return false; // Treat errors during eligibility check as failure
  }
}

/**
 * Filters a list of potential product IDs based on eligibility rules and user answers.
 * @param {number[]} potentialProductIds - An array of product IDs to check.
 * @param {object} userAnswers - The user's answers map { question_key: value }.
 * @returns {Promise<number[]>} A new array containing only the eligible product IDs.
 */
async function filterProducts(potentialProductIds, userAnswers) {
  if (!Array.isArray(potentialProductIds)) {
    console.error('filterProducts received invalid potentialProductIds:', potentialProductIds);
    return []; // Return empty if input is invalid
  }
  if (potentialProductIds.length === 0) {
    return []; // No products to filter
  }

  console.log(`Filtering ${potentialProductIds.length} potential products...`);

  // Use Promise.all to run eligibility checks concurrently for potentially better performance
  const eligibilityChecks = potentialProductIds.map(productId =>
    isProductEligible(productId, userAnswers)
      .then(isEligible => ({ productId, isEligible }))
      .catch(error => {
        // Log error but treat as ineligible for safety
        console.error(`Error checking eligibility for product ${productId} during filtering:`, error);
        return { productId, isEligible: false };
      })
  );

  const results = await Promise.all(eligibilityChecks);

  const eligibleProductIds = results
    .filter(result => result.isEligible)
    .map(result => result.productId);

  console.log(`Filtering complete. ${eligibleProductIds.length} products remain eligible.`);
  return eligibleProductIds;
}

/**
 * Selects the next best question to ask the user based on scoring logic.
 * @param {number[]} potentialProductIds - Current list of eligible product IDs.
 * @param {object} userAnswers - The user's answers map { question_key: value }.
 * @param {string|null} lastAskedQuestionGroup - The group of the previously asked question.
 * @returns {Promise<object|null>} The full question object to ask next, or null if no suitable question found.
 */
async function selectNextQuestion(potentialProductIds, userAnswers, lastAskedQuestionGroup) {
  // Default userAnswers to empty object if not provided
  const answers = userAnswers || {};
  console.log(`DEBUG selectNextQuestion: Checking potentialProductIds: [${potentialProductIds?.join(', ')}]`);
  if (!potentialProductIds || potentialProductIds.length === 0) {
    console.log('No potential products left, cannot select next question.');
    return null; // No products, no questions
  }

  console.log(`Selecting next question from ${potentialProductIds.length} potential products...`);
  const answeredQuestionKeys = Object.keys(answers);

  // 1. Get all applicable rules for the current potential products
  let fetchedSimpleRules = [];
  let fetchedComplexRules = [];
  let relevantLenderIds = [];
  try {
    // 1a. Get unique lender IDs
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('lender_id')
      .in('product_id', potentialProductIds);
    if (productsError) throw productsError;
    if (!productsData || productsData.length === 0) {
        console.warn(`No product data found for potential IDs: ${potentialProductIds.join(',')}`);
        relevantLenderIds = [];
    } else {
        relevantLenderIds = [...new Set(productsData.map(p => p.lender_id))];
    }

    // 1b. Fetch simple rules
    const simpleOrConditions = ['rule_scope.eq.Global'];
    if (relevantLenderIds.length > 0) simpleOrConditions.push(`and(rule_scope.eq.Lender,lender_id.in.(${relevantLenderIds.join(',')}))`);
    if (potentialProductIds.length > 0) simpleOrConditions.push(`and(rule_scope.eq.Product,product_id.in.(${potentialProductIds.join(',')}))`);
    const { data: simpleData, error: simpleError } = await supabase.from('policy_rules').select('*').or(simpleOrConditions.join(','));
    if (simpleError) throw simpleError;
    fetchedSimpleRules = simpleData || [];
    console.log(`DEBUG selectNextQuestion: Fetched ${fetchedSimpleRules.length} simple rules`);
    if (fetchedSimpleRules.length > 0) {
      console.log('DEBUG selectNextQuestion: Sample simple rule:', fetchedSimpleRules[0]);
    }

     // 1c. Fetch complex rules
    const complexOrConditions = ['rule_scope.eq.Global'];
    if (relevantLenderIds.length > 0) complexOrConditions.push(`and(rule_scope.eq.Lender,lender_id.in.(${relevantLenderIds.join(',')}))`);
    if (potentialProductIds.length > 0) complexOrConditions.push(`and(rule_scope.eq.Product,product_id.in.(${potentialProductIds.join(',')}))`);
    const { data: complexData, error: complexError } = await supabase.from('complex_policy_rules').select('*').or(complexOrConditions.join(','));
    fetchedComplexRules = complexData || [];
    console.log(`DEBUG selectNextQuestion: Fetched ${fetchedComplexRules.length} complex rules`);
    if (fetchedComplexRules.length > 0) {
      console.log('DEBUG selectNextQuestion: Sample complex rule:', fetchedComplexRules[0]);
    }
    if (complexError) throw complexError;
    fetchedComplexRules = complexData || [];

    console.log(`Fetched relevant rules: ${fetchedSimpleRules.length} simple, ${fetchedComplexRules.length} complex.`);

  } catch (error) {
    console.error('Error fetching rules during question selection:', error);
    return null;
  }

  // 1d. De-duplicate fetched rules using a composite key for simple rules
  const uniqueSimpleRules = new Map();
  for (const rule of fetchedSimpleRules) {
    // Key: scope:lenderId:productId:attribute (use 'null' for irrelevant parts, ignore lender for Product scope)
    const lenderPart = rule.rule_scope === 'Lender' ? rule.lender_id : 'null'; // Only use lenderId for Lender scope
    const productPart = rule.rule_scope === 'Product' ? rule.product_id : 'null';
    const key = `${rule.rule_scope}:${lenderPart}:${productPart}:${rule.policy_attribute}`;
    if (!uniqueSimpleRules.has(key)) {
      uniqueSimpleRules.set(key, rule);
    }
  }
  const uniqueComplexRules = new Map(); // Complex rules assumed unique by complex_rule_id from DB
   for (const rule of fetchedComplexRules) {
    // Still use complex_rule_id as the key here, assuming it's logically unique
    if (!uniqueComplexRules.has(rule.complex_rule_id)) {
      uniqueComplexRules.set(rule.complex_rule_id, rule);
    }
  }
  const allSimpleRules = Array.from(uniqueSimpleRules.values()); // Reassign to use de-duplicated list
  const allComplexRules = Array.from(uniqueComplexRules.values()); // Reassign to use de-duplicated list
  console.log(`De-duplicated rules (Composite Key): ${allSimpleRules.length} simple, ${allComplexRules.length} complex.`); // Log count after de-duplication
    console.log('DEBUG: De-duplicated Simple Rules (Composite Key):', JSON.stringify(allSimpleRules.map(r => ({ id: r.rule_id, key: `${r.rule_scope}:${r.rule_scope === 'Lender' || r.rule_scope === 'Product' ? r.lender_id : 'null'}:${r.rule_scope === 'Product' ? r.product_id : 'null'}:${r.policy_attribute}`, scope: r.rule_scope, lender: r.lender_id, product: r.product_id, attr: r.policy_attribute, qid: r.related_question_id }))));



  // 2. Identify unique, unanswered candidate questions from DE-DUPLICATED rules
  const candidateQuestionIds = new Set();
  for (const rule of allSimpleRules) {
    if (rule.related_question_id && !Object.prototype.hasOwnProperty.call(userAnswers, rule.policy_attribute)) {
       candidateQuestionIds.add(rule.related_question_id);
    }
  }
  for (const rule of allComplexRules) {
    for (const qId of rule.related_question_ids) {
      // Add all related IDs; filtering by answered status happens next
      candidateQuestionIds.add(qId);
    }
  }

  const candidateIdArray = Array.from(candidateQuestionIds);
  console.log(`DEBUG selectNextQuestion: Candidate IDs from rules: [${candidateIdArray.join(', ')}]`);
  // console.log('DEBUG: Candidate IDs before unanswered filter:', JSON.stringify(candidateIdArray));


  // Filter out questions that have already been answered
  const questionDetailsMap = {};
  const unansweredCandidateIds = [];
  for (const qId of candidateIdArray) {
      const details = await getQuestionDetails(qId);
      if (details && !Object.prototype.hasOwnProperty.call(userAnswers, details.question_key)) {
          unansweredCandidateIds.push(qId);
          questionDetailsMap[qId] = details;
      }
  }
  console.log(`DEBUG selectNextQuestion: Unanswered Candidate IDs: [${unansweredCandidateIds.join(', ')}]`);
  // console.log('DEBUG: Candidate IDs AFTER unanswered filter:', JSON.stringify(unansweredCandidateIds));


  if (unansweredCandidateIds.length === 0) {
    console.log('No unanswered questions related to remaining rules found.');
    return null;
  }

  // 3. Filter based on prerequisites
  const prerequisiteChecks = await Promise.all(
    unansweredCandidateIds.map(async qId => {
      const meetsPrereqs = await checkQuestionPrerequisites(qId, answeredQuestionKeys, answers);
      return { qId, meetsPrereqs };
    })
  );
  console.log(`DEBUG selectNextQuestion: Prerequisite check results: ${JSON.stringify(prerequisiteChecks)}`);

  // --- PRIORITIZE UNMET PREREQUISITES ---
  // Find the first candidate whose prerequisites are NOT met
  const unmetPrereq = prerequisiteChecks.find(result => !result.meetsPrereqs);
  if (unmetPrereq) {
    console.log(`DEBUG: Found candidate ${unmetPrereq.qId} with unmet prerequisites. Checking its prereqs...`);
    // Fetch prerequisite question IDs
    const { data: prereqs, error: prereqErr } = await supabase
      .from('question_dependencies')
      .select('prerequisite_question_id')
      .eq('dependent_question_id', unmetPrereq.qId);

    if (prereqErr) {
      console.error(`Error fetching prerequisites for ${unmetPrereq.qId}:`, prereqErr);
    } else if (prereqs && prereqs.length > 0) {
      console.log(`DEBUG: Found ${prereqs.length} prerequisites for ${unmetPrereq.qId}: ${JSON.stringify(prereqs.map(p => p.prerequisite_question_id))}`);
      for (const prereq of prereqs) {
        const prereqDetails = await getQuestionDetails(prereq.prerequisite_question_id);
        if (
          prereqDetails &&
          !Object.prototype.hasOwnProperty.call(userAnswers, prereqDetails.question_key) // Check if the prerequisite itself is unanswered
        ) {
          console.log(`DEBUG: Prioritizing unmet prerequisite question ${prereq.prerequisite_question_id} (${prereqDetails.question_key})`);
          return prereqDetails; // Return the first unanswered prerequisite
        }
        console.log(`DEBUG: Prerequisite ${prereq.prerequisite_question_id} (${prereqDetails?.question_key}) is already answered or details not found.`);
      }
    }
  }
  
  const eligibleCandidateIds = prerequisiteChecks
    .filter(result => result.meetsPrereqs)
    .map(result => result.qId);

  console.log('DEBUG: Eligible Candidate IDs after prerequisite check:', JSON.stringify(eligibleCandidateIds)); // Log eligible candidates

  if (eligibleCandidateIds.length === 0) {
    console.log('No candidate questions meet prerequisites.');
    return null;
  }

  // 4. Fetch dependency info for scoring eligible candidates
  const dependentQuestionIds = new Set();
  if (eligibleCandidateIds.length > 0) {
      // Check if any of the eligible candidates ARE dependent questions
      const { data: depsData, error: depsError } = await supabase
          .from('question_dependencies')
          .select('dependent_question_id')
          // Filter where the dependent_question_id is one of our eligible candidates
          .in('dependent_question_id', eligibleCandidateIds);

      if (depsError) {
          console.error('Error fetching dependency info for scoring:', depsError);
      } else if (depsData) {
          // Add the IDs of eligible questions that ARE dependent to the set
          for (const dep of depsData) {
              dependentQuestionIds.add(dep.dependent_question_id);
          }
          console.log(`DEBUG: Identified dependent questions among eligible candidates: [${Array.from(dependentQuestionIds).join(', ')}]`);
      }
  }

  // 5. Score eligible candidates using DE-DUPLICATED rules
  const scoredCandidates = [];
  for (const qId of eligibleCandidateIds) {
    const details = questionDetailsMap[qId];
    if (!details) continue;

    let eliminationScore = 0;
    let rateDiffScore = 0;
    let dependencyScore = 0; // NEW: Initialize dependency score
    // Calculate scores based on the UNIQUE rules linked to this question
    for (const rule of allSimpleRules) { // Use de-duplicated list
      if (rule.related_question_id === qId) {
        eliminationScore += rule.is_hard_knockout ? 2 : 1;
        if (SCORING_CONFIG.RATE_INFLUENCING_CATEGORIES.includes(rule.policy_category)) {
          rateDiffScore = 1;
        }
      }
    }

    // Special boost for bankruptcy_status question to ensure it is asked first
    const bankruptcyQuestionId = await getQuestionIdByKey('bankruptcy_status');
    if (qId === bankruptcyQuestionId) {
      eliminationScore += 100;
    }
    for (const rule of allComplexRules) { // Use de-duplicated list
      if (rule.related_question_ids.includes(qId)) {
        eliminationScore += rule.is_hard_knockout ? 2 : 1;
        if (SCORING_CONFIG.RATE_INFLUENCING_CATEGORIES.includes(rule.policy_category)) {
          rateDiffScore = 1;
        }
      }
    }
// NEW: Calculate Dependency Score (Prerequisites already met at this stage)
if (dependentQuestionIds.has(qId)) {
    dependencyScore = 1.0; // Assign max score if it's a dependent question whose prereqs are met
    console.log(`DEBUG SCORE: qId=${qId} is a dependent question with met prerequisites. Assigning dependencyScore=1.0`);
}

// Calculate Flow Score
let flowScore = (1 / (details.display_priority || 1)) * 0.1;
const currentGroupIndex = SCORING_CONFIG.QUESTION_GROUP_ORDER.indexOf(details.question_group);
const lastGroupIndex = lastAskedQuestionGroup ? SCORING_CONFIG.QUESTION_GROUP_ORDER.indexOf(lastAskedQuestionGroup) : -1;

if (lastAskedQuestionGroup === null || lastGroupIndex === -1) {
    flowScore += 0.1;
} else if (details.question_group === lastAskedQuestionGroup) {
    flowScore += 1.0;
} else if (currentGroupIndex === lastGroupIndex + 1) {
    flowScore += 0.5;
}

// Combine Scores
const totalScore = (eliminationScore * SCORING_CONFIG.WEIGHT_ELIMINATION) +
                   (rateDiffScore * SCORING_CONFIG.WEIGHT_RATE_DIFF) +
                   (flowScore * SCORING_CONFIG.WEIGHT_FLOW) +
                   (dependencyScore * SCORING_CONFIG.WEIGHT_DEPENDENCY); // NEW: Add dependency score

    console.log(`DEBUG SCORE: qId=${qId}, elim=${eliminationScore}, rate=${rateDiffScore}, dep=${dependencyScore}, flow=${flowScore.toFixed(2)}, total=${totalScore.toFixed(2)}, priority=${details.display_priority}, group=${details.question_group}`);

    scoredCandidates.push({ qId, score: totalScore, priority: details.display_priority });
  }

  console.log('DEBUG: Candidates before sort:', JSON.stringify(scoredCandidates.map(c => ({qId: c.qId, score: c.score, priority: c.priority}))));


  if (scoredCandidates.length === 0) {
     console.log('Scoring resulted in no candidates.');
     return null;
  }

  // 6. Select best question
  scoredCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.priority - b.priority;
  });

  console.log('DEBUG: Candidates AFTER sort:', JSON.stringify(scoredCandidates.map(c => ({qId: c.qId, score: c.score, priority: c.priority}))));


  const bestCandidateId = scoredCandidates[0].qId;
  console.log(`DEBUG: Selected question ID ${bestCandidateId} with score ${scoredCandidates[0].score}`);

  // 6. Fetch full details (already cached in questionDetailsMap)
  const bestQuestion = questionDetailsMap[bestCandidateId];
  console.log('DEBUG selectNextQuestion: Returning bestQuestion:', bestQuestion);

  return bestQuestion;
}

/**
 * Returns all remaining candidate questions sorted by score and priority.
 */
async function getAvailableQuestions(potentialProductIds, userAnswers, lastAskedQuestionGroup) {
  console.log(`DEBUG getAvailableQuestions: Checking potentialProductIds: [${potentialProductIds?.join(', ')}]`);
  if (!potentialProductIds || potentialProductIds.length === 0) {
    console.log('No potential products left, cannot get available questions.');
    return [];
  }

  const answeredQuestionKeys = Object.keys(userAnswers);

  // Fetch rules (reuse logic from selectNextQuestion)
  let fetchedSimpleRules = [];
  let fetchedComplexRules = [];
  let relevantLenderIds = [];
  try {
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('lender_id')
      .in('product_id', potentialProductIds);
    if (productsError) throw productsError;
    relevantLenderIds = productsData ? [...new Set(productsData.map(p => p.lender_id))] : [];

    const simpleOrConditions = ['rule_scope.eq.Global'];
    if (relevantLenderIds.length > 0) simpleOrConditions.push(`and(rule_scope.eq.Lender,lender_id.in.(${relevantLenderIds.join(',')}))`);
    if (potentialProductIds.length > 0) simpleOrConditions.push(`and(rule_scope.eq.Product,product_id.in.(${potentialProductIds.join(',')}))`);
    const { data: simpleData, error: simpleError } = await supabase.from('policy_rules').select('*').or(simpleOrConditions.join(','));
    if (simpleError) throw simpleError;
    fetchedSimpleRules = simpleData || [];

    const complexOrConditions = ['rule_scope.eq.Global'];
    if (relevantLenderIds.length > 0) complexOrConditions.push(`and(rule_scope.eq.Lender,lender_id.in.(${relevantLenderIds.join(',')}))`);
    if (potentialProductIds.length > 0) complexOrConditions.push(`and(rule_scope.eq.Product,product_id.in.(${potentialProductIds.join(',')}))`);
    const { data: complexData, error: complexError } = await supabase.from('complex_policy_rules').select('*').or(complexOrConditions.join(','));
    if (complexError) throw complexError;
    fetchedComplexRules = complexData || [];

  } catch (error) {
    console.error('Error fetching rules during getAvailableQuestions:', error);
    return [];
  }

  // De-duplicate rules
  const uniqueSimpleRules = new Map();
  for (const rule of fetchedSimpleRules) {
    const lenderPart = rule.rule_scope === 'Lender' ? rule.lender_id : 'null';
    const productPart = rule.rule_scope === 'Product' ? rule.product_id : 'null';
    const key = `${rule.rule_scope}:${lenderPart}:${productPart}:${rule.policy_attribute}`;
    if (!uniqueSimpleRules.has(key)) {
      uniqueSimpleRules.set(key, rule);
    }
  }
  const uniqueComplexRules = new Map();
  for (const rule of fetchedComplexRules) {
    if (!uniqueComplexRules.has(rule.complex_rule_id)) {
      uniqueComplexRules.set(rule.complex_rule_id, rule);
    }
  }
  const allSimpleRules = Array.from(uniqueSimpleRules.values());
  const allComplexRules = Array.from(uniqueComplexRules.values());

  // Candidate question IDs
  const candidateQuestionIds = new Set();
  for (const rule of allSimpleRules) {
    if (rule.related_question_id && !Object.prototype.hasOwnProperty.call(userAnswers, rule.policy_attribute)) {
      candidateQuestionIds.add(rule.related_question_id);
    }
  }
  for (const rule of allComplexRules) {
    for (const qId of rule.related_question_ids) {
      candidateQuestionIds.add(qId);
    }
  }
  const candidateIdArray = Array.from(candidateQuestionIds);

  if (candidateIdArray.length === 0) {
    console.log('No candidate questions found.');
    return [];
  }

  // Fetch question details
  const { data: questionDetails, error: questionError } = await supabase
    .from('questions')
    .select('*')
    .in('question_id', candidateIdArray);
  if (questionError) {
    console.error('Error fetching question details:', questionError);
    return [];
  }
  const questionDetailsMap = {};
  for (const q of questionDetails) {
    questionDetailsMap[q.question_id] = q;
  }

  // Score candidates (reuse logic)
  const scoredCandidates = [];
  for (const qId of candidateIdArray) {
    const details = questionDetailsMap[qId];
    if (!details) continue;

    let eliminationScore = 0;
    let rateDiffScore = 0;
    const dependencyScore = 0;


    for (const rule of allSimpleRules) {
      if (rule.related_question_id === qId) {
        eliminationScore += rule.is_hard_knockout ? 2 : 1;
        if (SCORING_CONFIG.RATE_INFLUENCING_CATEGORIES.includes(rule.policy_category)) {
          rateDiffScore = 1;
        }
      }
    }
    for (const rule of allComplexRules) {
      if (rule.related_question_ids.includes(qId)) {
        eliminationScore += rule.is_hard_knockout ? 2 : 1;
        if (SCORING_CONFIG.RATE_INFLUENCING_CATEGORIES.includes(rule.policy_category)) {
          rateDiffScore = 1;
        }
      }
    }

    let flowScore = (1 / (details.display_priority || 1)) * 0.1;
    const currentGroupIndex = SCORING_CONFIG.QUESTION_GROUP_ORDER.indexOf(details.question_group);
    const lastGroupIndex = lastAskedQuestionGroup ? SCORING_CONFIG.QUESTION_GROUP_ORDER.indexOf(lastAskedQuestionGroup) : -1;

    if (lastAskedQuestionGroup === null || lastGroupIndex === -1) {
      flowScore += 0.1;
    } else if (details.question_group === lastAskedQuestionGroup) {
      flowScore += 1.0;
    } else if (currentGroupIndex === lastGroupIndex + 1) {
      flowScore += 0.5;
    }

    const totalScore = (eliminationScore * SCORING_CONFIG.WEIGHT_ELIMINATION) +
                       (rateDiffScore * SCORING_CONFIG.WEIGHT_RATE_DIFF) +
                       (flowScore * SCORING_CONFIG.WEIGHT_FLOW) +
                       (dependencyScore * SCORING_CONFIG.WEIGHT_DEPENDENCY);

    scoredCandidates.push({
      question_id: qId,
      question_key: details.question_key,
      question_text: details.question_text,
      answer_type: details.answer_type,
      possible_answers: details.possible_answers,
      validation_rules: details.validation_rules,
      question_group: details.question_group,
      display_priority: details.display_priority,
      score: totalScore
    });
  }

  scoredCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.display_priority - b.display_priority;
  });

  return {
    scoredCandidates,
    candidateQuestionIds: candidateIdArray
  };
}



// --- Exports ---
export {
  evaluateRule,
  evaluateComplexRule,
  isProductEligible,
  filterProducts,
  selectNextQuestion,
  getAvailableQuestions
};
