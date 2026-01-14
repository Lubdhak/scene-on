// Chat API Client
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

export interface ChatRequest {
    id: string;
    from_scene_id: string;
    to_scene_id: string;
    message?: string;
    status: 'pending' | 'accepted' | 'rejected' | 'expired';
    accepted_at?: string;
    expires_at?: string;
    created_at: string;
    from_persona_name?: string;
    from_persona_avatar?: string;
    from_persona_description?: string;
}

export interface ChatMessage {
    id: string;
    chat_request_id: string;
    from_scene_id: string;
    content: string;
    created_at: string;
}

export interface ChatSession {
    request_id: string;
    from_scene_id: string;
    to_scene_id: string;
    expires_at: string;
    other_persona_name: string;
    other_persona_avatar: string;
    other_persona_description: string;
    last_message_content?: string;
    last_message_sender_id?: string;
    last_message_at?: string;
}

export const chatApi = {
    // Send a chat request to another scene
    sendChatRequest: async (toSceneId: string, message?: string): Promise<ChatRequest> => {
        const api = createAuthAxios();
        const response = await api.post<ChatRequest>('/chat/requests', {
            to_scene_id: toSceneId,
            message,
        });
        return response.data;
    },

    // Get all pending chat requests for user's active scene
    getChatInbox: async (): Promise<ChatRequest[]> => {
        const api = createAuthAxios();
        const response = await api.get<ChatRequest[]>('/chat/requests/inbox');
        return response.data;
    },

    // Get all pending chat requests sent by the user
    getSentRequests: async (): Promise<ChatRequest[]> => {
        const api = createAuthAxios();
        const response = await api.get<ChatRequest[]>('/chat/requests/sent');
        return response.data;
    },

    // Accept a chat request
    acceptChatRequest: async (requestId: string): Promise<{ message: string; request_id: string; expires_at: string }> => {
        const api = createAuthAxios();
        const response = await api.post(`/chat/requests/${requestId}/accept`);
        return response.data;
    },

    // Reject a chat request
    rejectChatRequest: async (requestId: string): Promise<{ message: string }> => {
        const api = createAuthAxios();
        const response = await api.post(`/chat/requests/${requestId}/reject`);
        return response.data;
    },

    // Cancel an outgoing chat request
    cancelChatRequest: async (requestId: string): Promise<{ message: string }> => {
        const api = createAuthAxios();
        const response = await api.post(`/chat/requests/${requestId}/cancel`);
        return response.data;
    },

    // Send a message in an accepted chat
    sendMessage: async (requestId: string, content: string, nonce?: string): Promise<ChatMessage> => {
        const api = createAuthAxios();
        const response = await api.post<ChatMessage>('/chat/messages', {
            request_id: requestId,
            content,
            nonce,
        });
        return response.data;
    },

    // Get all messages in a chat session
    getChatMessages: async (requestId: string): Promise<ChatMessage[]> => {
        const api = createAuthAxios();
        const response = await api.get<ChatMessage[]>(`/chat/messages/${requestId}`);
        return response.data;
    },

    // Get all active chat sessions
    getActiveSessions: async (): Promise<ChatSession[]> => {
        const api = createAuthAxios();
        const response = await api.get<ChatSession[]>('/chat/sessions');
        return response.data;
    },
};
