import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useApp, ChatRequest, personas } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { X, Check, MessageCircle, Clock } from 'lucide-react';

interface ChatInboxProps {
  onClose: () => void;
}

// Generate mock requests for demo
const generateMockRequests = (): ChatRequest[] => [
  {
    id: '1',
    fromPersona: personas[1],
    message: 'Hey, wanna duel with words?',
    timestamp: new Date(Date.now() - 60000),
    status: 'pending',
  },
  {
    id: '2',
    fromPersona: personas[3],
    message: 'I have a riddle for you...',
    timestamp: new Date(Date.now() - 120000),
    status: 'pending',
  },
  {
    id: '3',
    fromPersona: personas[5],
    timestamp: new Date(Date.now() - 300000),
    status: 'pending',
  },
];

const ChatInbox = ({ onClose }: ChatInboxProps) => {
  const { chatRequests, setChatRequests, setActiveChatId, isSceneActive } = useApp();

  // Add mock data on mount for demo
  useEffect(() => {
    if (isSceneActive && chatRequests.length === 0) {
      setChatRequests(generateMockRequests());
    }
  }, [isSceneActive]);

  const handleAccept = (requestId: string) => {
    setChatRequests(prev => 
      prev.map(r => r.id === requestId ? { ...r, status: 'accepted' as const } : r)
    );
    setActiveChatId(requestId);
    onClose();
  };

  const handleReject = (requestId: string) => {
    setChatRequests(prev => 
      prev.map(r => r.id === requestId ? { ...r, status: 'rejected' as const } : r)
    );
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
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
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

        {/* Request List */}
        <div className="p-4 space-y-3 overflow-y-auto h-[calc(100%-88px)]">
          {pendingRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <MessageCircle className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No pending requests</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                {isSceneActive ? 'Stay visible and they will come!' : 'Turn on your scene to receive requests'}
              </p>
            </div>
          ) : (
            pendingRequests.map((request, index) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 rounded-2xl bg-muted/30 border border-border hover:border-border/80 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center text-2xl shrink-0">
                    {request.fromPersona.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground">
                        {request.fromPersona.name}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {Math.floor((Date.now() - request.timestamp.getTime()) / 60000)}m ago
                      </span>
                    </div>
                    {request.message && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        "{request.message}"
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAccept(request.id)}
                        className="flex-1 bg-scene-active/20 text-scene-active border border-scene-active/30 hover:bg-scene-active/30"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleReject(request.id)}
                        className="flex-1 text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Decline
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ChatInbox;
