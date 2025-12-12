import { useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Key, ExternalLink } from 'lucide-react';

const MapTokenInput = () => {
  const { setMapboxToken } = useApp();
  const [token, setToken] = useState('');

  const handleSubmit = () => {
    if (token.trim()) {
      setMapboxToken(token.trim());
    }
  };

  return (
    <div className="min-h-screen bg-background bg-noise flex items-center justify-center p-6">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-[150px] pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        <div className="p-8 rounded-3xl bg-card border border-border shadow-2xl">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center glow-primary">
              <MapPin className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">Map Access Required</h2>
            <p className="text-muted-foreground text-sm">
              Enter your Mapbox public token to enable the map view. 
              You can find this in your Mapbox account dashboard.
            </p>
          </div>

          {/* Input */}
          <div className="space-y-4">
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="pk.eyJ1..."
                className="pl-12 py-6 bg-muted border-border font-mono text-sm"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!token.trim()}
              className="w-full py-6 rounded-xl gradient-primary text-primary-foreground font-semibold disabled:opacity-50"
            >
              Enable Map
            </Button>

            <a
              href="https://mapbox.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Get a Mapbox token
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Note */}
        <p className="text-center text-xs text-muted-foreground/60 mt-4">
          Your token is stored locally and never sent to our servers.
        </p>
      </motion.div>
    </div>
  );
};

export default MapTokenInput;
