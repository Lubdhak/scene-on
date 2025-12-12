import { motion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { Power } from 'lucide-react';

const SceneToggle = () => {
  const { isSceneActive, setIsSceneActive, setCurrentYell, setChatRequests } = useApp();

  const handleToggle = () => {
    if (isSceneActive) {
      // Turn off scene - clear all ephemeral data
      setIsSceneActive(false);
      setCurrentYell(null);
      setChatRequests([]);
    } else {
      setIsSceneActive(true);
    }
  };

  return (
    <motion.button
      onClick={handleToggle}
      className={`
        relative flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-lg
        transition-all duration-500 backdrop-blur-md
        ${isSceneActive 
          ? 'bg-scene-active/20 border-2 border-scene-active text-scene-active scene-pulse' 
          : 'bg-card/80 border-2 border-scene-inactive text-muted-foreground hover:border-muted-foreground'}
      `}
      whileTap={{ scale: 0.95 }}
    >
      <Power className={`w-6 h-6 transition-colors ${isSceneActive ? 'text-scene-active' : ''}`} />
      <span>{isSceneActive ? 'Scene is LIVE' : 'Go Live'}</span>
      
      {isSceneActive && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-scene-active"
        >
          <span className="absolute inset-0 rounded-full bg-scene-active animate-ping" />
        </motion.div>
      )}
    </motion.button>
  );
};

export default SceneToggle;
