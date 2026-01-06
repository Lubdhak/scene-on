import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MapTokenInput = () => {
  const navigate = useNavigate();
  const { authState, setMapboxToken } = useApp();
  const { toast } = useToast();
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);

  // Request location on component mount
  useEffect(() => {
    requestLocation();
  }, []);

  const requestLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        title: 'Location not supported',
        description: 'Your browser doesn\'t support geolocation',
        variant: 'destructive',
      });
      return;
    }

    setIsRequestingLocation(true);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude, accuracy } = position.coords;
			
      // Send location to backend
      const response = await fetch(`https://scene-on.onrender.com/api/v1/location/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState?.accessToken}`,
        },
        body: JSON.stringify({
          latitude,
          longitude,
          accuracy,
        }),
      });

      if (response.ok) {
        setLocationGranted(true);
        toast({
          title: 'Location saved',
          description: `Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        });

        // Set a placeholder token to enable map view (will be replaced with actual token later)
        setTimeout(() => {
          setMapboxToken('placeholder-token');
        }, 1500);
      } else {
        throw new Error('Failed to save location');
      }
    } catch (error) {
      toast({
        title: 'Location access denied',
        description: error instanceof Error ? error.message : 'Please enable location access',
        variant: 'destructive',
      });
    } finally {
      setIsRequestingLocation(false);
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
              {isRequestingLocation ? (
                <Loader2 className="w-8 h-8 text-primary-foreground animate-spin" />
              ) : locationGranted ? (
                <CheckCircle2 className="w-8 h-8 text-primary-foreground" />
              ) : (
                <MapPin className="w-8 h-8 text-primary-foreground" />
              )}
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {isRequestingLocation
                ? 'Requesting Location'
                : locationGranted
                  ? 'Location Confirmed'
                  : 'Location Access Required'}
            </h2>
            <p className="text-muted-foreground text-sm">
              {isRequestingLocation
                ? 'Please allow location access in your browser...'
                : locationGranted
                  ? 'Redirecting to map view...'
                  : 'Location permission needed for map features.'}
            </p>
          </div>

          {/* Location Status */}
          {locationGranted && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
              <p className="text-sm text-green-600 dark:text-green-400 text-center font-medium">
                ✓ Location saved successfully
              </p>
            </div>
          )}
        </div>

        {/* Note */}
        <p className="text-center text-xs text-muted-foreground/60 mt-4">
          Your location is stored securely and used only for map features.
        </p>
      </motion.div>
    </div>
  );
};

export default MapTokenInput;
