import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { scenesApi } from '@/api/scenes';
import { ChatSession } from '@/api/chat';

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
  const [mapboxToken, setMapboxToken] = useState('');
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

  // Persist distance radius to localStorage
  useEffect(() => {
    localStorage.setItem('distanceRadius', distanceRadius.toString());
  }, [distanceRadius]);

  const login = useCallback((auth: AuthState) => {
    setAuthState(auth);
    localStorage.setItem('auth', JSON.stringify(auth));
    localStorage.setItem('accessToken', auth.accessToken);
  }, []);

  const logout = useCallback(() => {
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
    setDistanceRadius(50); // Reset to default
    // Clear local storage if needed
    localStorage.removeItem('auth');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('selectedPersona');
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
        setDistanceRadius
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
