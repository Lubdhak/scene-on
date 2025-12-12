import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Persona {
  id: string;
  name: string;
  archetype: 'mystic' | 'warrior' | 'sage' | 'trickster';
  avatar: string;
  description: string;
  ability: string;
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
  status: 'pending' | 'accepted' | 'rejected';
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: Date;
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
  mapboxToken: string;
  setMapboxToken: (token: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const personas: Persona[] = [
  {
    id: '1',
    name: 'Nebula Witch',
    archetype: 'mystic',
    avatar: '🔮',
    description: 'Master of cosmic secrets and starlit whispers',
    ability: 'Extended broadcast range',
  },
  {
    id: '2',
    name: 'Iron Ronin',
    archetype: 'warrior',
    avatar: '⚔️',
    description: 'Silent blade, speaks through action',
    ability: 'Priority message queue',
  },
  {
    id: '3',
    name: 'Quantum Sage',
    archetype: 'sage',
    avatar: '🧠',
    description: 'Keeper of infinite knowledge streams',
    ability: 'See hidden scene types',
  },
  {
    id: '4',
    name: 'Neon Jester',
    archetype: 'trickster',
    avatar: '🃏',
    description: 'Chaos incarnate, laughter weaponized',
    ability: 'Anonymous yells',
  },
  {
    id: '5',
    name: 'Void Walker',
    archetype: 'mystic',
    avatar: '👁️',
    description: 'Exists between dimensions, sees all',
    ability: 'Location cloaking',
  },
  {
    id: '6',
    name: 'Storm Valkyrie',
    archetype: 'warrior',
    avatar: '⚡',
    description: 'Rides lightning, commands respect',
    ability: 'Instant chat accepts',
  },
];

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [isSceneActive, setIsSceneActive] = useState(false);
  const [currentYell, setCurrentYell] = useState<YellMessage | null>(null);
  const [chatRequests, setChatRequests] = useState<ChatRequest[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [mapboxToken, setMapboxToken] = useState('');

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
        mapboxToken,
        setMapboxToken,
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
