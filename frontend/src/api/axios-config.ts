// Centralized Axios Configuration with Auto-Logout on 401
import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080') + '/api/v1';

// Get auth token from localStorage
export const getAuthToken = (): string | null => {
    const auth = localStorage.getItem('auth');
    if (!auth) return null;
    try {
        const parsed = JSON.parse(auth);
        return parsed.accessToken;
    } catch {
        return null;
    }
};

// Logout handler - will be set by AppContext
let logoutHandler: (() => void) | null = null;

export const setLogoutHandler = (handler: () => void) => {
    logoutHandler = handler;
};

// Create axios instance with auth header and interceptors
export const createAuthAxios = (): AxiosInstance => {
    const token = getAuthToken();
    const instance = axios.create({
        baseURL: API_BASE_URL,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    // Response interceptor to handle 401 errors
    instance.interceptors.response.use(
        (response) => response,
        (error) => {
            if (error.response?.status === 401) {
                console.warn('🔐 Invalid or expired token detected, logging out...');
                
                // Clear local storage
                localStorage.removeItem('auth');
                localStorage.removeItem('accessToken');
                localStorage.removeItem('selectedPersona');
                
                // Call logout handler if set
                if (logoutHandler) {
                    logoutHandler();
                }
                
                // Redirect to login
                window.location.href = '/login';
            }
            return Promise.reject(error);
        }
    );

    return instance;
};
