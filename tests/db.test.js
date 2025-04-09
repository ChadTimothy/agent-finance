import supabase from '../src/db/supabaseClient'; // Adjust path if needed

// Basic test suite for database connection and core table access
describe('Database Connection and Core Tables', () => {

  // Test Case 1: Verify connection and fetch from 'lenders' table
  test('should connect to Supabase and fetch lenders', async () => {
    // Attempt to fetch data from the lenders table
    const { data, error } = await supabase
      .from('lenders')
      .select('*')
      .limit(1); // Limit to 1 for efficiency, we just need to see if it works

    // Assertion 1: Check if there was a database error
    // If 'error' is null or undefined, the query executed without throwing a Supabase-level error.
    expect(error).toBeNull();

    // Assertion 2: Check if data is an array (even if empty)
    // Supabase returns an array for .select(), even if no rows match.
    // This confirms the query structure was valid and executed.
    expect(Array.isArray(data)).toBe(true);

    // Optional Assertion 3: If sample data was seeded, check if at least one lender was returned
    // This depends on the db/seeds/01_sample_core_data.sql being run beforehand.
    // Uncomment if you expect sample data to be present during the test run.
    // if (data.length > 0) {
    //   expect(data[0]).toHaveProperty('lender_id');
    //   expect(data[0]).toHaveProperty('lender_name');
    // }
  });

  // Add more tests here later for products, questions etc. as needed
  // e.g., test('should fetch products', async () => { ... });
  // e.g., test('should fetch questions', async () => { ... });

});