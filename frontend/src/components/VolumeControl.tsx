import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { soundManager } from '@/utils/soundManager';

interface VolumeControlProps {
  className?: string;
}

export const VolumeControl = ({ className = '' }: VolumeControlProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [volume, setVolume] = useState(soundManager.getVolume() * 100);
  const [isMuted, setIsMuted] = useState(soundManager.isSoundMuted());

  const getVolumeColor = (vol: number) => {
    if (vol === 0 || isMuted) return 'text-muted-foreground';
    if (vol <= 33) return 'text-emerald-500';
    if (vol <= 66) return 'text-blue-500';
    return 'text-purple-500';
  };

  const volumeColor = getVolumeColor(volume);

  const handleVolumeChange = (value: number) => {
    setVolume(value);
    soundManager.setVolume(value / 100);
    if (value > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    const newMutedState = soundManager.toggleMute();
    setIsMuted(newMutedState);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Compact Button */}
      <AnimatePresence mode="wait">
        {!isExpanded && (
          <motion.button
            key="compact"
            initial={{ scale: 0.8, opacity: 0, y: 10 }}
            animate={{ 
              scale: 1, 
              opacity: 1, 
              y: 0,
              transition: {
                type: "spring",
                stiffness: 400,
                damping: 25
              }
            }}
            exit={{ 
              scale: 0.8, 
              opacity: 0,
              transition: { duration: 0.15 }
            }}
            onClick={() => setIsExpanded(true)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="group relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-card/80 backdrop-blur-md border border-border/50 rounded-lg sm:rounded-xl hover:bg-card transition-colors cursor-pointer shadow-sm"
            title="Click to adjust, double-click to mute"
          >
            {/* Icon with pulse */}
            <div className="relative">
              {isMuted || volume === 0 ? (
                <VolumeX className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${volumeColor} relative z-10`} />
              ) : (
                <Volume2 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${volumeColor} relative z-10`} />
              )}
              {!isMuted && volume > 0 && (
                <motion.div
                  className={`absolute inset-0 ${volumeColor} rounded-full opacity-20`}
                  animate={{
                    scale: [1, 1.6, 1],
                    opacity: [0.2, 0, 0.2],
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: [0.4, 0, 0.6, 1],
                  }}
                />
              )}
            </div>
            <motion.span 
              className={`text-xs sm:text-sm font-semibold ${volumeColor}`}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 0.3 }}
            >
              {isMuted ? 'Muted' : `${Math.round(volume)}%`}
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Expanded Slider */}
      <AnimatePresence mode="wait">
        {isExpanded && (
          <motion.div
            key="expanded"
            initial={{ 
              width: 80, 
              opacity: 0,
              scale: 0.9
            }}
            animate={{ 
              width: 240, 
              opacity: 1,
              scale: 1,
              transition: {
                width: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
                scale: { type: "spring", stiffness: 400, damping: 25 }
              }
            }}
            exit={{ 
              width: 80,
              opacity: 0,
              scale: 0.9,
              transition: { 
                duration: 0.2,
                ease: "easeInOut"
              }
            }}
            className="relative flex items-center gap-3 px-4 py-2.5 bg-card/80 backdrop-blur-md border border-border/50 rounded-xl shadow-sm"
          >
            {/* Icon with mute toggle */}
            <motion.button
              onClick={toggleMute}
              className="relative shrink-0 hover:scale-110 transition-transform"
              initial={{ rotate: -20, opacity: 0 }}
              animate={{ 
                rotate: 0, 
                opacity: 1,
                transition: { delay: 0.1, type: "spring", stiffness: 300 }
              }}
              whileTap={{ scale: 0.9 }}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className={`w-4 h-4 ${volumeColor} relative z-10`} />
              ) : (
                <Volume2 className={`w-4 h-4 ${volumeColor} relative z-10`} />
              )}
              {!isMuted && volume > 0 && (
                <motion.div
                  className={`absolute inset-0 ${volumeColor} rounded-full opacity-20`}
                  animate={{
                    scale: [1, 2, 1],
                    opacity: [0.3, 0, 0.3],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: [0.4, 0, 0.6, 1],
                  }}
                />
              )}
            </motion.button>

            {/* Slider */}
            <motion.div 
              className="flex-1"
              initial={{ opacity: 0, x: -10 }}
              animate={{ 
                opacity: 1, 
                x: 0,
                transition: { delay: 0.15, duration: 0.2 }
              }}
            >
              <Slider
                value={[volume]}
                onValueChange={(values) => handleVolumeChange(values[0])}
                min={0}
                max={100}
                step={5}
                className="cursor-pointer"
                disabled={isMuted}
                onPointerDown={() => {}}
                onPointerUp={() => {
                  setTimeout(() => setIsExpanded(false), 100);
                  // Play test sound
                  soundManager.playIncomingMessage();
                }}
              />
            </motion.div>

            {/* Value Display */}
            <motion.div
              key={`${volume}-${isMuted}`}
              initial={{ scale: 1.3, opacity: 0, y: -5 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
                y: 0,
                transition: { 
                  type: "spring",
                  stiffness: 500,
                  damping: 20
                }
              }}
              className="shrink-0 w-12 text-right"
            >
              <div className={`text-lg font-bold ${volumeColor} tabular-nums`}>
                {isMuted ? (
                  <VolumeX className="w-4 h-4 inline-block" />
                ) : (
                  Math.round(volume)
                )}
              </div>
              {!isMuted && (
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  %
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
