import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useApp, ChatMessage } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Send, Timer, AlertTriangle } from 'lucide-react';
import { chatApi, ChatMessage as ApiChatMessage } from '@/api/chat';
import { useWebSocket } from '@/hooks/useWebSocket';

const EphemeralChat = () => {
  const { activeChatId, setActiveChatId, chatRequests, activeSessions, setActiveSessions, currentSceneId, setShowInbox } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { subscribe } = useWebSocket(currentSceneId);

  // Find the active session using request_id
  const session = activeSessions.find(s => s.request_id === activeChatId);

  const otherPersona = session ? {
    name: session.other_persona_name,
    avatar: session.other_persona_avatar,
    description: session.other_persona_description || 'Live chat session',
  } : null;

  // Load messages when chat opens
  useEffect(() => {
    if (activeChatId) {
      if (!session) {
        handleClose();
        return;
      }
      loadMessages();
      setExpiresAt(new Date(session.expires_at));
    }
  }, [activeChatId, session]);

  // Subscribe to WebSocket for new messages
  useEffect(() => {
    if (!activeChatId) return;

    const unsubscribe = subscribe('chat.message.received', (data) => {
      if (data.request_id === activeChatId) {
        setMessages(prev => {
          // Prevent duplicates (especially for 'me' messages or multi-tab sync)
          if (prev.some(m => m.id === data.message_id || (data.nonce && m.id === data.nonce))) return prev;

          const isMe = data.from_scene_id === currentSceneId;
          const newMsg: ChatMessage = {
            id: data.message_id,
            senderId: isMe ? 'me' : 'other',
            text: data.content,
            timestamp: new Date(data.created_at),
          };
          return [...prev, newMsg];
        });
      }
    });

    // Subscribe to chat expiration
    const unsubscribeExpired = subscribe('chat.expired', (data) => {
      if (data.request_id === activeChatId) {
        alert('Chat has expired. Messages have been deleted.');
        handleClose();
      }
    });

    return () => {
      unsubscribe();
      unsubscribeExpired();
    };
  }, [activeChatId, subscribe]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ESC key handler to close chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeChatId]);

  // Auto-focus input when chat opens
  useEffect(() => {
    if (activeChatId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeChatId]);

  // Countdown timer synced with backend expiration
  useEffect(() => {
    if (!expiresAt) return;

    const timer = setInterval(() => {
      const now = new Date();
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        alert('Chat has expired!');
        handleClose();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  const loadMessages = async () => {
    if (!activeChatId) return;

    try {
      const apiMessages = await chatApi.getChatMessages(activeChatId);
      // Transform to frontend format
      setMessages(apiMessages.map(m => ({
        id: m.id,
        senderId: m.from_scene_id === currentSceneId ? 'me' : 'other',
        text: m.content,
        timestamp: new Date(m.created_at),
      })));
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !activeChatId) return;

    // Optimistically add message
    const nonce = crypto.randomUUID();
    const tempMsg: ChatMessage = {
      id: nonce,
      senderId: 'me',
      text: inputText.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, tempMsg]);
    setInputText('');

    try {
      const sent = await chatApi.sendMessage(activeChatId, inputText.trim(), nonce);
      // Replace temp message with actual message
      setMessages(prev =>
        prev.map(m => m.id === nonce ? {
          id: sent.id,
          senderId: 'me',
          text: sent.content,
          timestamp: new Date(sent.created_at),
        } : m)
      );

      // Update last message in global sessions list for the inbox
      setActiveSessions(prev => prev.map(s => s.request_id === activeChatId ? {
        ...s,
        last_message_content: sent.content,
        last_message_sender_id: currentSceneId || '',
        last_message_at: sent.created_at
      } : s));
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove temp message on error
      setMessages(prev => prev.filter(m => m.id !== nonce));
      alert('Failed to send message');
    }
  };

  const handleClose = () => {
    setActiveChatId(null);
    setMessages([]);
    setTimeLeft(300);
    setExpiresAt(null);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!otherPersona) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-muted border border-border flex items-center justify-center text-2xl">
            {otherPersona.avatar}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{otherPersona.name}</h3>
            <p className="text-xs text-muted-foreground">{otherPersona.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${timeLeft < 60 ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'}`}>
            <Timer className="w-4 h-4" />
            <span className="font-mono text-sm">{formatTime(timeLeft)}</span>
          </div>
          <button
            onClick={handleClose}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-destructive/20 hover:text-destructive transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Ephemeral warning */}
      <div className="flex items-center gap-2 px-4 py-2 bg-accent/10 border-b border-accent/20">
        <AlertTriangle className="w-4 h-4 text-accent" />
        <p className="text-xs text-accent">This chat is ephemeral. Messages vanish when you leave or time expires.</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${message.senderId === 'me' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${message.senderId === 'me'
                ? 'bg-primary text-primary-foreground rounded-br-md'
                : 'bg-muted text-foreground rounded-bl-md'
                }`}
            >
              <p className="text-sm">{message.text}</p>
            </div>
          </motion.div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 bg-muted border-border focus:ring-primary"
          />
          <Button
            onClick={handleSend}
            disabled={!inputText.trim()}
            size="icon"
            className="w-12 h-12 rounded-xl gradient-primary text-primary-foreground shrink-0"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default EphemeralChat;
