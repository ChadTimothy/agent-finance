-- Phase 2: Rules & Dependencies
-- Step 2.2: Populate Rules & Dependencies with Sample Data
-- Using literal IDs assuming insertion order from seed.sql is predictable
-- Lenders: 1=Liberty, 2=Latitude, 3=Pepper
-- Products: 1=Liberty Drive, 2=Liberty Express, 3=Latitude Car, 4=Pepper Asset, 5=Pepper Personal
-- Questions: 1=loan_amount, 2=loan_term, 3=asset_type, 4=asset_condition, 5=employment_status, 6=time_at_job, 7=income_amount, 8=residency_status, 9=credit_score_range

-- Sample Simple Policy Rules (policy_rules)
INSERT INTO policy_rules
  (lender_id, product_id, rule_scope, policy_category, policy_attribute, operator, rule_value, value_type, is_hard_knockout, related_question_id, failure_message)
VALUES
  -- Rule 1: Liberty Drive Car Loan (Product 1) - Max Loan Amount <= 100k (Hard Knockout)
  ((SELECT lender_id FROM lenders WHERE lender_name = 'Liberty Financial'), (SELECT product_id FROM products WHERE product_name = 'Liberty Drive Car Loan' AND lender_id = (SELECT lender_id FROM lenders WHERE lender_name = 'Liberty Financial')), 'Product', 'LoanAmount', 'loan_amount_requested', '<=', '100000', 'Number', TRUE, (SELECT question_id FROM questions WHERE question_key = 'loan_amount_requested'), 'Loan amount exceeds the maximum of $100,000 for this product.'), -- Standardized key
  -- Rule 2: Liberty Drive Car Loan (Product 1) - Asset must be Car or Motorbike (Hard Knockout)
  ((SELECT lender_id FROM lenders WHERE lender_name = 'Liberty Financial'), (SELECT product_id FROM products WHERE product_name = 'Liberty Drive Car Loan' AND lender_id = (SELECT lender_id FROM lenders WHERE lender_name = 'Liberty Financial')), 'Product', 'Asset', 'asset_type_requested', 'IN', '["Car", "Motorbike"]', 'List_String', TRUE, (SELECT question_id FROM questions WHERE question_key = 'asset_type_requested'), 'This product only finances Cars or Motorbikes.'), -- Standardized key
  -- Rule 3: Global Scope - Min Term >= 12 months (Not Hard Knockout) - Linked to loan_term (QID 2)
  (NULL, NULL, 'Global', 'LoanTerm', 'loan_term_months_requested', '>=', '12', 'Number', FALSE, (SELECT question_id FROM questions WHERE question_key = 'loan_term_months_requested'), NULL), -- Standardized key
  -- Rule 4: Pepper Money (Lender 3) - Requires minimum income >= 30k (Hard Knockout) - Linked to income_amount (QID 7)
  ((SELECT lender_id FROM lenders WHERE lender_name = 'Pepper Money'), NULL, 'Lender', 'Income', 'net_monthly_income', '>=', '2500', 'Number', TRUE, (SELECT question_id FROM questions WHERE question_key = 'net_monthly_income'), 'Minimum net monthly income requirement not met for Pepper Money products.'), -- Standardized key & value (assuming 30k gross ~ 2.5k net)
  -- Rule 5: Global Scope - Ensure 'has_adverse_credit_events' (QID 41) is asked (Not Hard Knockout)
  (NULL, NULL, 'Global', 'CreditHistory', 'has_adverse_credit_events_check', '>=', '0', 'Number', FALSE, (SELECT question_id FROM questions WHERE question_key = 'has_adverse_credit_events'), NULL)
-- Add ON CONFLICT based on actual unique constraints if needed.
-- For simplicity with sample data, omitting ON CONFLICT for now. Assumes clean insert or no unique constraints hit.
ON CONFLICT DO NOTHING; -- Basic conflict handling


-- Sample Complex Policy Rules (complex_policy_rules)
-- Use CTE for question IDs as it's cleaner for array construction
WITH q_ids AS (
  SELECT question_id, question_key FROM questions
)
INSERT INTO complex_policy_rules
  (lender_id, product_id, rule_scope, policy_category, logic_structure, related_question_ids, is_hard_knockout, failure_message)
VALUES
  -- Rule 5: Latitude Car Loan (Product 3, Lender 2) - Must be Citizen OR (Permanent Resident AND Employed FullTime) (Hard Knockout)
  ((SELECT lender_id FROM lenders WHERE lender_name = 'Latitude Financial Services'), (SELECT product_id FROM products WHERE product_name = 'Latitude Car Loan' AND lender_id = (SELECT lender_id FROM lenders WHERE lender_name = 'Latitude Financial Services')), 'Product', 'ResidencyEmployment',
   '{"operator": "OR", "conditions": [{"attribute": "residency_status_au", "op": "==", "value": "Citizen"}, {"operator": "AND", "conditions": [{"attribute": "residency_status_au", "op": "==", "value": "PermanentResident"}, {"attribute": "employment_status", "op": "==", "value": "FullTime"}]}]}'::jsonb,
    ARRAY[(SELECT question_id FROM q_ids WHERE question_key = 'residency_status_au'), (SELECT question_id FROM q_ids WHERE question_key = 'employment_status')], -- Standardized key
    TRUE,
    'Residency or employment status does not meet the requirements for this product.')
-- Add ON CONFLICT if needed
ON CONFLICT DO NOTHING;


-- Sample Question Dependencies (question_dependencies)
-- Use CTE for question IDs
WITH q_ids AS (
  SELECT question_id, question_key FROM questions
)
INSERT INTO question_dependencies (dependent_question_id, prerequisite_question_id) VALUES
-- Ask 'time_at_job' (QID 6) only after 'employment_status' (QID 5) is answered
((SELECT question_id FROM q_ids WHERE question_key = 'employment_duration_months'), (SELECT question_id FROM q_ids WHERE question_key = 'employment_status')), -- Standardized key
-- Ask 'asset_condition' (QID 4) only after 'asset_type' (QID 3) is answered
((SELECT question_id FROM q_ids WHERE question_key = 'asset_condition'), (SELECT question_id FROM q_ids WHERE question_key = 'asset_type_requested')) -- Standardized key
ON CONFLICT (dependent_question_id, prerequisite_question_id) DO NOTHING; -- Prevent error if dependency already exists


-- ==================================
-- Seed Data from dev_docs/test_data.md (Pepper Money Specific)
-- ==================================

-- Pepper Money Simple Rules
WITH pepper_ids AS (
    SELECT
        (SELECT lender_id FROM lenders WHERE lender_name = 'Pepper Money') AS lender_id,
        (SELECT product_id FROM products WHERE product_name = 'Pepper Consumer Asset Finance' AND lender_id = (SELECT lender_id FROM lenders WHERE lender_name = 'Pepper Money')) AS product_id
), q_ids AS (
    SELECT question_id, question_key FROM questions
)
INSERT INTO policy_rules (
    lender_id, product_id, rule_scope, policy_category, policy_attribute,
    operator, rule_value, value_type, is_hard_knockout, related_question_id, failure_message
)
SELECT
    p.lender_id, p.product_id, vals.rule_scope, vals.policy_category, vals.policy_attribute,
    vals.operator, vals.rule_value, vals.value_type, vals.is_hard_knockout,
    (SELECT question_id FROM q_ids WHERE question_key = vals.policy_attribute), -- Dynamically find related_question_id
    vals.failure_message
FROM pepper_ids p, (VALUES
    -- Basic Eligibility
    ('Product', 'Applicant', 'applicant_age', '>=', '18', 'Number', true, 'Applicant must be 18 years or older.'),
    ('Product', 'Applicant', 'residency_status_au', 'IN', '["Citizen", "PermanentResident"]', 'List_String', true, 'Applicant must generally be an Australian Citizen or Permanent Resident (Visa holders subject to specific policy).'),
    ('Product', 'CreditHistory', 'is_bankrupt', '==', 'false', 'Boolean', true, 'Current bankrupts are not accepted.'),
    ('Product', 'CreditHistory', 'is_ex_bankrupt_discharged_lt_2y', '==', 'false', 'Boolean', true, 'Ex-bankrupts must be discharged for more than 2 years.'),
    -- Loan Details Boundaries
    ('Product', 'LoanDetails', 'loan_amount_requested', '>=', '3000', 'Number', true, 'Minimum loan amount is $3,000 (may be higher depending on asset type).'),
    ('Product', 'LoanDetails', 'loan_amount_requested', '<=', '150000', 'Number', true, 'Maximum loan amount is $150,000 (may be lower depending on tier and asset type).'),
    ('Product', 'LoanDetails', 'loan_term_months_requested', '>=', '12', 'Number', true, 'Minimum loan term is 12 months.'),
    ('Product', 'LoanDetails', 'loan_term_months_requested', '<=', '84', 'Number', true, 'Maximum loan term is 84 months.'),
    -- Asset Exclusions
    ('Product', 'Asset', 'asset_usage_type', 'NOT IN', '["Racing Car", "Taxi", "Limousine"]', 'List_String', true, 'Assets like racing cars, taxis, or limousines are generally not accepted.'),
    -- Tier C minimum check (Employment Status must be one of these)
    ('Product', 'Employment', 'employment_status', 'IN', '["Permanent", "Contract", "SelfEmployed", "Casual"]', 'List_String', true, 'Applicant must be employed (Permanent, Contract, Self-Employed, or Casual).')
) AS vals(rule_scope, policy_category, policy_attribute, operator, rule_value, value_type, is_hard_knockout, failure_message)
ON CONFLICT DO NOTHING; -- Add appropriate ON CONFLICT clause if unique constraints exist


-- Pepper Money Complex Rules
WITH pepper_ids AS (
    SELECT
        (SELECT lender_id FROM lenders WHERE lender_name = 'Pepper Money') AS lender_id,
        (SELECT product_id FROM products WHERE product_name = 'Pepper Consumer Asset Finance' AND lender_id = (SELECT lender_id FROM lenders WHERE lender_name = 'Pepper Money')) AS product_id
), q_ids AS (
    SELECT question_id, question_key FROM questions
)
INSERT INTO complex_policy_rules (
    lender_id, product_id, rule_scope, policy_category, logic_structure,
    related_question_ids, is_hard_knockout, failure_message
)
SELECT
    p.lender_id, p.product_id, vals.rule_scope, vals.policy_category, vals.logic_structure::jsonb,
    vals.related_question_ids, vals.is_hard_knockout, vals.failure_message -- Corrected alias to match column name
FROM pepper_ids p, (VALUES
    -- Tier C Employment Minimums Knockout
    ('Product', 'Employment',
    '{"operator": "OR", "conditions": [{"operator": "AND", "conditions": [{ "attribute": "employment_status", "op": "IN", "value": ["Permanent", "Contract"] }, {"operator": "OR", "conditions": [{ "attribute": "employment_duration_months", "op": "<", "value": 6 }, { "attribute": "employment_on_probation", "op": "==", "value": true }]}]}, {"operator": "AND", "conditions": [{ "attribute": "employment_status", "op": "==", "value": "SelfEmployed" }, { "attribute": "employment_duration_months", "op": "<", "value": 12 }]}, {"operator": "AND", "conditions": [{ "attribute": "employment_status", "op": "==", "value": "Casual" }, { "attribute": "employment_duration_months", "op": "<", "value": 12 }]}]}',
    ARRAY[
        (SELECT question_id FROM q_ids WHERE question_key = 'employment_status'),
        (SELECT question_id FROM q_ids WHERE question_key = 'employment_duration_months'),
        (SELECT question_id FROM q_ids WHERE question_key = 'employment_on_probation')
    ]::INT[],
    true,
    'Employment duration or probation status does not meet minimum requirements (e.g., Perm/Contract < 6mo or probation, Self-Emp < 1yr, Casual < 12mo).'),

    -- Payday Loan Enquiry Knockout
    ('Product', 'CreditHistory',
    '{"operator": "AND", "conditions": [{ "attribute": "has_payday_loan_enquiry_last_6m", "op": "==", "value": true }, { "attribute": "has_adverse_repayment_history_last_12m", "op": "==", "value": true }]}',
    ARRAY[
        (SELECT question_id FROM q_ids WHERE question_key = 'has_payday_loan_enquiry_last_6m'),
        (SELECT question_id FROM q_ids WHERE question_key = 'has_adverse_repayment_history_last_12m')
    ]::INT[],
    true,
    'Payday loan enquiry in the last 6 months combined with adverse repayment history in the last 12 months is not accepted.'),

    -- Private Sale Asset Type Restriction
    ('Product', 'Asset',
    '{"operator": "AND", "conditions": [{ "attribute": "sale_type", "op": "==", "value": "Private" }, { "attribute": "asset_type_requested", "op": "IN", "value": ["Marine", "OtherGoods"] }]}',
    ARRAY[
        (SELECT question_id FROM q_ids WHERE question_key = 'sale_type'),
        (SELECT question_id FROM q_ids WHERE question_key = 'asset_type_requested')
    ]::INT[],
    true,
    'Marine and Other Goods asset types are not eligible for private sales with Pepper Money.')
) AS vals(rule_scope, policy_category, logic_structure, related_question_ids, is_hard_knockout, failure_message) -- Corrected alias definition
ON CONFLICT DO NOTHING; -- Add appropriate ON CONFLICT clause if unique constraints exist


-- Pepper Money Question Dependencies
WITH q_ids AS (
  SELECT question_id, question_key FROM questions
)
INSERT INTO question_dependencies (dependent_question_id, prerequisite_question_id)
SELECT
    (SELECT question_id FROM q_ids WHERE question_key = vals.dependent_key),
    (SELECT question_id FROM q_ids WHERE question_key = vals.prerequisite_key)
FROM (VALUES
    -- Ask for Adverse Details only if Adverse Events = Yes
    ('adverse_credit_details', 'has_adverse_credit_events'),
    -- Ask about Ex-Bankrupt Discharge only if Currently Bankrupt = No
    ('is_ex_bankrupt_discharged_lt_2y', 'is_bankrupt'),
    -- Ask about Adverse Repay History only if Payday Enquiry = Yes
    ('has_adverse_repayment_history_last_12m', 'has_payday_loan_enquiry_last_6m'),
    -- Ask Casual Industry only if Emp Status = Casual (Value-based dependency - backend logic might enforce this better)
    ('employment_industry_casual', 'employment_status'),
    -- Ask Savings Duration only if Savings Amount > 0 (Value-based dependency - backend logic needed for precise $50k check for Tier A)
    ('savings_shares_duration_months', 'savings_shares_amount'),
    -- Ask about Probation only if Emp Status = Permanent or Contract (Value-based dependency - backend logic)
    ('employment_on_probation', 'employment_status')
) AS vals(dependent_key, prerequisite_key)
WHERE
    (SELECT question_id FROM q_ids WHERE question_key = vals.dependent_key) IS NOT NULL
AND (SELECT question_id FROM q_ids WHERE question_key = vals.prerequisite_key) IS NOT NULL -- Ensure both questions exist before adding dependency
ON CONFLICT (dependent_question_id, prerequisite_question_id) DO NOTHING;