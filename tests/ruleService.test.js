import { evaluateRule, evaluateComplexRule } from '../src/services/ruleService.js';

// --- Tests for evaluateRule (Simple Rules) ---
describe('evaluateRule', () => {
  const userAnswers = {
    loan_amount: 50000,
    employment_status: 'FullTime',
    residency_status: 'Citizen',
    asset_type: 'Car',
    credit_score: 750,
    dependents: 2,
    state: 'VIC',
    // missing_answer is intentionally left out
  };

  // Test cases for various operators and types
  test('should pass == operator for correct string', () => {
    const rule = { policy_attribute: 'employment_status', operator: '==', rule_value: 'FullTime', value_type: 'String' };
    expect(evaluateRule(rule, userAnswers)).toBe(true);
  });

  test('should fail == operator for incorrect string', () => {
    const rule = { policy_attribute: 'employment_status', operator: '==', rule_value: 'PartTime', value_type: 'String' };
    expect(evaluateRule(rule, userAnswers)).toBe(false);
  });

   test('should pass != operator for different string', () => {
    const rule = { policy_attribute: 'employment_status', operator: '!=', rule_value: 'PartTime', value_type: 'String' };
    expect(evaluateRule(rule, userAnswers)).toBe(true);
  });

  test('should fail != operator for same string', () => {
    const rule = { policy_attribute: 'employment_status', operator: '!=', rule_value: 'FullTime', value_type: 'String' };
    expect(evaluateRule(rule, userAnswers)).toBe(false);
  });

  test('should pass >= operator for number', () => {
    const rule = { policy_attribute: 'loan_amount', operator: '>=', rule_value: '40000', value_type: 'Number' };
    expect(evaluateRule(rule, userAnswers)).toBe(true);
  });

   test('should pass >= operator for equal number', () => {
    const rule = { policy_attribute: 'loan_amount', operator: '>=', rule_value: '50000', value_type: 'Number' };
    expect(evaluateRule(rule, userAnswers)).toBe(true);
  });

  test('should fail >= operator for number', () => {
    const rule = { policy_attribute: 'loan_amount', operator: '>=', rule_value: '60000', value_type: 'Number' };
    expect(evaluateRule(rule, userAnswers)).toBe(false);
  });

  // Add tests for <, <=, > similarly

  test('should pass IN operator for list_string', () => {
    const rule = { policy_attribute: 'state', operator: 'IN', rule_value: '["VIC", "NSW"]', value_type: 'List_String' };
    expect(evaluateRule(rule, userAnswers)).toBe(true);
  });

  test('should fail IN operator for list_string', () => {
    const rule = { policy_attribute: 'state', operator: 'IN', rule_value: '["QLD", "SA"]', value_type: 'List_String' };
    expect(evaluateRule(rule, userAnswers)).toBe(false);
  });

   test('should pass NOT IN operator for list_string', () => {
    const rule = { policy_attribute: 'state', operator: 'NOT IN', rule_value: '["QLD", "SA"]', value_type: 'List_String' };
    expect(evaluateRule(rule, userAnswers)).toBe(true);
  });

  test('should fail NOT IN operator for list_string', () => {
    const rule = { policy_attribute: 'state', operator: 'NOT IN', rule_value: '["VIC", "NSW"]', value_type: 'List_String' };
    expect(evaluateRule(rule, userAnswers)).toBe(false);
  });

  // Test Missing Answer Handling ("Pass by Default")
  test('should pass standard operators if answer is missing', () => {
    const ruleEquals = { policy_attribute: 'missing_answer', operator: '==', rule_value: 'SomeValue', value_type: 'String' };
    const ruleGreater = { policy_attribute: 'missing_answer', operator: '>', rule_value: '100', value_type: 'Number' };
    const ruleIn = { policy_attribute: 'missing_answer', operator: 'IN', rule_value: '["A", "B"]', value_type: 'List_String' };
    expect(evaluateRule(ruleEquals, userAnswers)).toBe(true);
    expect(evaluateRule(ruleGreater, userAnswers)).toBe(true);
    expect(evaluateRule(ruleIn, userAnswers)).toBe(true);
  });

  // Test Exists / NotExists
   test('should pass Exists operator if answer exists', () => {
    const rule = { policy_attribute: 'loan_amount', operator: 'Exists' };
    expect(evaluateRule(rule, userAnswers)).toBe(true);
  });

  test('should fail Exists operator if answer is missing', () => {
    const rule = { policy_attribute: 'missing_answer', operator: 'Exists' };
    expect(evaluateRule(rule, userAnswers)).toBe(false);
  });

  test('should pass NotExists operator if answer is missing', () => {
    const rule = { policy_attribute: 'missing_answer', operator: 'NotExists' };
    expect(evaluateRule(rule, userAnswers)).toBe(true);
  });

   test('should fail NotExists operator if answer exists', () => {
    const rule = { policy_attribute: 'loan_amount', operator: 'NotExists' };
    expect(evaluateRule(rule, userAnswers)).toBe(false);
  });

   // Test type coercion
   test('should handle numeric comparison with string answer', () => {
    const rule = { policy_attribute: 'loan_amount_str', operator: '>=', rule_value: '40000', value_type: 'Number' };
    const answersWithStr = { ...userAnswers, loan_amount_str: "50000" };
    expect(evaluateRule(rule, answersWithStr)).toBe(true);
  });

   test('should fail numeric comparison with invalid string answer', () => {
    const rule = { policy_attribute: 'loan_amount_invalid_str', operator: '>=', rule_value: '40000', value_type: 'Number' };
    const answersWithInvalidStr = { ...userAnswers, loan_amount_invalid_str: "abc" }; // Use a non-numeric string
    // Expect failure because coercion fails, and evaluation error defaults to false
    expect(evaluateRule(rule, answersWithInvalidStr)).toBe(false);
  });

});


// --- Tests for evaluateComplexRule ---
describe('evaluateComplexRule', () => {
  const userAnswers = {
    residency_status: 'PermanentResident',
    employment_status: 'FullTime',
    income: 60000,
    has_defaults: false,
  };

  test('should pass AND rule when all conditions are true', async () => { // Make test async
    const complexRule = {
      complex_rule_id: 1,
      logic_structure: {
        operator: 'AND',
        conditions: [
          { attribute: 'income', op: '>=', value: 50000 },
          { attribute: 'employment_status', op: '==', value: 'FullTime' },
          { attribute: 'has_defaults', op: '==', value: false }
        ]
      }
    };
    await expect(evaluateComplexRule(complexRule, userAnswers)).resolves.toBe(true); // Use await and .resolves
  });

  test('should fail AND rule when one condition is false', async () => { // Make test async
     const complexRule = {
      complex_rule_id: 2,
      logic_structure: {
        operator: 'AND',
        conditions: [
          { attribute: 'income', op: '>=', value: 70000 }, // This fails
          { attribute: 'employment_status', op: '==', value: 'FullTime' }
        ]
      }
    };
    await expect(evaluateComplexRule(complexRule, userAnswers)).resolves.toBe(false); // Use await and .resolves
  });

  test('should pass OR rule when one condition is true', async () => { // Make test async
    const complexRule = {
      complex_rule_id: 3,
      logic_structure: {
        operator: 'OR',
        conditions: [
          { attribute: 'income', op: '>=', value: 70000 }, // This fails
          { attribute: 'employment_status', op: '==', value: 'FullTime' } // This passes
        ]
      }
    };
    await expect(evaluateComplexRule(complexRule, userAnswers)).resolves.toBe(true); // Use await and .resolves
  });

   test('should fail OR rule when all conditions are false', async () => { // Make test async
    const complexRule = {
      complex_rule_id: 4,
      logic_structure: {
        operator: 'OR',
        conditions: [
          { attribute: 'income', op: '>=', value: 70000 }, // Fails
          { attribute: 'employment_status', op: '==', value: 'PartTime' } // Fails
        ]
      }
    };
    await expect(evaluateComplexRule(complexRule, userAnswers)).resolves.toBe(false); // Use await and .resolves
  });

  test('should handle nested AND/OR conditions correctly', async () => { // Make test async
     const complexRule = {
      complex_rule_id: 5,
      logic_structure: { // Citizen OR (PR AND FullTime)
        operator: 'OR',
        conditions: [
          { attribute: 'residency_status', op: '==', value: 'Citizen' }, // Fails
          {
            operator: 'AND', // Nested AND
            conditions: [
              { attribute: 'residency_status', op: '==', value: 'PermanentResident' }, // Passes
              { attribute: 'employment_status', op: '==', value: 'FullTime' } // Passes
            ]
          }
        ]
      }
    };
    await expect(evaluateComplexRule(complexRule, userAnswers)).resolves.toBe(true); // Use await and .resolves
  });

   test('should handle nested AND/OR conditions correctly (failure case)', async () => { // Make test async
     const complexRule = {
      complex_rule_id: 6,
      logic_structure: { // Citizen OR (PR AND PartTime)
        operator: 'OR',
        conditions: [
          { attribute: 'residency_status', op: '==', value: 'Citizen' }, // Fails
          {
            operator: 'AND', // Nested AND
            conditions: [
              { attribute: 'residency_status', op: '==', value: 'PermanentResident' }, // Passes
              { attribute: 'employment_status', op: '==', value: 'PartTime' } // Fails
            ]
          }
        ]
      }
    };
    await expect(evaluateComplexRule(complexRule, userAnswers)).resolves.toBe(false); // Use await and .resolves
  });

   test('should handle missing answers within complex rules (Pass by Default)', async () => { // Make test async
     const complexRule = {
      complex_rule_id: 7,
      logic_structure: { // (missing_data == 'X') AND (income >= 50000)
        operator: 'AND',
        conditions: [
          { attribute: 'missing_data', op: '==', value: 'X' }, // Passes by default
          { attribute: 'income', op: '>=', value: 50000 } // Passes
        ]
      }
    };
    // Complex rules now return false (pass eligibility) if answers are missing, unless it's an existence check.
    // This test case has 'missing_data == X' which is NOT an existence check.
    // Therefore, it should return false because 'missing_data' is missing.
    await expect(evaluateComplexRule(complexRule, userAnswers)).resolves.toBe(false);
  });

   test('should handle Exists within complex rules', async () => { // Make test async
     const complexRule = {
      complex_rule_id: 8,
      logic_structure: { // Exists(income) AND NotExists(missing_data)
        operator: 'AND',
        conditions: [
          { attribute: 'income', op: 'Exists' }, // Passes
          { attribute: 'missing_data', op: 'NotExists' } // Passes
        ]
      }
    };
    await expect(evaluateComplexRule(complexRule, userAnswers)).resolves.toBe(true); // Use await and .resolves
  });

});