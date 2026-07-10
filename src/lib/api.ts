import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Example request interceptor
api.interceptors.request.use((config) => {
  // You can add auth tokens here if needed
  return config;
});
