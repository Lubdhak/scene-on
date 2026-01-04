import { Persona } from '@/context/AppContext';
import { motion } from 'framer-motion';

interface PersonaBadgeProps {
  persona: Persona;
}

const PersonaBadge = ({ persona }: PersonaBadgeProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-border/50 bg-card/80 backdrop-blur-md shadow-lg"
    >
      <div className="text-2xl avatar-float">{persona.avatar}</div>
      <div className="min-w-0">
        <p className="font-semibold text-foreground text-sm truncate">{persona.name}</p>
        <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">
          {persona.description}
        </p>
      </div>
    </motion.div>
  );
};

export default PersonaBadge;
