import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp, personas, Persona } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';

const archetypeColors = {
  mystic: 'from-persona-mystic/20 to-persona-mystic/5 border-persona-mystic/40',
  warrior: 'from-persona-warrior/20 to-persona-warrior/5 border-persona-warrior/40',
  sage: 'from-persona-sage/20 to-persona-sage/5 border-persona-sage/40',
  trickster: 'from-persona-trickster/20 to-persona-trickster/5 border-persona-trickster/40',
};

const archetypeGlow = {
  mystic: 'shadow-[0_0_30px_hsl(280_80%_60%/0.3)]',
  warrior: 'shadow-[0_0_30px_hsl(350_85%_55%/0.3)]',
  sage: 'shadow-[0_0_30px_hsl(145_70%_45%/0.3)]',
  trickster: 'shadow-[0_0_30px_hsl(45_100%_55%/0.3)]',
};

const PersonaSelect = () => {
  const navigate = useNavigate();
  const { selectedPersona, setSelectedPersona } = useApp();

  const handleSelect = (persona: Persona) => {
    setSelectedPersona(persona);
  };

  const handleContinue = () => {
    if (selectedPersona) {
      navigate('/map');
    }
  };

  return (
    <div className="min-h-screen bg-background bg-noise relative overflow-hidden">
      {/* Ambient effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-secondary/10 rounded-full blur-[150px] pointer-events-none" />
      
      <div className="relative z-10 px-6 py-12 max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/20 border border-secondary/30 mb-4">
            <Sparkles className="w-4 h-4 text-secondary" />
            <span className="text-sm font-medium text-secondary">Step 1 of 2</span>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-3">Choose Your Persona</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Your persona defines how others see you. Each archetype grants unique abilities.
          </p>
        </motion.div>

        {/* Persona Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10"
        >
          {personas.map((persona, index) => (
            <motion.div
              key={persona.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
            >
              <button
                onClick={() => handleSelect(persona)}
                className={`
                  w-full p-5 rounded-2xl border text-left transition-all duration-300
                  bg-gradient-to-br ${archetypeColors[persona.archetype]}
                  ${selectedPersona?.id === persona.id 
                    ? `ring-2 ring-primary scale-[1.02] ${archetypeGlow[persona.archetype]}` 
                    : 'hover:scale-[1.01] hover:border-border'}
                `}
              >
                <div className="flex items-start gap-4">
                  <div className="text-4xl avatar-float">{persona.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground mb-1">{persona.name}</h3>
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                      {persona.description}
                    </p>
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/50 border border-border/50">
                      <span className="text-xs font-mono text-primary">{persona.ability}</span>
                    </div>
                  </div>
                </div>
              </button>
            </motion.div>
          ))}
        </motion.div>

        {/* Continue Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex justify-center"
        >
          <Button
            onClick={handleContinue}
            disabled={!selectedPersona}
            size="lg"
            className={`
              px-8 py-6 text-lg font-semibold rounded-2xl transition-all duration-300
              ${selectedPersona 
                ? 'gradient-primary text-primary-foreground glow-primary hover:scale-105' 
                : 'bg-muted text-muted-foreground cursor-not-allowed'}
            `}
          >
            Enter the Scene
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default PersonaSelect;
