import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useApp, ChatMessage } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Send, Timer, AlertTriangle } from 'lucide-react';

// Mock initial messages
const mockMessages: ChatMessage[] = [
  {
    id: '1',
    senderId: 'other',
    text: 'Hey! Saw your yell. What brings you here?',
    timestamp: new Date(Date.now() - 30000),
  },
];

const EphemeralChat = () => {
  const { activeChatId, setActiveChatId, chatRequests, selectedPersona } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>(mockMessages);
  const [inputText, setInputText] = useState('');
  const [timeLeft, setTimeLeft] = useState(300); // 5 minute timer for demo
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeRequest = chatRequests.find(r => r.id === activeChatId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSend = () => {
    if (!inputText.trim()) return;
    
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderId: 'me',
      text: inputText.trim(),
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, newMessage]);
    setInputText('');

    // Simulate response after a short delay
    setTimeout(() => {
      const responses = [
        'Interesting perspective!',
        'Tell me more about that.',
        'Ha! I like your style.',
        'Makes sense to me.',
        "That's a cool way to look at it.",
      ];
      const randomResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        senderId: 'other',
        text: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, randomResponse]);
    }, 1000 + Math.random() * 2000);
  };

  const handleClose = () => {
    setActiveChatId(null);
    setMessages([]);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!activeRequest) return null;

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
            {activeRequest.fromPersona.avatar}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{activeRequest.fromPersona.name}</h3>
            <p className="text-xs text-muted-foreground">{activeRequest.fromPersona.description}</p>
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
        <p className="text-xs text-accent">This chat is ephemeral. Messages vanish when you leave.</p>
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
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                message.senderId === 'me'
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
