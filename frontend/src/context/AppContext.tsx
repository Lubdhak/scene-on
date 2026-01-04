import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
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
  sentRequestSceneIds: string[];
  setSentRequestSceneIds: React.Dispatch<React.SetStateAction<string[]>>;
  mapboxToken: string;
  setMapboxToken: (token: string) => void;
  showInbox: boolean;
  setShowInbox: (show: boolean) => void;
  unreadSessionIds: string[];
  setUnreadSessionIds: React.Dispatch<React.SetStateAction<string[]>>;
  authState: AuthState | null;
  login: (auth: AuthState) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Initial personas for local state (will be replaced by custom creation)
export const personas: Persona[] = [];

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(() => {
    const stored = localStorage.getItem('selectedPersona');
    const parsed = stored ? JSON.parse(stored) : null;
    console.log('Initialized selectedPersona from storage:', parsed);
    return parsed;
  });
  const [isSceneActive, setIsSceneActive] = useState<boolean>(() => {
    return localStorage.getItem('isSceneActive') === 'true';
  });

  const updateSceneActive = (active: boolean) => {
    setIsSceneActive(active);
    localStorage.setItem('isSceneActive', String(active));
  };

  const [currentYell, setCurrentYell] = useState<YellMessage | null>(null);
  const [chatRequests, setChatRequests] = useState<ChatRequest[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeSessions, setActiveSessions] = useState<ChatSession[]>([]);
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(() => {
    return localStorage.getItem('currentSceneId');
  });
  const [sentRequestSceneIds, setSentRequestSceneIds] = useState<string[]>([]);
  const [unreadSessionIds, setUnreadSessionIds] = useState<string[]>([]);
  const [mapboxToken, setMapboxToken] = useState('');
  const [showInbox, setShowInbox] = useState(false);
  const [authState, setAuthState] = useState<AuthState | null>(() => {
    // Try to restore auth from localStorage
    const stored = localStorage.getItem('auth');
    return stored ? JSON.parse(stored) : null;
  });

  const login = (auth: AuthState) => {
    setAuthState(auth);
    localStorage.setItem('auth', JSON.stringify(auth));
  };

  const logout = async () => {
    // If scene is active, try to stop it in backend before clearing state
    if (isSceneActive) {
      try {
        console.log('🚪 User logging out while live, stopping scene...');
        await scenesApi.stopScene();
      } catch (err) {
        console.error('Failed to stop scene during logout:', err);
      }
    }

    setAuthState(null);
    localStorage.removeItem('auth');
    localStorage.removeItem('isSceneActive');
    localStorage.removeItem('selectedPersona');
    localStorage.removeItem('currentSceneId');
    setSelectedPersona(null);
    setIsSceneActive(false);
    setCurrentSceneId(null);
    setSentRequestSceneIds([]);
  };

  return (
    <AppContext.Provider
      value={{
        selectedPersona,
        setSelectedPersona,
        isSceneActive,
        setIsSceneActive: updateSceneActive,
        currentYell,
        setCurrentYell,
        chatRequests,
        setChatRequests,
        activeChatId,
        setActiveChatId,
        activeSessions,
        setActiveSessions,
        currentSceneId,
        setCurrentSceneId: (id: string | null) => {
          setCurrentSceneId(id);
          if (id) localStorage.setItem('currentSceneId', id);
          else localStorage.removeItem('currentSceneId');
        },
        sentRequestSceneIds,
        setSentRequestSceneIds,
        unreadSessionIds,
        setUnreadSessionIds,
        mapboxToken,
        setMapboxToken,
        showInbox,
        setShowInbox,
        authState,
        login,
        logout,
        isAuthenticated: !!authState,
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
