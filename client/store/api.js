'use client';
// path is store/api.js
import axios from "axios";

const API = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api`,
  headers: {
    'Content-Type': 'application/json', // Set default content type to JSON
  }
});

// Request interceptor to add authorization token if available
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token'); // Get the token from localStorage using the correct key
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Optional: Response Interceptor for handling 401/403 (Token Expiration/Invalidity)
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      // Handle token expiration or invalidity
      console.error("Token expired or invalid. Please log in again.");
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Optionally, dispatch a logout action here if you have access to the store
      // store.dispatch(logoutUser());
      window.location.href = '/login'; // Redirect to login page
    }
    return Promise.reject(error);
  }
);

export default API;