-- Phase 3: Session State Persistence
-- Step 3.1: Create Session Table

CREATE TABLE user_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_answers JSONB DEFAULT '{}'::jsonb NOT NULL,
    potential_product_ids INT[] DEFAULT ARRAY[]::integer[] NOT NULL,
    last_asked_question_group TEXT, -- Stores the group of the last question asked, for scoring
    status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'completed', 'abandoned')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    last_updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE user_sessions IS 'Stores the state of each user interaction session.';
COMMENT ON COLUMN user_sessions.session_id IS 'Unique identifier for the session.';
COMMENT ON COLUMN user_sessions.user_answers IS 'JSON object storing user answers keyed by question_key.';
COMMENT ON COLUMN user_sessions.potential_product_ids IS 'Array of product IDs currently considered potentially eligible.';
COMMENT ON COLUMN user_sessions.last_asked_question_group IS 'The question_group of the most recently asked question, used for scoring.';
COMMENT ON COLUMN user_sessions.status IS 'Current status of the user session.';

-- Optional: Trigger to automatically update last_updated_at on row update
CREATE OR REPLACE FUNCTION update_last_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.last_updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_sessions_last_updated
BEFORE UPDATE ON user_sessions
FOR EACH ROW
EXECUTE FUNCTION update_last_updated_at_column();