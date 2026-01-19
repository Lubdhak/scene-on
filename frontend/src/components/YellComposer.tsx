import { useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Send, Megaphone, Loader2, Clock } from 'lucide-react';
import { yellsApi } from '@/api/yells';
import { useToast } from '@/hooks/use-toast';
import { soundManager } from '@/utils/soundManager';

interface YellComposerProps {
  onClose: () => void;
}

const YellComposer = ({ onClose }: YellComposerProps) => {
  const { setCurrentYell, nextYellAt, setNextYellAt } = useApp();
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const maxLength = 32;

  // Calculate time remaining until next yell
  // TODO: Re-enable cooldown after testing
  const now = Math.floor(Date.now() / 1000);
  const canYell = true; // !nextYellAt || now >= nextYellAt;
  const remainingSeconds = nextYellAt ? Math.max(0, nextYellAt - now) : 0;
  const remainingMinutes = Math.floor(remainingSeconds / 60);
  const remainingSecondsDisplay = remainingSeconds % 60;

  const handleSend = async () => {
    if (!text.trim() || isLoading || !canYell) return;

    // Initialize audio on user interaction
    soundManager.initialize();

    setIsLoading(true);
    try {
      const response = await yellsApi.broadcast(text.trim());
      
      // Store current yell and cooldown time
      const yellData = {
        id: response.id,
        scene_id: response.scene_id,
        content: response.content,
        timestamp: new Date(),
        expires_at: new Date(response.expires_at * 1000),
        latitude: response.latitude,
        longitude: response.longitude,
      };
      
      setCurrentYell(yellData);
      // TODO: Re-enable after testing
      // setNextYellAt(response.next_yell_at);

      toast({
        title: 'Yell broadcasted! 📢',
        description: 'Your message has been sent to nearby users.',
      });

      onClose();
    } catch (error: any) {
      console.error('Failed to broadcast yell:', error);
      
      if (error.response?.status === 429) {
        // Rate limited
        // TODO: Re-enable after testing
        /*
        const retryAfter = error.response.data?.retry_after || 300;
        const nextYellTimestamp = error.response.data?.next_yell_at || Math.floor(Date.now() / 1000) + retryAfter;
        setNextYellAt(nextYellTimestamp);
        
        const minutes = Math.floor(retryAfter / 60);
        const seconds = retryAfter % 60;
        toast({
          title: 'Too fast! ⏰',
          description: `Please wait ${minutes}m ${seconds}s before yelling again.`,
          variant: 'destructive',
        });
        */
      } else {
        toast({
          title: 'Failed to broadcast',
          description: error.response?.data?.error || 'Something went wrong. Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const quickSuggestions = [
    'Anyone up for a chat?',
    'AMA happening now!',
    'Just vibing here',
    'Looking for advice',
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg mx-4 mb-4 p-6 rounded-3xl bg-card border border-border shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Broadcast a Yell</h3>
              <p className="text-xs text-muted-foreground">Visible to everyone nearby</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Cooldown Warning */}
        {!canYell && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-500" />
            <span className="text-sm text-yellow-600 dark:text-yellow-500">
              Wait {remainingMinutes}:{remainingSecondsDisplay.toString().padStart(2, '0')} before yelling again
            </span>
          </div>
        )}

        {/* Text Input */}
        <div className="relative mb-4">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, maxLength))}
            placeholder="What do you want to yell?"
            disabled={isLoading || !canYell}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && text.trim() && !isLoading && canYell) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:ring-accent disabled:opacity-50 pr-16"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
            {text.length}/{maxLength}
          </span>
        </div>

        {/* Quick suggestions */}
        <div className="flex flex-wrap gap-2 mb-4">
          {quickSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setText(suggestion)}
              disabled={isLoading || !canYell}
              className="px-3 py-1.5 rounded-full bg-muted/50 border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {suggestion}
            </button>
          ))}
        </div>

        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={!text.trim() || isLoading || !canYell}
          className="w-full py-6 rounded-xl bg-accent text-accent-foreground font-semibold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Broadcasting...
            </>
          ) : (
            <>
              <Send className="w-5 h-5 mr-2" />
              Yell It!
            </>
          )}
        </Button>
      </motion.div>
    </motion.div>
  );
};

export default YellComposer;
