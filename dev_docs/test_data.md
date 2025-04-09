Okay, let's break down the Pepper Money documents ("Consumer Product Guide" and "Consumer Interest Rate Schedule") and translate them into the required database structure.

**Assumptions & Notes:**

1.  **Single Product:** The documents describe a tiered system (A, B, C) based on customer profile rather than distinct named products. We will model this as one main product, "Pepper Consumer Asset Finance". The tiering criteria will primarily be implemented using rules, and the NAF/LVR limits and rates, which depend heavily on the calculated tier and asset details, will likely need backend logic beyond simple rules for precise application (though we can set overall product boundaries).
2.  **Placeholder IDs:** We'll use placeholders like `(Pepper_ID)`, `(Product_ID_PepperAssetFinance)`, and `(Question_ID_X)` as the actual IDs will be generated upon insertion.
3.  **Standardization:** Terms like "Motor Vehicle", "Caravan", "Motorbike", "Marine", "Other Goods" will be standardized. "Asset Finance" seems the most appropriate `loan_type`.
4.  **Calculations:** Rules involving calculations (like LVR, repayment % of income, asset age at end of term) are complex for the current rule engine structure. We will note these requirements but assume they will be handled primarily in the backend application logic after core eligibility is determined by the database rules. We will implement basic boundary checks where possible.
5.  **Adverse Credit:** The *definition* of adverse credit is complex. We'll use a boolean question `has_adverse_credit_events` linked to the definition provided, acknowledging that a 'Yes' might still be acceptable for Tier B/C with explanation. Tier A requires 'No'.
6.  **Visa Holders:** The guide mentions a separate flyer for Visa holders, which isn't provided. Rules related to specific visa types cannot be added now. We need a general residency question.

---

## Data Population for Pepper Money

### 1. `lenders` Table

```sql
INSERT INTO lenders (lender_name) VALUES
('Pepper Money');
-- Assume this generates lender_id = (Pepper_ID)
```

### 2. `products` Table

```sql
INSERT INTO products (
    lender_id, product_name, loan_type,
    min_loan_amount, max_loan_amount,
    min_term_months, max_term_months,
    asset_types_allowed,
    base_rate, worst_case_rate, notes
) VALUES (
    (Pepper_ID), -- Use the ID generated above
    'Pepper Consumer Asset Finance',
    'Asset Finance',
    3000,  -- Minimum NAF from guide (Motor Bikes/ATV)
    150000, -- Maximum NAF from guide (Motor Vehicles Tier A/B)
    12,    -- Minimum term from guide
    84,    -- Maximum term (without balloon) from guide
    '{"Car", "Motorbike", "Caravan", "Campervan", "Motorhome", "Boat", "Jet Ski", "ATV", "Off-Road Bike", "Tractor", "Horse Float", "Ride On Mower"}', -- Combined list from guide/rate schedule
    8.79,  -- Lowest indicative rate from Rate Schedule (Tier A, Motor Vehicle, New/Demo/Used 0-5)
    20.69, -- Highest indicative rate from Rate Schedule (Tier C, Motorbike/Marine/Other, Used 10+)
    'Tiered product (A, B, C) based on applicant profile affecting rates, NAF/LVR limits, and eligible assets/terms. Final rate, NAF, LVR depend on tier, asset type, asset age, and loan term. Max asset age 15 years at end of term (requires calculation). Balloon/RV options available up to 60 months. Specific asset exclusions apply (e.g., racing cars, taxis). Fees apply (Establishment, Origination, Account Keeping). 0.5% rate loading may apply for terms 61-84 months (excludes Caravans). Marine & Other Goods not applicable for Tier C or private sales/refinance. Repayment affordability checks apply (e.g., Tier A: repayment <= 35% net monthly income).'
);
-- Assume this generates product_id = (Product_ID_PepperAssetFinance)
```

### 3. `questions` Table

*(Note: Order reflects logical flow groups and priorities)*

```sql
-- Loan Details Group
INSERT INTO questions (question_key, question_text, answer_type, possible_answers, validation_rules, help_text, question_group, display_priority) VALUES
('asset_type_requested', 'What type of asset are you financing?', 'String', '[{"value": "MotorVehicle", "label": "Motor Vehicle (Car, Ute, etc.)"}, {"value": "Caravan", "label": "Caravan/Campervan/Motorhome"}, {"value": "Marine", "label": "Marine (Boat, Jet Ski)"}, {"value": "Motorbike", "label": "Motorbike"}, {"value": "ATV_OffRoad", "label": "ATV/Off-Road Bike"}, {"value": "OtherGoods", "label": "Other Goods (Tractor, Horse Float, Mower)"}]', null, 'Select the primary asset type.', 'LoanDetails', 1),
('sale_type', 'Is this a dealer sale or a private sale?', 'String', '[{"value": "Dealer", "label": "Dealer Sale"}, {"value": "Private", "label": "Private Sale"}]', null, null, 'LoanDetails', 2),
('asset_usage_type', 'What is the intended usage or specific type of the asset?', 'String', null, '{"minLength": 3, "maxLength": 100}', 'E.g., Personal Use Car, Work Ute, Racing Car, Taxi, Limousine.', 'LoanDetails', 3),
('loan_amount_requested', 'How much do you wish to borrow (Net Amount Financed)?', 'Number', null, '{"min": 3000, "max": 150000}', 'Enter the total amount needed for the asset, including any fees you wish to finance.', 'LoanDetails', 5),
('asset_value', 'What is the purchase price or value of the asset?', 'Number', null, '{"min": 0}', 'Enter the value before any deposit or trade-in.', 'LoanDetails', 6),
('asset_age_years', 'What is the age of the asset in years?', 'Number', null, '{"min": 0, "max": 50}', 'Enter 0 for new assets.', 'LoanDetails', 7),
('loan_term_months_requested', 'What is the desired loan term (in months)?', 'Number', null, '{"min": 12, "max": 84}', 'Enter the term between 12 and 84 months.', 'LoanDetails', 8);
-- Assume IDs: (Question_ID_AssetType), (Question_ID_SaleType), (Question_ID_AssetUsage), (Question_ID_LoanAmount), (Question_ID_AssetValue), (Question_ID_AssetAge), (Question_ID_LoanTerm)

-- Applicant Info Group
INSERT INTO questions (question_key, question_text, answer_type, possible_answers, validation_rules, help_text, question_group, display_priority) VALUES
('applicant_age', 'What is your age?', 'Number', null, '{"min": 0, "max": 120}', null, 'ApplicantInfo', 5),
('residency_status', 'What is your current residency status in Australia?', 'String', '[{"value": "Citizen", "label": "Australian Citizen"}, {"value": "PermanentResident", "label": "Permanent Resident"}, {"value": "TemporaryResident", "label": "Temporary Resident (Visa Holder)"}, {"value": "Other", "label": "Other"}]', null, 'Pepper has specific policies for Visa holders.', 'ApplicantInfo', 6),
('residential_status', 'What is your current living situation?', 'String', '[{"value": "HomeOwner", "label": "Home Owner/Buyer"}, {"value": "Renting", "label": "Renting"}, {"value": "Boarding", "label": "Boarding/Living with Parents"}, {"value": "Other", "label": "Other"}]', null, 'This helps determine your customer tier.', 'ApplicantInfo', 10);
-- Assume IDs: (Question_ID_ApplicantAge), (Question_ID_ResidencyStatusAU), (Question_ID_ResidentialStatus) -- Renamed from residence_status for clarity

-- Employment Group
INSERT INTO questions (question_key, question_text, answer_type, possible_answers, validation_rules, help_text, question_group, display_priority) VALUES
('employment_status', 'What is your primary employment status?', 'String', '[{"value": "Permanent", "label": "Permanent (Full-Time or Part-Time)"}, {"value": "Contract", "label": "Contract"}, {"value": "SelfEmployed", "label": "Self-Employed"}, {"value": "Casual", "label": "Casual"}, {"value": "Unemployed", "label": "Unemployed"}, {"value": "Other", "label": "Other"}]', null, null, 'Employment', 30),
('employment_duration_months', 'How long have you been continuously employed in your current role/business (in months)?', 'Number', null, '{"min": 0}', 'Enter the total number of months.', 'Employment', 31),
('employment_on_probation', 'Are you currently on probation in your Permanent or Contract role?', 'Boolean', '[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]', null, 'Select No if not applicable (e.g., self-employed, casual).', 'Employment', 33),
('employment_industry_casual', 'If Casual, what industry do you work in?', 'String', '[{"value": "Mining", "label": "Mining"}, {"value": "Medicine", "label": "Medicine/Healthcare"}, {"value": "Education", "label": "Education"}, {"value": "Other", "label": "Other"}]', null, 'Required only for Casual employment to check Tier A/B eligibility.', 'Employment', 32);
-- Assume IDs: (Question_ID_EmpStatus), (Question_ID_EmpDuration), (Question_ID_EmpProbation), (Question_ID_EmpIndustryCasual)

-- Income Group
INSERT INTO questions (question_key, question_text, answer_type, possible_answers, validation_rules, help_text, question_group, display_priority) VALUES
('net_monthly_income', 'What is your estimated total net monthly income (after tax)?', 'Number', null, '{"min": 0}', 'Include income from all sources.', 'Income', 50);
-- Assume ID: (Question_ID_NetMonthlyIncome)

-- Assets Group
INSERT INTO questions (question_key, question_text, answer_type, possible_answers, validation_rules, help_text, question_group, display_priority) VALUES
('savings_shares_amount', 'Do you have savings or shares? If so, what is the approximate total amount?', 'Number', null, '{"min": 0}', 'Enter 0 if none. Required for Tier A consideration if not a homeowner.', 'Assets', 20),
('savings_shares_duration_months', 'For how many months have you held these savings/shares?', 'Number', null, '{"min": 0}', 'Required if savings/shares amount is $50k+ for Tier A.', 'Assets', 21);
-- Assume IDs: (Question_ID_SavingsAmount), (Question_ID_SavingsDuration)

-- Credit History Group
INSERT INTO questions (question_key, question_text, answer_type, possible_answers, validation_rules, help_text, question_group, display_priority) VALUES
('has_checkable_credit', 'Do you have a checkable credit history?', 'Boolean', '[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]', null, 'E.g., existing loans, credit cards reported on your credit file.', 'CreditHistory', 40),
('has_adverse_credit_events', 'Have you had any adverse credit events?', 'Boolean', '[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]', null, 'Defined as: default > $1k, any default in last 6 months, RHI > 2 in last 12 months, court writ/judgement.', 'CreditHistory', 41),
('adverse_credit_details', 'Please provide details of any adverse credit events.', 'String', null, '{"minLength": 10}', 'Required if Yes to previous question. Include explanation and mention any asset backing if applicable for Tier B consideration.', 'CreditHistory', 42),
('is_bankrupt', 'Are you currently bankrupt?', 'Boolean', '[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]', null, null, 'CreditHistory', 43),
('is_ex_bankrupt_discharged_lt_2y', 'If previously bankrupt, were you discharged less than 2 years ago?', 'Boolean', '[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]', null, 'Only answer if you answered No to being currently bankrupt.', 'CreditHistory', 44),
('has_payday_loan_enquiry_last_6m', 'Have you made any enquiries for payday loans in the last 6 months?', 'Boolean', '[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]', null, null, 'CreditHistory', 45),
('has_adverse_repayment_history_last_12m', 'Have you had any adverse repayment history in the past 12 months (related to payday or other loans)?', 'Boolean', '[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]', null, 'Required if you answered Yes to payday loan enquiries for Tier A/B.', 'CreditHistory', 46);
-- Assume IDs: (Question_ID_CheckableCredit), (Question_ID_AdverseCredit), (Question_ID_AdverseDetails), (Question_ID_Bankrupt), (Question_ID_ExBankrupt), (Question_ID_PaydayEnquiry), (Question_ID_AdverseRepayHist)

```

### 4. `policy_rules` Table (Simple Rules)

```sql
INSERT INTO policy_rules (
    lender_id, product_id, rule_scope, policy_category, policy_attribute,
    operator, rule_value, value_type, is_hard_knockout, related_question_id, failure_message
) VALUES
-- Basic Eligibility
((Pepper_ID), (Product_ID_PepperAssetFinance), 'Product', 'Applicant', 'applicant_age', '>=', '18', 'Number', true, (Question_ID_ApplicantAge), 'Applicant must be 18 years or older.'),
((Pepper_ID), (Product_ID_PepperAssetFinance), 'Product', 'Applicant', 'residency_status_au', 'IN', '["Citizen", "PermanentResident"]', 'List_String', true, (Question_ID_ResidencyStatusAU), 'Applicant must generally be an Australian Citizen or Permanent Resident (Visa holders subject to specific policy).'), -- Note: Simplified, real policy is more nuanced for visa holders.
((Pepper_ID), (Product_ID_PepperAssetFinance), 'Product', 'CreditHistory', 'is_bankrupt', '==', 'false', 'Boolean', true, (Question_ID_Bankrupt), 'Current bankrupts are not accepted.'),
((Pepper_ID), (Product_ID_PepperAssetFinance), 'Product', 'CreditHistory', 'is_ex_bankrupt_discharged_lt_2y', '==', 'false', 'Boolean', true, (Question_ID_ExBankrupt), 'Ex-bankrupts must be discharged for more than 2 years.'),
-- Loan Details Boundaries
((Pepper_ID), (Product_ID_PepperAssetFinance), 'Product', 'LoanDetails', 'loan_amount_requested', '>=', '3000', 'Number', true, (Question_ID_LoanAmount), 'Minimum loan amount is $3,000 (may be higher depending on asset type).'),
((Pepper_ID), (Product_ID_PepperAssetFinance), 'Product', 'LoanDetails', 'loan_amount_requested', '<=', '150000', 'Number', true, (Question_ID_LoanAmount), 'Maximum loan amount is $150,000 (may be lower depending on tier and asset type).'),
((Pepper_ID), (Product_ID_PepperAssetFinance), 'Product', 'LoanDetails', 'loan_term_months_requested', '>=', '12', 'Number', true, (Question_ID_LoanTerm), 'Minimum loan term is 12 months.'),
((Pepper_ID), (Product_ID_PepperAssetFinance), 'Product', 'LoanDetails', 'loan_term_months_requested', '<=', '84', 'Number', true, (Question_ID_LoanTerm), 'Maximum loan term is 84 months.'),
-- Asset Exclusions
((Pepper_ID), (Product_ID_PepperAssetFinance), 'Product', 'Asset', 'asset_usage_type', 'NOT IN', '["Racing Car", "Taxi", "Limousine"]', 'List_String', true, (Question_ID_AssetUsage), 'Assets like racing cars, taxis, or limousines are generally not accepted.');
-- Tier C minimum check (Employment Status must be one of these)
((Pepper_ID), (Product_ID_PepperAssetFinance), 'Product', 'Employment', 'employment_status', 'IN', '["Permanent", "Contract", "SelfEmployed", "Casual"]', 'List_String', true, (Question_ID_EmpStatus), 'Applicant must be employed (Permanent, Contract, Self-Employed, or Casual).');
```

### 5. `complex_policy_rules` Table

*(Focus on knockouts not covered by simple rules or requiring AND/OR logic)*

```sql
INSERT INTO complex_policy_rules (
    lender_id, product_id, rule_scope, policy_category, logic_structure,
    related_question_ids, is_hard_knockout, failure_message
) VALUES
-- Tier C Employment Minimums Knockout (Checks if employment details FAIL minimums)
((Pepper_ID), (Product_ID_PepperAssetFinance), 'Product', 'Employment',
'{
  "operator": "OR",
  "conditions": [
    {
      "operator": "AND",
      "conditions": [
        { "attribute": "employment_status", "op": "IN", "value": ["Permanent", "Contract"] },
        {
          "operator": "OR",
          "conditions": [
            { "attribute": "employment_duration_months", "op": "<", "value": 6 },
            { "attribute": "employment_on_probation", "op": "==", "value": true }
          ]
        }
      ]
    },
    {
      "operator": "AND",
      "conditions": [
        { "attribute": "employment_status", "op": "==", "value": "SelfEmployed" },
        { "attribute": "employment_duration_months", "op": "<", "value": 12 }
      ]
    },
    {
      "operator": "AND",
      "conditions": [
        { "attribute": "employment_status", "op": "==", "value": "Casual" },
        { "attribute": "employment_duration_months", "op": "<", "value": 12 }
      ]
    }
  ]
}',
ARRAY[(Question_ID_EmpStatus), (Question_ID_EmpDuration), (Question_ID_EmpProbation)]::INT[], -- Cast to integer array
true,
'Employment duration or probation status does not meet minimum requirements (e.g., Perm/Contract < 6mo or probation, Self-Emp < 1yr, Casual < 12mo).'),

-- Payday Loan Enquiry Knockout (Enquiry + Adverse Repay History)
((Pepper_ID), (Product_ID_PepperAssetFinance), 'Product', 'CreditHistory',
'{
  "operator": "AND",
  "conditions": [
    { "attribute": "has_payday_loan_enquiry_last_6m", "op": "==", "value": true },
    { "attribute": "has_adverse_repayment_history_last_12m", "op": "==", "value": true }
  ]
}',
ARRAY[(Question_ID_PaydayEnquiry), (Question_ID_AdverseRepayHist)]::INT[],
true, -- This knocks out Tier A/B according to notes, potentially ok for Tier C, but doc implies general caution. Setting as hard KO for now.
'Payday loan enquiry in the last 6 months combined with adverse repayment history in the last 12 months is not accepted.');

-- Tier C Asset Type Restriction (Marine or Other Goods not allowed if Tier C is determined)
-- This requires knowing the Tier first. Cannot easily model as a static rule.
-- Assume backend logic checks: IF Tier == 'C' AND asset_type_requested IN ['Marine', 'OtherGoods'] THEN Fail.

-- Private Sale Asset Type Restriction (Marine or Other Goods not allowed for Private Sale)
((Pepper_ID), (Product_ID_PepperAssetFinance), 'Product', 'Asset',
'{
  "operator": "AND",
  "conditions": [
    { "attribute": "sale_type", "op": "==", "value": "Private" },
    { "attribute": "asset_type_requested", "op": "IN", "value": ["Marine", "OtherGoods"] }
  ]
}',
ARRAY[(Question_ID_SaleType), (Question_ID_AssetType)]::INT[],
true,
'Marine and Other Goods asset types are not eligible for private sales with Pepper Money.');

-- Tier A Residence/Savings Check (Must meet one criteria if Tier A is the goal)
-- This rule is more for *qualifying* for Tier A, not a product knockout. Backend logic needed.
-- Logic: IF trying for Tier A, MUST satisfy: (residential_status == 'HomeOwner') OR (savings_shares_amount >= 50000 AND savings_shares_duration_months >= 3)

-- Tier A Credit Check (Must meet criteria if Tier A is the goal)
-- Backend logic: IF trying for Tier A, MUST satisfy: (has_checkable_credit == true) AND (has_adverse_credit_events == false)

```

### 6. `question_dependencies` Table

```sql
INSERT INTO question_dependencies (dependent_question_id, prerequisite_question_id) VALUES
-- Ask for Adverse Details only if Adverse Events = Yes
((Question_ID_AdverseDetails), (Question_ID_AdverseCredit)),
-- Ask about Ex-Bankrupt Discharge only if Currently Bankrupt = No
((Question_ID_ExBankrupt), (Question_ID_Bankrupt)),
-- Ask about Adverse Repay History only if Payday Enquiry = Yes
((Question_ID_AdverseRepayHist), (Question_ID_PaydayEnquiry)),
-- Ask Casual Industry only if Emp Status = Casual (Value-based dependency - backend logic might enforce this better)
((Question_ID_EmpIndustryCasual), (Question_ID_EmpStatus)),
-- Ask Savings Duration only if Savings Amount > 0 (Value-based dependency - backend logic needed for precise $50k check for Tier A)
((Question_ID_SavingsDuration), (Question_ID_SavingsAmount)),
-- Ask about Probation only if Emp Status = Permanent or Contract (Value-based dependency - backend logic)
((Question_ID_EmpProbation), (Question_ID_EmpStatus));
```

---

**Summary of Deferred Logic / Schema Limitations:**

*   **Tier Calculation:** Determining the final customer Tier (A, B, C) based on the combination of Residence, Employment, and Credit answers requires backend logic.
*   **Tier-Specific Limits (NAF/LVR):** Applying the correct NAF/LVR limits based on the calculated Tier and the `asset_type_requested` requires backend logic referencing the limit tables in the Product Guide.
*   **Tier-Specific Rates:** Selecting the correct interest rate from the Rate Schedule based on Tier, `asset_type_requested`, and `asset_age_years` requires backend logic.
*   **Complex Calculations:**
    *   LVR Calculation (`loan_amount_requested` / `asset_value`).
    *   Asset Age at End of Term (`asset_age_years` + `loan_term_months_requested`/12).
    *   Repayment Affordability (`loan_repayment_monthly` / `net_monthly_income`).
*   **Value-Based Dependencies:** Some question dependencies rely on the *value* of the prerequisite answer (e.g., ask Savings Duration only if Savings Amount >= $50k). The current `question_dependencies` table only checks if the prerequisite was asked/answered. More granular control needs backend logic.
*   **Tier-Specific Rule Application:** Applying rules that only matter for a specific Tier (like Tier C cannot finance Marine/Other Goods, or Tier A requires no adverse credit) needs backend logic to check the Tier before applying the rule.

This structure provides a solid foundation for core eligibility checks, with the more dynamic and calculation-heavy aspects deferred to the application's backend processing.