import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import MapContainer from '@/components/MapContainer';
import SceneToggle from '@/components/SceneToggle';
import YellComposer from '@/components/YellComposer';
import ChatInbox from '@/components/ChatInbox';
import EphemeralChat from '@/components/EphemeralChat';
import PersonaBadge from '@/components/PersonaBadge';
import MapTokenInput from '@/components/MapTokenInput';
import { Settings, Inbox, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { chatApi } from '@/api/chat';
import { scenesApi } from '@/api/scenes';
import { useWebSocket } from '@/hooks/useWebSocket';

const MapView = () => {
  const navigate = useNavigate();
  const {
    selectedPersona,
    isSceneActive,
    setIsSceneActive,
    mapboxToken,
    chatRequests,
    setChatRequests,
    setActiveSessions,
    setCurrentSceneId,
    setSentChatRequests,
    activeChatId,
    authState,
    currentSceneId,
    showInbox,
    setShowInbox,
    unreadSessionIds,
    setUnreadSessionIds,
    logout
  } = useApp();
  const { toast } = useToast();
  const [showYellComposer, setShowYellComposer] = useState(false);
  const { subscribe, isConnected } = useWebSocket(currentSceneId);

  // Auto-clear unread status when a chat becomes active
  useEffect(() => {
    if (activeChatId) {
      setUnreadSessionIds(prev => prev.filter(id => id !== activeChatId));
    }
  }, [activeChatId, setUnreadSessionIds]);

  useEffect(() => {
    if (!selectedPersona) {
      navigate('/persona');
    } else {
      syncSceneStatus();
    }
  }, [selectedPersona, navigate]);

  const syncSceneStatus = async () => {
    if (!authState) return;
    try {
      const { active, scene } = await scenesApi.getActiveScene();
      setIsSceneActive(active);
      if (active && scene) {
        setCurrentSceneId(scene.id);
      } else {
        setCurrentSceneId(null);
      }
    } catch (error) {
      console.error('Failed to sync scene status:', error);
    }
  };

  const loadChatInbox = async () => {
    try {
      const { active, scene } = await scenesApi.getActiveScene();
      setIsSceneActive(active);

      if (active && scene) {
        setCurrentSceneId(scene.id);
        const [requests, sessions, sentRequests] = await Promise.all([
          chatApi.getChatInbox(),
          chatApi.getActiveSessions(),
          chatApi.getSentRequests()
        ]);

        setChatRequests(requests.map(r => ({
          id: r.id,
          fromPersona: {
            id: r.from_scene_id,
            name: r.from_persona_name || 'Unknown',
            avatar: r.from_persona_avatar || '❓',
            description: r.from_persona_description || '',
          },
          message: r.message,
          timestamp: new Date(r.created_at),
          status: r.status,
        })));

        setActiveSessions(sessions);

        setSentChatRequests(sentRequests.map(r => ({
          id: r.id,
          fromPersona: {
            id: r.to_scene_id,
            name: 'Unknown', // API doesn't return recipient details for sent requests yet
            avatar: '❓',
            description: '',
          },
          message: r.message,
          timestamp: new Date(r.created_at),
          status: r.status,
        })));
      } else {
        setCurrentSceneId(null);
      }
    } catch (err) {
      console.error('Failed to load chat inbox:', err);
    }
  };

  // Subscribe to chat requests
  useEffect(() => {
    loadChatInbox();

    console.log('📡 MapView: Subscribing to chat events');
    const unsubscribeReceived = subscribe('chat.request.received', (data) => {
      // Optimistic state update only
      if (data && data.from_scene_id) {
        setChatRequests(prev => {
          if (prev.some(r => r.id === data.id)) return prev;
          return [{
            id: data.id,
            fromPersona: {
              id: data.from_scene_id,
              name: data.from_persona_name || 'Unknown',
              avatar: data.from_persona_avatar || '❓',
              description: data.from_persona_description || '',
            },
            message: data.message,
            timestamp: new Date(data.created_at || Date.now()),
            status: 'pending' as const,
          }, ...prev];
        });
      }
    });

    const unsubscribeAccepted = subscribe('chat.request.accepted', (data) => {
      if (data && data.request_id) {
        setChatRequests(prev => prev.map(r => r.id === data.request_id ? { ...r, status: 'accepted' as const } : r));
        // Update sessions list to show the new active chat
        chatApi.getActiveSessions().then(setActiveSessions).catch(console.error);
      }
    });

    const unsubscribeEnded = subscribe('chat.session.ended', (data) => {
      if (data && data.request_id) {
        setChatRequests(prev => prev.filter(r => r.id !== data.request_id));
        setActiveSessions(prev => prev.filter(s => s.request_id !== data.request_id));
        setUnreadSessionIds(prev => prev.filter(id => id !== data.request_id));
      }
    });

    const unsubscribeMessage = subscribe('chat.message.received', (data) => {
      const reqId = data.request_id;
      if (reqId) {
        // Mark as unread if not active
        if (activeChatId !== reqId) {
          setUnreadSessionIds(prev => prev.includes(reqId) ? prev : [...prev, reqId]);
        }

        // Update last message in sessions list
        setActiveSessions(prev => prev.map(s => s.request_id === reqId ? {
          ...s,
          last_message_content: data.content,
          last_message_sender_id: data.from_scene_id,
          last_message_at: data.created_at
        } : s));
      }
    });

    const unsubscribeCanceled = subscribe('chat.request.canceled', (data) => {
      if (data && data.request_id) {
        console.log('🚫 Chat request canceled received in MapView:', data);
        setChatRequests(prev => prev.filter(r => r.id !== data.request_id));
        setSentChatRequests(prev => prev.filter(r => r.id !== data.request_id));

        toast({
          title: "Request Canceled",
          description: "The chat request was canceled.",
          duration: 3000,
        });
      }
    });

    const unsubscribeRejected = subscribe('chat.request.rejected', (data) => {
      if (data && data.request_id) {
        console.log('🚫 Chat request rejected:', data);
        setSentChatRequests(prev => prev.filter(r => r.id !== data.request_id));
        // Also remove from incoming requests just in case
        setChatRequests(prev => prev.filter(r => r.id !== data.request_id));

        const rejecterName = data.rejecter_name || "User";
        toast({
          title: "Request Denied",
          description: `${rejecterName} declined your chat request.`,
          variant: "destructive",
          duration: 3000,
        });
      }
    });

    const unsubscribeExpired = subscribe('chat.expired', (data) => {
      if (data && data.request_id) {
        console.log('⏰ Chat expired:', data);
        setChatRequests(prev => prev.filter(r => r.id !== data.request_id));
        setSentChatRequests(prev => prev.filter(r => r.id !== data.request_id));
        setActiveSessions(prev => prev.filter(s => s.request_id !== data.request_id));
        setUnreadSessionIds(prev => prev.filter(id => id !== data.request_id));

        // If this was the active chat, close it
        if (activeChatId === data.request_id) {
          // We might want to clear activeChatId via context or navigate away? 
          // For now, let's just toast.
          toast({
            title: "Chat Expired",
            description: "The chat session has ended.",
            duration: 3000,
          });
        }
      }
    });

    const unsubscribeSceneEnded = subscribe('scene.ended', (data) => {
      // data.scene_id is the scene that ended
      if (data && data.scene_id) {
        console.log('🎬 Scene ended:', data.scene_id);

        // Check if we have any active chat with this scene
        // We need to look through activeSessions to find if we're chatting with this scene
        setActiveSessions(prev => {
          const affectedSession = prev.find(s => s.from_scene_id === data.scene_id || s.to_scene_id === data.scene_id);

          if (affectedSession) {
            console.log('Found affected session:', affectedSession);

            // If we are currently in this chat, notify and close
            if (activeChatId === affectedSession.request_id) {
              toast({
                title: "User Left",
                description: "The other user has left the scene. Chat ended.",
                duration: 4000
              });
              // Ideally we should close the chat window here or clear activeChatId
              // But simply clearing activeChatId might be jarring if not handled by UI.
              // Assuming UI handles activeChatId change:
              // setActiveChatId(null); // Can't call this directly inside setState if it triggers re-render loop?
              // No, setActiveChatId is from context. We can't call it inside setState callback safely usually 
              // without being rigorous. Better to do it outside.
            } else {
              // Notify even if not active? Maybe not. Just clean up.
            }

            // Remove the session
            return prev.filter(s => s.request_id !== affectedSession.request_id);
          }
          return prev; // No change
        });

        // Also clean up requests if any
        setChatRequests(prev => prev.filter(r => r.fromPersona.id !== data.scene_id)); // Wait, fromPersona.id is scene_id? 
        // In ChatRequest: fromPersona.id is the PERSONA id, not scene? 
        // Let's check: in chat.go, fromSceneID is used for WS target. 
        // In MapView loadChatInbox: fromPersona.id = r.from_scene_id. Correct.
        setChatRequests(prev => prev.filter(r => r.fromPersona.id !== data.scene_id));
      }
    });

    return () => {
      unsubscribeReceived();
      unsubscribeAccepted();
      unsubscribeEnded();
      unsubscribeMessage();
      unsubscribeCanceled();
      unsubscribeRejected();
      unsubscribeExpired();
      unsubscribeSceneEnded();
    };
  }, [subscribe, isSceneActive, activeChatId, setChatRequests, setActiveSessions, setUnreadSessionIds]);


  if (!selectedPersona) return null;

  const pendingCount = chatRequests.filter(r => r.status === 'pending').length;
  const unreadCount = unreadSessionIds.length;
  const totalNotificationCount = pendingCount + unreadCount;

  // Show token input if no mapbox token
  if (!mapboxToken) {
    return <MapTokenInput />;
  }

  return (
    <div className="h-screen w-full bg-background relative overflow-hidden">
      {/* Map Background */}
      <MapContainer />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4">
        <div className="flex items-center justify-between">
          <PersonaBadge persona={selectedPersona} />

          <div className="flex items-center gap-2">
            {/* Inbox Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowInbox(true)}
              className="relative w-12 h-12 rounded-xl bg-card/80 backdrop-blur-md border border-border/50 hover:bg-card"
            >
              <Inbox className="w-5 h-5 text-foreground" />
              {totalNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center">
                  {totalNotificationCount}
                </span>
              )}
            </Button>

            {/* Settings */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/persona')}
              className="w-12 h-12 rounded-xl bg-card/80 backdrop-blur-md border border-border/50 hover:bg-card"
            >
              <Settings className="w-5 h-5 text-foreground" />
            </Button>

            {/* Logout */}
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="w-12 h-12 rounded-xl bg-card/80 backdrop-blur-md border border-border/50 hover:bg-card text-destructive hover:text-destructive"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-4 pb-8">
        <div className="flex flex-col items-center gap-4">
          {/* Yell Button - only show when scene is active */}
          <AnimatePresence>
            {isSceneActive && !showYellComposer && (
              <motion.button
                onClick={() => setShowYellComposer(true)}
                className="px-6 py-3 rounded-full bg-accent text-accent-foreground font-semibold shadow-lg hover:scale-105 transition-transform"
              >
                📢 Yell to Nearby
              </motion.button>
            )}
          </AnimatePresence>

          {/* Scene Toggle */}
          <SceneToggle />
        </div>
      </div>

      {/* Yell Composer Modal */}
      <AnimatePresence>
        {showYellComposer && (
          <YellComposer onClose={() => setShowYellComposer(false)} />
        )}
      </AnimatePresence>

      {/* Chat Inbox Drawer */}
      <AnimatePresence>
        {showInbox && (
          <ChatInbox onClose={() => setShowInbox(false)} />
        )}
      </AnimatePresence>

      {/* Active Chat */}
      <AnimatePresence>
        {activeChatId && (
          <EphemeralChat />
        )}
      </AnimatePresence>
    </div>
  );
};

export default MapView;
