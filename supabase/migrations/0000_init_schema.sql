-- Phase 1: Database Foundation
-- Step 1.2: Create Core Tables (lenders, products, questions)

-- Lenders Table
CREATE TABLE lenders (
    lender_id SERIAL PRIMARY KEY,
    lender_name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE lenders IS 'Stores information about lending institutions.';
COMMENT ON COLUMN lenders.lender_name IS 'Unique name of the lender.';

-- Products Table
CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    lender_id INT NOT NULL REFERENCES lenders(lender_id),
    product_name TEXT NOT NULL,
    loan_type TEXT NOT NULL, -- e.g., 'Personal', 'Asset Finance', 'Home Loan'
    min_loan_amount NUMERIC,
    max_loan_amount NUMERIC,
    min_term_months INT,
    max_term_months INT,
    asset_types_allowed TEXT[], -- e.g., ['Car', 'Boat', 'Equipment']
    base_rate NUMERIC, -- Best indicative rate
    worst_case_rate NUMERIC, -- Highest indicative rate
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (lender_id, product_name)
);

COMMENT ON TABLE products IS 'Stores details about specific loan products offered by lenders.';
COMMENT ON COLUMN products.lender_id IS 'Foreign key linking to the lender offering this product.';
COMMENT ON COLUMN products.product_name IS 'Name of the loan product (unique per lender).';
COMMENT ON COLUMN products.loan_type IS 'Category of the loan.';
COMMENT ON COLUMN products.asset_types_allowed IS 'Specific asset types financed (if applicable, for Asset Finance).';
COMMENT ON COLUMN products.base_rate IS 'Best possible indicative interest rate.';
COMMENT ON COLUMN products.worst_case_rate IS 'Highest possible indicative interest rate.';


-- Questions Table
CREATE TABLE questions (
    question_id SERIAL PRIMARY KEY,
    question_key TEXT NOT NULL UNIQUE, -- Machine-readable key, used in user_answers JSON
    question_text TEXT NOT NULL, -- Human-readable question text for the UI
    answer_type TEXT NOT NULL, -- Expected data type of the answer (e.g., 'number', 'string', 'boolean', 'select', 'multiselect')
    possible_answers JSONB, -- For 'select'/'multiselect', stores options (e.g., [{"value": "FullTime", "label": "Full Time"}, ...])
    validation_rules JSONB, -- Rules for validating user input (e.g., {"min": 0, "max": 1000000, "required": true})
    help_text TEXT, -- Optional guidance for the user
    question_group TEXT NOT NULL, -- Logical grouping (e.g., 'ApplicantInfo', 'Employment', 'AssetDetails')
    display_priority INT NOT NULL DEFAULT 0, -- Order within group (lower number = higher priority)
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE questions IS 'Stores the questions presented to the user.';
COMMENT ON COLUMN questions.question_key IS 'Unique key used to store answers and link rules.';
COMMENT ON COLUMN questions.answer_type IS 'Defines the expected answer format and UI control.';
COMMENT ON COLUMN questions.possible_answers IS 'Predefined options for select/multiselect types.';
COMMENT ON COLUMN questions.validation_rules IS 'JSON object defining validation constraints for the answer.';
COMMENT ON COLUMN questions.help_text IS 'Optional text displayed to assist the user in answering.';
COMMENT ON COLUMN questions.question_group IS 'Used for logical grouping and conversational flow scoring.';
COMMENT ON COLUMN questions.display_priority IS 'Determines question order within a group (lower is higher priority).';