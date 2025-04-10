import express from 'express';
import dotenv from 'dotenv';
import sessionRoutes from './api/sessionRoutes.js'; // Import session routes
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001; // Use environment variable or default

// Middleware
app.use(express.json()); // Parse JSON request bodies

// API Routes
app.use('/api', sessionRoutes); // Mount session routes under /api

// Basic Route (optional)
app.get('/', (req, res) => { // Changed back to root for basic check
  res.send('Broker AI Decision Engine API is running!');
});

// Global Error Handler (Basic Example - Enhance as needed)
// This should be defined AFTER all other app.use() and routes
app.use((err, req, res, next) => {
  console.error("Global Error Handler Caught:", err.message, err.stack || ''); // Log message and stack

  // Use a predefined status code if available (e.g., from validation errors), otherwise default to 500
  const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;

  // Provide a more user-friendly message for common client errors (4xx)
  // and a generic one for server errors (5xx) to avoid leaking details.
  let userMessage = 'An unexpected error occurred on the server.';
  if (statusCode >= 400 && statusCode < 500) {
    // For client errors, use the error message directly if it's intended for the user
    userMessage = err.message || 'Bad Request. Please check your input.';
  }

  res.status(statusCode).json({
    error: {
      message: userMessage,
      // Optionally add a code for specific error types if needed later
      // code: err.code || 'INTERNAL_ERROR'
    }
  });
});

// Start Server
const server = app.listen(PORT, () => { // Assign to variable
  console.log(`API Server listening on port ${PORT}`);
});

// Export app and server for potential testing
export { app, server }; // Export both
export default app;