import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import { scenesApi } from '@/api/scenes';
import { ChatSession } from '@/api/chat';
import { setLogoutHandler, createAuthAxios } from '@/api/axios-config';

export interface Persona {
  id: string;
  name: string;
  avatar: string;
  description: string;
}

export interface YellMessage {
  id: string;
  text: string;
  timestamp: Date;
}

export interface ChatRequest {
  id: string;
  fromPersona: Persona;
  message?: string;
  timestamp: Date;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: Date;
}

interface AuthState {
  accessToken: string;
  userId: string;
  email: string;
}

interface AppContextType {
  selectedPersona: Persona | null;
  setSelectedPersona: (persona: Persona | null) => void;
  isSceneActive: boolean;
  setIsSceneActive: (active: boolean) => void;
  currentYell: YellMessage | null;
  setCurrentYell: (yell: YellMessage | null) => void;
  chatRequests: ChatRequest[];
  setChatRequests: React.Dispatch<React.SetStateAction<ChatRequest[]>>;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  activeSessions: ChatSession[];
  setActiveSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  currentSceneId: string | null;
  setCurrentSceneId: (id: string | null) => void;
  sentChatRequests: ChatRequest[];
  setSentChatRequests: React.Dispatch<React.SetStateAction<ChatRequest[]>>;
  mapboxToken: string;
  setMapboxToken: (token: string) => void;
  authState: AuthState | null;
  setAuthState: (auth: AuthState | null) => void;
  login: (auth: AuthState) => void;
  logout: () => void;
  isAuthenticated: boolean;
  showInbox: boolean;
  setShowInbox: (show: boolean) => void;
  unreadSessionIds: string[];
  setUnreadSessionIds: React.Dispatch<React.SetStateAction<string[]>>;
  distanceRadius: number;
  setDistanceRadius: (radius: number) => void;
  setWsDisconnect: (disconnectFn: (() => void) | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(() => {
    try {
      const stored = localStorage.getItem('selectedPersona');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isSceneActive, setIsSceneActive] = useState(false);
  const [currentYell, setCurrentYell] = useState<YellMessage | null>(null);
  const [chatRequests, setChatRequests] = useState<ChatRequest[]>([]);
  const [sentChatRequests, setSentChatRequests] = useState<ChatRequest[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeSessions, setActiveSessions] = useState<ChatSession[]>([]);
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  const [mapboxToken, setMapboxToken] = useState(() => {
    // Try to get from environment variable first
    return import.meta.env.VITE_MAPBOX_TOKEN || '';
  });
  const [authState, setAuthState] = useState<AuthState | null>(() => {
    try {
      const stored = localStorage.getItem('auth');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [showInbox, setShowInbox] = useState(false);
  const [unreadSessionIds, setUnreadSessionIds] = useState<string[]>([]);
  const [distanceRadius, setDistanceRadius] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('distanceRadius');
      return stored ? parseInt(stored, 10) : 50; // Default 50km
    } catch {
      return 50;
    }
  });
  const wsDisconnectRef = useRef<(() => void) | null>(null);

  // Persist distance radius to localStorage
  useEffect(() => {
    localStorage.setItem('distanceRadius', distanceRadius.toString());
  }, [distanceRadius]);

  const login = useCallback((auth: AuthState) => {
    setAuthState(auth);
    localStorage.setItem('auth', JSON.stringify(auth));
    localStorage.setItem('accessToken', auth.accessToken);
  }, []);

  const logout = useCallback(async () => {
    // Disconnect WebSocket first
    if (wsDisconnectRef.current) {
      console.log('🔌 Disconnecting WebSocket before logout...');
      wsDisconnectRef.current();
      wsDisconnectRef.current = null;
    }

    // Call backend logout endpoint which handles scene cleanup
    try {
      const api = createAuthAxios();
      await api.post('/auth/logout');
      console.log('✓ Logged out from backend');
    } catch (error) {
      console.error('Backend logout failed:', error);
      // Continue with client-side cleanup even if backend call fails
    }

    // Client-side cleanup
    setAuthState(null);
    setSelectedPersona(null);
    setIsSceneActive(false);
    setCurrentYell(null);
    setChatRequests([]);
    setSentChatRequests([]);
    setActiveChatId(null);
    setActiveSessions([]);
    setCurrentSceneId(null);
    setShowInbox(false);
    setUnreadSessionIds([]);
    setDistanceRadius(50);
    localStorage.removeItem('auth');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('selectedPersona');
  }, []);

  // Register logout handler for axios interceptor
  useEffect(() => {
    setLogoutHandler(logout);
  }, [logout]);

  const setWsDisconnect = useCallback((disconnectFn: (() => void) | null) => {
    wsDisconnectRef.current = disconnectFn;
  }, []);

  return (
    <AppContext.Provider
      value={{
        selectedPersona,
        setSelectedPersona,
        isSceneActive,
        setIsSceneActive,
        currentYell,
        setCurrentYell,
        chatRequests,
        setChatRequests,
        activeChatId,
        setActiveChatId,
        activeSessions,
        setActiveSessions,
        currentSceneId,
        setCurrentSceneId,
        sentChatRequests,
        setSentChatRequests,
        mapboxToken,
        setMapboxToken,
        authState,
        setAuthState,
        login,
        logout,
        isAuthenticated: !!authState,
        showInbox,
        setShowInbox,
        unreadSessionIds,
        setUnreadSessionIds,
        distanceRadius,
        setDistanceRadius,
        setWsDisconnect,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};
