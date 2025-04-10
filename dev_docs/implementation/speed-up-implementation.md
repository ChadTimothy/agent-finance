# Implementation Plan: Optimize Question Selection and Retrieval

## 1. Goal

Improve the performance and logical consistency of the question selection and available question list generation process within the `ruleService.js`. Address identified issues such as redundant computations, answered questions appearing in the available list, and premature display of dependent questions.

## 2. Refactoring: Combine Question Logic (`selectNextQuestion` & `getAvailableQuestions`)

The current separation leads to redundant rule fetching/processing and inconsistent logic (especially regarding filtering and prerequisite checks).

**Steps:**

1.  **Create `determineQuestionState` function:**
    *   Location: `src/services/ruleService.js`
    *   Parameters: `potentialProductIds`, `userAnswers`, `lastAskedQuestionGroup`
    *   Logic:
        *   Fetch relevant simple and complex rules based on `potentialProductIds`.
        *   De-duplicate fetched rules (using existing composite key logic).
        *   Identify all unique candidate `question_id`s from de-duplicated rules.
        *   Fetch details for all candidate questions (`getQuestionDetails` - potentially batched).
        *   **Filter 1: Remove Answered:** Remove candidates whose `question_key` exists in `userAnswers`.
        *   **Filter 2: Check Prerequisites:** For remaining candidates, call `checkQuestionPrerequisites`. Filter out candidates whose prerequisites are *not* met.
        *   **Scoring:** Score all remaining *eligible* candidates.
            *   Calculate Elimination, RateDiff, Flow scores as currently done.
            *   **Calculate Dependency Score:** Check `question_dependencies` for each eligible candidate. Apply `WEIGHT_DEPENDENCY` boost if it's a dependent question (ensuring consistency with previous `selectNextQuestion` logic).
        *   **Sorting:** Sort the scored, eligible, unanswered, prerequisite-met candidates by `totalScore` (descending), then `display_priority` (ascending).
    *   Return Value: An object `{ nextQuestion: Question | null, availableQuestions: Question[] }`.
        *   `nextQuestion`: The first element of the sorted list, or `null` if the list is empty.
        *   `availableQuestions`: The entire sorted list (including the `nextQuestion`).

2.  **Refactor `selectNextQuestion`:**
    *   Modify `selectNextQuestion` to simply call `determineQuestionState` and return only the `nextQuestion` property from the result.

3.  **Refactor `getAvailableQuestions`:**
    *   Modify `getAvailableQuestions` to call `determineQuestionState` and return the `availableQuestions` property from the result.

4.  **Update API Endpoints (`src/api/sessionRoutes.js`):**
    *   Modify `GET /sessions/:sessionId/next_question`: Ensure it calls the refactored `selectNextQuestion`.
    *   Modify `GET /sessions/:sessionId/available_questions`: Ensure it calls the refactored `getAvailableQuestions`.
    *   *(Optional Consideration):* Create a single new endpoint (e.g., `GET /sessions/:sessionId/question_state`) that calls `determineQuestionState` once and returns both `nextQuestion` and `availableQuestions`, potentially deprecating the other two endpoints for clients that need both pieces of info.

5.  **Update Frontend (`web/src/app/page.tsx`):**
    *   Adjust frontend calls depending on whether separate endpoints are kept or a combined one is used. Ensure the `availableQuestions` list displayed now correctly excludes answered/prerequisite-unmet questions and uses scores derived from the unified logic.

## 3. Performance Optimizations

Implement optimizations within the new `determineQuestionState` and its helper functions.

**Steps:**

1.  **Database Interaction:**
    *   **Batching:**
        *   Review `getQuestionDetails` usage. Ensure details for *all* initial candidate questions are fetched in a single batched query (`.in('question_id', candidateIdArray)`) early in `determineQuestionState`.
        *   Review `checkQuestionPrerequisites`: If it needs to fetch details for prerequisite questions, ensure this is batched where possible.
    *   **Indexing:**
        *   Verify/add database indexes on:
            *   `policy_rules`: `related_question_id`, `rule_scope`, `lender_id`, `product_id`, `policy_attribute`
            *   `complex_policy_rules`: `rule_scope`, `lender_id`, `product_id` (and check indexes related to `related_question_ids` if applicable, though this might be tricky with array columns).
            *   `questions`: `question_id` (Primary Key), `question_key` (Unique index needed for lookups).
            *   `question_dependencies`: `dependent_question_id`, `prerequisite_question_id`.
            *   `products`: `product_id` (PK), `lender_id`.
    *   **Query Analysis:** Use database tools (e.g., `EXPLAIN ANALYZE`) to inspect the performance of the rule-fetching queries, especially the `OR` conditions, under realistic load. Refactor if necessary.

2.  **Rule & Question Processing:**
    *   **Scoring Loop Optimization:** Analyze the `O(candidates * rules)` complexity. If performance profiling indicates this is a bottleneck, consider refactoring:
        *   Iterate through de-duplicated `allSimpleRules` and `allComplexRules` once.
        *   For each rule, update the scores in a map keyed by `question_id` (`Map<question_id, ScoreComponents>`).
        *   After processing all rules, iterate through the score map to calculate the final `totalScore` for each candidate question.

3.  **Caching:**
    *   **Strategy:** Implement a server-side in-memory cache (e.g., using `node-cache` or similar) with a reasonable TTL (e.g., 5-15 minutes, depending on how often question/rule data changes).
    *   **Scope:** Cache results of:
        *   `getQuestionDetails(questionId)`: Questions rarely change.
        *   `getQuestionIdByKey(questionKey)`: Similar to above.
        *   *(Advanced):* Potentially cache results of `getProductRules` or even the de-duplicated rule lists if product/rule definitions are static for periods longer than the TTL. Be cautious about cache invalidation if rules can change frequently.

4.  **Concurrency:**
    *   Review `determineQuestionState` and helpers (`checkQuestionPrerequisites`). Ensure `Promise.all` is used effectively for independent async operations (like fetching prerequisite details if needed simultaneously for multiple candidates).

## 4. Testing

1.  **Update Unit/Integration Tests (`tests/api.test.js`):**
    *   Modify existing tests for `/next_question` and potentially `/available_questions` to align with the refactored logic and expected return values.
    *   Ensure tests still cover dependency handling (prerequisites being asked first, dependent questions appearing next).
    *   Verify that answered questions and prerequisite-unmet questions *do not* appear in the `availableQuestions` list returned by the API.
    *   *(If applicable):* Add tests for the new combined API endpoint.
2.  **Performance Testing (Optional but Recommended):**
    *   Establish baseline performance metrics for the current API endpoints.
    *   After implementation, run load tests (e.g., using `k6`, `autocannon`) to measure response times and compare against the baseline to confirm improvements.

## 5. Rollout

1.  Implement changes on a feature branch.
2.  Thoroughly test locally and in a staging environment.
3.  Monitor performance and error logs after deployment to production. 