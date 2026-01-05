import { motion } from 'framer-motion';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Power } from 'lucide-react';
import { scenesApi } from '@/api/scenes';

const SceneToggle = () => {
  const { isSceneActive, setIsSceneActive, setCurrentYell, setChatRequests, setCurrentSceneId, setSentChatRequests, selectedPersona, setSelectedPersona, setActiveChatId, setShowInbox } = useApp();
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    if (isSceneActive) {
      // Turn off scene - clear all ephemeral data
      setIsLoading(true);
      try {
        await scenesApi.stopScene();
        setIsSceneActive(false);
        setCurrentSceneId(null);
        setCurrentYell(null);
        setChatRequests([]);
        setSentChatRequests([]);
        setActiveChatId(null);
        setShowInbox(false);
      } catch (error) {
        console.error('Failed to stop scene:', error);
        alert('Failed to stop scene');
      } finally {
        setIsLoading(false);
      }
    } else {
      // Turn on scene - create scene in backend
      if (!selectedPersona) {
        alert('Please select a persona first');
        return;
      }

      setIsLoading(true);
      try {
        // Validate persona ID
        if (!selectedPersona.id) {
          console.error('Persona ID is missing:', selectedPersona);
          alert('Persona not properly initialized. Please go back and select your persona again.');
          setIsLoading(false);
          return;
        }

        console.log('Starting scene with persona ID:', selectedPersona.id);

        // Get user's location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              try {
                console.log('Calling startScene with:', {
                  personaId: selectedPersona.id,
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                });
                const scene = await scenesApi.startScene(
                  selectedPersona.id,
                  position.coords.latitude,
                  position.coords.longitude
                );
                setIsSceneActive(true);
                setCurrentSceneId(scene.id);
              } catch (error: any) {
                console.error('Failed to start scene:', error);
                console.error('Error response:', error.response?.data);
                alert(error.response?.data?.error || 'Failed to start scene');
              } finally {
                setIsLoading(false);
              }
            },
            (error) => {
              console.error('Failed to get location:', error);
              // Use default location if permission denied
              scenesApi.startScene(selectedPersona.id, 40.7128, -74.006)
                .then(() => {
                  setIsSceneActive(true);
                })
                .catch((err: any) => {
                  console.error('Failed to start scene:', err);
                  alert(err.response?.data?.error || 'Failed to start scene');
                })
                .finally(() => {
                  setIsLoading(false);
                });
            }
          );
        } else {
          // Geolocation not supported, use default
          await scenesApi.startScene(selectedPersona.id, 40.7128, -74.006);
          setIsSceneActive(true);
          setIsLoading(false);
        }
      } catch (error: any) {
        console.error('Failed to start scene:', error);
        alert(error.response?.data?.error || 'Failed to start scene');
        setIsLoading(false);
      }
    }
  };

  return (
    <motion.button
      onClick={handleToggle}
      disabled={isLoading}
      className={`
        relative flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-lg
        transition-all duration-500 backdrop-blur-md
        ${isSceneActive
          ? 'bg-scene-active/20 border-2 border-scene-active text-scene-active scene-pulse'
          : 'bg-card/80 border-2 border-scene-inactive text-muted-foreground hover:border-muted-foreground'}
        ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      whileTap={{ scale: isLoading ? 1 : 0.95 }}
    >
      <Power className={`w-6 h-6 transition-colors ${isSceneActive ? 'text-scene-active' : ''}`} />
      <span>
        {isLoading ? 'Loading...' : isSceneActive ? 'Scene is LIVE' : 'Go Live'}
      </span>

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
