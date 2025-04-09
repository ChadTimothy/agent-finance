-- Phase 2: Rules & Dependencies
-- Step 2.1: Create Rules & Dependency Tables

-- Policy Rules Table (Simple, Single-Condition Rules)
CREATE TABLE policy_rules (
    rule_id SERIAL PRIMARY KEY,
    lender_id INT REFERENCES lenders(lender_id), -- Nullable for global rules
    product_id INT REFERENCES products(product_id), -- Nullable for global/lender rules
    rule_scope TEXT NOT NULL CHECK (rule_scope IN ('Global', 'Lender', 'Product')),
    policy_category TEXT NOT NULL, -- e.g., 'CreditScore', 'Employment', 'LVR'
    policy_attribute TEXT NOT NULL, -- Corresponds to a question_key
    operator TEXT NOT NULL, -- e.g., '==', '>=', 'IN', 'Exists'
    rule_value TEXT NOT NULL, -- Value to compare against, format depends on value_type
    value_type TEXT NOT NULL, -- e.g., 'Number', 'String', 'Boolean', 'List_String', 'List_Number'
    is_hard_knockout BOOLEAN NOT NULL DEFAULT FALSE,
    related_question_id INT REFERENCES questions(question_id), -- Nullable, links rule to primary question
    failure_message TEXT, -- Optional message if rule fails
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE policy_rules IS 'Stores simple, single-condition eligibility rules.';
COMMENT ON COLUMN policy_rules.lender_id IS 'FK to lenders table; NULL if rule is Global.';
COMMENT ON COLUMN policy_rules.product_id IS 'FK to products table; NULL if rule is Global or Lender scope.';
COMMENT ON COLUMN policy_rules.rule_scope IS 'Defines the scope the rule applies to (Global, Lender, Product).';
COMMENT ON COLUMN policy_rules.policy_category IS 'High-level category for grouping/reporting rules.';
COMMENT ON COLUMN policy_rules.policy_attribute IS 'The specific attribute (question_key) this rule evaluates.';
COMMENT ON COLUMN policy_rules.operator IS 'The comparison operator used (e.g., ==, >=, IN).';
COMMENT ON COLUMN policy_rules.rule_value IS 'The value to compare the user answer against.';
COMMENT ON COLUMN policy_rules.value_type IS 'Specifies how to interpret rule_value and the user answer.';
COMMENT ON COLUMN policy_rules.is_hard_knockout IS 'If TRUE, failing this rule immediately disqualifies the product.';
COMMENT ON COLUMN policy_rules.related_question_id IS 'The primary question providing the data for this rule.';
COMMENT ON COLUMN policy_rules.failure_message IS 'Optional user-facing message if the rule fails.';

CREATE INDEX idx_policy_rules_lender_id ON policy_rules(lender_id);
CREATE INDEX idx_policy_rules_product_id ON policy_rules(product_id);
CREATE INDEX idx_policy_rules_related_question_id ON policy_rules(related_question_id);


-- Complex Policy Rules Table (Multi-Condition Rules using AND/OR)
CREATE TABLE complex_policy_rules (
    complex_rule_id SERIAL PRIMARY KEY,
    lender_id INT REFERENCES lenders(lender_id), -- Nullable for global rules
    product_id INT REFERENCES products(product_id), -- Nullable for global/lender rules
    rule_scope TEXT NOT NULL CHECK (rule_scope IN ('Global', 'Lender', 'Product')),
    policy_category TEXT NOT NULL,
    logic_structure JSONB NOT NULL, -- Defines the AND/OR logic and nested conditions
    related_question_ids INT[] NOT NULL, -- Array of question IDs needed for this complex rule
    is_hard_knockout BOOLEAN NOT NULL DEFAULT FALSE,
    failure_message TEXT, -- Optional message if rule fails
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE complex_policy_rules IS 'Stores complex, multi-condition eligibility rules using AND/OR logic.';
COMMENT ON COLUMN complex_policy_rules.lender_id IS 'FK to lenders table; NULL if rule is Global.';
COMMENT ON COLUMN complex_policy_rules.product_id IS 'FK to products table; NULL if rule is Global or Lender scope.';
COMMENT ON COLUMN complex_policy_rules.rule_scope IS 'Defines the scope the rule applies to (Global, Lender, Product).';
COMMENT ON COLUMN complex_policy_rules.policy_category IS 'High-level category for grouping/reporting rules.';
COMMENT ON COLUMN complex_policy_rules.logic_structure IS 'JSON object defining the rule logic (e.g., {"operator": "AND", "conditions": [...]}).';
COMMENT ON COLUMN complex_policy_rules.related_question_ids IS 'Array of question IDs required to evaluate this rule.';
COMMENT ON COLUMN complex_policy_rules.is_hard_knockout IS 'If TRUE, failing this rule immediately disqualifies the product.';
COMMENT ON COLUMN complex_policy_rules.failure_message IS 'Optional user-facing message if the rule fails.';

CREATE INDEX idx_complex_policy_rules_lender_id ON complex_policy_rules(lender_id);
CREATE INDEX idx_complex_policy_rules_product_id ON complex_policy_rules(product_id);
-- Consider GIN index for efficient searching within the array if needed frequently
CREATE INDEX idx_complex_policy_rules_related_question_ids ON complex_policy_rules USING GIN (related_question_ids);


-- Question Dependencies Table
CREATE TABLE question_dependencies (
    dependency_id SERIAL PRIMARY KEY,
    dependent_question_id INT NOT NULL REFERENCES questions(question_id), -- The question that depends on another
    prerequisite_question_id INT NOT NULL REFERENCES questions(question_id), -- The question that must be answered first
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (dependent_question_id, prerequisite_question_id) -- Ensure no duplicate dependencies
);

COMMENT ON TABLE question_dependencies IS 'Defines prerequisites between questions (e.g., ask Q2 only if Q1 was answered).';
COMMENT ON COLUMN question_dependencies.dependent_question_id IS 'The question that has a prerequisite.';
COMMENT ON COLUMN question_dependencies.prerequisite_question_id IS 'The question that must be answered before the dependent question can be asked.';

CREATE INDEX idx_question_dependencies_dependent ON question_dependencies(dependent_question_id);