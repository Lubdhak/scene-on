// Scenes API Client
import axios from 'axios';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080') + '/api/v1';

// Get auth token from localStorage
const getAuthToken = (): string | null => {
    const auth = localStorage.getItem('auth');
    if (!auth) return null;
    try {
        const parsed = JSON.parse(auth);
        return parsed.accessToken;
    } catch {
        return null;
    }
};

// Create axios instance with auth header
const createAuthAxios = () => {
    const token = getAuthToken();
    return axios.create({
        baseURL: API_BASE_URL,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
};

export interface Scene {
    id: string;
    persona_id: string;
    latitude: number;
    longitude: number;
    is_active: boolean;
    started_at: string;
    expires_at: string;
    created_at: string;
}

export interface SceneWithPersona extends Scene {
    persona_name?: string;
    persona_avatar?: string;
}

export const scenesApi = {
    // Start a scene at given location
    startScene: async (personaId: string, latitude: number, longitude: number): Promise<Scene> => {
        const api = createAuthAxios();
        const response = await api.post<Scene>('/scenes/start', {
            persona_id: personaId,
            latitude,
            longitude,
        });
        return response.data;
    },

    // Stop active scene
    stopScene: async (): Promise<{ message: string }> => {
        const api = createAuthAxios();
        const response = await api.post('/scenes/stop');
        return response.data;
    },

    // Get current active scene
    getActiveScene: async (): Promise<{ active: boolean; scene?: Scene }> => {
        const api = createAuthAxios();
        const response = await api.get<{ active: boolean; scene?: Scene }>('/scenes/active');
        return response.data;
    },

    // Get nearby scenes
    getNearbyScenes: async (latitude: number, longitude: number, radius?: number): Promise<Scene[]> => {
        const api = createAuthAxios();
        const params: any = { latitude, longitude };
        if (radius !== undefined) {
            params.radius = radius;
        }
        const response = await api.get<Scene[]>('/scenes/nearby', { params });
        return response.data;
    },
};
