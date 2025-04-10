-- Pepper Money Database Population Script (PostgreSQL Compliant)
-- Based on pepper.md, using the Product Variants approach

BEGIN;

-- Create temporary table to store IDs for this session
CREATE TEMPORARY TABLE temp_ids (
    name VARCHAR(100) PRIMARY KEY,
    id INTEGER NOT NULL
);

-- Step 1: Add the Lender
WITH inserted_lender AS (
    INSERT INTO lenders (lender_name) 
    VALUES ('Pepper Money') 
    RETURNING lender_id
)
INSERT INTO temp_ids (name, id)
SELECT 'lender_id', lender_id FROM inserted_lender;

-- Step 2: Add Required Questions
-- Note: In a real implementation, you'd want to check if these questions already exist
-- and use those IDs rather than creating duplicates

-- ApplicantInfo Group
WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('applicant_age', 'What is your age?', 'Number', null, 'ApplicantInfo', 1)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'applicant_age_id', question_id FROM inserted_q;

WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('residence_ownership_status', 'What is your current residency status?', 'String', 
            '[{"value": "HomeOwner", "label": "Home Buyer/Owner"}, 
              {"value": "Renting", "label": "Renting"}, 
              {"value": "Boarding", "label": "Boarding"}, 
              {"value": "LivingWithParents", "label": "Living With Parents"}]', 
            'ApplicantInfo', 2)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'residence_status_id', question_id FROM inserted_q;

WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('has_spouse_property', 'Does your spouse own property?', 'Boolean', '[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]', 'ApplicantInfo', 3)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'spouse_property_id', question_id FROM inserted_q;

-- Employment Group
WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('employment_status_detailed', 'What is your current primary employment status?', 'String',
            '[{"value": "Permanent", "label": "Permanent PAYG"}, 
              {"value": "Contract", "label": "Contract"}, 
              {"value": "SelfEmployed", "label": "Self Employed"}, 
              {"value": "Casual", "label": "Casual"}]', 
            'Employment', 1)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'employment_status_id', question_id FROM inserted_q;

WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('employment_duration_years', 'How many years have you been in your current role/self-employed?', 'Number', null, 'Employment', 2)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'employment_years_id', question_id FROM inserted_q;

WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('employment_duration_months', 'How many months have you been in your current role?', 'Number', null, 'Employment', 3)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'employment_months_id', question_id FROM inserted_q;

WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('is_on_probation', 'Are you currently on probation in your role?', 'Boolean', '[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]', 'Employment', 4)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'on_probation_id', question_id FROM inserted_q;

WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('employment_industry', 'What industry do you primarily work in?', 'String',
            '[{"value": "Mining", "label": "Mining"}, 
              {"value": "Medicine", "label": "Medicine"}, 
              {"value": "Education", "label": "Education"}, 
              {"value": "Other", "label": "Other Industry"}]', 
            'Employment', 5)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'industry_id', question_id FROM inserted_q;

-- Assets Group
WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('liquid_savings_or_shares_amount', 'What is the approximate total amount of your liquid savings or shares?', 'Number', null, 'Assets', 1)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'savings_amount_id', question_id FROM inserted_q;

WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('savings_held_duration_months', 'How long have you held these savings/shares above $50k (in months)?', 'Number', null, 'Assets', 2)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'savings_duration_id', question_id FROM inserted_q;

-- Credit History Group
WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('has_checkable_credit_history', 'Do you have a checkable credit history (e.g., loans, credit cards)?', 'Boolean', '[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]', 'CreditHistory', 1)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'checkable_credit_id', question_id FROM inserted_q;

WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('has_default_over_1k', 'Do you have any defaults over $1,000?', 'Boolean', '[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]', 'CreditHistory', 2)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'default_over_1k_id', question_id FROM inserted_q;

WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('has_default_last_6_months', 'Have you had any defaults in the last 6 months?', 'Boolean', '[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]', 'CreditHistory', 3)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'default_6m_id', question_id FROM inserted_q;

WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('has_rhi_2_last_12_months', 'Have you had a Repayment History Indicator of 2+ in the last 12 months?', 'Boolean', '[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]', 'CreditHistory', 4)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'rhi_12m_id', question_id FROM inserted_q;

WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('has_court_writ_judgement', 'Do you have any court writs or judgements?', 'Boolean', '[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]', 'CreditHistory', 5)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'court_writ_id', question_id FROM inserted_q;

WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('has_adverse_credit', 'Have you had any significant adverse credit events?', 'Boolean', '[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]', 'CreditHistory', 6)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'adverse_credit_id', question_id FROM inserted_q;

WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('has_adverse_credit_explanation', 'Can you provide an explanation for any adverse credit?', 'Boolean', '[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]', 'CreditHistory', 7)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'adverse_explain_id', question_id FROM inserted_q;

WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('bankruptcy_status', 'Have you ever been bankrupt?', 'String',
            '[{"value": "Never", "label": "Never"}, 
              {"value": "Current", "label": "Currently Bankrupt"}, 
              {"value": "Discharged", "label": "Discharged Bankrupt"}]', 
            'CreditHistory', 8)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'bankruptcy_status_id', question_id FROM inserted_q;

WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('bankruptcy_discharge_date', 'If discharged, what was the discharge date?', 'String', null, 'CreditHistory', 9)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'bankruptcy_date_id', question_id FROM inserted_q;

WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('bankruptcy_discharge_years', 'How many years ago were you discharged from bankruptcy?', 'Number', null, 'CreditHistory', 10)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'bankruptcy_years_id', question_id FROM inserted_q;

-- Loan Details Group
WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('asset_type_requested', 'What type of asset are you looking to finance?', 'String',
            '[{"value": "Motor Vehicles", "label": "Motor Vehicle"}, 
              {"value": "Caravans", "label": "Caravan"}, 
              {"value": "Campervans", "label": "Campervan"}, 
              {"value": "Motorhomes", "label": "Motorhome"}, 
              {"value": "Marine", "label": "Marine"}, 
              {"value": "Motor Bikes", "label": "Motor Bike"}, 
              {"value": "ATV", "label": "ATV/Off-Road Bike"}, 
              {"value": "Other Goods", "label": "Other Goods"}]', 
            'LoanDetails', 1)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'asset_type_id', question_id FROM inserted_q;

WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('asset_purchase_type', 'How are you purchasing this asset?', 'String',
            '[{"value": "Dealer", "label": "Dealer Sale"}, 
              {"value": "Private", "label": "Private Sale"}]', 
            'LoanDetails', 2)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'purchase_type_id', question_id FROM inserted_q;

WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('loan_amount', 'How much do you wish to borrow?', 'Number', null, 'LoanDetails', 3)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'loan_amount_id', question_id FROM inserted_q;

WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('asset_value', 'What is the estimated value of the asset?', 'Number', null, 'LoanDetails', 4)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'asset_value_id', question_id FROM inserted_q;

WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('asset_age_years', 'What is the age of the asset in years?', 'Number', null, 'LoanDetails', 5)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'asset_age_id', question_id FROM inserted_q;

WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('loan_term_months', 'What is the desired loan term in months?', 'Number', null, 'LoanDetails', 6)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'loan_term_id', question_id FROM inserted_q;

WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('calculated_lvr', 'Calculated LVR (system-generated)', 'Number', null, 'LoanDetails', 7)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'calculated_lvr_id', question_id FROM inserted_q;

WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('calculated_asset_end_age', 'Calculated asset age at end of term (system-generated)', 'Number', null, 'LoanDetails', 8)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'asset_end_age_id', question_id FROM inserted_q;

WITH inserted_q AS (
    INSERT INTO questions (question_key, question_text, answer_type, possible_answers, question_group, display_priority) 
    VALUES ('calculated_repayment_income_ratio', 'Calculated repayment to income ratio (system-generated)', 'Number', null, 'LoanDetails', 9)
    RETURNING question_id
)
INSERT INTO temp_ids (name, id) SELECT 'repayment_ratio_id', question_id FROM inserted_q;

-- Step 3: Set Up Question Dependencies
INSERT INTO question_dependencies (dependent_question_id, prerequisite_question_id)
VALUES 
    ((SELECT id FROM temp_ids WHERE name = 'spouse_property_id'), (SELECT id FROM temp_ids WHERE name = 'residence_status_id')),
    ((SELECT id FROM temp_ids WHERE name = 'savings_duration_id'), (SELECT id FROM temp_ids WHERE name = 'savings_amount_id')),
    ((SELECT id FROM temp_ids WHERE name = 'bankruptcy_date_id'), (SELECT id FROM temp_ids WHERE name = 'bankruptcy_status_id')),
    ((SELECT id FROM temp_ids WHERE name = 'bankruptcy_years_id'), (SELECT id FROM temp_ids WHERE name = 'bankruptcy_status_id')),
    ((SELECT id FROM temp_ids WHERE name = 'adverse_explain_id'), (SELECT id FROM temp_ids WHERE name = 'adverse_credit_id'));

-- Step 4: Add Products for Each Tier/Asset Type
-- Motor Vehicles
WITH inserted_p AS (
    INSERT INTO products (lender_id, product_name, loan_type, min_loan_amount, max_loan_amount, min_term_months, max_term_months, asset_types_allowed, base_rate, worst_case_rate, notes)
    VALUES (
        (SELECT id FROM temp_ids WHERE name = 'lender_id'), 
        'Pepper Motor Vehicle Tier A', 'Asset Finance', 5000, 150000, 12, 84, '{"Motor Vehicles"}', 8.79, 11.99, 
        'Tier A NAF $150k. Max LVR 180%. Rates based on Motor Vehicle schedule. 0.5% loading applies for terms 61-84m.'
    )
    RETURNING product_id
)
INSERT INTO temp_ids (name, id) SELECT 'mv_tier_a_id', product_id FROM inserted_p;

WITH inserted_p AS (
    INSERT INTO products (lender_id, product_name, loan_type, min_loan_amount, max_loan_amount, min_term_months, max_term_months, asset_types_allowed, base_rate, worst_case_rate, notes)
    VALUES (
        (SELECT id FROM temp_ids WHERE name = 'lender_id'), 
        'Pepper Motor Vehicle Tier B', 'Asset Finance', 5000, 150000, 12, 84, '{"Motor Vehicles"}', 10.69, 12.99, 
        'Tier B NAF $150k. Max LVR 180%. Rates based on Motor Vehicle schedule. 0.5% loading applies for terms 61-84m.'
    )
    RETURNING product_id
)
INSERT INTO temp_ids (name, id) SELECT 'mv_tier_b_id', product_id FROM inserted_p;

WITH inserted_p AS (
    INSERT INTO products (lender_id, product_name, loan_type, min_loan_amount, max_loan_amount, min_term_months, max_term_months, asset_types_allowed, base_rate, worst_case_rate, notes)
    VALUES (
        (SELECT id FROM temp_ids WHERE name = 'lender_id'), 
        'Pepper Motor Vehicle Tier C', 'Asset Finance', 5000, 40000, 12, 84, '{"Motor Vehicles"}', 15.19, 17.19, 
        'Tier C NAF $40k. Max LVR 120%. Rates based on Motor Vehicle schedule. 0.5% loading applies for terms 61-84m.'
    )
    RETURNING product_id
)
INSERT INTO temp_ids (name, id) SELECT 'mv_tier_c_id', product_id FROM inserted_p;

-- Caravans (Note: Tier C not offered for Caravans per pepper.md)
WITH inserted_p AS (
    INSERT INTO products (lender_id, product_name, loan_type, min_loan_amount, max_loan_amount, min_term_months, max_term_months, asset_types_allowed, base_rate, worst_case_rate, notes)
    VALUES (
        (SELECT id FROM temp_ids WHERE name = 'lender_id'), 
        'Pepper Caravan Tier A', 'Asset Finance', 5000, 110000, 12, 84, '{"Caravans", "Campervans", "Motorhomes"}', 8.79, 11.99, 
        'Tier A NAF $110k. Max LVR 140%. Includes Campervans and Motorhomes.'
    )
    RETURNING product_id
)
INSERT INTO temp_ids (name, id) SELECT 'caravan_tier_a_id', product_id FROM inserted_p;

WITH inserted_p AS (
    INSERT INTO products (lender_id, product_name, loan_type, min_loan_amount, max_loan_amount, min_term_months, max_term_months, asset_types_allowed, base_rate, worst_case_rate, notes)
    VALUES (
        (SELECT id FROM temp_ids WHERE name = 'lender_id'), 
        'Pepper Caravan Tier B', 'Asset Finance', 5000, 110000, 12, 84, '{"Caravans", "Campervans", "Motorhomes"}', 10.69, 12.99, 
        'Tier B NAF $110k. Max LVR 140%. Includes Campervans and Motorhomes.'
    )
    RETURNING product_id
)
INSERT INTO temp_ids (name, id) SELECT 'caravan_tier_b_id', product_id FROM inserted_p;

-- Marine
WITH inserted_p AS (
    INSERT INTO products (lender_id, product_name, loan_type, min_loan_amount, max_loan_amount, min_term_months, max_term_months, asset_types_allowed, base_rate, worst_case_rate, notes)
    VALUES (
        (SELECT id FROM temp_ids WHERE name = 'lender_id'), 
        'Pepper Marine Tier A', 'Asset Finance', 5000, 100000, 12, 84, '{"Marine"}', 8.79, 11.99, 
        'Tier A NAF $100k. Max LVR 130%. Includes trailered boats and jet skis.'
    )
    RETURNING product_id
)
INSERT INTO temp_ids (name, id) SELECT 'marine_tier_a_id', product_id FROM inserted_p;

WITH inserted_p AS (
    INSERT INTO products (lender_id, product_name, loan_type, min_loan_amount, max_loan_amount, min_term_months, max_term_months, asset_types_allowed, base_rate, worst_case_rate, notes)
    VALUES (
        (SELECT id FROM temp_ids WHERE name = 'lender_id'), 
        'Pepper Marine Tier B', 'Asset Finance', 5000, 100000, 12, 84, '{"Marine"}', 10.69, 12.99, 
        'Tier B NAF $100k. Max LVR 130%. Includes trailered boats and jet skis.'
    )
    RETURNING product_id
)
INSERT INTO temp_ids (name, id) SELECT 'marine_tier_b_id', product_id FROM inserted_p;

-- Motor Bikes
WITH inserted_p AS (
    INSERT INTO products (lender_id, product_name, loan_type, min_loan_amount, max_loan_amount, min_term_months, max_term_months, asset_types_allowed, base_rate, worst_case_rate, notes)
    VALUES (
        (SELECT id FROM temp_ids WHERE name = 'lender_id'), 
        'Pepper Motor Bike Tier A', 'Asset Finance', 3000, 55000, 12, 84, '{"Motor Bikes"}', 8.79, 11.99, 
        'Tier A NAF $55k. Max LVR 180%. Must be roadworthy and registered.'
    )
    RETURNING product_id
)
INSERT INTO temp_ids (name, id) SELECT 'bike_tier_a_id', product_id FROM inserted_p;

WITH inserted_p AS (
    INSERT INTO products (lender_id, product_name, loan_type, min_loan_amount, max_loan_amount, min_term_months, max_term_months, asset_types_allowed, base_rate, worst_case_rate, notes)
    VALUES (
        (SELECT id FROM temp_ids WHERE name = 'lender_id'), 
        'Pepper Motor Bike Tier B', 'Asset Finance', 3000, 55000, 12, 84, '{"Motor Bikes"}', 10.69, 12.99, 
        'Tier B NAF $55k. Max LVR 180%. Must be roadworthy and registered.'
    )
    RETURNING product_id
)
INSERT INTO temp_ids (name, id) SELECT 'bike_tier_b_id', product_id FROM inserted_p;

WITH inserted_p AS (
    INSERT INTO products (lender_id, product_name, loan_type, min_loan_amount, max_loan_amount, min_term_months, max_term_months, asset_types_allowed, base_rate, worst_case_rate, notes)
    VALUES (
        (SELECT id FROM temp_ids WHERE name = 'lender_id'), 
        'Pepper Motor Bike Tier C', 'Asset Finance', 3000, 40000, 12, 84, '{"Motor Bikes"}', 15.19, 17.19, 
        'Tier C NAF $40k. Max LVR 120%. Must be roadworthy and registered.'
    )
    RETURNING product_id
)
INSERT INTO temp_ids (name, id) SELECT 'bike_tier_c_id', product_id FROM inserted_p;

-- ATV/Off-Road Bikes & Other Goods (Note: not available for Tier C)
WITH inserted_p AS (
    INSERT INTO products (lender_id, product_name, loan_type, min_loan_amount, max_loan_amount, min_term_months, max_term_months, asset_types_allowed, base_rate, worst_case_rate, notes)
    VALUES (
        (SELECT id FROM temp_ids WHERE name = 'lender_id'), 
        'Pepper ATV/Other Goods Tier A', 'Asset Finance', 3000, 50000, 12, 84, '{"ATV", "Other Goods"}', 8.79, 11.99, 
        'Tier A NAF $50k. Max LVR 180%.'
    )
    RETURNING product_id
)
INSERT INTO temp_ids (name, id) SELECT 'other_tier_a_id', product_id FROM inserted_p;

WITH inserted_p AS (
    INSERT INTO products (lender_id, product_name, loan_type, min_loan_amount, max_loan_amount, min_term_months, max_term_months, asset_types_allowed, base_rate, worst_case_rate, notes)
    VALUES (
        (SELECT id FROM temp_ids WHERE name = 'lender_id'), 
        'Pepper ATV/Other Goods Tier B', 'Asset Finance', 3000, 50000, 12, 84, '{"ATV", "Other Goods"}', 10.69, 12.99, 
        'Tier B NAF $50k. Max LVR 180%.'
    )
    RETURNING product_id
)
INSERT INTO temp_ids (name, id) SELECT 'other_tier_b_id', product_id FROM inserted_p;

-- Step 5: Add Global Rules
-- Minimum Age Rule (applies to all lenders)
INSERT INTO policy_rules (rule_scope, policy_category, policy_attribute, operator, rule_value, value_type, is_hard_knockout, related_question_id, failure_message)
VALUES (
    'Global', 'ApplicantEligibility', 'applicant_age', '>=', '18', 'Number', true, 
    (SELECT id FROM temp_ids WHERE name = 'applicant_age_id'), 
    'Applicant must be at least 18 years old.'
);

-- Step 6: Add Lender-Wide Rules
-- Current Bankruptcy not accepted
INSERT INTO policy_rules (lender_id, rule_scope, policy_category, policy_attribute, operator, rule_value, value_type, is_hard_knockout, related_question_id, failure_message)
VALUES (
    (SELECT id FROM temp_ids WHERE name = 'lender_id'), 
    'Lender', 'CreditHistory', 'bankruptcy_status', '!=', 'Current', 'String', true, 
    (SELECT id FROM temp_ids WHERE name = 'bankruptcy_status_id'), 
    'Current bankrupts are not accepted.'
);

-- Discharged Bankruptcy must be > 2 years
INSERT INTO complex_policy_rules (lender_id, rule_scope, policy_category, logic_structure, related_question_ids, is_hard_knockout, failure_message)
VALUES (
    (SELECT id FROM temp_ids WHERE name = 'lender_id'), 
    'Lender', 'CreditHistory',
    '{
      "operator": "OR",
      "conditions": [
        { "attribute": "bankruptcy_status", "op": "!=", "value": "Discharged" },
        {
          "operator": "AND",
          "conditions": [
            { "attribute": "bankruptcy_status", "op": "==", "value": "Discharged" },
            { "attribute": "bankruptcy_discharge_years", "op": ">=", "value": 2 }
          ]
        }
      ]
    }'::jsonb,
    ARRAY[
        (SELECT id FROM temp_ids WHERE name = 'bankruptcy_status_id'),
        (SELECT id FROM temp_ids WHERE name = 'bankruptcy_years_id')
    ]::int[],
    true, 'Ex-bankrupts must be discharged > 2 years.'
);

-- Excluded asset types
INSERT INTO policy_rules (lender_id, rule_scope, policy_category, policy_attribute, operator, rule_value, value_type, is_hard_knockout, related_question_id, failure_message)
VALUES (
    (SELECT id FROM temp_ids WHERE name = 'lender_id'), 
    'Lender', 'AssetType', 'asset_type_requested', 'NOT IN', '["Racing Car", "Taxi", "Limousine"]', 'List_String', true, 
    (SELECT id FROM temp_ids WHERE name = 'asset_type_id'), 
    'Racing cars, taxis, limousines, and other assets which are rare, highly untraceable, or difficult to recover will not be considered.'
);

-- Maximum asset age at end of term
INSERT INTO policy_rules (lender_id, rule_scope, policy_category, policy_attribute, operator, rule_value, value_type, is_hard_knockout, related_question_id, failure_message)
VALUES (
    (SELECT id FROM temp_ids WHERE name = 'lender_id'), 
    'Lender', 'AssetProperties', 'calculated_asset_end_age', '<=', '15', 'Number', true, 
    (SELECT id FROM temp_ids WHERE name = 'asset_end_age_id'), 
    'Maximum asset age at the end of term is 15 years.'
);

-- Step 7: Define Adverse Credit (Composite Definition)
INSERT INTO complex_policy_rules (lender_id, rule_scope, policy_category, logic_structure, related_question_ids, is_hard_knockout, failure_message)
VALUES (
    (SELECT id FROM temp_ids WHERE name = 'lender_id'), 
    'Lender', 'AdverseCredit',
    '{
      "operator": "OR",
      "conditions": [
        { "attribute": "has_default_over_1k", "op": "==", "value": true },
        { "attribute": "has_default_last_6_months", "op": "==", "value": true },
        { "attribute": "has_rhi_2_last_12_months", "op": "==", "value": true },
        { "attribute": "has_court_writ_judgement", "op": "==", "value": true }
      ]
    }'::jsonb,
    ARRAY[
        (SELECT id FROM temp_ids WHERE name = 'default_over_1k_id'),
        (SELECT id FROM temp_ids WHERE name = 'default_6m_id'),
        (SELECT id FROM temp_ids WHERE name = 'rhi_12m_id'),
        (SELECT id FROM temp_ids WHERE name = 'court_writ_id')
    ]::int[],
    false, 'Applicant has adverse credit history per Pepper criteria.'
);

-- Step 8: Tier Eligibility Rules
-- Note: Tiers are defined per PRODUCT VARIANT now, not as a separate lender-wide rule

-- Link specific products to Tier A eligibility
-- Motor Vehicle Tier A
INSERT INTO complex_policy_rules (lender_id, product_id, rule_scope, policy_category, logic_structure, related_question_ids, is_hard_knockout, failure_message)
VALUES (
    (SELECT id FROM temp_ids WHERE name = 'lender_id'),
    (SELECT id FROM temp_ids WHERE name = 'mv_tier_a_id'),
    'Product', 'Tiering Eligibility',
    '{
      "operator": "AND",
      "conditions": [
        {
          "operator": "OR",
          "conditions": [
            { "attribute": "residence_ownership_status", "op": "==", "value": "HomeOwner" },
            { "attribute": "has_spouse_property", "op": "==", "value": true },
            {
              "operator": "AND",
              "conditions": [
                { "attribute": "liquid_savings_or_shares_amount", "op": ">=", "value": 50000 },
                { "attribute": "savings_held_duration_months", "op": ">=", "value": 3 }
              ]
            }
          ]
        },
        {
          "operator": "OR",
          "conditions": [
            { "attribute": "employment_status_detailed", "op": "==", "value": "Permanent" },
            { "attribute": "employment_status_detailed", "op": "==", "value": "Contract" },
            {
              "operator": "AND",
              "conditions": [
                { "attribute": "employment_status_detailed", "op": "==", "value": "SelfEmployed" },
                { "attribute": "employment_duration_years", "op": ">=", "value": 2 }
              ]
            },
            {
              "operator": "AND",
              "conditions": [
                { "attribute": "employment_status_detailed", "op": "==", "value": "Casual" },
                { "attribute": "employment_duration_months", "op": ">=", "value": 18 },
                { "attribute": "employment_industry", "op": "IN", "value": ["Mining", "Medicine", "Education"] }
              ]
            }
          ]
        },
        { "attribute": "has_checkable_credit_history", "op": "==", "value": true },
        { "attribute": "has_adverse_credit", "op": "==", "value": false }
      ]
    }'::jsonb,
    ARRAY[
        (SELECT id FROM temp_ids WHERE name = 'residence_status_id'),
        (SELECT id FROM temp_ids WHERE name = 'spouse_property_id'),
        (SELECT id FROM temp_ids WHERE name = 'savings_amount_id'),
        (SELECT id FROM temp_ids WHERE name = 'savings_duration_id'),
        (SELECT id FROM temp_ids WHERE name = 'employment_status_id'),
        (SELECT id FROM temp_ids WHERE name = 'employment_years_id'),
        (SELECT id FROM temp_ids WHERE name = 'employment_months_id'),
        (SELECT id FROM temp_ids WHERE name = 'industry_id'),
        (SELECT id FROM temp_ids WHERE name = 'checkable_credit_id'),
        (SELECT id FROM temp_ids WHERE name = 'adverse_credit_id')
    ]::int[],
    true, 'Applicant does not meet the criteria for Pepper Motor Vehicle Tier A.'
);

-- Tier B Eligibility (Motor Vehicle example)
INSERT INTO complex_policy_rules (lender_id, product_id, rule_scope, policy_category, logic_structure, related_question_ids, is_hard_knockout, failure_message)
VALUES (
    (SELECT id FROM temp_ids WHERE name = 'lender_id'),
    (SELECT id FROM temp_ids WHERE name = 'mv_tier_b_id'),
    'Product', 'Tiering Eligibility',
    '{
      "operator": "AND",
      "conditions": [
        {
          "operator": "OR",
          "conditions": [
            { "attribute": "residence_ownership_status", "op": "==", "value": "Renting" },
            {
              "operator": "AND",
              "conditions": [
                { "attribute": "residence_ownership_status", "op": "IN", "value": ["Boarding", "LivingWithParents"] },
                { "attribute": "employment_status_detailed", "op": "==", "value": "Permanent" }, 
                { "attribute": "has_checkable_credit_history", "op": "==", "value": true }
              ]
            }
          ]
        },
        {
          "operator": "OR",
          "conditions": [
             { "attribute": "employment_status_detailed", "op": "==", "value": "Permanent" },
             { "attribute": "employment_status_detailed", "op": "==", "value": "Contract" },
             {
                "operator": "AND",
                "conditions": [
                   { "attribute": "employment_status_detailed", "op": "==", "value": "SelfEmployed" },
                   { "attribute": "employment_duration_years", "op": ">=", "value": 1 }
                ]
             },
             {
                 "operator": "AND",
                 "conditions": [
                    { "attribute": "employment_status_detailed", "op": "==", "value": "Casual" },
                    { "attribute": "employment_duration_months", "op": ">=", "value": 12 },
                    { "attribute": "residence_ownership_status", "op": "==", "value": "HomeOwner" }
                 ]
             },
             {
                "operator": "AND",
                "conditions": [
                    { "attribute": "employment_status_detailed", "op": "==", "value": "Casual" },
                    { "attribute": "employment_duration_months", "op": ">=", "value": 18 },
                    { "attribute": "employment_industry", "op": "IN", "value": ["Mining", "Medicine", "Education"] }
                ]
             }
          ]
        },
        { "attribute": "has_checkable_credit_history", "op": "==", "value": true },
        {
          "operator": "OR",
          "conditions": [
            { "attribute": "has_adverse_credit", "op": "==", "value": false },
            {
              "operator": "AND",
              "conditions": [
                { "attribute": "has_adverse_credit", "op": "==", "value": true },
                { "attribute": "has_adverse_credit_explanation", "op": "==", "value": true }
              ]
            }
          ]
        }
      ]
    }'::jsonb,
    ARRAY[
        (SELECT id FROM temp_ids WHERE name = 'residence_status_id'),
        (SELECT id FROM temp_ids WHERE name = 'employment_status_id'),
        (SELECT id FROM temp_ids WHERE name = 'employment_years_id'),
        (SELECT id FROM temp_ids WHERE name = 'employment_months_id'),
        (SELECT id FROM temp_ids WHERE name = 'industry_id'),
        (SELECT id FROM temp_ids WHERE name = 'checkable_credit_id'),
        (SELECT id FROM temp_ids WHERE name = 'adverse_credit_id'),
        (SELECT id FROM temp_ids WHERE name = 'adverse_explain_id')
    ]::int[],
    true, 'Applicant does not meet the criteria for Pepper Motor Vehicle Tier B.'
);

-- Tier C Eligibility (Motor Vehicle example)
INSERT INTO complex_policy_rules (lender_id, product_id, rule_scope, policy_category, logic_structure, related_question_ids, is_hard_knockout, failure_message)
VALUES (
    (SELECT id FROM temp_ids WHERE name = 'lender_id'),
    (SELECT id FROM temp_ids WHERE name = 'mv_tier_c_id'),
    'Product', 'Tiering Eligibility',
    '{
      "operator": "AND",
      "conditions": [
        { 
          "attribute": "residence_ownership_status", 
          "op": "IN", 
          "value": ["Renting", "Boarding", "LivingWithParents"]
        },
        {
           "operator": "OR",
           "conditions": [
              {
                 "operator": "AND",
                 "conditions": [
                    { "attribute": "employment_status_detailed", "op": "IN", "value": ["Permanent", "Contract"]},
                    { "attribute": "employment_duration_months", "op": ">=", "value": 6 },
                    { "attribute": "is_on_probation", "op": "==", "value": false }
                 ]
              },
              {
                 "operator": "AND",
                 "conditions": [
                    { "attribute": "employment_status_detailed", "op": "==", "value": "SelfEmployed" },
                    { "attribute": "employment_duration_years", "op": ">=", "value": 1 }
                 ]
              },
              {
                 "operator": "AND",
                 "conditions": [
                    { "attribute": "employment_status_detailed", "op": "==", "value": "Casual" },
                    { "attribute": "employment_duration_months", "op": ">=", "value": 12 }
                 ]
              }
           ]
        },
        {
           "operator": "OR",
           "conditions": [
              { "attribute": "has_checkable_credit_history", "op": "==", "value": false },
              {
                 "operator": "AND",
                 "conditions": [
                    { "attribute": "has_adverse_credit", "op": "==", "value": true },
                    { "attribute": "has_adverse_credit_explanation", "op": "==", "value": true }
                 ]
              }
           ]
        }
      ]
    }'::jsonb,
    ARRAY[
        (SELECT id FROM temp_ids WHERE name = 'residence_status_id'),
        (SELECT id FROM temp_ids WHERE name = 'employment_status_id'),
        (SELECT id FROM temp_ids WHERE name = 'employment_months_id'),
        (SELECT id FROM temp_ids WHERE name = 'employment_years_id'),
        (SELECT id FROM temp_ids WHERE name = 'on_probation_id'),
        (SELECT id FROM temp_ids WHERE name = 'checkable_credit_id'),
        (SELECT id FROM temp_ids WHERE name = 'adverse_credit_id'),
        (SELECT id FROM temp_ids WHERE name = 'adverse_explain_id')
    ]::int[],
    true, 'Applicant does not meet the criteria for Pepper Motor Vehicle Tier C.'
);

-- Repeat Tier A/B/C rules for Caravan, Marine, Motor Bikes, Other products as needed

-- Step 9: Repayment-to-Income Rules
-- Tier A: 35% max repayment/income (Applies to ALL Tier A products)
INSERT INTO policy_rules (lender_id, product_id, rule_scope, policy_category, policy_attribute, operator, rule_value, value_type, is_hard_knockout, related_question_id, failure_message)
VALUES 
    ((SELECT id FROM temp_ids WHERE name = 'lender_id'), (SELECT id FROM temp_ids WHERE name = 'mv_tier_a_id'), 'Product', 'Serviceability', 'calculated_repayment_income_ratio', '<=', '0.35', 'Number', true, (SELECT id FROM temp_ids WHERE name = 'repayment_ratio_id'), 'Maximum new loan repayment as percentage of net monthly income for Tier A is 35%.'),
    ((SELECT id FROM temp_ids WHERE name = 'lender_id'), (SELECT id FROM temp_ids WHERE name = 'caravan_tier_a_id'), 'Product', 'Serviceability', 'calculated_repayment_income_ratio', '<=', '0.35', 'Number', true, (SELECT id FROM temp_ids WHERE name = 'repayment_ratio_id'), 'Maximum new loan repayment as percentage of net monthly income for Tier A is 35%.'),
    ((SELECT id FROM temp_ids WHERE name = 'lender_id'), (SELECT id FROM temp_ids WHERE name = 'marine_tier_a_id'), 'Product', 'Serviceability', 'calculated_repayment_income_ratio', '<=', '0.35', 'Number', true, (SELECT id FROM temp_ids WHERE name = 'repayment_ratio_id'), 'Maximum new loan repayment as percentage of net monthly income for Tier A is 35%.'),
    ((SELECT id FROM temp_ids WHERE name = 'lender_id'), (SELECT id FROM temp_ids WHERE name = 'bike_tier_a_id'), 'Product', 'Serviceability', 'calculated_repayment_income_ratio', '<=', '0.35', 'Number', true, (SELECT id FROM temp_ids WHERE name = 'repayment_ratio_id'), 'Maximum new loan repayment as percentage of net monthly income for Tier A is 35%.'),
    ((SELECT id FROM temp_ids WHERE name = 'lender_id'), (SELECT id FROM temp_ids WHERE name = 'other_tier_a_id'), 'Product', 'Serviceability', 'calculated_repayment_income_ratio', '<=', '0.35', 'Number', true, (SELECT id FROM temp_ids WHERE name = 'repayment_ratio_id'), 'Maximum new loan repayment as percentage of net monthly income for Tier A is 35%.');

-- Tier B: 30% max repayment/income (Applies to ALL Tier B products)
INSERT INTO policy_rules (lender_id, product_id, rule_scope, policy_category, policy_attribute, operator, rule_value, value_type, is_hard_knockout, related_question_id, failure_message)
VALUES 
    ((SELECT id FROM temp_ids WHERE name = 'lender_id'), (SELECT id FROM temp_ids WHERE name = 'mv_tier_b_id'), 'Product', 'Serviceability', 'calculated_repayment_income_ratio', '<=', '0.30', 'Number', true, (SELECT id FROM temp_ids WHERE name = 'repayment_ratio_id'), 'Maximum new loan repayment as percentage of net monthly income for Tier B is 30%.'),
    ((SELECT id FROM temp_ids WHERE name = 'lender_id'), (SELECT id FROM temp_ids WHERE name = 'caravan_tier_b_id'), 'Product', 'Serviceability', 'calculated_repayment_income_ratio', '<=', '0.30', 'Number', true, (SELECT id FROM temp_ids WHERE name = 'repayment_ratio_id'), 'Maximum new loan repayment as percentage of net monthly income for Tier B is 30%.'),
    ((SELECT id FROM temp_ids WHERE name = 'lender_id'), (SELECT id FROM temp_ids WHERE name = 'marine_tier_b_id'), 'Product', 'Serviceability', 'calculated_repayment_income_ratio', '<=', '0.30', 'Number', true, (SELECT id FROM temp_ids WHERE name = 'repayment_ratio_id'), 'Maximum new loan repayment as percentage of net monthly income for Tier B is 30%.'),
    ((SELECT id FROM temp_ids WHERE name = 'lender_id'), (SELECT id FROM temp_ids WHERE name = 'bike_tier_b_id'), 'Product', 'Serviceability', 'calculated_repayment_income_ratio', '<=', '0.30', 'Number', true, (SELECT id FROM temp_ids WHERE name = 'repayment_ratio_id'), 'Maximum new loan repayment as percentage of net monthly income for Tier B is 30%.'),
    ((SELECT id FROM temp_ids WHERE name = 'lender_id'), (SELECT id FROM temp_ids WHERE name = 'other_tier_b_id'), 'Product', 'Serviceability', 'calculated_repayment_income_ratio', '<=', '0.30', 'Number', true, (SELECT id FROM temp_ids WHERE name = 'repayment_ratio_id'), 'Maximum new loan repayment as percentage of net monthly income for Tier B is 30%.');

-- Tier C: 25% max repayment/income (Applies to ALL Tier C products)
INSERT INTO policy_rules (lender_id, product_id, rule_scope, policy_category, policy_attribute, operator, rule_value, value_type, is_hard_knockout, related_question_id, failure_message)
VALUES 
    ((SELECT id FROM temp_ids WHERE name = 'lender_id'), (SELECT id FROM temp_ids WHERE name = 'mv_tier_c_id'), 'Product', 'Serviceability', 'calculated_repayment_income_ratio', '<=', '0.25', 'Number', true, (SELECT id FROM temp_ids WHERE name = 'repayment_ratio_id'), 'Maximum new loan repayment as percentage of net monthly income for Tier C is 25%.'),
    ((SELECT id FROM temp_ids WHERE name = 'lender_id'), (SELECT id FROM temp_ids WHERE name = 'bike_tier_c_id'), 'Product', 'Serviceability', 'calculated_repayment_income_ratio', '<=', '0.25', 'Number', true, (SELECT id FROM temp_ids WHERE name = 'repayment_ratio_id'), 'Maximum new loan repayment as percentage of net monthly income for Tier C is 25%.');

-- Step 10: LVR Rules per Product
-- Motor Vehicle Tier A: 180% LVR Max
INSERT INTO policy_rules (lender_id, product_id, rule_scope, policy_category, policy_attribute, operator, rule_value, value_type, is_hard_knockout, related_question_id, failure_message)
VALUES (
    (SELECT id FROM temp_ids WHERE name = 'lender_id'), (SELECT id FROM temp_ids WHERE name = 'mv_tier_a_id'), 'Product', 'LVR', 'calculated_lvr', '<=', '1.8', 'Number', true, 
    (SELECT id FROM temp_ids WHERE name = 'calculated_lvr_id'), 'Maximum LVR for Pepper Motor Vehicle Tier A is 180%.'
);

-- Motor Vehicle Tier B: 180% LVR Max
INSERT INTO policy_rules (lender_id, product_id, rule_scope, policy_category, policy_attribute, operator, rule_value, value_type, is_hard_knockout, related_question_id, failure_message)
VALUES (
    (SELECT id FROM temp_ids WHERE name = 'lender_id'), (SELECT id FROM temp_ids WHERE name = 'mv_tier_b_id'), 'Product', 'LVR', 'calculated_lvr', '<=', '1.8', 'Number', true, 
    (SELECT id FROM temp_ids WHERE name = 'calculated_lvr_id'), 'Maximum LVR for Pepper Motor Vehicle Tier B is 180%.'
);

-- Motor Vehicle Tier C: 120% LVR Max
INSERT INTO policy_rules (lender_id, product_id, rule_scope, policy_category, policy_attribute, operator, rule_value, value_type, is_hard_knockout, related_question_id, failure_message)
VALUES (
    (SELECT id FROM temp_ids WHERE name = 'lender_id'), (SELECT id FROM temp_ids WHERE name = 'mv_tier_c_id'), 'Product', 'LVR', 'calculated_lvr', '<=', '1.2', 'Number', true, 
    (SELECT id FROM temp_ids WHERE name = 'calculated_lvr_id'), 'Maximum LVR for Pepper Motor Vehicle Tier C is 120%.'
);

-- Add LVR rules for Caravan, Marine, Bike, Other products, referencing their specific tier product IDs...

-- Step 11: Private Sale NAF Limits per Product Tier
-- Motor Vehicle Tier A Private Sale NAF Limit
INSERT INTO complex_policy_rules (lender_id, product_id, rule_scope, policy_category, logic_structure, related_question_ids, is_hard_knockout, failure_message)
VALUES (
    (SELECT id FROM temp_ids WHERE name = 'lender_id'), 
    (SELECT id FROM temp_ids WHERE name = 'mv_tier_a_id'), 
    'Product', 'PrivateSaleLimit',
    '{
      "operator": "OR",
      "conditions": [
        { "attribute": "asset_purchase_type", "op": "!=", "value": "Private" },
        {
          "operator": "AND",
          "conditions": [
            { "attribute": "asset_purchase_type", "op": "==", "value": "Private" },
            { "attribute": "loan_amount", "op": "<=", "value": 100000 }
          ]
        }
      ]
    }'::jsonb,
    ARRAY[
        (SELECT id FROM temp_ids WHERE name = 'purchase_type_id'),
        (SELECT id FROM temp_ids WHERE name = 'loan_amount_id')
    ]::int[],
    true, 'Maximum NAF for private sale Motor Vehicles (Tier A) is $100,000.'
);

-- Repeat for Tier B/C and other asset types, adjusting the NAF limit (100k, 55k, 50k) as per pepper.md table

-- Clean up temporary table
DROP TABLE temp_ids;

COMMIT; 