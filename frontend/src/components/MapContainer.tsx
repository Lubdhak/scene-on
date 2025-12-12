import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useApp, personas } from '@/context/AppContext';
import { MapPin, AlertCircle } from 'lucide-react';

// Simulated nearby users for demo
const mockNearbyUsers = [
  { id: '1', persona: personas[1], yell: "Who's up for a battle?" },
  { id: '2', persona: personas[2], yell: null },
  { id: '3', persona: personas[4], yell: "The void sees all..." },
];

const MapContainer = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const { mapboxToken, selectedPersona, isSceneActive, currentYell } = useApp();
  const [mapError, setMapError] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    // Check for WebGL support first
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) {
      console.log('WebGL not supported, using fallback UI');
      setMapError(true);
      return;
    }

    // Dynamically import mapbox to avoid SSR issues and handle errors
    const initMap = async () => {
      try {
        const mapboxgl = await import('mapbox-gl');
        await import('mapbox-gl/dist/mapbox-gl.css');
        
        mapboxgl.default.accessToken = mapboxToken;

        const map = new mapboxgl.default.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: [-74.006, 40.7128],
          zoom: 15,
          pitch: 45,
        });

        map.on('load', () => {
          setMapLoaded(true);
          map.setFog({
            color: 'rgb(15, 20, 35)',
            'high-color': 'rgb(30, 40, 70)',
            'horizon-blend': 0.1,
          });
        });

        map.on('error', () => {
          setMapError(true);
        });

        // Get user's location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude } = position.coords;
              map.flyTo({ center: [longitude, latitude], zoom: 15 });
            },
            () => console.log('Using default location')
          );
        }

        return () => map.remove();
      } catch (error) {
        console.log('Map initialization failed, using fallback:', error);
        setMapError(true);
      }
    };

    initMap();
  }, [mapboxToken]);

  return (
    <div className="absolute inset-0">
      {/* Map container or fallback background */}
      {!mapError ? (
        <div ref={mapContainer} className="w-full h-full" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-background via-muted/20 to-background relative overflow-hidden">
          {/* Grid pattern for visual interest */}
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `
                linear-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px),
                linear-gradient(90deg, hsl(var(--primary) / 0.3) 1px, transparent 1px)
              `,
              backgroundSize: '50px 50px',
            }}
          />
          
          {/* Glowing orbs for depth */}
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-1/3 right-1/4 w-48 h-48 bg-secondary/15 rounded-full blur-[80px]" />
          
          {/* WebGL notice */}
          <div className="absolute top-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-muted/80 backdrop-blur-sm border border-border/50 text-sm text-muted-foreground">
            <AlertCircle className="w-4 h-4" />
            <span>Map preview unavailable - works in production</span>
          </div>
        </div>
      )}
      
      {/* Overlay gradient for better UI contrast */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-background/60 via-transparent to-background/80" />
      
      {/* Simulated avatar markers */}
      {isSceneActive && (
        <div className="absolute inset-0 pointer-events-none">
          {/* User's own avatar in center */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-card border-2 border-primary flex items-center justify-center text-3xl scene-pulse">
                {selectedPersona?.avatar}
              </div>
              {/* Location pin indicator */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                <MapPin className="w-5 h-5 text-primary fill-primary" />
              </div>
              {currentYell && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="absolute -top-16 left-1/2 -translate-x-1/2 px-3 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium whitespace-nowrap max-w-48 truncate yell-appear"
                >
                  {currentYell.text}
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Mock nearby users */}
          {mockNearbyUsers.map((user, index) => (
            <motion.div
              key={user.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.9 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="absolute pointer-events-auto cursor-pointer"
              style={{
                left: `${30 + index * 20}%`,
                top: `${30 + (index % 2) * 25}%`,
              }}
            >
              <div className="relative avatar-float" style={{ animationDelay: `${index * 0.5}s` }}>
                <div className="w-12 h-12 rounded-full bg-card/90 border border-border flex items-center justify-center text-2xl backdrop-blur-sm hover:scale-110 transition-transform">
                  {user.persona.avatar}
                </div>
                {user.yell && (
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-muted/90 text-foreground text-xs max-w-32 truncate backdrop-blur-sm">
                    {user.yell}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MapContainer;
