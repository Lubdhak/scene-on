import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radar, MapPin } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface DistanceSliderProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

export const DistanceSlider = ({ value, onChange, className = '' }: DistanceSliderProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const [isChanging, setIsChanging] = useState(false);

  // Debounce the actual onChange to avoid too many updates
  useEffect(() => {
    if (displayValue === value) return;
    
    setIsChanging(true);
    const timer = setTimeout(() => {
      onChange(displayValue);
      setIsChanging(false);
    }, 200);
    
    return () => {
      clearTimeout(timer);
      setIsChanging(false);
    };
  }, [displayValue, value, onChange]);

  const getRadiusColor = (km: number) => {
    if (km <= 750) return 'text-emerald-500';
    if (km <= 1500) return 'text-blue-500';
    if (km <= 2250) return 'text-purple-500';
    return 'text-orange-500';
  };

  const radiusColor = getRadiusColor(displayValue);

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
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="group relative flex items-center gap-2 px-4 py-2.5 bg-card/80 backdrop-blur-md border border-border/50 rounded-xl hover:bg-card transition-colors cursor-pointer shadow-sm"
          >
            {/* Animated radar pulse */}
            <div className="relative">
              <Radar className={`w-4 h-4 ${radiusColor} relative z-10`} />
              <motion.div
                className={`absolute inset-0 ${radiusColor} rounded-full opacity-20`}
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
            </div>
            <motion.span 
              className={`text-sm font-semibold ${radiusColor}`}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 0.3 }}
            >
              {displayValue} km
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
              width: 280, 
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
            {/* Icon */}
            <motion.div 
              className="relative shrink-0"
              initial={{ rotate: -20, opacity: 0 }}
              animate={{ 
                rotate: 0, 
                opacity: 1,
                transition: { delay: 0.1, type: "spring", stiffness: 300 }
              }}
            >
              <MapPin className={`w-4 h-4 ${radiusColor} relative z-10`} />
              <motion.div
                className={`absolute inset-0 ${radiusColor} rounded-full opacity-20`}
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
            </motion.div>

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
                value={[displayValue]}
                onValueChange={(values) => setDisplayValue(values[0])}
                min={0}
                max={3000}
                step={10}
                className="cursor-pointer"
                onPointerDown={() => {}}
                onPointerUp={() => {
                  setTimeout(() => setIsExpanded(false), 100);
                }}
              />
            </motion.div>

            {/* Value Display */}
            <motion.div
              key={displayValue}
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
              className="shrink-0 w-16 text-right relative"
            >
              {/* Subtle loading pulse when changing */}
              {isChanging && (
                <motion.div
                  className="absolute inset-0 bg-foreground/5 rounded-lg"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                />
              )}
              <div className={`text-lg font-bold ${radiusColor} tabular-nums relative z-10`}>
                {displayValue}
              </div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider relative z-10">
                km
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
