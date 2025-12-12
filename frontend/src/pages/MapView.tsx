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
import { Settings, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MapView = () => {
  const navigate = useNavigate();
  const { selectedPersona, isSceneActive, mapboxToken, chatRequests, activeChatId } = useApp();
  const [showInbox, setShowInbox] = useState(false);
  const [showYellComposer, setShowYellComposer] = useState(false);

  useEffect(() => {
    if (!selectedPersona) {
      navigate('/persona');
    }
  }, [selectedPersona, navigate]);

  if (!selectedPersona) return null;

  const pendingCount = chatRequests.filter(r => r.status === 'pending').length;

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
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center">
                  {pendingCount}
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
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
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
