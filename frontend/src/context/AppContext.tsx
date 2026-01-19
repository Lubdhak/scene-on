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
  scene_id: string;
  content: string;
  timestamp: Date;
  expires_at: Date;
  persona_name?: string;
  persona_avatar?: string;
  latitude?: number;
  longitude?: number;
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
  receivedYells: Map<string, YellMessage>; // sceneId -> YellMessage
  setReceivedYells: React.Dispatch<React.SetStateAction<Map<string, YellMessage>>>;
  nextYellAt: number | null;
  setNextYellAt: (timestamp: number | null) => void;
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
  const [currentYell, setCurrentYell] = useState<YellMessage | null>(() => {
    try {
      const stored = localStorage.getItem('currentYell');
      if (stored) {
        const yell = JSON.parse(stored);
        // Check if expired
        if (new Date(yell.expires_at) > new Date()) {
          return {
            ...yell,
            timestamp: new Date(yell.timestamp),
            expires_at: new Date(yell.expires_at),
          };
        }
      }
      return null;
    } catch {
      return null;
    }
  });
  const [receivedYells, setReceivedYells] = useState<Map<string, YellMessage>>(() => {
    try {
      const stored = localStorage.getItem('receivedYells');
      if (stored) {
        const parsed = JSON.parse(stored);
        const yellsMap = new Map<string, YellMessage>();
        // Filter out expired yells on load
        parsed.forEach(([sceneId, yell]: [string, any]) => {
          if (new Date(yell.expires_at) > new Date()) {
            yellsMap.set(sceneId, {
              ...yell,
              timestamp: new Date(yell.timestamp),
              expires_at: new Date(yell.expires_at),
            });
          }
        });
        return yellsMap;
      }
      return new Map();
    } catch {
      return new Map();
    }
  });
  const [nextYellAt, setNextYellAt] = useState<number | null>(null);
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

  // Persist currentYell to localStorage
  useEffect(() => {
    if (currentYell) {
      localStorage.setItem('currentYell', JSON.stringify(currentYell));
    } else {
      localStorage.removeItem('currentYell');
    }
  }, [currentYell]);

  // Persist receivedYells to localStorage (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (receivedYells.size > 0) {
        const serialized = JSON.stringify(Array.from(receivedYells.entries()));
        localStorage.setItem('receivedYells', serialized);
      } else {
        localStorage.removeItem('receivedYells');
      }
    }, 500); // Debounce by 500ms

    return () => clearTimeout(timeoutId);
  }, [receivedYells]);

  // Clean up expired currentYell
  useEffect(() => {
    if (!currentYell) return;

    const checkExpiration = () => {
      if (currentYell.expires_at < new Date()) {
        setCurrentYell(null);
      }
    };

    // Check immediately
    checkExpiration();

    // Check every 30 seconds
    const interval = setInterval(checkExpiration, 30000);
    return () => clearInterval(interval);
  }, [currentYell]);

  // Clean up expired receivedYells
  useEffect(() => {
    if (receivedYells.size === 0) return;

    const checkExpiration = () => {
      const now = new Date();
      const expiredSceneIds: string[] = [];
      
      // First pass: identify expired yells without creating new Map
      receivedYells.forEach((yell, sceneId) => {
        if (yell.expires_at < now) {
          expiredSceneIds.push(sceneId);
        }
      });

      // Only update if there are expired yells
      if (expiredSceneIds.length > 0) {
        const updatedYells = new Map(receivedYells);
        expiredSceneIds.forEach(sceneId => updatedYells.delete(sceneId));
        setReceivedYells(updatedYells);
        console.log(`🗑️ Removed ${expiredSceneIds.length} expired yells`);
      }
    };

    // Check immediately
    checkExpiration();

    // Check every 30 seconds
    const interval = setInterval(checkExpiration, 30000);
    return () => clearInterval(interval);
  }, [receivedYells]);

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
    setReceivedYells(new Map());
    setNextYellAt(null);
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
    localStorage.removeItem('currentYell');
    localStorage.removeItem('receivedYells');
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
        receivedYells,
        setReceivedYells,
        nextYellAt,
        setNextYellAt,
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
