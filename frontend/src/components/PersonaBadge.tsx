import { Persona } from '@/context/AppContext';
import { motion } from 'framer-motion';

interface PersonaBadgeProps {
  persona: Persona;
}

const archetypeColors = {
  mystic: 'border-persona-mystic/50 bg-persona-mystic/10',
  warrior: 'border-persona-warrior/50 bg-persona-warrior/10',
  sage: 'border-persona-sage/50 bg-persona-sage/10',
  trickster: 'border-persona-trickster/50 bg-persona-trickster/10',
};

const PersonaBadge = ({ persona }: PersonaBadgeProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border backdrop-blur-md ${archetypeColors[persona.archetype]}`}
    >
      <div className="text-2xl">{persona.avatar}</div>
      <div>
        <p className="font-semibold text-foreground text-sm">{persona.name}</p>
        <p className="text-xs text-muted-foreground capitalize">{persona.archetype}</p>
      </div>
    </motion.div>
  );
};

export default PersonaBadge;
