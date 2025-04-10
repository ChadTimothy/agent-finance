# Guide: Populating Pepper Money Data using Product Variants

**Objective:** To populate the database with Pepper Money products, rates, and eligibility rules using the "Product Variants" strategy, where each tier (A, B, C) for a base product type is represented as a distinct product entry.

**Source Document:** `dev_docs/Sample Lender Docs/pepper.md`
**Schema Guide:** `dev_docs/data_population_guide.md`

## Strategy Overview

Instead of trying to dynamically apply tier-based limits and rates using complex rule logic *after* selecting a base product, we create separate product entries for each significant variation. For Pepper, this means creating products like "Pepper Motor Vehicle Tier A", "Pepper Motor Vehicle Tier B", etc.

1.  **Product Variants:** Each Tier (A, B, C) for a core asset type (Motor Vehicle, Caravan, etc.) gets its own entry in the `products` table. This entry stores the tier-specific NAF limits (as `max_loan_amount`) and the indicative interest rate range (`base_rate`, `worst_case_rate`).
2.  **Tier Eligibility Rules:** A `complex_policy_rule` is created for each product variant. This rule defines the criteria an applicant must meet to qualify for that specific tier (based on Residence, Employment, Credit from `pepper.md`).
3.  **Rule Linking:** The tier eligibility rule is linked directly to its corresponding product variant via `product_id` and has `rule_scope = 'Product'`.
4.  **Hard Knockout:** The tier eligibility rules have `is_hard_knockout = true`. If an applicant fails the criteria for "Tier A", the "Pepper Motor Vehicle Tier A" product is immediately excluded from their options.
5.  **Outcome:** The eligibility engine filters down the list of product variants. The remaining variants represent the Pepper products (and associated tiers/rates) the applicant qualifies for.

**Note:** Calculations like LVR and precise final rate calculation (based on exact term, asset age, balloon payments) are generally handled *outside* this core eligibility engine, potentially in the application layer after the qualifying product variants are identified.

## Step 1: Define Required Questions

Based on the Pepper Tiering table and other rules, ensure the following questions (or similar) exist in the `questions` table. Assign appropriate `question_id`s.

*(Note: Example `question_key`s are illustrative. Use consistent keys.)*

| `question_key`                    | `question_text`                                                                 | `answer_type`   | `possible_answers` (Example)                                                                                                                            | `question_group` | Notes                                                                  |
| :-------------------------------- | :------------------------------------------------------------------------------ | :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------------- | :--------------------------------------------------------------------- |
| `residence_ownership_status`      | "What is your current residency status?"                                        | `String`        | `[{"value": "HomeOwner", "label": "Home Buyer/Owner"}, {"value": "Renting", "label": "Renting"}, ...]`                                                  | `ApplicantInfo`  | Needed for all tiers.                                                  |
| `has_spouse_property`             | "Does your spouse own property?" (Conditional)                                  | `Boolean`       | `[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]`                                                                       | `ApplicantInfo`  | Tier A condition. Potentially depends on `residence_ownership_status`. |
| `liquid_savings_or_shares_amount` | "What is the approximate total amount of your liquid savings or shares?"        | `Number`        | `null`                                                                                                                                                  | `Assets`         | Tier A condition.                                                      |
| `savings_held_duration_months`    | "How long have you held these savings/shares above $50k?" (Conditional)       | `Number`        | `null`                                                                                                                                                  | `Assets`         | Tier A condition. Depends on previous answer.                          |
| `employment_status_detailed`      | "What is your current primary employment status?"                               | `String`        | `[{"value": "Permanent", "label": "Permanent PAYG"}, {"value": "Contract", "label": "Contract"}, {"value": "SelfEmployed", "label": "Self Employed"}, ...]` | `Employment`     | Needed for all tiers.                                                  |
| `employment_duration_years`       | "How many years have you been in your current role/self-employed?"              | `Number`        | `null`                                                                                                                                                  | `Employment`     | Needed for Self Employed (Tier A/B/C), Contract/Permanent (Tier C).    |
| `employment_duration_months`      | "How many months have you been in your current role/self-employed?"             | `Number`        | `null`                                                                                                                                                  | `Employment`     | Needed for Casual (Tier A/B/C), Contract/Permanent (Tier C).           |
| `is_on_probation`                 | "Are you currently on probation in your role?"                                  | `Boolean`       | `[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]`                                                                       | `Employment`     | Tier C condition for Permanent/Contract.                             |
| `employment_industry`             | "What industry do you primarily work in?" (Conditional)                         | `String`        | `[{"value": "Mining", "label": "Mining"}, {"value": "Medicine", "label": "Medicine"}, {"value": "Education", "label": "Education"}, {"value":"Other"}]`      | `Employment`     | Needed for Casual (Tier A/B).                                        |
| `has_checkable_credit_history`    | "Do you have a checkable credit history (e.g., loans, credit cards)?"           | `Boolean`       | `[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]`                                                                       | `CreditHistory`  | Needed for Tiers A/B/C.                                                |
| `has_adverse_credit`              | "Have you had any significant adverse credit events?" (Simplified)              | `Boolean`       | `[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]`                                                                       | `CreditHistory`  | Tiers A/B check. (Could be complex rule itself).                       |
| `has_adverse_credit_explanation`  | "Can you provide an explanation for any adverse credit?" (Conditional)        | `Boolean`       | `[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]`                                                                       | `CreditHistory`  | Tiers B/C.                                                             |
| `applicant_age`                   | "What is your age?"                                                             | `Number`        | `null`                                                                                                                                                  | `ApplicantInfo`  | General rule.                                                        |
| `bankruptcy_status`               | "Have you ever been bankrupt?"                                                  | `String`        | `[{"value": "Never", "label": "Never"}, {"value": "Current", "label": "Currently Bankrupt"}, {"value": "Discharged", "label": "Discharged Bankrupt"}]` | `CreditHistory`  | General rule.                                                        |
| `bankruptcy_discharge_date`       | "If discharged, what was the discharge date?" (Conditional)                   | `String`        | `null` (Date format)                                                                                                                                    | `CreditHistory`  | General rule (needs date comparison logic).                          |
| `asset_type_requested`            | "What type of asset are you looking to finance?"                                | `String`        | `[{"value": "Motor Vehicle", "label": "Motor Vehicle"}, {"value": "Caravan", "label": "Caravan"}, ...]`                                                | `LoanDetails`    | Needed for product selection/rules.                                  |
| `loan_amount`                     | "How much do you wish to borrow?"                                               | `Number`        | `null`                                                                                                                                                  | `LoanDetails`    | Checked against product `max_loan_amount`.                           |
| `asset_value`                     | "What is the estimated value of the asset?"                                     | `Number`        | `null`                                                                                                                                                  | `LoanDetails`    | Needed for LVR calculation (outside engine).                           |
| `asset_age_years`                 | "What is the age of the asset in years?"                                        | `Number`        | `null`                                                                                                                                                  | `LoanDetails`    | Needed for rate determination & end-of-term check (outside engine).  |
| `loan_term_months`                | "What is the desired loan term in months?"                                      | `Number`        | `null`                                                                                                                                                  | `LoanDetails`    | Needed for rate determination & end-of-term check (outside engine).  |
| `has_default_over_1k`             | "Do you have any defaults over $1,000?"                                         | `Boolean`       | `[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]`                                                                       | `CreditHistory`  | Used for adverse credit definition.                                  |
| `has_default_last_6_months`       | "Have you had any defaults in the last 6 months?"                              | `Boolean`       | `[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]`                                                                       | `CreditHistory`  | Used for adverse credit definition.                                  |
| `has_rhi_2_last_12_months`        | "Have you had a Repayment History Indicator of 2+ in the last 12 months?"       | `Boolean`       | `[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]`                                                                       | `CreditHistory`  | Used for adverse credit definition.                                  |
| `has_court_writ_judgement`        | "Do you have any court writs or judgements?"                                    | `Boolean`       | `[{"value": true, "label": "Yes"}, {"value": false, "label": "No"}]`                                                                       | `CreditHistory`  | Used for adverse credit definition.                                  |
| `asset_purchase_type`             | "How are you purchasing this asset?"                                            | `String`        | `[{"value": "Dealer", "label": "Dealer Sale"}, {"value": "Private", "label": "Private Sale"}]`                                                         | `LoanDetails`    | Affects establishment fee and private sale limits.                   |

*You will need to assign actual `question_id`s after inserting these into the `questions` table.*

### Setting Up Question Dependencies

After inserting questions, define dependencies between them in the `question_dependencies` table:

```sql
-- Example: Only ask about spouse property if applicant is not a homeowner
INSERT INTO question_dependencies (dependent_question_id, prerequisite_question_id)
VALUES 
(/* ID for has_spouse_property */, /* ID for residence_ownership_status */);

-- Example: Only ask about savings duration if they have at least $50k
INSERT INTO question_dependencies (dependent_question_id, prerequisite_question_id)
VALUES 
(/* ID for savings_held_duration_months */, /* ID for liquid_savings_or_shares_amount */);

-- Example: Only ask about bankruptcy discharge date if they are a discharged bankrupt
INSERT INTO question_dependencies (dependent_question_id, prerequisite_question_id)
VALUES 
(/* ID for bankruptcy_discharge_date */, /* ID for bankruptcy_status */);

-- Example: Only ask about adverse credit explanation if they have adverse credit
INSERT INTO question_dependencies (dependent_question_id, prerequisite_question_id)
VALUES 
(/* ID for has_adverse_credit_explanation */, /* ID for has_adverse_credit */);
```

Note: These dependencies only define which questions *can* be asked based on previous answers. Ensuring the *correct* follow-up questions are asked (e.g., `has_spouse_property` only when `residence_ownership_status != 'HomeOwner'`) requires additional logic in the application or separate rules.

## Step 2: Create Product Variants

Insert entries into the `products` table for each tier of a Pepper product. Assume `lender_id = 1` for Pepper Money.

**Example: Pepper Motor Vehicle Loans**

```sql
-- First, add the lender
INSERT INTO lenders (lender_name) 
VALUES ('Pepper Money') 
RETURNING lender_id;  -- Capture the returned lender_id for use in subsequent inserts

-- Tier A Motor Vehicle
INSERT INTO products (lender_id, product_name, loan_type, min_loan_amount, max_loan_amount, min_term_months, max_term_months, asset_types_allowed, base_rate, worst_case_rate, notes)
VALUES (1, 'Pepper Motor Vehicle Tier A', 'Asset Finance', 5000, 150000, 12, 84, '{"Motor Vehicles"}', 8.79, 11.99, 'Tier A NAF $150k. Rates based on Motor Vehicle schedule. 0.5% loading applies for terms 61-84m.');

-- Tier B Motor Vehicle
INSERT INTO products (lender_id, product_name, loan_type, min_loan_amount, max_loan_amount, min_term_months, max_term_months, asset_types_allowed, base_rate, worst_case_rate, notes)
VALUES (1, 'Pepper Motor Vehicle Tier B', 'Asset Finance', 5000, 150000, 12, 84, '{"Motor Vehicles"}', 10.69, 12.99, 'Tier B NAF $150k. Rates based on Motor Vehicle schedule. 0.5% loading applies for terms 61-84m.');

-- Tier C Motor Vehicle
INSERT INTO products (lender_id, product_name, loan_type, min_loan_amount, max_loan_amount, min_term_months, max_term_months, asset_types_allowed, base_rate, worst_case_rate, notes)
VALUES (1, 'Pepper Motor Vehicle Tier C', 'Asset Finance', 5000, 40000, 12, 84, '{"Motor Vehicles"}', 15.19, 17.19, 'Tier C NAF $40k. Rates based on Motor Vehicle schedule. 0.5% loading applies for terms 61-84m.');

-- Tier A Caravan
INSERT INTO products (lender_id, product_name, loan_type, min_loan_amount, max_loan_amount, min_term_months, max_term_months, asset_types_allowed, base_rate, worst_case_rate, notes)
VALUES (1, 'Pepper Caravan Tier A', 'Asset Finance', 5000, 110000, 12, 84, '{"Caravans", "Campervans", "Motorhomes"}', 8.79, 11.99, 'Tier A NAF $110k. Maximum LVR 140%. Includes Campervans and Motorhomes.');

-- Tier B Caravan
INSERT INTO products (lender_id, product_name, loan_type, min_loan_amount, max_loan_amount, min_term_months, max_term_months, asset_types_allowed, base_rate, worst_case_rate, notes)
VALUES (1, 'Pepper Caravan Tier B', 'Asset Finance', 5000, 110000, 12, 84, '{"Caravans", "Campervans", "Motorhomes"}', 10.69, 12.99, 'Tier B NAF $110k. Maximum LVR 140%. Includes Campervans and Motorhomes.');

-- Note: Tier C does not offer Caravans per pepper.md

-- Add similar entries for Marine, Motor Bikes, Other Goods
```

**Private Sale Handling:**
Add a simple rule to restrict the NAF for private sales:

```sql
-- Example: Private Sale NAF Limit for Motor Vehicle 
INSERT INTO policy_rules (lender_id, product_id, rule_scope, policy_category, policy_attribute, operator, rule_value, value_type, is_hard_knockout, related_question_id, failure_message)
VALUES (
    1, /* product_id for relevant Motor Vehicle product */, 'Product', 'AssetFinance',
    'loan_amount', '<=', '100000', 'Number', true, /* question_id for loan_amount */,
    'Maximum NAF for private sale Motor Vehicles is $100,000'
);
```

*Note the `product_id` generated for each of these variants.*

## Step 3: Create Tier Eligibility Rules

Create entries in `complex_policy_rules` to check if an applicant meets the criteria for each specific Tier variant. Link each rule to the corresponding `product_id`.

**Example: Tier Eligibility Rules for Motor Vehicle Variants**

*Assume the `product_id`s are 101 (Tier A), 102 (Tier B), 103 (Tier C).*
*Assume you have looked up the `question_id`s for the keys listed in Step 1.* Replace `[...]` with the actual arrays of integer IDs.

```sql
-- Tier A Eligibility Rule (Linked to Product 101)
INSERT INTO complex_policy_rules (lender_id, product_id, rule_scope, policy_category, logic_structure, related_question_ids, is_hard_knockout, failure_message)
VALUES (
    1, 101, 'Product', 'Tiering Eligibility',
    '{
      "operator": "AND",
      "conditions": [
        { -- Residence: HomeOwner OR Spouse Property OR $50k+ Savings for 3+ months
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
        { -- Employment: Permanent OR Contract OR SelfEmp >= 2yr OR Casual >= 18m in special industries
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
        { -- Credit: Checkable & No Adverse
          "attribute": "has_checkable_credit_history", "op": "==", "value": true 
        },
        { 
          "attribute": "has_adverse_credit", "op": "==", "value": false 
        }
      ]
    }'::jsonb,
    ARRAY[/* IDs for residence_ownership_status, has_spouse_property, liquid_savings_or_shares_amount, 
           savings_held_duration_months, employment_status_detailed, employment_duration_years,
           employment_duration_months, employment_industry, has_checkable_credit_history, has_adverse_credit */],
    true, 'Applicant does not meet the criteria for Pepper Tier A.'
);

-- Tier B Eligibility Rule (Linked to Product 102)
INSERT INTO complex_policy_rules (lender_id, product_id, rule_scope, policy_category, logic_structure, related_question_ids, is_hard_knockout, failure_message)
VALUES (
    1, 102, 'Product', 'Tiering Eligibility',
    '{
      "operator": "AND",
      "conditions": [
        { -- Residence: Renting OR Boarding/Parents + Employed + Credit
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
        { -- Employment: Perm OR Contract OR SelfEmp >= 1yr OR Casual >= 12m + HomeOwner OR Casual >= 18m (Mining/Med/Edu)
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
        { -- Credit: Either no adverse OR has adverse with explanation
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
    ARRAY[/* IDs for residence_ownership_status, employment_status_detailed, employment_duration_years,
           employment_duration_months, employment_industry, has_checkable_credit_history, 
           has_adverse_credit, has_adverse_credit_explanation */],
    true, 'Applicant does not meet the criteria for Pepper Tier B.'
);

-- Tier C Eligibility Rule (Linked to Product 103)
INSERT INTO complex_policy_rules (lender_id, product_id, rule_scope, policy_category, logic_structure, related_question_ids, is_hard_knockout, failure_message)
VALUES (
    1, 103, 'Product', 'Tiering Eligibility',
    '{
      "operator": "AND",
      "conditions": [
        { -- Residence: Renting OR Boarding OR Living w/ Parents
          "attribute": "residence_ownership_status", "op": "IN", "value": ["Renting", "Boarding", "LivingWithParents"]
        },
        { -- Employment: Perm/Contract >= 6m (no probation) OR SelfEmp >= 1yr OR Casual >= 12m
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
        { -- Credit: No checkable credit OR some adverse with explanation
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
    ARRAY[/* IDs for residence_ownership_status, employment_status_detailed, employment_duration_months, 
           employment_duration_years, is_on_probation, has_checkable_credit_history, 
           has_adverse_credit, has_adverse_credit_explanation */],
    true, 'Applicant does not meet the criteria for Pepper Tier C.'
);
```

### Complex Rule for Adverse Credit Definition

Define a complex rule to determine if a customer has adverse credit based on Pepper's definition:

```sql
-- First, define adverse credit using pepper.md's definition
-- This isn't directly tied to product eligibility but defines a composite concept used in tier rules
INSERT INTO complex_policy_rules (lender_id, product_id, rule_scope, policy_category, logic_structure, related_question_ids, is_hard_knockout, failure_message)
VALUES (
    1, NULL, 'Lender', 'AdverseCredit',
    '{
      "operator": "OR",
      "conditions": [
        { "attribute": "has_default_over_1k", "op": "==", "value": true },
        { "attribute": "has_default_last_6_months", "op": "==", "value": true },
        { "attribute": "has_rhi_2_last_12_months", "op": "==", "value": true },
        { "attribute": "has_court_writ_judgement", "op": "==", "value": true }
      ]
    }'::jsonb,
    ARRAY[/* IDs for has_default_over_1k, has_default_last_6_months, has_rhi_2_last_12_months, has_court_writ_judgement */],
    false, 'Applicant has adverse credit history per Pepper criteria.'
);
```

## Step 4: Create Global and Lender-Wide Rules

Add simple `policy_rules` for criteria that apply across all products or all Pepper products.

```sql
-- Minimum Age requirement (Global)
INSERT INTO policy_rules (rule_scope, policy_category, policy_attribute, operator, rule_value, value_type, is_hard_knockout, related_question_id, failure_message)
VALUES (
    'Global', 'ApplicantEligibility', 'applicant_age', '>=', '18', 'Number', true, 
    /* question_id for applicant_age */,
    'Applicant must be at least 18 years old.'
);

-- Current Bankruptcy not accepted (Lender-wide)
INSERT INTO policy_rules (lender_id, rule_scope, policy_category, policy_attribute, operator, rule_value, value_type, is_hard_knockout, related_question_id, failure_message)
VALUES (
    1, 'Lender', 'CreditHistory', 'bankruptcy_status', '!=', 'Current', 'String', true, 
    /* question_id for bankruptcy_status */,
    'Current bankrupts are not accepted.'
);

-- Discharged Bankruptcy must be > 2 years (Lender-wide)
INSERT INTO complex_policy_rules (lender_id, rule_scope, policy_category, logic_structure, related_question_ids, is_hard_knockout, failure_message)
VALUES (
    1, 'Lender', 'CreditHistory',
    '{
      "operator": "OR",
      "conditions": [
        { "attribute": "bankruptcy_status", "op": "!=", "value": "Discharged" },
        {
          "operator": "AND",
          "conditions": [
            { "attribute": "bankruptcy_status", "op": "==", "value": "Discharged" },
            -- Note: This simplified approach requires special handling in application
            -- to calculate years since discharge
            { "attribute": "bankruptcy_discharge_years", "op": ">=", "value": 2 }
          ]
        }
      ]
    }'::jsonb,
    ARRAY[/* IDs for bankruptcy_status, bankruptcy_discharge_years */],
    true, 'Ex-bankrupts must be discharged > 2 years.'
);

-- Excluded asset types (Lender-wide)
INSERT INTO policy_rules (lender_id, rule_scope, policy_category, policy_attribute, operator, rule_value, value_type, is_hard_knockout, related_question_id, failure_message)
VALUES (
    1, 'Lender', 'AssetType', 'asset_type_requested', 'NOT IN', '["Racing Car", "Taxi", "Limousine"]', 'List_String', true, 
    /* question_id for asset_type_requested */,
    'Racing cars, taxis, limousines, and other assets which are rare, highly untraceable, or difficult to recover will not be considered.'
);

-- Maximum asset age at end of term must be <= 15 years (Lender-wide)
-- Note: This requires calculation in the application layer or a separate pre-calculated question
INSERT INTO policy_rules (lender_id, rule_scope, policy_category, policy_attribute, operator, rule_value, value_type, is_hard_knockout, related_question_id, failure_message)
VALUES (
    1, 'Lender', 'AssetProperties', 'calculated_asset_end_age', '<=', '15', 'Number', true, 
    /* question_id for a calculated field or special handling */,
    'Maximum asset age at the end of term is 15 years.'
);
```

## Step 5: Handle Other Rules and Calculations

*   **LVR & Calculated Fields:** As the engine doesn't perform calculations:
    *   **Option 1 (Recommended):** Perform calculations like LVR (`loan_amount / asset_value`) in the application layer *after* determining qualifying product variants. Then, apply any LVR policy checks there.
    
    *   **Option 2:** Create questions for calculated values (e.g., `calculated_lvr`). Have the application calculate the value, submit it as an "answer" to this question, and then use a simple `policy_rule`:
      ```sql
      -- Example LVR rule for Tier A Motor Vehicle (180% LVR maximum)
      INSERT INTO policy_rules (product_id, rule_scope, policy_category, policy_attribute, operator, rule_value, value_type, is_hard_knockout, related_question_id, failure_message)
      VALUES (
          /* product_id for Tier A Motor Vehicle */, 'Product', 'LVR', 'calculated_lvr', '<=', '1.8', 'Number', true, 
          /* question_id for calculated_lvr */,
          'Maximum LVR for Tier A Motor Vehicle is 180%.'
      );
      ```

*   **Repayment as % of Income:**
    Pepper has tier-specific limits on the new loan repayment as % of net monthly income:
    - Tier A: 35%
    - Tier B: 30%
    - Tier C: 25%
    
    These can be handled as:
    ```sql
    -- Example for Tier A repayment/income ratio
    INSERT INTO policy_rules (product_id, rule_scope, policy_category, policy_attribute, operator, rule_value, value_type, is_hard_knockout, related_question_id, failure_message)
    VALUES (
        /* product_id for Tier A products */, 'Product', 'Serviceability', 'calculated_repayment_income_ratio', '<=', '0.35', 'Number', true, 
        /* question_id for calculated ratio */,
        'Maximum new loan repayment as percentage of net monthly income for Tier A is 35%.'
    );
    ```

*   **Precise Rate Calculation:** The `base_rate` and `worst_case_rate` in product entries provide the *range*. The exact rate based on `asset_age_years`, `loan_term_months` (including the 0.50% loading for 61-84 months), and balloon payments needs external calculation.

*   **Asset Age at Term End:** For the `asset_age_years + loan_term_months/12 <= 15` check, either:
    - Calculate this post-eligibility in the application
    - Create a pre-calculated question and a simple rule against it

This product variant strategy allows modeling of tier-specific eligibility and rate ranges within the existing system but requires careful data entry and acknowledges that calculations must be handled separately. 