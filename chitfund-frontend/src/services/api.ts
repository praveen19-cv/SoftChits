import axios, { AxiosInstance } from 'axios';

const API_URL = 'http://localhost:3000/api';

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api; 