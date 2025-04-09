# Implementation Plan: Loan Product Finder Backend

**Project Goal:**

Build the backend service for an intelligent loan product finder. This service will:

1.  Store detailed information about lenders (Liberty, Latitude, Pepper, etc.), their loan products, and the rules that determine eligibility.
2.  Interact via an API to ask a user relevant questions one at a time.
3.  Intelligently choose the next question based on:
    *   Narrowing down eligible products efficiently (Elimination Power).
    *   Helping identify eligibility for products with potentially lower interest rates (Rate Differentiation).
    *   Making the question sequence feel logical (Conversational Flow).
4.  Keep track of the user's answers and the list of products they might still qualify for.
5.  Store this progress in a database so users can potentially resume later and for auditing.
6.  Allow users to change previous answers and correctly recalculate eligibility.

**Target User:** A future User Interface (UI) used by finance brokers or similar.

**Technology Stack:**

*   **Database:** Supabase (PostgreSQL)
*   **Backend Language/Framework:** Node.js/Express.js
*   **API Format:** RESTful API using JSON

**Project Setup & Environment:**

*   **[x] Node.js Project:** Initialize a new Node.js project (`npm init -y`).
*   **[x] Core Dependencies:** Install necessary packages: `npm install express @supabase/supabase-js dotenv`
*   **[x] Development Dependencies:** Install testing and development tools: `npm install --save-dev jest supertest nodemon`
*   **[x] Environment Variables:** Use a `.env` file (add to `.gitignore`) to manage sensitive keys and configurations:
    *   `SUPABASE_URL`: Your Supabase project URL.
    *   `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (keep secure!).
    *   (Optional/Later) Variables for scoring weights, rate categories, group order if not using a config file.
*   **[x] Configuration:** Manage configurable parameters (scoring weights, rate categories, group order) either via environment variables (loaded using `dotenv`) or a dedicated configuration file (e.g., `src/config/scoringConfig.js`). Environment variables are simpler initially.
*   **[x] Running Locally:** Add scripts to `package.json`:
    *   `"start": "node src/server.js"` (for production)
    *   `"dev": "nodemon src/server.js"` (for development with auto-restart)
    *   Run with `npm run dev`.
*   **[x] Code Structure (Suggestion):**
    ```
    .
    ├── db/
    │   ├── schema/
    │   └── seeds/
    ├── src/
    │   ├── api/         # Express routes/controllers
    │   ├── services/    # Business logic (eligibility, scoring, session)
    │   ├── db/          # Database interaction functions (using Supabase client)
    │   ├── config/      # Application configuration (if not using only .env)
    │   ├── utils/       # Helper functions
    │   └── server.js    # Express app setup and server start
    ├── tests/         # Unit and integration tests
    ├── .env           # Environment variables (ignored by git)
    ├── .gitignore
    ├── package.json
    └── README.md      # Project overview
    ```
*   **[x] Database Schema & Seed Application (CLI Method):**
    1.  Ensure Supabase CLI is installed (`brew install supabase/tap/supabase` or equivalent).
    2.  Log in to the CLI: `supabase login` (follow browser prompts).
    3.  Link the project: `supabase link --project-ref <your-project-ref>` (replace with your actual project ref). Enter DB password if prompted.
    4.  Initialize local Supabase config: `supabase init`. This creates the `supabase` directory.
    5.  Move schema definition (`db/schema/...sql`) into a migration file (e.g., `supabase/migrations/0000_init_schema.sql`). (This tool will handle this step).
    6.  Move seed data (`db/seeds/...sql`) into `supabase/seed.sql`. (This tool will handle this step).
    7.  Apply the schema migration to the linked remote database: `supabase db push`.
    8.  **Apply Seed Data via Script:** Execute the custom Node.js seeding script: `npm run seed:remote`. (Requires the `execute_raw_sql` Postgres function to be created in Supabase via SQL Editor - see `scripts/seedRemoteDb.js` for definition).

---

**Implementation Plan**

**Phase 1: Database Foundation (Supabase)**

*(Goal: Set up the database structure to hold all the necessary information. Test basic data retrieval.)*

*   **[x] Step 1.1: Setup Supabase Project** (User performed)
    *   Create a new project in Supabase.
    *   Locate and securely store your project URL and `service_role` key.
*   **[x] Step 1.2: Create Core Tables (`lenders`, `products`, `questions`)** (Via migration `0000_init_schema.sql`)
    *   Using the Supabase SQL Editor or Table Editor, create:
        *   `lenders` Table: `lender_id` (SERIAL PK), `lender_name` (TEXT NN UQ), `created_at` (TIMESTAMPTZ DEFAULT now()).
        *   `products` Table: `product_id` (SERIAL PK), `lender_id` (INT FK REFERENCES lenders(lender_id)), `product_name` (TEXT NN), `loan_type` (TEXT NN), `min_loan_amount` (NUMERIC), `max_loan_amount` (NUMERIC), `min_term_months` (INT), `max_term_months` (INT), `asset_types_allowed` (TEXT[]), `base_rate` (NUMERIC, Best indicative rate), `worst_case_rate` (NUMERIC, Highest indicative rate), `notes` (TEXT), `created_at` (TIMESTAMPTZ DEFAULT now()), UNIQUE (`lender_id`, `product_name`).
        *   `questions` Table: `question_id` (SERIAL PK), `question_key` (TEXT NN UQ), `question_text` (TEXT NN), `answer_type` (TEXT NN), `possible_answers` (JSONB), `validation_rules` (JSONB), `help_text` (TEXT), `question_group` (TEXT NN, e.g., 'ApplicantInfo', 'Employment', 'AssetDetails'), `display_priority` (INT NN DEFAULT 0, Lower number = higher priority), `created_at` (TIMESTAMPTZ DEFAULT now()). *(Note: `question_group` and `display_priority` added for Conversational Flow scoring)*.
*   **[x] Step 1.3: Populate Core Tables with Sample Data** (Via `supabase/seed.sql` and `npm run seed:remote`)
    *   Add 2-3 lenders, 4-5 products (with varying `base_rate`/`worst_case_rate`), and 5-10 questions (with different `question_group` values and `display_priority`) using the Supabase interface. Use realistic data based on the provided lender docs.
*   **[x] Step 1.4: Test Basic Data Retrieval** (Via `tests/db.test.js`)
    *   In your Node.js backend project, set up the Supabase client connection (`@supabase/supabase-js`).
    *   Write simple test scripts or functions (e.g., using Jest) to fetch data from these tables (e.g., get a product by ID, get a question by key). Ensure the connection works and data types are correct.

*(Interaction Check: These tables form the foundation. Later steps will rely on fetching data *from* them.)*

**Phase 2: Rules & Dependencies (Supabase)**

*(Goal: Model how eligibility is determined (simple and complex rules) and how questions relate to each other. Test rule/dependency retrieval.)*

*   **[x] Step 2.1: Create Rules & Dependency Tables** (Via migration `0001_rules_and_dependencies.sql`)
    *   Using the Supabase SQL Editor or Table Editor, create:
        *   `policy_rules` Table (For Simple, Single-Condition Rules):
            *   `rule_id` (SERIAL PK)
            *   `lender_id` (INT FK REFERENCES lenders(lender_id), nullable)
            *   `product_id` (INT FK REFERENCES products(product_id), nullable)
            *   `rule_scope` (TEXT NN, e.g., 'Global', 'Lender', 'Product', CHECK (`rule_scope` IN ('Global', 'Lender', 'Product')))
            *   `policy_category` (TEXT NN, e.g., 'CreditScore', 'Employment', 'LVR')
            *   `policy_attribute` (TEXT NN, Corresponds to a `question_key`)
            *   `operator` (TEXT NN, e.g., '==', '>=', 'IN', 'Exists'. See Appendix A for full list)
            *   `rule_value` (TEXT NN, Value to compare against. Format depends on `value_type`, e.g., "50000", "FullTime", "true", '["VIC","NSW"]', "[1,2,5]")
            *   `value_type` (TEXT NN, e.g., 'Number', 'String', 'Boolean', 'List_String', 'List_Number'. See Appendix A for full list)
            *   `is_hard_knockout` (BOOL NN DEFAULT FALSE)
            *   `related_question_id` (INT FK REFERENCES questions(question_id), nullable, Links rule to the primary question providing the attribute)
            *   `failure_message` (TEXT, Optional message if rule fails)
            *   `created_at` (TIMESTAMPTZ DEFAULT now())
            *   Indexes on `lender_id`, `product_id`, `related_question_id`.
        *   `complex_policy_rules` Table (For Multi-Condition Rules using AND/OR):
            *   `complex_rule_id` (SERIAL PK)
            *   `lender_id` (INT FK REFERENCES lenders(lender_id), nullable)
            *   `product_id` (INT FK REFERENCES products(product_id), nullable)
            *   `rule_scope` (TEXT NN, e.g., 'Global', 'Lender', 'Product', CHECK (`rule_scope` IN ('Global', 'Lender', 'Product')))
            *   `policy_category` (TEXT NN)
            *   `logic_structure` (JSONB NN, Defines the AND/OR logic, e.g., `{"operator": "AND", "conditions": [{"attribute": "income", "op": ">=", "value": 50000}, {"attribute": "employment_status", "op": "==", "value": "FullTime"}]}`. See Appendix A for structure details)
            *   `related_question_ids` (INT[] NN, Array of question IDs needed for this complex rule)
            *   `is_hard_knockout` (BOOL NN DEFAULT FALSE)
            *   `failure_message` (TEXT, Optional message if rule fails)
            *   `created_at` (TIMESTAMPTZ DEFAULT now())
            *   Indexes on `lender_id`, `product_id`. Consider GIN index on `related_question_ids`.
        *   `question_dependencies` Table:
            *   `dependency_id` (SERIAL PK)
            *   `dependent_question_id` (INT NN FK REFERENCES questions(question_id))
            *   `prerequisite_question_id` (INT NN FK REFERENCES questions(question_id))
            *   `created_at` (TIMESTAMPTZ DEFAULT now())
            *   UNIQUE (`dependent_question_id`, `prerequisite_question_id`)
            *   Index on `dependent_question_id`.
*   **[x] Step 2.2: Populate Rules & Dependencies with Sample Data** (Via `supabase/seed_rules_deps.sql` and `npm run seed:remote`)
    *   Add sample rules to `policy_rules` linking to your sample products/questions. Include rules with different scopes, operators, value types, and link some to questions. Make some hard knockouts.
    *   Add sample complex rules to `complex_policy_rules` linking to sample products/questions, defining the `logic_structure` JSON, and listing `related_question_ids`.
    *   Add sample dependencies in `question_dependencies` linking some of your sample questions.
*   **[x] Step 2.3: Test Rule & Dependency Retrieval** (Partially done by implementing `getProductRules`, implicitly tested via API tests)
    *   In your backend project, write test functions:
        *   `getProductRules(productId)`: Fetches relevant rules from *both* `policy_rules` and `complex_policy_rules` based on the specific product ID, its lender ID (for lender-scope rules), and global scope rules. Verify it retrieves the correct combined set based on your sample data.
        *   `checkQuestionPrerequisites(dependentQuestionId)`: Fetches the prerequisite question IDs for a given question ID from `question_dependencies`. Verify results.

*(Interaction Check: The `policy_rules` and `complex_policy_rules` tables are central. The eligibility logic (Phase 4) will read these rules. The question selection logic (Phase 5) will use rules (to find relevant questions) and `question_dependencies` (to check prerequisites).)*

**Phase 3: Session State Persistence (Supabase & Backend)**

*(Goal: Set up the mechanism to store and retrieve the state of each user's interaction. Test session creation and state updates.)*

*   **[x] Step 3.1: Create Session Table** (Via migration `0002_user_sessions.sql`)
    *   Using the Supabase SQL Editor or Table Editor, create:
        *   `user_sessions` Table:
            *   `session_id` (UUID PK DEFAULT gen_random_uuid())
            *   `user_answers` (JSONB DEFAULT '{}'::jsonb)
            *   `potential_product_ids` (INT[] DEFAULT ARRAY[]::integer[])
            *   `last_asked_question_group` (TEXT, nullable, Stores the group of the last question asked, for scoring)
            *   `status` (TEXT DEFAULT 'active', e.g., 'active', 'completed', 'abandoned')
            *   `created_at` (TIMESTAMPTZ DEFAULT now())
            *   `last_updated_at` (TIMESTAMPTZ DEFAULT now())
*   **[x] Step 3.2: Implement Session Management Functions (Backend)** (In `src/services/sessionService.js`)
    *   Create functions:
        *   `createSession()`: Generates a UUID, creates a new row in `user_sessions` with default values, and returns the `session_id`. (Initialize `potential_product_ids` here - e.g., fetch *all* active product IDs initially).
        *   `getSessionState(sessionId)`: Fetches the row from `user_sessions` for the given ID. Returns the state object (or null/error if not found).
        *   `updateSessionState(sessionId, { userAnswers, potentialProductIds, lastAskedQuestionGroup, status })`: Updates the specified fields and `last_updated_at` for the given `sessionId` in the `user_sessions` table.
*   **[x] Step 3.3: Test Session Management** (Via `tests/sessionService.test.js`)
    *   Write tests:
        *   Call `createSession()`, verify a row is created in Supabase and a valid ID is returned. Check initial `potential_product_ids`.
        *   Call `getSessionState()` with the ID, verify the default state is retrieved.
        *   Call `updateSessionState()` with some dummy data (answers, product IDs, last group), then call `getSessionState()` again to verify the data was saved correctly in Supabase.

*(Interaction Check: All subsequent API endpoints (Phase 6) will use these functions to read the current state before processing and write the updated state back after processing.)*

**Phase 4: Core Eligibility Logic (Backend)**

*(Goal: Implement the logic that determines if a product is eligible based on rules and user answers. Test eligibility checks.)*

*   **[x] Step 4.1: Implement Rule Evaluation Engines (Backend)** (`evaluateRule`, `evaluateComplexRule` in `src/services/ruleService.js`)
    *   Create function `evaluateRule(rule, userAnswers)`:
        *   Takes a *simple* `policy_rules` object and the `userAnswers` map (`{question_key: value}`).
        *   Handles fetching the relevant answer based on `rule.policy_attribute` (which matches a `question_key`).
        *   **Missing Answer Handling:** If the required answer is missing and the operator is *not* `Exists` or `NotExists`, return `true` (Pass by Default). If operator is `Exists` and answer is missing, return `false`. If operator is `NotExists` and answer is missing, return `true`.
        *   If answer exists, parse `rule.rule_value` based on `rule.value_type`. Perform type coercion on the user answer if necessary (e.g., string "100" to number 100 for numeric comparison).
        *   Perform the comparison using `rule.operator`. Handle all defined operators (See Appendix A).
        *   Return `true` (pass) or `false` (fail).
    *   Create function `evaluateComplexRule(complexRule, userAnswers)`:
        *   Takes a `complex_policy_rules` object and `userAnswers`.
        *   Parses the `complexRule.logic_structure` JSONB.
        *   Recursively evaluates the nested `conditions` based on the top-level `operator` ("AND", "OR").
        *   For each condition within the JSON:
            *   Fetch the relevant answer using the `condition.attribute` (which matches a `question_key`).
            *   **Missing Answer Handling:** Apply the same "Pass by Default" logic as `evaluateRule` based on the `condition.op` and whether the answer exists.
            *   If answer exists, perform comparison between the answer and `condition.value` using `condition.op`. Infer types from JSON values (string, number, boolean, array) and perform necessary type coercion on the user answer. Handle all defined operators (See Appendix A).
        *   Combine results based on the top-level "AND" / "OR".
        *   Return `true` (pass) or `false` (fail).
*   **[x] Step 4.2: Implement Product Eligibility Checker (Backend)** (`isProductEligible` in `src/services/ruleService.js`, uses implemented `getProductRules`)
    *   Create function `isProductEligible(productId, userAnswers)`:
        *   Uses `getProductRules(productId)` (from Phase 2) to fetch all applicable simple and complex rules.
        *   Iterate through simple rules: Call `evaluateRule(rule, userAnswers)`. If `rule.is_hard_knockout` is true and the rule fails, return `false` immediately.
        *   Iterate through complex rules: Call `evaluateComplexRule(complexRule, userAnswers)`. If `complexRule.is_hard_knockout` is true and the rule fails, return `false` immediately.
        *   If all hard knockout rules passed (or there were none), return `true`.
*   **[x] Step 4.3: Test Eligibility Logic** (Unit tests for evaluators in `tests/ruleService.test.js`)
    *   Write unit tests for `evaluateRule` covering all operators, value types, and the "Pass by Default" missing answer logic.
    *   Write unit tests for `evaluateComplexRule` covering AND/OR logic, nested conditions (if implemented), various operators/types within JSON, and missing answer logic.
    *   Write tests for `isProductEligible`:
        *   Test Case 1: Product with rules, provide answers that *pass* all rules -> Expect `true`.
        *   Test Case 2: Product with rules, provide an answer that *fails* a simple `is_hard_knockout=TRUE` rule -> Expect `false`.
        *   Test Case 3: Product with rules, provide answers that *fail* a complex `is_hard_knockout=TRUE` rule -> Expect `false`.
        *   Test Case 4: Product with rules, provide an answer that *fails* a `is_hard_knockout=FALSE` rule -> Expect `true`.
        *   Test Case 5: Provide incomplete answers -> Expect `true` (unless an `Exists` rule fails or a `NotExists` rule passes inappropriately). Verify "Pass by Default" works.

*(Interaction Check: The Filtering Logic (Phase 5) and Answer Change Logic (Phase 6) will heavily rely on `isProductEligible` to determine which products remain.)*

**Phase 5: Filtering & Question Selection Logic (Backend)**

*(Goal: Implement the logic to narrow down products and intelligently select the next question. Test filtering and question selection sequence.)*

*   **[x] Step 5.1: Implement Filtering Logic (Backend)** (`filterProducts` in `src/services/ruleService.js`)
    *   Create function `filterProducts(potentialProductIds, userAnswers)`:
        *   Takes the current list of product IDs and all user answers.
        *   Uses `isProductEligible(productId, userAnswers)` for each product ID in the list.
        *   Returns a *new* list containing only the IDs for which `isProductEligible` returned `true`.
*   **[x] Step 5.2: Implement Question Selection Logic (Backend)** (`selectNextQuestion` in `src/services/ruleService.js`, includes implemented helpers `checkQuestionPrerequisites`, `getQuestionDetails`)
    *   Create function `selectNextQuestion(potentialProductIds, userAnswers, lastAskedQuestionGroup)`:
        1.  Get applicable simple (`policy_rules`) and complex (`complex_policy_rules`) rules for the current `potentialProductIds`.
        2.  Identify all unique `related_question_id`s from applicable simple rules and `related_question_ids` from applicable complex rules.
        3.  Filter this set to find questions not yet present in `userAnswers` (`unansweredQuestionIds`).
        4.  Filter `unansweredQuestionIds` based on prerequisites using `checkQuestionPrerequisites` and `userAnswers` to get `eligibleCandidateIds`. If empty, return `null` (no more questions). Handle prioritizing unmet prerequisites first.
        5.  **Scoring:** For each `eligibleCandidateId`:
            *   Fetch question details (`question_group`, `display_priority`).
            *   **Calculate Elimination Power Score:**
                *   Find applicable simple/complex rules linked to this candidate ID.
                *   Score = (Count of linked hard knockout rules * 2) + (Count of linked non-hard knockout rules * 1).
            *   **Calculate Rate Differentiation Score:**
                *   Check if any linked applicable rules have a `policy_category` in the configured list of rate-influencing categories (e.g., `['CreditScore', 'LVR', 'LoanPurpose', 'SecurityValue', 'IncomeVerification']`).
                *   Score = 1 if yes, 0 if no.
            *   **Calculate Conversational Flow Score:**
                *   Base Score = (1 / `display_priority`) * 0.1 (Adjust multiplier as needed).
                *   Group Bonus: +1.0 if `candidate_group` == `lastAskedQuestionGroup`; +0.5 if `candidate_group` is next in configured order; +0.1 if `lastAskedQuestionGroup` is null.
            *   **Calculate Dependency Score:** + WEIGHT_DEPENDENCY if the question is dependent and its prerequisite is met.
            *   **Combine Scores:** Total Score = (EliminationScore * Config.Weight_Elimination) + (RateDiffScore * Config.Weight_RateDiff) + (FlowScore * Config.Weight_Flow) + (DependencyScore * Config.Weight_Dependency).
        6.  Select the `eligibleCandidateId` with the highest Total Score. Tie-break using lowest `display_priority`, then lowest `question_id`.
        7.  Fetch full question details for the selected ID using `getQuestionDetails(id)`.
        8.  Return the question object.
    *   **Configuration:** Ensure scoring weights, rate categories, and group order are easily configurable (e.g., via environment variables or a config file).
*   **[x] Step 5.3: Test Filtering & Selection** (All API/service tests passing)
    *   **[x]** Test `filterProducts`: Provide product IDs and answers, verify the returned list is correctly filtered based on sample simple and complex rules. (Covered by `tests/ruleService.test.js`)
    *   Test `selectNextQuestion`:
        *   **[x]** Test initial state (all products, no answers) -> Verify expected first question. (Passed in `tests/api.test.js`)
        *   **[x]** Test state where prerequisites are not met -> Verify dependent question is *not* selected, but prerequisite *is*. (Passed in `tests/api.test.js`)
        *   **[x]** Test state where prerequisites *are* met -> Verify dependent question *is* selected. (Passed in `tests/api.test.js` after score weight adjustment)
        *   Test state where a rate-related question becomes eligible -> Verify scoring boost. (Implicitly tested, could be more explicit)
        *   Test state involving complex rules -> Verify questions from `related_question_ids` are considered. (Implicitly tested)
        *   Step through a sequence: provide answers one by one and check if the *next* selected question seems logical based on scoring priorities. (Partially tested via dependency test)

*(Interaction Check: The API endpoints (Phase 6) will call `filterProducts` after answers are submitted/changed and `selectNextQuestion` to determine what to ask next.)*

**Phase 6: API Endpoints (Backend)**

*(Goal: Expose the core logic through a web API using Express.js. Test API interactions end-to-end.)*

*   **[x] Step 6.1: Implement API Endpoints** (Handlers implemented in `src/api/sessionRoutes.js`)
    *   Set up Express.js routes:
        *   `POST /sessions`
        *   `GET /sessions/:sessionId/next_question`
        *   `POST /sessions/:sessionId/answers`
        *   `PATCH /sessions/:sessionId/answers/:questionKey`
        *   `GET /sessions/:sessionId/eligible_products`
*   **[x] Step 6.2: Implement Error Handling & Validation** (Global handler exists. `express-validator` and `validateAnswer` helper added.)
    *   Utilize Express middleware for common tasks like JSON body parsing (`express.json()`).
    *   Implement input validation using a library like `express-validator`.
    *   Implement centralized error handling using an Express error-handling middleware function.
*   **[x] Step 6.3: Test API Endpoints** (All tests in `tests/api.test.js` for implemented routes are passing.)
    *   Use tools like Postman, `curl`, or automated API testing frameworks (like Jest with `supertest`).
    *   Test the full flow: Create session -> Get question -> Post answer -> Get next question -> Post answer -> Get eligible products -> Change an answer (PATCH) -> Get eligible products (verify change) -> Get next question.
    *   Test edge cases: Invalid session ID, bad answer format, completing the flow (no more questions), invalid `questionKey` for PATCH.

*(Interaction Check: This phase connects all previous logic (Session, Eligibility, Filtering, Selection) and makes it usable by external clients like a future UI.)*

*(Developer Note: Scoring weights in `src/services/ruleService.js` (SCORING_CONFIG) were adjusted to fix initial question selection bug and prioritize dependent questions.)*

**Phase 8: Deployment & Documentation**

*(Goal: Prepare the service for use and document how it works.)*

*   **Step 8.1: Prepare for Deployment:** Configure environment variables (Supabase URL/Key, scoring weights, etc.), choose deployment strategy (e.g., Docker container on Fly.io, Vercel Serverless, AWS Lambda).
*   **Step 8.2: Deploy:** Deploy the backend service to a staging/production environment.
*   **Step 8.3: API Documentation:** Create clear documentation for the API endpoints (e.g., using Swagger/OpenAPI specification generated from code comments or manually). Explain how to start a session, submit answers, change answers, and get results. Include example requests/responses.
*   **Step 8.4: Maintenance Plan:** Document the process needed to update the lender rules in Supabase (`policy_rules`, `complex_policy_rules`) when guidelines change. Define who is responsible and the testing required after updates.

---

**Appendix A: Rule Operators and Types**

**1. Simple Rules (`policy_rules`)**

*   **Operators (`operator` column):**
    *   `==` (Equals)
    *   `!=` (Not Equals)
    *   `>` (Greater Than)
    *   `<` (Less Than)
    *   `>=` (Greater Than or Equal To)
    *   `<=` (Less Than or Equal To)
    *   `IN` (Answer is within the list in `rule_value`)
    *   `NOT IN` (Answer is not within the list in `rule_value`)
    *   `Exists` (Checks if an answer exists for `related_question_id`)
    *   `NotExists` (Checks if an answer does not exist for `related_question_id`)
*   **Value Types (`value_type` column):**
    *   `Number`: For numeric comparisons. `rule_value` is a number string (e.g., "50000", "0.75").
    *   `String`: For text comparisons (case-sensitive by default). `rule_value` is text (e.g., "FullTime", "PAYG").
    *   `Boolean`: For true/false. `rule_value` is "true" or "false".
    *   `List_String`: For `IN`/`NOT IN`. `rule_value` is a JSON array string (e.g., `["VIC", "NSW"]`).
    *   `List_Number`: For `IN`/`NOT IN`. `rule_value` is a JSON array string (e.g., `[1, 2, 5]`).

**2. Complex Rules (`complex_policy_rules`)**

*   **Top-Level Operator (`logic_structure.operator`):**
    *   `AND`: All conditions must be true.
    *   `OR`: At least one condition must be true.
*   **Condition Operators (`logic_structure.conditions[].op`):**
    *   Same as simple rule operators: `==`, `!=`, `>`, `<`, `>=`, `<=`, `IN`, `NOT IN`, `Exists`, `NotExists`.
*   **Condition Value Typing (`logic_structure.conditions[].value`):**
    *   Implicit based on JSON type:
        *   JSON String -> String
        *   JSON Number -> Number
        *   JSON Boolean -> Boolean
        *   JSON Array of Strings -> List_String (for `IN`/`NOT IN`)
        *   JSON Array of Numbers -> List_Number (for `IN`/`NOT IN`)

**3. Missing Answer Handling (Default)**

*   For all operators *except* `Exists` and `NotExists`, if the required user answer is missing, the condition evaluates to `true` (Pass by Default).
*   If operator is `Exists` and answer is missing, evaluates to `false`.
*   If operator is `NotExists` and answer is missing, evaluates to `true`.

---

This step-by-step plan allows for building and testing incrementally. Each phase builds upon the previous ones, ensuring that core components are verified before adding more complexity. Remember to test thoroughly at each stage, especially after populating real data.