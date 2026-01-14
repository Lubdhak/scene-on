import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp, Persona } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, User, MessageSquare, Info, RefreshCw, ArrowLeft, X } from 'lucide-react';
import axios from 'axios';
import { scenesApi } from '@/api/scenes';
import { useToast } from '@/hooks/use-toast';

const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/v1`;

const AVATARS = ['🌟', '⚔️', '🔮', '🛡️', '🛰️', '🎭', '🦋', '🔥', '⚡', '🌌', '🐉', '🏔️'];

const PersonaSelect = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { selectedPersona, setSelectedPersona, authState, isSceneActive } = useApp();
  const [isCreating, setIsCreating] = useState(false);

  // Pre-fill from existing persona if available
  const [name, setName] = useState(selectedPersona?.name || '');
  const [description, setDescription] = useState(selectedPersona?.description || '');
  const [selectedAvatar, setSelectedAvatar] = useState(selectedPersona?.avatar || AVATARS[0]);
  const [nameError, setNameError] = useState('');

  // ESC key handler to close/go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedPersona) {
        navigate('/map');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPersona, navigate]);

  const handleContinue = async () => {
    if (!name || !authState) return;

    setIsCreating(true);
    try {
      // Create or update persona in backend
      const response = await axios.post(
        `${API_BASE_URL}/personas`,
        {
          name,
          avatar_url: selectedAvatar,
          description: description,
        },
        {
          headers: {
            Authorization: `Bearer ${authState.accessToken}`,
          },
        }
      );

      const personaId = response.data.id || response.data.ID;
      if (!personaId) throw new Error('Backend response missing ID');

      const updatedPersona: Persona = {
        id: personaId,
        name: response.data.name,
        avatar: response.data.avatar_url,
        description: response.data.description || '',
      };

      setSelectedPersona(updatedPersona);
      localStorage.setItem('selectedPersona', JSON.stringify(updatedPersona));

      // If already live, refresh the scene to broadcast identity update
      if (isSceneActive) {
        console.log('🔄 User is live, refreshing scene with new identity');
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(async (pos) => {
            await scenesApi.startScene(personaId, pos.coords.latitude, pos.coords.longitude);
          }, (err) => {
            console.error('Location error during scene refresh:', err);
            // Even if location fails, the persona update in DB is enough for others on reload,
            // but calling startScene with default/cached coords would be better for real-time update.
            scenesApi.startScene(personaId, 0, 0); // Placeholder or last known
          });
        }
      }

      navigate('/map');
    } catch (error: any) {
      console.error('PERSONA CREATION ERROR:', error);

      const errorMessage = error.response?.data?.error || 'Failed to update persona';
      const errorCode = error.response?.data?.code;

      if (errorCode === 'NAME_TAKEN') {
        setNameError(errorMessage);
        toast({
          title: "Name Taken",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background bg-noise relative overflow-hidden flex items-center justify-center p-6">
      {/* Ambient effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-secondary/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Back button and close button if persona exists */}
      {selectedPersona && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/map')}
            className="absolute top-6 left-6 z-20"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Map
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/map')}
            className="absolute top-6 right-6 z-20 w-10 h-10 rounded-full hover:bg-destructive/20 hover:text-destructive"
          >
            <X className="w-5 h-5" />
          </Button>
        </>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-lg"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/20 border border-secondary/30 mb-4">
            <Sparkles className="w-4 h-4 text-secondary" />
            <span className="text-sm font-medium text-secondary">
              {selectedPersona ? 'Edit Identity' : 'Character Creation'}
            </span>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-3">
            {selectedPersona ? 'Update Your Identity' : 'Define Your Identity'}
          </h1>
          <p className="text-muted-foreground">
            {isSceneActive
              ? "You're currently LIVE! Changes will reflect instantly on the map."
              : "How do you want to be seen in this reality?"}
          </p>
        </div>

        <div className="bg-card/40 backdrop-blur-xl rounded-3xl border border-border/50 overflow-hidden shadow-2xl">
          <div className="p-8 space-y-8">
            {/* Avatar Selection */}
            <div className="space-y-4">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <User className="w-4 h-4" /> Pick a Profile Picture
              </label>
              <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                {AVATARS.map((avatar) => (
                  <button
                    key={avatar}
                    onClick={() => setSelectedAvatar(avatar)}
                    className={`
                      text-2xl w-12 h-12 flex items-center justify-center rounded-xl border transition-all
                      ${selectedAvatar === avatar
                        ? 'border-primary bg-primary/20 scale-110 shadow-[0_0_15px_rgba(var(--primary),0.3)]'
                        : 'border-border/50 bg-card/50 hover:bg-card hover:scale-105'}
                    `}
                  >
                    {avatar}
                  </button>
                ))}
              </div>
            </div>

            {/* Name Input */}
            <div className="space-y-4">
              <label className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" /> Persona Name
                </div>
                <span className={`text-[10px] ${name.length > 10 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {name.length}/10
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value.slice(0, 10));
                    setNameError('');
                  }}
                  placeholder="e.g. Neon Ghost"
                  className={`w-full bg-background/50 border px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground transition-all ${nameError ? 'border-destructive/80 focus:ring-destructive/30' : 'border-border/50'}`}
                />
                {nameError && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute left-1 -bottom-5 text-[10px] font-medium text-destructive mt-1 ml-1"
                  >
                    ❌ {nameError}
                  </motion.p>
                )}
              </div>
            </div>

            {/* Message Input */}
            <div className="space-y-4">
              <label className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Identity Message
                </div>
                <span className={`text-[10px] ${description.length > 20 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {description.length}/20
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 20))}
                  placeholder="Something about you..."
                  className="w-full bg-background/50 border border-border/50 px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                />
              </div>
            </div>

            {/* Hint */}
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-secondary/5 border border-secondary/10">
              <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your name and message will be visible to everyone nearby on the map. Keep it snappy!
              </p>
            </div>
          </div>

          <div className="p-4 bg-muted/30 border-t border-border/50">
            <Button
              onClick={handleContinue}
              disabled={!name || name.length < 2 || isCreating}
              size="lg"
              className="w-full py-7 text-lg font-semibold rounded-2xl gradient-primary text-primary-foreground glow-primary transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            >
              {isCreating
                ? 'Saving Changes...'
                : isSceneActive
                  ? 'Update Identity & Stay Live'
                  : 'Enter the Scene'}
              {isSceneActive ? <RefreshCw className="ml-2 w-5 h-5" /> : <ArrowRight className="ml-2 w-5 h-5" />}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PersonaSelect;
