import { useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X, Send, Megaphone } from 'lucide-react';

interface YellComposerProps {
  onClose: () => void;
}

const YellComposer = ({ onClose }: YellComposerProps) => {
  const { setCurrentYell } = useApp();
  const [text, setText] = useState('');
  const maxLength = 100;

  const handleSend = () => {
    if (text.trim()) {
      setCurrentYell({
        id: Date.now().toString(),
        text: text.trim(),
        timestamp: new Date(),
      });
      onClose();
    }
  };

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

        {/* Text Input */}
        <div className="relative mb-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, maxLength))}
            placeholder="What do you want to yell?"
            className="min-h-[100px] bg-muted/50 border-border resize-none text-foreground placeholder:text-muted-foreground focus:ring-accent"
          />
          <span className="absolute bottom-3 right-3 text-xs text-muted-foreground font-mono">
            {text.length}/{maxLength}
          </span>
        </div>

        {/* Quick suggestions */}
        <div className="flex flex-wrap gap-2 mb-4">
          {['Anyone up for a chat?', 'AMA happening now!', 'Just vibing here', 'Looking for advice'].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setText(suggestion)}
              className="px-3 py-1.5 rounded-full bg-muted/50 border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>

        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={!text.trim()}
          className="w-full py-6 rounded-xl bg-accent text-accent-foreground font-semibold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5 mr-2" />
          Yell It!
        </Button>
      </motion.div>
    </motion.div>
  );
};

export default YellComposer;
