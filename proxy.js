import { createProxyMiddleware } from 'http-proxy-middleware';
import express from 'express';

const app = express();
const PORT = 8000;

// Proxy API requests to the backend
app.use('/api', createProxyMiddleware({ 
  target: 'http://localhost:3001',
  changeOrigin: true
}));

// Proxy all other requests to the frontend
app.use('/', createProxyMiddleware({ 
  target: 'http://localhost:3000',
  changeOrigin: true,
  ws: true // Enable WebSocket proxy for Next.js HMR
}));

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
}); 