import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Supabase URL not found. Make sure SUPABASE_URL is set in your .env file.");
}
if (!supabaseKey) {
  throw new Error("Supabase Service Role Key not found. Make sure SUPABASE_SERVICE_ROLE_KEY is set in your .env file.");
}

// Create and export the Supabase client instance
// We use the service_role key here for backend operations.
// Ensure this key is kept secure and not exposed client-side.
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Automatically refresh the session token - less critical for service_role key but good practice
    autoRefreshToken: true,
    // Persist session - less critical for service_role key
    persistSession: false,
    // Detect session from URL - typically for client-side auth flows, disable for backend
    detectSessionInUrl: false
  }
});

export default supabase;