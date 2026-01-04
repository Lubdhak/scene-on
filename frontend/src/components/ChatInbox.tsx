import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { X, Check, Clock, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { chatApi, ChatSession } from '@/api/chat';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useState } from 'react';

interface ChatInboxProps {
  onClose: () => void;
}

const ActiveSessionItem = ({ session, index, isUnread, currentSceneId, onClick }: { session: ChatSession; index: number; isUnread: boolean; currentSceneId: string | null; onClick: () => void }) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const totalDuration = 5 * 60; // 5 minutes in seconds

  useEffect(() => {
    const calculateTime = () => {
      const expiry = new Date(session.expires_at).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeLeft(diff);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [session.expires_at]);

  const progress = (timeLeft / totalDuration) * 100;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const isUrgent = timeLeft < 60;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="group relative cursor-pointer"
    >
      {/* Striking ADHD Glow */}
      <div className={`absolute inset-0 blur-xl opacity-0 truncate group-hover:opacity-20 transition-opacity rounded-2xl ${isUrgent ? 'bg-destructive' : 'bg-primary'}`} />

      <div className={`
        relative flex items-center gap-4 p-4 rounded-2xl border-2 transition-all overflow-hidden
        ${isUrgent
          ? 'bg-destructive/5 border-destructive/20 hover:border-destructive shadow-lg shadow-destructive/5'
          : 'bg-primary/5 border-primary/20 hover:border-primary shadow-lg shadow-primary/5'}
      `}>
        {/* Progress Circle Wrapper */}
        <div className="relative w-14 h-14 shrink-0">
          <svg className="w-full h-full -rotate-90 transform">
            {/* Background Track */}
            <circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              className="text-muted-foreground/10"
            />
            {/* Progress */}
            <circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeDasharray="150"
              strokeDashoffset={150 - (progress * 150) / 100}
              className={isUrgent ? 'text-destructive' : 'text-scene-active'}
            />
          </svg>

          {/* Avatar in the center */}
          <div className="absolute inset-0 flex items-center justify-center text-2xl">
            {session.other_persona_avatar}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <h4 className="font-bold text-base text-foreground truncate">{session.other_persona_name}</h4>
            <div className="flex items-center gap-2">
              {isUnread && (
                <div className="w-2.5 h-2.5 rounded-full bg-accent" />
              )}
              <div className={`
                font-mono text-xs font-black px-2 py-1 rounded-md flex items-center gap-1
                ${isUrgent ? 'bg-destructive text-white' : 'bg-primary/10 text-primary'}
              `}>
                {minutes}:{seconds.toString().padStart(2, '0')}
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 min-w-0">
            {session.last_message_content ? (
              <div className="flex items-center gap-1.5 truncate w-full">
                {session.last_message_sender_id === currentSceneId ? (
                  <ArrowUpRight className="w-3 h-3 text-primary shrink-0" />
                ) : (
                  <ArrowDownLeft className="w-3 h-3 text-scene-active shrink-0" />
                )}
                <span className={`truncate ${isUnread ? 'text-foreground font-bold' : ''}`}>
                  {session.last_message_content}
                </span>
              </div>
            ) : (
              <>
                <span className={`w-1.5 h-1.5 rounded-full ${isUrgent ? 'bg-destructive' : 'bg-scene-active'}`} />
                {isUnread ? 'New message received' : 'Live chat session'}
              </>
            )}
          </div>

        </div>
      </div>
    </motion.div>
  );
};

const ChatInbox = ({ onClose }: ChatInboxProps) => {
  const {
    chatRequests, setChatRequests, setActiveChatId,
    activeSessions, setActiveSessions, isSceneActive,
    currentSceneId, unreadSessionIds, setUnreadSessionIds
  } = useApp();
  const { subscribe } = useWebSocket(currentSceneId);

  // Fetch everything on mount and when scene becomes active
  useEffect(() => {
    if (isSceneActive) {
      loadAll();
    }
  }, [isSceneActive]);

  // Subscribe to WebSocket chat request notifications for instant UI updates
  useEffect(() => {
    const unsubscribeReceived = subscribe('chat.request.received', () => {
      console.log('📬 Inbox: New request received via WS');
      loadAll();
    });

    const unsubscribeAccepted = subscribe('chat.request.accepted', () => {
      console.log('🤝 Inbox: Request accepted via WS');
      loadAll();
    });

    return () => {
      unsubscribeReceived();
      unsubscribeAccepted();
    };
  }, [subscribe]);

  const loadAll = async () => {
    await Promise.all([loadChatInbox(), loadSessions()]);
  };

  const loadSessions = async () => {
    try {
      const sessions = await chatApi.getActiveSessions();
      setActiveSessions(sessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const loadChatInbox = async () => {
    try {
      const requests = await chatApi.getChatInbox();
      // Transform backend format to frontend format
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
    } catch (error) {
      console.error('Failed to load chat inbox:', error);
    }
  };

  const handleAccept = async (requestId: string) => {
    try {
      await chatApi.acceptChatRequest(requestId);
      setChatRequests(prev =>
        prev.map(r => r.id === requestId ? { ...r, status: 'accepted' as const } : r)
      );
      setActiveChatId(requestId);
      onClose();
    } catch (error) {
      console.error('Failed to accept chat request:', error);
      alert('Failed to accept chat request');
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await chatApi.rejectChatRequest(requestId);
      setChatRequests(prev =>
        prev.map(r => r.id === requestId ? { ...r, status: 'rejected' as const } : r)
      );
    } catch (error) {
      console.error('Failed to reject chat request:', error);
      alert('Failed to reject chat request');
    }
  };

  const pendingRequests = chatRequests.filter(r => r.status === 'pending');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-end bg-background/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-md bg-card border-l border-border shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="font-semibold text-foreground">Chat Requests</h2>
              <p className="text-sm text-muted-foreground">
                {pendingRequests.length} pending
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* List Content */}
        <div className="p-4 space-y-6 overflow-y-auto h-[calc(100%-88px)] scrollbar-hide">

          {/* Active Conversations Section */}
          {activeSessions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <div className="w-2 h-2 rounded-full bg-scene-active" />
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  Live Conversations
                </h3>
              </div>
              <div className="space-y-3">
                {activeSessions.map((session, index) => (
                  <ActiveSessionItem
                    key={session.request_id}
                    session={session}
                    index={index}
                    isUnread={unreadSessionIds.includes(session.request_id)}
                    currentSceneId={currentSceneId}
                    onClick={() => {
                      setUnreadSessionIds(prev => prev.filter(id => id !== session.request_id));
                      setActiveChatId(session.request_id);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Pending Requests Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Pending Requests ({pendingRequests.length})
              </h3>
            </div>

            {pendingRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center opacity-40">
                <p className="text-xs text-muted-foreground italic font-medium">No new invites yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((request, index) => (
                  <motion.div
                    key={request.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    className="p-4 rounded-2xl bg-muted/20 border border-border/50 hover:border-primary/30 transition-all group relative overflow-hidden"
                  >
                    <div className="flex items-start gap-3 relative z-10">
                      <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center text-2xl shrink-0 shadow-inner">
                        {request.fromPersona.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm text-foreground truncate max-w-[120px]">
                            {request.fromPersona.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded">
                            <Clock className="w-3 h-3" />
                            {Math.floor((Date.now() - request.timestamp.getTime()) / 60000)}m
                          </span>
                        </div>

                        {/* Persona custom message & Invite message inline */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-3">
                          <p className="text-xs font-medium text-primary/70 italic">
                            {request.fromPersona.description}
                          </p>
                          {request.message && (
                            <div className="text-[11px] leading-tight text-foreground bg-primary/10 border border-primary/20 rounded-lg px-2 py-1 font-medium">
                              “{request.message}”
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleAccept(request.id)}
                            className="flex-1 h-9 bg-scene-active hover:bg-scene-active/90 text-white font-bold text-xs shadow-lg shadow-scene-active/20"
                          >
                            <Check className="w-4 h-4 mr-1" />
                            ACCEPT
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleReject(request.id)}
                            className="w-10 h-9 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ChatInbox;
