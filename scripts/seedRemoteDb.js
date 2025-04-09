import fs from 'node:fs/promises';
import path from 'node:path';
import supabase from '../src/db/supabaseClient.js'; // Assuming ESM

// Define paths for the seed files
const coreSeedPath = path.resolve(path.dirname(''), 'supabase/seed.sql');
const rulesDepsSeedPath = path.resolve(path.dirname(''), 'supabase/seed_rules_deps.sql');

// Helper function to read and execute a single SQL file
async function executeSqlFile(filePath) {
  console.log(`Attempting to read SQL file: ${filePath}`);
  let sqlContent;
  try {
    sqlContent = await fs.readFile(filePath, 'utf-8');
    console.log(`Successfully read SQL file: ${path.basename(filePath)}`);
  } catch (err) {
    console.error(`Error reading SQL file at ${filePath}:`, err);
    throw err; // Re-throw error to be caught by the main function
  }

  // Ensure we actually read some content
  if (!sqlContent || sqlContent.trim().length === 0) {
    console.warn(`SQL file ${path.basename(filePath)} is empty. Skipping execution.`);
    return; // Don't proceed if file is empty
  }

  console.log(`Executing SQL from ${path.basename(filePath)}...`);

  try {
    // Use the .sql() method which is suitable for executing raw SQL strings.
    // Note: This method might have limitations on very large files or complex multi-statement scripts
    // depending on the underlying driver and network conditions. For initial seeding, it should be fine.
    const { error } = await supabase.rpc('execute_raw_sql', { sql: sqlContent }); // Using a helper function if direct .sql() isn't available or suitable

    // Alternative if direct .sql() is preferred and works (check Supabase JS client docs for exact usage)
    // const { error } = await supabase.sql(sqlContent);

    if (error) {
      console.error('Error executing seed SQL:', error);
      // Attempt to provide more specific feedback if possible
      if (error.message) console.error('Error Message:', error.message);
      if (error.details) console.error('Error Details:', error.details);
      if (error.hint) console.error('Error Hint:', error.hint);
      process.exit(1);
    } else {
      console.log('Successfully executed seed SQL.');
    }
  } catch (err) {
    console.error('An unexpected error occurred during SQL execution:', err);
    process.exit(1);
  }
}

// Main seeding function
async function seedDatabase() {
  try {
    // Execute core seed data first
    await executeSqlFile(coreSeedPath);

    // Execute rules and dependencies seed data second
    await executeSqlFile(rulesDepsSeedPath);

    console.log("Database seeding completed successfully.");

  } catch (error) {
    console.error("Database seeding failed.");
    process.exit(1);
  }
}

// --- Helper Function for Raw SQL Execution (if needed) ---
// This assumes you have created a Postgres function `execute_raw_sql`
// in your Supabase project that takes text and executes it.
/*
  Example Postgres function (run in Supabase SQL Editor):

  CREATE OR REPLACE FUNCTION execute_raw_sql(sql TEXT)
  RETURNS void
  LANGUAGE plpgsql
  AS $$
  BEGIN
    EXECUTE sql;
  END;
  $$;

*/
// If you don't want to create the function, stick to `supabase.sql(sqlContent)` if available/suitable.
// For now, the script assumes the function exists. Adjust if using supabase.sql().

seedDatabase();