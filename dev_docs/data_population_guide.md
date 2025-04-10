# Guide: Populating the Loan Product Finder Database

**Objective:** To accurately translate product details, eligibility criteria, and application questions from lender documents (Liberty, Latitude, Pepper, etc.) into the Supabase database tables for the Loan Product Finder backend.

**Source Documents:** PDF guidelines provided by each lender (Liberty, Latitude, Pepper).

**Target Database:** Supabase PostgreSQL instance associated with this project.

**Process Overview:**

1.  **Understand the Schema:** Familiarize yourself with the purpose and structure of each relevant table described below.
2.  **Extract Data Systematically:** Go through each lender's document section by section (e.g., product types, eligibility rules, credit policy).
3.  **Map Data to Tables:** Identify which table and fields correspond to the information found.
4.  **Ensure Consistency:** Use consistent naming conventions (especially for `question_key`) and data formats.
5.  **Handle IDs:** When inserting data that references other tables (e.g., rules referencing products or questions), you will need the `*_id` (PK) of the referenced record. You may need to query the database to find these IDs after inserting the primary records (lenders, products, questions) or keep track manually during the process. Using SQL scripts for seeding can help manage these dependencies.
6.  **Start Small:** Consider fully populating one lender's data first before moving to the next.

---

## Table Population Details

### 1. `lenders` Table

*   **Purpose:** Stores basic information about each lender.
*   **Fields:**
    *   `lender_id` (SERIAL PK): Auto-generated. Note this ID when adding products.
    *   `lender_name` (TEXT NN UQ): The official name of the lender (e.g., "Liberty Financial", "Latitude Financial Services", "Pepper Money"). Must be unique.
    *   `created_at`: Auto-generated.

### 2. `products` Table

*   **Purpose:** Stores details about each specific loan product offered by a lender.
*   **Fields:**
    *   `product_id` (SERIAL PK): Auto-generated. Note this ID when adding rules specific to this product.
    *   `lender_id` (INT FK): The `lender_id` from the `lenders` table for the lender offering this product.
    *   `product_name` (TEXT NN): The specific name of the loan product (e.g., "Liberty Star", "Latitude Personal Loan", "Pepper Near Prime"). Must be unique *per lender*.
    *   `loan_type` (TEXT NN): The category of the loan (e.g., "Personal Loan", "Car Loan", "Mortgage", "Asset Finance"). Standardize these terms.
    *   `min_loan_amount` (NUMERIC): Minimum amount that can be borrowed for this product.
    *   `max_loan_amount` (NUMERIC): Maximum amount that can be borrowed.
    *   `min_term_months` (INT): Minimum loan term in months.
    *   `max_term_months` (INT): Maximum loan term in months.
    *   `asset_types_allowed` (TEXT[]): A PostgreSQL array of strings listing the types of assets that can be financed or used as security (e.g., `{"New Car", "Used Car", "Motorbike", "Property"}`). Extract from product descriptions or security requirements. Use `{}` for empty or not applicable.
    *   `base_rate` (NUMERIC): The best *indicative* interest rate advertised or typically offered for this product (often depends on risk). Find the lowest representative rate.
    *   `worst_case_rate` (NUMERIC): The highest *indicative* interest rate possible for this product. Find the highest representative rate. (Used for Rate Differentiation scoring).
    *   `notes` (TEXT): Any additional relevant notes about the product not captured elsewhere.
    *   `created_at`: Auto-generated.

### 3. `questions` Table

*   **Purpose:** Defines every question that *might* need to be asked to determine eligibility for *any* product based on the rules found in the lender documents.
*   **Fields:**
    *   `question_id` (SERIAL PK): Auto-generated. Note this ID when creating rules or dependencies related to this question.
    *   `question_key` (TEXT NN UQ): A unique, programmatic identifier for the question (e.g., `net_monthly_income`, `employment_status`, `residency_status_au`, `asset_type_requested`). Use snake_case. **This key is crucial as it links rules (`policy_attribute`) to answers.** Must be unique across all questions.
    *   `question_text` (TEXT NN): The actual text of the question as it would be presented to the user (e.g., "What is your gross annual income?", "What is your current employment status?").
    *   `answer_type` (TEXT NN): The expected data type of the answer. Must match one of the types defined in Appendix A (`Number`, `String`, `Boolean`, `List_String`, `List_Number`). Determines basic validation.
    *   `possible_answers` (JSONB): For questions with predefined choices (like dropdowns or radio buttons). Store as a JSON array of objects, e.g., `[{"value": "FullTime", "label": "Full Time"}, {"value": "PartTime", "label": "Part Time"}, {"value": "SelfEmployed", "label": "Self Employed"}]` or a simple array `["Yes", "No"]`. Use `null` if the answer is free-form text/number.
    *   `validation_rules` (JSONB): Specific validation rules beyond basic type checking. Store as a JSON object, e.g., `{"min": 0, "max": 1000000}` for income, `{"minLength": 5, "maxLength": 100}` for a text field, `{"pattern": "^\\d{4}$"}` for a postcode, `{"enum": ["VIC", "NSW", "QLD"]}` for allowed states. See `src/api/sessionRoutes.js` `validateAnswer` function for supported rule keys (`minLength`, `maxLength`, `pattern`, `min`, `max`, `enum`). Use `null` if no specific rules apply beyond `answer_type`.
    *   `help_text` (TEXT): Optional text providing clarification or help for the user answering the question.
    *   `question_group` (TEXT NN): A category for grouping related questions (e.g., `ApplicantInfo`, `Employment`, `Income`, `Expenses`, `Assets`, `Liabilities`, `LoanDetails`). Used for Conversational Flow scoring. Define logical groups based on lender application forms/sections.
    *   `display_priority` (INT NN DEFAULT 0): Determines the default order *within* a `question_group`. Lower numbers are asked first. Used for Conversational Flow scoring and tie-breaking.
    *   `created_at`: Auto-generated.

### 4. `policy_rules` Table (Simple Rules)

*   **Purpose:** Defines single-condition eligibility rules.
*   **Fields:**
    *   `rule_id` (SERIAL PK): Auto-generated.
    *   `lender_id` (INT FK): Link to `lenders` table if the rule applies only to a specific lender (use `null` for Global or Product scope).
    *   `product_id` (INT FK): Link to `products` table if the rule applies only to a specific product (use `null` for Global or Lender scope).
    *   `rule_scope` (TEXT NN): Defines applicability:
        *   `Global`: Applies to all lenders and products.
        *   `Lender`: Applies to all products of the specified `lender_id`.
        *   `Product`: Applies only to the specified `product_id`.
    *   `policy_category` (TEXT NN): Broad category of the rule (e.g., `CreditScore`, `Employment`, `Income`, `LVR`, `Residency`, `Asset`). Used for Rate Differentiation scoring. Standardize these categories.
    *   `policy_attribute` (TEXT NN): The `question_key` from the `questions` table that provides the data needed to evaluate this rule. **Must exactly match a `question_key`**.
    *   `operator` (TEXT NN): The comparison operator. Must be one of the operators defined in Appendix A (e.g., `==`, `>=`, `<`, `IN`, `Exists`).
    *   `rule_value` (TEXT NN): The value to compare the user's answer against. Format depends on `value_type` (see Appendix A).
        *   Numbers: `"50000"`, `"0.8"`
        *   Strings: `"FullTime"`, `"PAYG"`
        *   Booleans: `"true"`, `"false"`
        *   Lists: `"[\"VIC\", \"NSW\"]"`, `"[1, 5, 10]"` (Must be valid JSON array string).
    *   `value_type` (TEXT NN): The data type of `rule_value`. Must be one of the types defined in Appendix A (`Number`, `String`, `Boolean`, `List_String`, `List_Number`).
    *   `is_hard_knockout` (BOOL NN DEFAULT FALSE): Set to `true` if failing this rule immediately disqualifies the product/lender. Set to `false` if it's a guideline or contributes to scoring (future). Most policy rules will likely be `true`.
    *   `related_question_id` (INT FK): The `question_id` from the `questions` table corresponding to the `policy_attribute`. This explicitly links the rule to the question.
    *   `failure_message` (TEXT): Optional user-friendly message explaining why a hard knockout rule failed (if applicable).
    *   `created_at`: Auto-generated.

*   **Example Translation:**
    *   *Lender Doc Rule:* "Pepper Money requires applicants to be Australian Citizens or Permanent Residents."
    *   *Requires Question:* `question_key`: `residency_status_au`, `question_text`: "What is your residency status in Australia?", `answer_type`: `String`, `possible_answers`: `[{"value": "Citizen", "label": "Australian Citizen"}, {"value": "PermanentResident", "label": "Permanent Resident"}, {"value": "TemporaryResident", "label": "Temporary Resident (Visa Holder)"}, {"value": "Other", "label": "Other"}]`
    *   *Policy Rule Entry:*
        *   `lender_id`: (ID for Pepper Money)
        *   `product_id`: `null` (Applies to all Pepper products)
        *   `rule_scope`: `Lender`
        *   `policy_category`: `Residency`
        *   `policy_attribute`: `residency_status_au`
        *   `operator`: `IN`
        *   `rule_value`: `"[\"Citizen\", \"PermanentResident\"]"`
        *   `value_type`: `List_String`
        *   `is_hard_knockout`: `true`
        *   `related_question_id`: (ID for the `residency_status_au` question)
        *   `failure_message`: "Applicant must be an Australian Citizen or Permanent Resident for Pepper Money loans."

### 5. `complex_policy_rules` Table (Complex Rules)

*   **Purpose:** Defines multi-condition eligibility rules using AND/OR logic.
*   **Fields:**
    *   `complex_rule_id` (SERIAL PK): Auto-generated.
    *   `lender_id` (INT FK): Link to `lenders` if Lender scope.
    *   `product_id` (INT FK): Link to `products` if Product scope.
    *   `rule_scope` (TEXT NN): `Global`, `Lender`, or `Product`.
    *   `policy_category` (TEXT NN): Broad category (e.g., `Servicing`, `Affordability`).
    *   `logic_structure` (JSONB NN): Defines the rule logic. See Appendix A and examples below.
        *   Top level must have `"operator": "AND"` or `"operator": "OR"`.
        *   Must have `"conditions": [...]` array.
        *   Each condition is an object: `{"attribute": "question_key", "op": "operator", "value": value}`.
        *   `value` type is inferred from JSON (string, number, boolean, array).
        *   Conditions can be nested by making a condition object itself have `"operator"` and `"conditions"`.
    *   `related_question_ids` (INT[] NN): A PostgreSQL array of **all** `question_id`s corresponding to the `attribute`s used anywhere within the `logic_structure`. E.g., `{10, 15, 22}`.
    *   `is_hard_knockout` (BOOL NN DEFAULT FALSE): `true` if failing this complex rule is an immediate knockout.
    *   `failure_message` (TEXT): Optional message if the rule fails.
    *   `created_at`: Auto-generated.

*   **Example `logic_structure`:**
    *   *Rule:* "Income must be > $60k AND (Employment Status is FullTime OR Employment Status is PermanentPartTime)"
    *   *JSON:*
        ```json
        {
          "operator": "AND",
          "conditions": [
            {
              "attribute": "net_monthly_income",
              "op": ">",
              "value": 60000
            },
            {
              "operator": "OR",
              "conditions": [
                {
                  "attribute": "employment_status",
                  "op": "==",
                  "value": "FullTime"
                },
                {
                  "attribute": "employment_status",
                  "op": "==",
                  "value": "PermanentPartTime"
                }
              ]
            }
          ]
        }
        ```
    *   *Requires Questions:* `net_monthly_income`, `employment_status`.
    *   *`related_question_ids` would be:* `{ (ID for net_monthly_income), (ID for employment_status) }`

### 6. `question_dependencies` Table

*   **Purpose:** Defines prerequisites between questions.
*   **Fields:**
    *   `dependency_id` (SERIAL PK): Auto-generated.
    *   `dependent_question_id` (INT NN FK): The `question_id` of the question that should *only* be asked if the prerequisite is met.
    *   `prerequisite_question_id` (INT NN FK): The `question_id` of the question that must be answered *before* the dependent question can be asked.
    *   `created_at`: Auto-generated.

*   **Example:**
    *   *Scenario:* Only ask for "ABN" (`question_id` 25) if "Employment Status" (`question_id` 12) is answered as "SelfEmployed". (Note: The *value* check happens in rules, this table just ensures the ABN question isn't asked if employment status hasn't been answered at all).
    *   *Entry:*
        *   `dependent_question_id`: 25
        *   `prerequisite_question_id`: 12

---

**Recommendation:**

Create spreadsheets or structured documents mapping the lender PDF information to these table structures first. This makes review easier before committing data to Supabase or writing final SQL seed scripts. Pay close attention to detail, especially with rule logic and IDs.

---

## Best Practices and Learnings

### 1. Standardized Boolean Answers
For questions requiring Yes/No answers, use the following standardized format in the `possible_answers` field:
```json
[
  {"value": true, "label": "Yes"},
  {"value": false, "label": "No"}
]
```
This ensures consistency across the application and simplifies rule evaluation.

### 2. Handling Calculated Fields
Some lender rules rely on calculated values (e.g., LVR, DTI ratios) that aren't directly asked questions. Handle these by:

1. Creating separate questions for the components (e.g., `property_value` and `loan_amount` for LVR)
2. Using `complex_policy_rules` to implement the calculation logic
3. Documenting the calculation method in the rule's `failure_message`

Example for LVR calculation:
```json
{
  "operator": "AND",
  "conditions": [
    {
      "operator": "/",
      "conditions": [
        {"attribute": "loan_amount", "op": "value"},
        {"attribute": "property_value", "op": "value"}
      ],
      "op": "<=",
      "value": 0.8
    }
  ]
}
```

### 3. Product Variants Pattern
When products have complex tiering based on applicant profiles:

1. Create separate product entries for each major variant
2. Use a consistent naming pattern: `{base_product_name} - {variant_type}`
3. Link variants through the `notes` field in the `products` table
4. Create specific rules for each variant

Example:
```sql
-- Base product
INSERT INTO products (product_name, ...) 
VALUES ('Pepper Essential', ...);

-- Variants
INSERT INTO products (product_name, notes, ...)
VALUES 
  ('Pepper Essential - Prime', 'Variant of Pepper Essential for prime customers', ...),
  ('Pepper Essential - Near Prime', 'Variant of Pepper Essential for near-prime customers', ...);
```

### 4. PostgreSQL Array Types
When working with array fields:

- `asset_types_allowed` (TEXT[]): Use consistent terminology across lenders
  ```sql
  -- Good
  asset_types_allowed = '{"New Car", "Used Car", "Motorcycle"}'
  
  -- Avoid
  asset_types_allowed = '{"New Vehicle", "Second Hand Auto", "Motorbike"}'
  ```

- `related_question_ids` (INT[]): Always verify foreign key relationships
  ```sql
  -- Verify questions exist before creating dependencies
  SELECT question_id FROM questions 
  WHERE question_id = ANY(ARRAY[10, 15, 22]);
  ```

### 5. Managing Primary/Foreign Key Relationships
When creating seed scripts:

1. Use variables or temporary tables to store generated IDs
2. Insert data in the correct order: lenders → products → questions → rules
3. Verify foreign key relationships before insertion
4. Use transaction blocks to ensure data consistency

Example seed script structure:
```sql
BEGIN;

-- Store lender ID
WITH inserted_lender AS (
  INSERT INTO lenders (lender_name)
  VALUES ('New Lender')
  RETURNING lender_id
)
-- Use the ID for products
INSERT INTO products (lender_id, product_name, ...)
SELECT lender_id, 'Product Name', ...
FROM inserted_lender;

COMMIT;
```

### 6. Question Grouping Strategy
Group questions logically to improve the user experience:

1. Use consistent `question_group` values across lenders
2. Set `display_priority` to ensure logical flow
3. Consider dependencies when ordering questions

Recommended question groups:
- `ApplicantInfo`: Basic personal details
- `Employment`: Work status and history
- `Income`: All income sources
- `Expenses`: Living expenses and commitments
- `Assets`: Property, vehicles, savings
- `Liabilities`: Existing loans and debts
- `LoanDetails`: Specific loan requirements

Remember to maintain consistency in naming and structure across all lenders to ensure the engine can effectively compare and evaluate products.