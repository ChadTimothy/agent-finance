INSERT INTO lenders (lender_name) VALUES
('Liberty Financial'),
('Latitude Financial Services'),
('Pepper Money')
ON CONFLICT (lender_name) DO NOTHING;

WITH lender_ids AS (
  SELECT lender_id, lender_name FROM lenders WHERE lender_name IN ('Liberty Financial', 'Latitude Financial Services', 'Pepper Money')
)
INSERT INTO products (lender_id, product_name, loan_type, min_loan_amount, max_loan_amount, min_term_months, max_term_months, asset_types_allowed, base_rate, worst_case_rate, notes)
SELECT
  l.lender_id, p.product_name, p.loan_type, p.min_loan_amount, p.max_loan_amount, p.min_term_months, p.max_term_months, p.asset_types_allowed, p.base_rate, p.worst_case_rate, p.notes
FROM (VALUES
  ('Liberty Financial', 'Liberty Drive Car Loan', 'Asset Finance', 5000, 100000, 12, 84, ARRAY['Car', 'Motorbike'], 6.5, 14.0, 'Flexible car loan options.'),
  ('Liberty Financial', 'Liberty Express Personal Loan', 'Personal', 5000, 50000, 12, 60, NULL, 8.0, 16.5, 'Unsecured personal loan.'),
  ('Latitude Financial Services', 'Latitude Car Loan', 'Asset Finance', 8000, 150000, 24, 84, ARRAY['Car'], 7.0, 15.5, 'Competitive rates for new and used cars.')
) AS p(lender_name, product_name, loan_type, min_loan_amount, max_loan_amount, min_term_months, max_term_months, asset_types_allowed, base_rate, worst_case_rate, notes)
JOIN lenders l ON p.lender_name = l.lender_name
ON CONFLICT (lender_id, product_name) DO NOTHING;

WITH pepper_lender AS (
  SELECT lender_id FROM lenders WHERE lender_name = 'Pepper Money'
)
INSERT INTO products (
    lender_id, product_name, loan_type,
    min_loan_amount, max_loan_amount,
    min_term_months, max_term_months,
    asset_types_allowed,
    base_rate, worst_case_rate, notes
)
SELECT
    p.lender_id,
    'Pepper Consumer Asset Finance',
    'Asset Finance',
    3000,
    150000,
    12,
    84,
    '{"Car", "Motorbike", "Caravan", "Campervan", "Motorhome", "Boat", "Jet Ski", "ATV", "Off-Road Bike", "Tractor", "Horse Float", "Ride On Mower"}',
    8.79,
    20.69,
    'Tiered product (A, B, C) based on applicant profile affecting rates, NAF/LVR limits, and eligible assets/terms. Final rate, NAF, LVR depend on tier, asset type, asset age, and loan term. Max asset age 15 years at end of term (requires calculation). Balloon/RV options available up to 60 months. Specific asset exclusions apply (e.g., racing cars, taxis). Fees apply (Establishment, Origination, Account Keeping). 0.5% rate loading may apply for terms 61-84 months (excludes Caravans). Marine & Other Goods not applicable for Tier C or private sales/refinance. Repayment affordability checks apply (e.g., Tier A: repayment <= 35% net monthly income).'
FROM pepper_lender p
ON CONFLICT (lender_id, product_name) DO NOTHING;

UPDATE questions
SET
  question_key = 'loan_amount_requested',
  question_text = 'How much do you need to borrow?',
  answer_type = 'Number',
  validation_rules = '{"min": 5000, "max": 500000}'
WHERE question_key = 'loan_amount';

UPDATE questions
SET
  question_key = 'loan_term_months_requested',
  question_text = 'Over how many months would you like to repay the loan?',
  answer_type = 'Number',
  validation_rules = '{"min": 12, "max": 84}'
WHERE question_key = 'loan_term';

UPDATE questions
SET
  question_key = 'asset_type_requested',
  question_text = 'What type of asset are you purchasing?',
  answer_type = 'String',
  possible_answers = '[{"value": "Car", "label": "Car"}, {"value": "Motorbike", "label": "Motorbike"}, {"value": "Boat", "label": "Boat"}, {"value": "Equipment", "label": "Equipment"}, {"value": "Other", "label": "Other"}]',
  validation_rules = NULL
WHERE question_key = 'asset_type';

UPDATE questions
SET
  question_key = 'net_monthly_income',
  question_text = 'What is your estimated total net monthly income (after tax)?',
  answer_type = 'Number',
  validation_rules = '{"min": 0}'
WHERE question_key = 'income_amount';

UPDATE questions
SET
  question_key = 'residency_status_au',
  question_text = 'What is your residency status in Australia?',
  answer_type = 'String',
  possible_answers = '[{"value": "Citizen", "label": "Australian Citizen"}, {"value": "PermanentResident", "label": "Permanent Resident"}, {"value": "VisaHolder", "label": "Visa Holder"}, {"value": "Other", "label": "Other"}]',
  validation_rules = NULL
WHERE question_key = 'residency_status';

UPDATE questions
SET
  question_key = 'employment_duration_months',
  question_text = 'How long have you been in your current job (in months)?',
  answer_type = 'Number',
  validation_rules = '{"min": 0}'
WHERE question_key = 'time_at_job';

UPDATE questions
SET
  answer_type = 'String',
  validation_rules = NULL
WHERE question_key = 'employment_status';

UPDATE questions
SET
  answer_type = 'String',
  validation_rules = NULL
WHERE question_key = 'asset_condition';

UPDATE questions
SET
  answer_type = 'String',
  validation_rules = NULL
WHERE question_key = 'credit_score_range';

INSERT INTO questions (question_key, question_text, answer_type, possible_answers, validation_rules, help_text, question_group, display_priority) VALUES
('sale_type', 'Is this a dealer sale or a private sale?', 'String', '[{"value": "Dealer", "label": "Dealer Sale"}, {"value": "Private", "label": "Private Sale"}]', null, null, 'LoanDetails', 2),
('asset_usage_type', 'What is the intended usage or specific type of the asset?', 'String', null, '{"minLength": 3, "maxLength": 100}', 'E.g., Personal Use Car, Work Ute, Racing Car, Taxi, Limousine.', 'LoanDetails', 3),
('asset_value', 'What is the purchase price or value of the asset?', 'Number', null, '{"min": 0}', 'Enter the value before any deposit or trade-in.', 'LoanDetails', 6),
('asset_age_years', 'What is the age of the asset in years?', 'Number', null, '{"min": 0, "max": 50}', 'Enter 0 for new assets.', 'LoanDetails', 7),
('applicant_age', 'What is your age?', 'Number', null, '{"min": 0, "max": 120}', null, 'ApplicantInfo', 5),
('residential_status', 'What is your current living situation?', 'String', '[{"value": "HomeOwner", "label": "Home Owner/Buyer"}, {"value": "Renting", "label": "Renting"}, {"value": "Boarding", "label": "Boarding/Living with Parents"}, {"value": "Other", "label": "Other"}]', null, 'This helps determine your customer tier.', 'ApplicantInfo', 10),
('employment_on_probation', 'Are you currently on probation in your Permanent or Contract role?', 'Boolean', '[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]', null, 'Select No if not applicable (e.g., self-employed, casual).', 'Employment', 33),
('employment_industry_casual', 'If Casual, what industry do you work in?', 'String', '[{"value": "Mining", "label": "Mining"}, {"value": "Medicine", "label": "Medicine/Healthcare"}, {"value": "Education", "label": "Education"}, {"value": "Other", "label": "Other"}]', null, 'Required only for Casual employment to check Tier A/B eligibility.', 'Employment', 32),
('savings_shares_amount', 'Do you have savings or shares? If so, what is the approximate total amount?', 'Number', null, '{"min": 0}', 'Enter 0 if none. Required for Tier A consideration if not a homeowner.', 'Assets', 20),
('savings_shares_duration_months', 'For how many months have you held these savings/shares?', 'Number', null, '{"min": 0}', 'Required if savings/shares amount is $50k+ for Tier A.', 'Assets', 21),
('has_checkable_credit', 'Do you have a checkable credit history?', 'Boolean', '[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]', null, 'E.g., existing loans, credit cards reported on your credit file.', 'CreditHistory', 40),
('has_adverse_credit_events', 'Have you had any adverse credit events?', 'Boolean', '[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]', null, 'Defined as: default > $1k, any default in last 6 months, RHI > 2 in last 12 months, court writ/judgement.', 'CreditHistory', 41),
('adverse_credit_details', 'Please provide details of any adverse credit events.', 'String', null, '{"minLength": 10}', 'Required if Yes to previous question. Include explanation and mention any asset backing if applicable for Tier B consideration.', 'CreditHistory', 42),
('is_bankrupt', 'Are you currently bankrupt?', 'Boolean', '[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]', null, null, 'CreditHistory', 43),
('is_ex_bankrupt_discharged_lt_2y', 'If previously bankrupt, were you discharged less than 2 years ago?', 'Boolean', '[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]', null, 'Only answer if you answered No to being currently bankrupt.', 'CreditHistory', 44),
('has_payday_loan_enquiry_last_6m', 'Have you made any enquiries for payday loans in the last 6 months?', 'Boolean', '[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]', null, null, 'CreditHistory', 45),
('has_adverse_repayment_history_last_12m', 'Have you had any adverse repayment history in the past 12 months (related to payday or other loans)?', 'Boolean', '[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]', null, 'Required if you answered Yes to payday loan enquiries for Tier A/B.', 'CreditHistory', 46)
ON CONFLICT (question_key) DO NOTHING;