import supabase from '../src/db/supabaseClient.js';
import {
  createSession,
  getSessionState,
  updateSessionState
} from '../src/services/sessionService.js';

// Make sure products table has data for getInitialProductIds()
// You might want to add a specific setup/teardown for tests later
// or ensure the seed data includes products.

describe('Session Service', () => {
  let testSessionId = null;

  // Cleanup potentially created sessions after tests run
  afterAll(async () => {
    if (testSessionId) {
      // Attempt to delete the session created during tests
      await supabase.from('user_sessions').delete().eq('session_id', testSessionId);
      console.log(`Cleaned up test session: ${testSessionId}`);
    }
    // Supabase client typically manages its own connection pool; explicit closing/signout usually not needed for service key tests.
  });

  test('createSession should create a new session and return its ID', async () => {
    try {
      const sessionId = await createSession();

      // Check if sessionId is a valid UUID (basic regex check)
      expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      testSessionId = sessionId; // Store for cleanup and later tests

      // Verify the session exists in the database
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data.session_id).toBe(sessionId);
      expect(data.user_answers).toEqual({}); // Default empty object
      expect(data.status).toBe('active');
      // Check if potential_product_ids is an array (might be empty if no products seeded)
      expect(Array.isArray(data.potential_product_ids)).toBe(true);

    } catch (e) {
      // Fail test explicitly if createSession throws an error
      expect(e).toBeUndefined();
    }
  });

  test('getSessionState should retrieve an existing session', async () => {
    // Depends on createSession test passing and setting testSessionId
    if (!testSessionId) {
      throw new Error("Cannot run getSessionState test: testSessionId not set by createSession test.");
    }

    try {
      const sessionState = await getSessionState(testSessionId);

      expect(sessionState).not.toBeNull();
      expect(sessionState.session_id).toBe(testSessionId);
      // Add more assertions based on expected initial state if needed
      expect(sessionState.status).toBe('active');

    } catch (e) {
      expect(e).toBeUndefined();
    }
  });

  test('getSessionState should return null for a non-existent session ID', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000'; // Example invalid UUID
    try {
      const sessionState = await getSessionState(nonExistentId);
      expect(sessionState).toBeNull();
    } catch (e) {
      // We expect it to return null, not throw for a non-existent ID
      expect(e).toBeUndefined();
    }
  });

  test('updateSessionState should update specified fields of an existing session', async () => {
    if (!testSessionId) {
      throw new Error("Cannot run updateSessionState test: testSessionId not set by createSession test.");
    }

    const updates = {
      user_answers: { 'loan_amount': 50000, 'loan_term': 36 },
      potential_product_ids: [1, 3], // Example updated list
      last_asked_question_group: 'LoanDetails',
      status: 'active' // Keep active for now
    };

    try {
      const success = await updateSessionState(testSessionId, updates);
      expect(success).toBe(true);

      // Verify the update in the database
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('session_id', testSessionId)
        .single();

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data.user_answers).toEqual(updates.user_answers);
      expect(data.potential_product_ids).toEqual(updates.potential_product_ids);
      expect(data.last_asked_question_group).toBe(updates.last_asked_question_group);
      expect(data.status).toBe(updates.status);
      // Optionally check if last_updated_at changed (might be tricky due to timing)

    } catch (e) {
      expect(e).toBeUndefined();
    }
  });

   test('updateSessionState should handle empty update data gracefully', async () => {
    if (!testSessionId) {
      throw new Error("Cannot run updateSessionState test: testSessionId not set by createSession test.");
    }
     const initialState = await getSessionState(testSessionId); // Get state before empty update

    try {
      const success = await updateSessionState(testSessionId, {}); // Empty update object
      expect(success).toBe(true); // Should report success (or false if designed that way)

      // Verify state hasn't changed unexpectedly
      const finalState = await getSessionState(testSessionId);
      expect(finalState).toEqual(initialState); // State should remain the same

    } catch (e) {
      expect(e).toBeUndefined();
    }
  });

  // Add tests for error conditions if needed (e.g., invalid sessionId format for update)

});