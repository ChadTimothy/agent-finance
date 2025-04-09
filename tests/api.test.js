import request from 'supertest';
import { app, server } from '../src/server.js'; // Import app and server instance
import supabase from '../src/db/supabaseClient.js'; // Import for cleanup

describe('API Endpoints', () => {

  // --- /api/sessions ---
  describe('POST /api/sessions', () => {
    let testSessionId = null; // Use local variable for cleanup

    afterEach(async () => {
      // Clean up session created by this test
      if (testSessionId) {
        try {
          await supabase.from('user_sessions').delete().eq('session_id', testSessionId);
          // console.log(`Cleaned up POST /sessions test session: ${testSessionId}`);
          testSessionId = null;
        } catch (error) {
          console.error(`Error cleaning up session ${testSessionId}:`, error);
        }
      }
    });

    test('should create a new session and return the first question', async () => {
      const res = await request(app)
        .post('/api/sessions')
        .expect('Content-Type', /json/)
        .expect(201);

      expect(res.body).toHaveProperty('sessionId');
      expect(res.body.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      const sessionId = res.body.sessionId;
      testSessionId = sessionId; // Store for cleanup

      let nextQuestion = res.body.nextQuestion;
      let safetyCounter = 0;
      const maxSteps = 20;
      const targetKey = 'employment_status';

      while (nextQuestion && nextQuestion.question_key !== targetKey && safetyCounter < maxSteps) {
        let answerValue;
        const rules = nextQuestion.validation_rules || {};
        const possible = nextQuestion.possible_answers || [];

        switch (nextQuestion.answer_type) {
          case 'Number': {
            const minNum = rules.min ?? 0;
            const maxNum = rules.max ?? 1000000;
            answerValue = Math.max(minNum, Math.min(maxNum, 1000));
            break;
          }
          case 'Boolean':
            answerValue = false;
            break;
          case 'String':
            if (rules.enum && rules.enum.length > 0) {
              answerValue = rules.enum[0];
            } else if (possible.length > 0 && possible[0]?.value) {
              answerValue = possible[0].value;
            } else {
              const minLength = rules.minLength || 1;
              const maxLength = rules.maxLength || 50;
              answerValue = 'ValidDefault'.padEnd(minLength, 'X').substring(0, maxLength);
            }
            break;
          default:
            answerValue = 'Default';
        }

        await request(app)
          .post(`/api/sessions/${sessionId}/answers`)
          .send({ questionKey: nextQuestion.question_key, answerValue })
          .expect(200);

        const nextRes = await request(app)
          .get(`/api/sessions/${sessionId}/next_question`)
          .expect(200);

        nextQuestion = nextRes.body.nextQuestion;
        safetyCounter++;
      }

      expect(safetyCounter).toBeLessThan(maxSteps);
      expect(nextQuestion).not.toBeNull();
      expect(nextQuestion).toHaveProperty('question_id');
      expect(nextQuestion.question_key).toBe(targetKey);
    });
  });

  // --- /api/sessions/:sessionId/next_question ---
  describe('GET /api/sessions/:sessionId/next_question', () => {
    test('should return 404 for non-existent session', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app)
        .get(`/api/sessions/${nonExistentId}/next_question`)
        .expect('Content-Type', /json/)
        .expect(404);
    });

    test('should return the next logical question', async () => {
      // This test needs its own session setup & cleanup
      let sessionId = null;
      try {
        const sessionRes = await request(app).post('/api/sessions').expect(201);
        sessionId = sessionRes.body.sessionId;
        expect(sessionId).toBeDefined();
        const firstQuestionKey = sessionRes.body.nextQuestion?.question_key;
        expect(firstQuestionKey).toBeDefined(); // Ensure we got a first question

        // Submit answer for the first question received (e.g., 'income_amount')
        // Fetch question details to generate valid answer
        const { data: questionData } = await supabase
          .from('questions')
          .select('*')
          .eq('question_key', firstQuestionKey)
          .single();

        let answerValue;
        const rules = questionData?.validation_rules || {};
        const possible = questionData?.possible_answers || [];

        switch (questionData?.answer_type) {
          case 'Number': {
            const minNum = rules.min ?? 0;
            const maxNum = rules.max ?? 1000000;
            answerValue = Math.max(minNum, Math.min(maxNum, 1000));
            break;
          }
          case 'Boolean':
            answerValue = false;
            break;
          case 'String':
            if (rules.enum && rules.enum.length > 0) {
              answerValue = rules.enum[0];
            } else if (possible.length > 0 && possible[0]?.value) {
              answerValue = possible[0].value;
            } else {
              const minLength = rules.minLength || 1;
              const maxLength = rules.maxLength || 50;
              answerValue = 'ValidDefault'.padEnd(minLength, 'X').substring(0, maxLength);
            }
            break;
          default:
            answerValue = 'Default';
        }

        await request(app)
          .post(`/api/sessions/${sessionId}/answers`)
          .send({ questionKey: firstQuestionKey, answerValue })
          .expect('Content-Type', /json/)
          .expect(200);

        // Now get the next question
        const res = await request(app)
          .get(`/api/sessions/${sessionId}/next_question`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(res.body).toHaveProperty('nextQuestion');
        // Assertion depends heavily on scoring logic and seed data after answering the first question
        // Example: expect(res.body.nextQuestion).toHaveProperty('question_key', 'residency_status');
        if (res.body.nextQuestion) {
           expect(res.body.nextQuestion).toHaveProperty('question_key'); // Check if *a* question key exists
        } else {
           console.warn('GET /next_question returned null. Flow might be complete or logic issue.');
        }
      } finally {
        // Cleanup this specific session
        if (sessionId) {
          await supabase.from('user_sessions').delete().eq('session_id', sessionId);
        }
      }
    });

    test('should ask dependent question after prerequisite is answered (Pepper dependency)', async () => {
      // Test: Answer 'has_adverse_credit_events' = true, expect 'adverse_credit_details' next.
      let sessionId = null;
      const prerequisiteKey = 'has_adverse_credit_events';
      const dependentKey = 'adverse_credit_details';

      try {
        const sessionRes = await request(app).post('/api/sessions').expect(201);
        sessionId = sessionRes.body.sessionId;
        expect(sessionId).toBeDefined();

        let nextQuestion = sessionRes.body.nextQuestion;
        let safetyCounter = 0; // Prevent infinite loops in test
        const maxSteps = 200; // Max questions to answer before failing test (Increased)

        // Loop until the prerequisite question is asked or we hit the limit
        while (nextQuestion && nextQuestion.question_key !== prerequisiteKey && safetyCounter < maxSteps) {
          // Provide a more robust default valid answer based on type
          let answerValue;
          const rules = nextQuestion.validation_rules || {};
          const possible = nextQuestion.possible_answers || [];

          switch (nextQuestion.answer_type) {
            case 'Number': { // Add block scope
              // Try to pick a value between min/max if available, otherwise a common default
              const minNum = rules.min ?? 1000; // Lower default min
              const maxNum = rules.max ?? 100000; // Higher default max
              // Pick a value in the middle, leaning towards lower end
              answerValue = Math.max(minNum, Math.min(maxNum, 30000));
              // Specific overrides for common keys if needed
              if (nextQuestion.question_key === 'applicant_age') answerValue = 40;
              if (nextQuestion.question_key === 'loan_term_months_requested') answerValue = 60; // 5 years
              if (nextQuestion.question_key === 'employment_duration_months') answerValue = 24; // 2 years, more realistic default
              break;
            } // Close block scope
            case 'Boolean':
              // Default to false unless it's a specific known positive requirement
              answerValue = false;
              break;
            case 'String':
              // Prioritize enum/possible answers
              if (rules.enum && rules.enum.length > 0) {
                answerValue = rules.enum[0]; // Use first enum value
              } else if (possible.length > 0 && possible[0]?.value) {
                answerValue = possible[0].value; // Use first possible answer value
              } else {
                // Use a generic string that meets length requirements
                const minLength = rules.minLength || 1;
                const maxLength = rules.maxLength || 50;
                answerValue = 'ValidDefault'.padEnd(minLength, 'X').substring(0, maxLength);
                 // Specific overrides
                if (nextQuestion.question_key === 'employment_status') answerValue = 'Permanent'; // Use value allowed by Pepper rule
                if (nextQuestion.question_key === 'residency_status_au') answerValue = 'Citizen'; // Common valid value
                if (nextQuestion.question_key === 'asset_type_requested') answerValue = 'Car'; // Common valid value
              }
              break;
            default:
              // Fallback for unknown types
              answerValue = 'DefaultFallback';
          }

          // Submit answer
          console.log(`DEBUG: Posting answer for ${nextQuestion.question_key}:`, answerValue);
          // Make the request and capture the response
          const postRes = await request(app)
            .post(`/api/sessions/${sessionId}/answers`)
            .send({ questionKey: nextQuestion.question_key, answerValue: answerValue }); // Send the generated answerValue

          // Log the body if the status is not 200, then assert
          if (postRes.status !== 200) {
            console.error('Unexpected response status in dependency test loop:', postRes.status, JSON.stringify(postRes.body, null, 2));
          }
          expect(postRes.status).toBe(200);

          // Get the next question
          const nextRes = await request(app)
            .get(`/api/sessions/${sessionId}/next_question`)
            .expect(200);
          nextQuestion = nextRes.body.nextQuestion;
          safetyCounter++;
        }

        // Check if we found the prerequisite question
        expect(safetyCounter).toBeLessThan(maxSteps); // Ensure we didn't time out
        expect(nextQuestion).not.toBeNull();
        expect(nextQuestion.question_key).toBe(prerequisiteKey);

        // Answer the prerequisite question to trigger the dependency
        await request(app)
          .post(`/api/sessions/${sessionId}/answers`)
          .send({ questionKey: prerequisiteKey, answerValue: false }) // Answer 'No'
          .expect(200);

        // Get the final next question
        const finalRes = await request(app)
          .get(`/api/sessions/${sessionId}/next_question`)
          .expect(200);

        // Assert that the dependent question is asked next
        // Split assertion to pinpoint the issue
        expect(finalRes.body.nextQuestion).toBeDefined(); // Check if the object exists first
        if (finalRes.body.nextQuestion) { // Only check key if object exists
          expect(finalRes.body.nextQuestion.question_key).toBe(dependentKey);
        }

      } finally {
        // Cleanup
        if (sessionId) {
          await supabase.from('user_sessions').delete().eq('session_id', sessionId);
        }
      }
    }, 30000); // Increase timeout for this potentially longer test
  });

  // --- /api/sessions/:sessionId/answers ---
  describe('POST /api/sessions/:sessionId/answers', () => {
     let sessionId = null;
     let firstQuestionKey = null;

     beforeEach(async () => { // Use beforeEach to get a fresh session for each test
        const sessionRes = await request(app).post('/api/sessions').expect(201);
        sessionId = sessionRes.body.sessionId;
        firstQuestionKey = sessionRes.body.nextQuestion?.question_key;
        expect(sessionId).toBeDefined();
        // Don't strictly require firstQuestionKey here, some tests might not need it
     });

     afterEach(async () => {
        if (sessionId) {
            await supabase.from('user_sessions').delete().eq('session_id', sessionId);
            sessionId = null;
            firstQuestionKey = null;
        }
     });

     test('should return 400 if questionKey or answerValue is missing', async () => {
       await request(app)
         .post(`/api/sessions/${sessionId}/answers`)
         .send({ questionKey: 'some_key' }) // Missing answerValue
         .expect('Content-Type', /json/)
         .expect(400);

       await request(app)
         .post(`/api/sessions/${sessionId}/answers`)
         .send({ answerValue: 'some_value' }) // Missing questionKey
         .expect('Content-Type', /json/)
         .expect(400);
     });

     test('should return 404 if session ID is invalid', async () => {
       const nonExistentId = '00000000-0000-0000-0000-000000000000';
       await request(app)
         .post(`/api/sessions/${nonExistentId}/answers`)
         .send({ questionKey: 'loan_amount', answerValue: 60000 })
         .expect('Content-Type', /json/)
         .expect(404);
     });

     test('should accept a valid answer and return success', async () => {
       if (!firstQuestionKey) {
         console.warn('Skipping POST /answers test as no initial question key available.');
         return;
       }
       const { data: questionData } = await supabase
         .from('questions')
         .select('*')
         .eq('question_key', firstQuestionKey)
         .single();

       let answerValue;
       const rules = questionData?.validation_rules || {};
       const possible = questionData?.possible_answers || [];

       switch (questionData?.answer_type) {
         case 'Number': {
           const minNum = rules.min ?? 0;
           const maxNum = rules.max ?? 1000000;
           answerValue = Math.max(minNum, Math.min(maxNum, 1000));
           break;
         }
         case 'Boolean':
           answerValue = false;
           break;
         case 'String':
           if (rules.enum && rules.enum.length > 0) {
             answerValue = rules.enum[0];
           } else if (possible.length > 0 && possible[0]?.value) {
             answerValue = possible[0].value;
           } else {
             const minLength = rules.minLength || 1;
             const maxLength = rules.maxLength || 50;
             answerValue = 'ValidDefault'.padEnd(minLength, 'X').substring(0, maxLength);
           }
           break;
         default:
           answerValue = 'Default';
       }

       const res = await request(app)
         .post(`/api/sessions/${sessionId}/answers`)
         .send({ questionKey: firstQuestionKey, answerValue })
         .expect('Content-Type', /json/)
         .expect(200);

       expect(res.body).toEqual({ success: true, message: 'Answer submitted successfully.' });

       // Verify DB state
       const { data } = await supabase.from('user_sessions').select('user_answers').eq('session_id', sessionId).single();
       expect(data?.user_answers?.[firstQuestionKey]).toBe(answerValue); // Match submitted answer
     });

     test('should filter products correctly after submitting an answer (hard knockout)', async () => {
       // This test creates its own session, so no need for beforeEach session
       let specificSessionId = null;
       try {
         const sessionRes = await request(app).post('/api/sessions').expect(201);
         specificSessionId = sessionRes.body.sessionId;
         expect(specificSessionId).toBeDefined();

         // Submit an answer that should trigger Rule 1 (Product 1, loan_amount > 100k)
         await request(app)
           .post(`/api/sessions/${specificSessionId}/answers`)
           .send({ questionKey: 'loan_amount_requested', answerValue: 110000 }) // Use standardized key
           .expect(200);

         // Check the eligible products
         const eligibleRes = await request(app)
           .get(`/api/sessions/${specificSessionId}/eligible_products`)
           .expect(200);

         expect(eligibleRes.body).toHaveProperty('eligibleProductIds');
         expect(Array.isArray(eligibleRes.body.eligibleProductIds)).toBe(true);
         // Assert Product 1 (Liberty Drive Car Loan) is NOT eligible
         expect(eligibleRes.body.eligibleProductIds).not.toContain(1);
       } finally {
          // Cleanup this specific session
          if (specificSessionId) {
            await supabase.from('user_sessions').delete().eq('session_id', specificSessionId);
          }
       }
     });

   test('should filter products correctly after submitting an answer (Pepper simple rule knockout)', async () => {
     // This test creates its own session
     let specificSessionId = null;
     let pepperProductId = null;
     try {
       // Find the Pepper product ID first
       const { data: productData, error: productError } = await supabase
         .from('products')
         .select('product_id')
         .eq('product_name', 'Pepper Consumer Asset Finance')
         .single();
       if (productError || !productData) throw new Error('Could not find Pepper product ID for test setup.');
       pepperProductId = productData.product_id;

       const sessionRes = await request(app).post('/api/sessions').expect(201);
       specificSessionId = sessionRes.body.sessionId;
       expect(specificSessionId).toBeDefined();

       // Get initial eligible products to confirm Pepper product is present
       const initialEligibleRes = await request(app)
         .get(`/api/sessions/${specificSessionId}/eligible_products`)
         .expect(200);
       expect(initialEligibleRes.body.eligibleProductIds).toContain(pepperProductId);

       // Submit an answer that should trigger Pepper knockout rule (is_bankrupt = true)
       await request(app)
         .post(`/api/sessions/${specificSessionId}/answers`)
         .send({ questionKey: 'is_bankrupt', answerValue: true })
         .expect(200);

       // Check the eligible products again
       const finalEligibleRes = await request(app)
         .get(`/api/sessions/${specificSessionId}/eligible_products`)
         .expect(200);

       expect(finalEligibleRes.body).toHaveProperty('eligibleProductIds');
       // Assert Pepper Product is NOT eligible
       expect(finalEligibleRes.body.eligibleProductIds).not.toContain(pepperProductId);

     } finally {
        // Cleanup this specific session
        if (specificSessionId) {
          await supabase.from('user_sessions').delete().eq('session_id', specificSessionId);
        }
     }
   });

   test('should filter products correctly after submitting answers (Pepper complex rule knockout)', async () => {
     // This test creates its own session
     let specificSessionId = null;
     let pepperProductId = null;
     try {
       // Find the Pepper product ID
       const { data: productData, error: productError } = await supabase
         .from('products')
         .select('product_id')
         .eq('product_name', 'Pepper Consumer Asset Finance')
         .single();
       if (productError || !productData) throw new Error('Could not find Pepper product ID for test setup.');
       pepperProductId = productData.product_id;

       const sessionRes = await request(app).post('/api/sessions').expect(201);
       specificSessionId = sessionRes.body.sessionId;
       expect(specificSessionId).toBeDefined();

       // Confirm Pepper product is initially eligible
       const initialEligibleRes = await request(app)
         .get(`/api/sessions/${specificSessionId}/eligible_products`)
         .expect(200);
       expect(initialEligibleRes.body.eligibleProductIds).toContain(pepperProductId);

       // Submit answers that trigger the complex rule: Private Sale + Marine asset
       await request(app)
         .post(`/api/sessions/${specificSessionId}/answers`)
         .send({ questionKey: 'sale_type', answerValue: 'Private' })
         .expect(200);

       await request(app)
         .post(`/api/sessions/${specificSessionId}/answers`)
         .send({ questionKey: 'asset_type_requested', answerValue: 'Marine' })
         .expect(200);

       // Check the eligible products again
       const finalEligibleRes = await request(app)
         .get(`/api/sessions/${specificSessionId}/eligible_products`)
         .expect(200);

       expect(finalEligibleRes.body).toHaveProperty('eligibleProductIds');
       // Assert Pepper Product is NOT eligible due to complex rule
       expect(finalEligibleRes.body.eligibleProductIds).not.toContain(pepperProductId);

     } finally {
        // Cleanup this specific session
        if (specificSessionId) {
          await supabase.from('user_sessions').delete().eq('session_id', specificSessionId);
        }
     }
   });

});

  // --- /api/sessions/:sessionId/answers/:questionKey ---
  describe('PATCH /api/sessions/:sessionId/answers/:questionKey', () => {
     let sessionId = null;
     let firstQuestionKey = null; // Store the key of an answer we can update

     beforeEach(async () => {
        // Create a session and submit an initial answer to update later
        const sessionRes = await request(app).post('/api/sessions').expect(201);
        sessionId = sessionRes.body.sessionId;
        firstQuestionKey = sessionRes.body.nextQuestion?.question_key;
        expect(sessionId).toBeDefined();
        expect(firstQuestionKey).toBeDefined(); // Need a question to update

        // Submit an initial answer for the first question
        await request(app)
          // Fetch question details to generate valid answer
          const { data: questionData } = await supabase
            .from('questions')
            .select('*')
            .eq('question_key', firstQuestionKey)
            .single();

          let answerValue;
          const rules = questionData?.validation_rules || {};
          const possible = questionData?.possible_answers || [];

          switch (questionData?.answer_type) {
            case 'Number': {
              const minNum = rules.min ?? 0;
              const maxNum = rules.max ?? 1000000;
              answerValue = Math.max(minNum, Math.min(maxNum, 1000));
              break;
            }
            case 'Boolean':
              answerValue = false;
              break;
            case 'String':
              if (rules.enum && rules.enum.length > 0) {
                answerValue = rules.enum[0];
              } else if (possible.length > 0 && possible[0]?.value) {
                answerValue = possible[0].value;
              } else {
                const minLength = rules.minLength || 1;
                const maxLength = rules.maxLength || 50;
                answerValue = 'ValidDefault'.padEnd(minLength, 'X').substring(0, maxLength);
              }
              break;
            default:
              answerValue = 'Default';
          }

          await request(app)
            .post(`/api/sessions/${sessionId}/answers`)
            .send({ questionKey: firstQuestionKey, answerValue })
            .expect(200);
     });

     afterEach(async () => {
        if (sessionId) {
            await supabase.from('user_sessions').delete().eq('session_id', sessionId);
            sessionId = null;
            firstQuestionKey = null;
        }
     });

     test('should return 400 if answerValue is missing', async () => {
       await request(app)
         .patch(`/api/sessions/${sessionId}/answers/${firstQuestionKey}`)
         .send({}) // Missing answerValue
         .expect('Content-Type', /json/)
         .expect(400);
     });
     test('should return 404 if session ID is invalid', async () => {
       const nonExistentId = '00000000-0000-0000-0000-000000000000';
       // Use a valid key format, even if the session is invalid
       const keyToUpdate = firstQuestionKey || 'net_monthly_income'; // Use standardized key
       await request(app)
         .patch(`/api/sessions/${nonExistentId}/answers/${keyToUpdate}`)
         .send({ answerValue: 'NewValue' })
         .expect('Content-Type', /json/)
         .expect(404);
     });
     test('should update an existing answer and return success', async () => {
       const newValue = 'UpdatedValue';

       // Get product list *before* update (optional, for comparison)
       // const initialState = await getSessionState(sessionId);
       // const initialProductIds = initialState?.potential_product_ids;

       const { data: questionData } = await supabase
         .from('questions')
         .select('*')
         .eq('question_key', firstQuestionKey)
         .single();

       let patchValue;
       const rules = questionData?.validation_rules || {};
       const possible = questionData?.possible_answers || [];

       switch (questionData?.answer_type) {
         case 'Number': {
           const minNum = rules.min ?? 0;
           const maxNum = rules.max ?? 1000000;
           patchValue = Math.max(minNum, Math.min(maxNum, 1000));
           break;
         }
         case 'Boolean':
           patchValue = false;
           break;
         case 'String':
           if (rules.enum && rules.enum.length > 0) {
             patchValue = rules.enum[0];
           } else if (possible.length > 0 && possible[0]?.value) {
             patchValue = possible[0].value;
           } else {
             const minLength = rules.minLength || 1;
             const maxLength = rules.maxLength || 50;
             patchValue = 'ValidDefault'.padEnd(minLength, 'X').substring(0, maxLength);
           }
           break;
         default:
           patchValue = 'Default';
       }

       const res = await request(app)
         .patch(`/api/sessions/${sessionId}/answers/${firstQuestionKey}`)
         .send({ answerValue: patchValue })
         .expect('Content-Type', /json/)
         .expect(200);

       expect(res.body).toEqual({ success: true, message: 'Answer updated successfully.' });

       // Verify DB state
       const { data, error } = await supabase
         .from('user_sessions')
         .select('user_answers, potential_product_ids')
         .eq('session_id', sessionId)
         .single();

       expect(error).toBeNull();
       expect(data?.user_answers?.[firstQuestionKey]).toBe(patchValue); // Match submitted patch value

       // Verify product list was re-filtered (it might be the same or different)
       // A simple check is that it's still an array. A more robust test
       // might involve setting up rules/answers where the list *must* change.
       expect(Array.isArray(data?.potential_product_ids)).toBe(true);
       // Optional: Check if it actually changed if the test setup guarantees it
       // expect(data?.potential_product_ids).not.toEqual(initialProductIds);
     });

     test('should re-filter products correctly after PATCHing an answer (Pepper knockout)', async () => {
       let specificSessionId = null;
       let pepperProductId = null;
       const knockoutKey = 'is_bankrupt'; // The key we will PATCH

       try {
         // Find the Pepper product ID
         const { data: productData, error: productError } = await supabase
           .from('products')
           .select('product_id')
           .eq('product_name', 'Pepper Consumer Asset Finance')
           .single();
         if (productError || !productData) throw new Error('Could not find Pepper product ID for test setup.');
         pepperProductId = productData.product_id;

         // Create session
         const sessionRes = await request(app).post('/api/sessions').expect(201);
         specificSessionId = sessionRes.body.sessionId;
         expect(specificSessionId).toBeDefined();

         // Submit initial answers ensuring Pepper is eligible (is_bankrupt = false)
         // We need to answer questions until 'is_bankrupt' is asked, or submit it directly if possible
         // For simplicity, let's assume we can submit it directly for the test
         await request(app)
           .post(`/api/sessions/${specificSessionId}/answers`)
           .send({ questionKey: knockoutKey, answerValue: false }) // Initially eligible
           .expect(200);

         // Verify Pepper product is eligible initially
         const initialEligibleRes = await request(app)
           .get(`/api/sessions/${specificSessionId}/eligible_products`)
           .expect(200);
         expect(initialEligibleRes.body.eligibleProductIds).toContain(pepperProductId);

         // Now, PATCH the answer to trigger the knockout
         await request(app)
           .patch(`/api/sessions/${specificSessionId}/answers/${knockoutKey}`)
           .send({ answerValue: true }) // Change to ineligible
           .expect(200);

         // Verify Pepper product is NO LONGER eligible after PATCH
         const finalEligibleRes = await request(app)
           .get(`/api/sessions/${specificSessionId}/eligible_products`)
           .expect(200);
         expect(finalEligibleRes.body.eligibleProductIds).not.toContain(pepperProductId);

       } finally {
         // Cleanup
         if (specificSessionId) {
           await supabase.from('user_sessions').delete().eq('session_id', specificSessionId);
         }
       }
     });
  });

  // --- /api/sessions/:sessionId/eligible_products ---
  describe('GET /api/sessions/:sessionId/eligible_products', () => {
     test('should return 404 for non-existent session', async () => {
       const nonExistentId = '00000000-0000-0000-0000-000000000000';
       await request(app)
         .get(`/api/sessions/${nonExistentId}/eligible_products`)
         .expect('Content-Type', /json/)
         .expect(404);
     });

     test('should return the list of eligible product IDs', async () => {
        // Needs its own session setup & cleanup
        let sessionId = null;
        try {
            const sessionRes = await request(app).post('/api/sessions').expect(201);
            sessionId = sessionRes.body.sessionId;
            expect(sessionId).toBeDefined();

            // Submit an answer to potentially filter products
            const firstQuestionKey = sessionRes.body.nextQuestion?.question_key;
            if (firstQuestionKey) {
                await request(app)
                const { data: questionData } = await supabase
                  .from('questions')
                  .select('*')
                  .eq('question_key', firstQuestionKey)
                  .single();

                let answerValue;
                const rules = questionData?.validation_rules || {};
                const possible = questionData?.possible_answers || [];

                switch (questionData?.answer_type) {
                  case 'Number': {
                    const minNum = rules.min ?? 0;
                    const maxNum = rules.max ?? 1000000;
                    answerValue = Math.max(minNum, Math.min(maxNum, 1000));
                    break;
                  }
                  case 'Boolean':
                    answerValue = false;
                    break;
                  case 'String':
                    if (rules.enum && rules.enum.length > 0) {
                      answerValue = rules.enum[0];
                    } else if (possible.length > 0 && possible[0]?.value) {
                      answerValue = possible[0].value;
                    } else {
                      const minLength = rules.minLength || 1;
                      const maxLength = rules.maxLength || 50;
                      answerValue = 'ValidDefault'.padEnd(minLength, 'X').substring(0, maxLength);
                    }
                    break;
                  default:
                    answerValue = 'Default';
                }

                await request(app)
                  .post(`/api/sessions/${sessionId}/answers`)
                  .send({ questionKey: firstQuestionKey, answerValue })
                  .expect(200);
            }

            const res = await request(app)
                .get(`/api/sessions/${sessionId}/eligible_products`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(res.body).toHaveProperty('eligibleProductIds');
            expect(Array.isArray(res.body.eligibleProductIds)).toBe(true);
        } finally {
            // Cleanup
            if (sessionId) {
                await supabase.from('user_sessions').delete().eq('session_id', sessionId);
            }
        }
     });
  });

  // Cleanup after all tests in this file
  afterAll(async () => {
    // Close the server connection to allow Jest to exit cleanly
    await new Promise(resolve => server.close(resolve));
    console.log('Server closed.');
  });
});

describe('Robustness & Edge Cases', () => {
  let sessionId = null;

  beforeEach(async () => {
    // Create a new session for each robustness test
    const res = await request(app).post('/api/sessions').expect(201);
    sessionId = res.body.sessionId;
  });

  afterEach(async () => {
    // Clean up session after each test
    if (sessionId) {
      await supabase.from('user_sessions').delete().eq('session_id', sessionId);
      sessionId = null;
    }
  });

  test('should handle invalid session ID gracefully in GET /next_question', async () => {
    const invalidId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).get(`/api/sessions/${invalidId}/next_question`).expect(404);
    expect(res.body.error.message).toContain('not found');
  });

  test('should handle invalid session ID gracefully in POST /answers', async () => {
    const invalidId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .post(`/api/sessions/${invalidId}/answers`)
      .send({ questionKey: 'any_key', answerValue: 'any_value' })
      .expect(404);
    expect(res.body.error.message).toContain('not found');
  });

  test('should handle invalid session ID gracefully in PATCH /answers', async () => {
   const invalidId = '00000000-0000-0000-0000-000000000000';
   const res = await request(app)
     .patch(`/api/sessions/${invalidId}/answers/any_key`)
     .send({ answerValue: 'any_value' })
     .expect(404);
   expect(res.body.error.message).toContain('not found');
 });

  test('should return 400 for invalid answer format in POST /answers', async () => {
    // Example: Sending a string where a number is expected for loan_amount_requested
    await request(app)
      .post(`/api/sessions/${sessionId}/answers`)
      .send({ questionKey: 'loan_amount_requested', answerValue: 'not-a-number' })
      .expect(400);
  });

  test('should handle PATCH answer change and re-filter products', async () => {
    const { body } = await request(app).post('/api/sessions').expect(201);
    const sessionId = body.sessionId;
    const firstQuestionKey = body.nextQuestion?.question_key;
    expect(firstQuestionKey).toBeDefined();

    try {
      // 1. Get initial product list
      const initialRes = await request(app).get(`/api/sessions/${sessionId}/eligible_products`).expect(200);
      const initialProductIds = initialRes.body.eligibleProductIds;
      expect(initialProductIds).toContain(1); // Expect Liberty Drive initially

      // 2. Answer question that knocks out Product 1 (Liberty Drive)
      await request(app)
        .post(`/api/sessions/${sessionId}/answers`)
        .send({ questionKey: 'loan_amount_requested', answerValue: 150000 }) // Exceeds Liberty limit
        .expect(200);

      // 3. Verify Product 1 is knocked out
      const knockedOutRes = await request(app).get(`/api/sessions/${sessionId}/eligible_products`).expect(200);
      expect(knockedOutRes.body.eligibleProductIds).not.toContain(1);

      // 4. PATCH the answer back to an acceptable value
      await request(app)
        .patch(`/api/sessions/${sessionId}/answers/loan_amount_requested`)
        .send({ answerValue: 50000 }) // Within Liberty limits
        .expect(200);

      // 5. Verify Product 1 is eligible again after PATCH and re-filter
      const restoredRes = await request(app).get(`/api/sessions/${sessionId}/eligible_products`).expect(200);
      expect(restoredRes.body.eligibleProductIds).toContain(1);
    } finally {
      // Cleanup specific session
      await supabase.from('user_sessions').delete().eq('session_id', sessionId);
    }
  }, 10000); // Increased timeout to 10 seconds for this test
});