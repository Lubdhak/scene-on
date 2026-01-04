import { useRef, useEffect, useState, useMemo, memo } from 'react';
import { useApp, ChatRequest } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { MessageCircle, MapPin, AlertCircle, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { scenesApi } from '@/api/scenes';
import { chatApi, ChatSession } from '@/api/chat';
import { useWebSocket } from '@/hooks/useWebSocket';

interface NearbyUser {
  sceneId: string;
  personaId: string;
  avatar: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
}

const MapMarker = memo(({
  user, index, session, isPendingSent, isPendingReceived, currentSceneId, onClick
}: {
  user: NearbyUser;
  index: number;
  session?: ChatSession;
  isPendingSent: boolean;
  isPendingReceived: boolean;
  currentSceneId: string | null;
  onClick: () => void;
}) => {
  const isActive = !!session;
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const totalDuration = 5 * 60; // 5 minutes in seconds

  useEffect(() => {
    if (!session) return;

    const calculateTime = () => {
      const expiry = new Date(session.expires_at).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeLeft(diff);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [session]);

  const progress = (timeLeft / totalDuration) * 100;
  const isUrgent = isActive && timeLeft < 60;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.5, opacity: 0, y: -20 }}
      transition={{
        type: "spring",
        damping: 15,
        stiffness: 100,
      }}
      layout
      className="absolute pointer-events-auto cursor-pointer group"
      style={{
        left: `${25 + (index % 3) * 20 + (Math.sin(index) * 5)}%`,
        top: `${25 + Math.floor(index / 3) * 20 + (Math.cos(index) * 5)}%`,
      }}
      onClick={onClick}
    >
      <div className="relative avatar-float" style={{ animationDelay: `${index * 0.5}s` }}>
        {isActive && (
          <div className={`absolute inset-0 -m-2.5 rounded-full border-2 ${isUrgent ? 'border-destructive' : 'border-scene-active'} animate-pulse opacity-20`} />
        )}
        {isPendingSent && !isActive && (
          <div className="absolute inset-0 -m-1.5 rounded-full border border-primary/50 border-dashed animate-spin-slow" />
        )}
        {isPendingReceived && !isActive && (
          <div className="absolute inset-0 -m-2 rounded-full bg-accent/20 animate-ping opacity-30" />
        )}

        <motion.div
          whileHover={{ scale: 1.15, rotate: 5 }}
          className={`
            relative w-14 h-14 rounded-full bg-card/90 border-2 flex items-center justify-center text-3xl shadow-lg backdrop-blur-md transition-all z-10
            ${isActive ? (isUrgent ? 'border-destructive shadow-destructive/20' : 'border-scene-active shadow-scene-active/20') :
              isPendingSent ? 'border-primary/50' :
                isPendingReceived ? 'border-accent animate-pulse' :
                  'border-border group-hover:border-primary'}
          `}
        >
          {/* Timer Ring */}
          {isActive && (
            <svg className="absolute inset-x-0 inset-y-0 w-full h-full -rotate-90 transform pointer-events-none" style={{ scale: '1.2' }}>
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-muted-foreground/10"
              />
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="150"
                strokeDashoffset={150 - (progress * 150) / 100}
                className={isUrgent ? 'text-destructive' : 'text-scene-active'}
              />
            </svg>
          )}

          <span className="relative z-10">{user.avatar}</span>
        </motion.div>

        {(isActive || isPendingSent || isPendingReceived) && (
          <div className={`
            absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] shadow-lg border-2 border-card z-20
            ${isActive ? (isUrgent ? 'bg-destructive' : 'bg-scene-active') : isPendingSent ? 'bg-primary' : 'bg-accent'}
          `}>
            {isActive ? (
              <span className="font-mono font-black text-[9px] text-white">
                {Math.ceil(timeLeft / 60)}m
              </span>
            ) : '•'}
          </div>
        )}

        {/* Message Preview Layer */}
        <div className={`
          absolute -top-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 transition-all duration-300 transform z-30 pointer-events-none
          ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-hover:-translate-y-1'}
        `}>
          {session?.last_message_content && (
            <div className={`
              bg-card/95 border px-2 py-1 rounded-lg shadow-xl flex items-center gap-1.5 max-w-[140px] animate-in fade-in zoom-in duration-300
              ${isActive ? (isUrgent ? 'border-destructive/50 ring-destructive/20' : 'border-scene-active/50 ring-1 ring-scene-active/20') : 'border-border/50'}
            `}>
              {session.last_message_sender_id === currentSceneId ? (
                <ArrowUpRight className="w-2.5 h-2.5 text-primary shrink-0" />
              ) : (
                <ArrowDownLeft className="w-2.5 h-2.5 text-scene-active shrink-0" />
              )}
              <span className="text-[10px] font-bold text-foreground truncate leading-tight">
                {session.last_message_content}
              </span>
            </div>
          )}

          <div className={`
            px-3 py-1.5 rounded-full bg-card/95 text-foreground text-[10px] font-bold whitespace-nowrap shadow-xl border border-border/50 transition-all
            ${isActive ? (isUrgent ? 'text-destructive border-destructive/30' : 'text-scene-active border-scene-active/30') : ''}
            ${!isActive ? 'opacity-0 group-hover:opacity-100' : ''}
          `}>
            {user.name}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

const MapContainer = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const {
    mapboxToken, selectedPersona, isSceneActive, currentYell, authState,
    sentRequestSceneIds, setSentRequestSceneIds, activeSessions, setActiveSessions,
    chatRequests, setChatRequests, setActiveChatId, currentSceneId, setShowInbox,
    setUnreadSessionIds
  } = useApp();
  const [mapError, setMapError] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedUser, setSelectedUser] = useState<NearbyUser | null>(null);
  const [inviteMessage, setInviteMessage] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

  const { subscribe } = useWebSocket();

  // WebSocket subscriptions for real-time removal
  useEffect(() => {
    console.log('📡 Setting up WebSocket subscription for scene.ended');
    const unsubscribeEnded = subscribe('scene.ended', (data) => {
      const { scene_id } = data;
      console.log('🎭 REAL-TIME: Scene ended received via WS:', scene_id);
      setNearbyUsers(prev => {
        const filtered = prev.filter(u => u.sceneId !== scene_id);
        console.log(`📉 Nearby users count: ${prev.length} -> ${filtered.length}`);
        return filtered;
      });
    });

    return () => {
      unsubscribeEnded();
    };
  }, [subscribe]);

  // Fetch nearby scenes when scene is active
  useEffect(() => {
    if (!isSceneActive || !userLocation) return;

    const fetchNearby = async () => {
      try {
        const scenes = await scenesApi.getNearbyScenes(userLocation.lat, userLocation.lng);

        // Transform scenes to nearby users format
        const users: NearbyUser[] = scenes.map((scene: any) => ({
          sceneId: scene.id,
          personaId: scene.persona_id,
          avatar: scene.persona_avatar || '❓',
          name: scene.persona_name || 'Unknown',
          description: scene.persona_description || '',
          latitude: scene.latitude,
          longitude: scene.longitude,
        }));

        setNearbyUsers(users);
      } catch (error) {
        console.error('Failed to fetch nearby scenes:', error);
      }
    };

    fetchNearby();

    // Refresh every 10 seconds
    const interval = setInterval(fetchNearby, 10000);
    return () => clearInterval(interval);
  }, [isSceneActive, userLocation]);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          // Use default location if denied
          setUserLocation({ lat: 40.7128, lng: -74.006 });
        }
      );
    } else {
      setUserLocation({ lat: 40.7128, lng: -74.006 });
    }
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    // Check for WebGL support first
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    if (!gl) {
      console.log('WebGL not supported, using fallback UI');
      setMapError(true);
      return;
    }

    // Dynamically import mapbox to avoid SSR issues and handle errors
    const initMap = async () => {
      try {
        const mapboxgl = await import('mapbox-gl');
        await import('mapbox-gl/dist/mapbox-gl.css');

        mapboxgl.default.accessToken = mapboxToken;

        const map = new mapboxgl.default.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: userLocation ? [userLocation.lng, userLocation.lat] : [-74.006, 40.7128],
          zoom: 15,
          pitch: 45,
        });

        map.on('load', () => {
          setMapLoaded(true);
          map.setFog({
            color: 'rgb(15, 20, 35)',
            'high-color': 'rgb(30, 40, 70)',
            'horizon-blend': 0.1,
          });
        });

        map.on('error', () => {
          setMapError(true);
        });

        // Get user's location
        if (navigator.geolocation && userLocation) {
          map.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 15 });
        }

        return () => map.remove();
      } catch (error) {
        console.log('Map initialization failed, using fallback:', error);
        setMapError(true);
      }
    };

    initMap();
  }, [mapboxToken, userLocation]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d < 1 ? (d * 1000).toFixed(0) + 'm' : d.toFixed(1) + 'km';
  };

  const deg2rad = (deg: number) => {
    return deg * (Math.PI / 180);
  };

  const handleCancelChatRequest = async (user: NearbyUser) => {
    // Find the request ID from global state or fetch it
    // For now, we need to know the request ID. Let's update nearbyUsers to include it if possible, 
    // or search chatRequests/activeSessions.
    // Actually, we can fetch sent requests or find it in a local map.
    setSendingRequest(true);
    try {
      // Find request for this scene
      const sentRequests = await chatApi.getSentRequests();
      const req = sentRequests.find(r => r.to_scene_id === user.sceneId && r.status === 'pending');
      if (req) {
        await chatApi.cancelChatRequest(req.id);
        setSentRequestSceneIds(prev => prev.filter(id => id !== user.sceneId));
        setSelectedUser(null);
      }
    } catch (error) {
      console.error('Failed to cancel request:', error);
      alert('Failed to cancel request');
    } finally {
      setSendingRequest(false);
    }
  };

  const handleAcceptChatRequest = async (user: NearbyUser) => {
    setSendingRequest(true);
    try {
      const inboundReq = chatRequests.find(r => r.fromPersona.id === user.sceneId && r.status === 'pending');
      if (inboundReq) {
        const result = await chatApi.acceptChatRequest(inboundReq.id);
        // Update local state
        setChatRequests(prev => prev.map(r => r.id === inboundReq.id ? { ...r, status: 'accepted' } : r));
        // Fetch active sessions to update the pulse indicator
        const sessions = await chatApi.getActiveSessions();
        setActiveSessions(sessions);
        // Open the chat
        setActiveChatId(result.request_id);
        setSelectedUser(null);
      }
    } catch (error) {
      console.error('Failed to accept request:', error);
      alert('Failed to accept request');
    } finally {
      setSendingRequest(false);
    }
  };

  const handleSendChatRequest = async (user: NearbyUser) => {
    if (!authState || sendingRequest) return;

    // Optimistically update if not already there
    if (!sentRequestSceneIds.includes(user.sceneId)) {
      setSentRequestSceneIds(prev => [...prev, user.sceneId]);
    }

    setSendingRequest(true);
    try {
      const finalMessage = inviteMessage.trim() || `Hey! I'm ${selectedPersona?.name}`;
      await chatApi.sendChatRequest(user.sceneId, finalMessage);
      // Silent success - the UI will update based on sentRequestSceneIds
      setSelectedUser(null);
      setInviteMessage('');
    } catch (error: any) {
      console.error('Failed to send chat request:', error);
      const isAlreadyExists = error.response?.data?.error?.includes('already exists');
      if (isAlreadyExists) {
        // If it already exists, just treat it as sent
        setSelectedUser(null);
        setInviteMessage('');
      } else {
        alert(error.response?.data?.error || 'Failed to send chat request');
        // Rollback if not "already exists" error
        setSentRequestSceneIds(prev => prev.filter(id => id !== user.sceneId));
      }
    } finally {
      setSendingRequest(false);
    }
  };

  return (
    <div className="absolute inset-0">
      {/* Map container or fallback background */}
      {!mapError ? (
        <div ref={mapContainer} className="w-full h-full" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-background via-muted/20 to-background relative overflow-hidden">
          {/* Grid pattern for visual interest */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `
                linear-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px),
                linear-gradient(90deg, hsl(var(--primary) / 0.3) 1px, transparent 1px)
              `,
              backgroundSize: '50px 50px',
            }}
          />

          {/* Glowing orbs for depth */}
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-1/3 right-1/4 w-48 h-48 bg-secondary/15 rounded-full blur-[80px]" />

          {/* WebGL notice */}
          <div className="absolute top-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-muted/80 backdrop-blur-sm border border-border/50 text-sm text-muted-foreground">
            <AlertCircle className="w-4 h-4" />
            <span>Map preview unavailable - works in production</span>
          </div>
        </div>
      )}

      {/* Overlay gradient for better UI contrast */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-background/60 via-transparent to-background/80" />

      {/* Avatar markers */}
      {isSceneActive && (
        <div className="absolute inset-0 pointer-events-none">
          {/* User's own avatar in center */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-card border-2 border-primary flex items-center justify-center text-3xl scene-pulse">
                {selectedPersona?.avatar}
              </div>
              {/* Location pin indicator */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                <MapPin className="w-5 h-5 text-primary fill-primary" />
              </div>
              {currentYell && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="absolute -top-16 left-1/2 -translate-x-1/2 px-3 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium whitespace-nowrap max-w-48 truncate yell-appear"
                >
                  {currentYell.text}
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Real nearby users */}
          <AnimatePresence mode="popLayout">
            {nearbyUsers.map((user, index) => {
              const session = activeSessions.find(s => s.from_scene_id === user.sceneId || s.to_scene_id === user.sceneId);
              const isPendingSent = sentRequestSceneIds.includes(user.sceneId);
              const isPendingReceived = chatRequests.some(r => r.fromPersona.id === user.sceneId && r.status === 'pending');

              return (
                <MapMarker
                  key={user.sceneId}
                  user={user}
                  index={index}
                  session={session}
                  isPendingSent={isPendingSent}
                  isPendingReceived={isPendingReceived}
                  currentSceneId={currentSceneId}
                  onClick={() => setSelectedUser(user)}
                />
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* User details popup */}
      {selectedUser && (() => {
        const isActive = activeSessions.some(s => s.from_scene_id === selectedUser.sceneId || s.to_scene_id === selectedUser.sceneId);
        const isPendingSent = sentRequestSceneIds.includes(selectedUser.sceneId);
        const isPendingReceived = chatRequests.some(r => r.fromPersona.id === selectedUser.sceneId && r.status === 'pending');
        const distance = userLocation ? calculateDistance(userLocation.lat, userLocation.lng, selectedUser.latitude, selectedUser.longitude) : '...';

        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-background/40 backdrop-blur-sm"
            onClick={() => {
              setSelectedUser(null);
              setInviteMessage('');
            }}
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-muted border-2 border-primary flex items-center justify-center text-4xl">
                  {selectedUser.avatar}
                </div>
                <div className="text-center w-full">
                  <h3 className="text-2xl font-bold text-foreground">{selectedUser.name}</h3>
                  {selectedUser.description && (
                    <p className="text-base text-muted-foreground mt-2 italic px-2">
                      "{selectedUser.description}"
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-center gap-2 text-xs text-primary font-medium uppercase tracking-wider">
                    <div className="w-2 h-2 rounded-full bg-scene-active animate-pulse" />
                    {distance} AWAY
                  </div>
                </div>

                {/* Invitation Message Input - Only show if no request sent/active */}
                {!isActive && !isPendingSent && !isPendingReceived ? (
                  <div className="w-full space-y-2">
                    <label className="text-xs font-medium text-muted-foreground ml-1 uppercase tracking-wider">
                      Add an invitation message (optional)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={50}
                        value={inviteMessage}
                        onChange={(e) => setInviteMessage(e.target.value)}
                        placeholder="Wanna catch up?"
                        className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium">
                        {inviteMessage.length}/50
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`
                    w-full py-4 px-6 rounded-2xl text-center border font-bold text-sm
                    ${isActive ? 'bg-scene-active/10 border-scene-active/20 text-scene-active' :
                      isPendingSent ? 'bg-primary/10 border-primary/20 text-primary' :
                        'bg-accent/10 border-accent/20 text-accent'}
                  `}>
                    {isActive ? 'YOU ARE IN A LIVE CHAT' :
                      isPendingSent ? 'REQUEST PENDING...' :
                        'WANTS TO CHAT WITH YOU'}
                  </div>
                )}

                <div className="w-full flex flex-col gap-2">
                  <Button
                    onClick={() => {
                      if (isActive) {
                        const session = activeSessions.find(s => s.from_scene_id === selectedUser.sceneId || s.to_scene_id === selectedUser.sceneId);
                        if (session) {
                          setUnreadSessionIds(prev => prev.filter(id => id !== session.request_id));
                          setActiveChatId(session.request_id);
                        }
                        setSelectedUser(null);
                      } else if (isPendingReceived) {
                        handleAcceptChatRequest(selectedUser);
                      } else if (!isPendingSent) {
                        handleSendChatRequest(selectedUser);
                      }
                    }}
                    disabled={sendingRequest || (isPendingSent && !isActive)}
                    className={`w-full ${isActive ? 'bg-scene-active hover:bg-scene-active/90 text-white' : 'gradient-primary'}`}
                  >
                    {isActive ? (
                      <><MessageCircle className="w-4 h-4 mr-2" /> Open Chat</>
                    ) : isPendingSent ? (
                      'Request Sent'
                    ) : isPendingReceived ? (
                      <><MessageCircle className="w-4 h-4 mr-2" /> Accept & Chat</>
                    ) : (
                      <><MessageCircle className="w-4 h-4 mr-2" /> {sendingRequest ? 'Sending...' : 'Send Chat Request'}</>
                    )}
                  </Button>

                  {isPendingSent && (
                    <Button
                      variant="destructive"
                      onClick={() => handleCancelChatRequest(selectedUser)}
                      disabled={sendingRequest}
                      className="w-full"
                    >
                      Cancel Request
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelectedUser(null);
                      setInviteMessage('');
                    }}
                    className="w-full"
                  >
                    Not Now
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        );
      })()}
    </div>
  );
};

export default MapContainer;
