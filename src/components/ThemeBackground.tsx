import React, { useEffect, useState } from 'react';
import { Heart, Leaf, CloudRain, Sparkles, Music } from 'lucide-react';

interface ThemeBackgroundProps {
  theme: string;
}

export const ThemeBackground: React.FC<ThemeBackgroundProps> = ({ theme }) => {
  const [elements, setElements] = useState<{ id: number; left: string; delay: string; duration: string; size: number }[]>([]);

  useEffect(() => {
    const count = 15;
    const newElements = Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 5}s`,
      duration: `${10 + Math.random() * 10}s`,
      size: 10 + Math.random() * 20,
    }));
    setElements(newElements);
  }, [theme]);

  const renderElement = (el: any) => {
    const style = {
      left: el.left,
      animationDelay: el.delay,
      animationDuration: el.duration,
      width: el.size,
      height: el.size,
    };

    switch (theme) {
      case 'love':
      case 'default':
        return (
          <div key={el.id} className="floating-element text-romantic-deep/20 animate-[bubble_linear_infinite]" style={style}>
            <Heart fill="currentColor" />
          </div>
        );
      case 'sad':
        return (
          <div key={el.id} className="floating-element text-slate-400/30 animate-[rain_linear_infinite]" style={style}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              <path d="M12 3v18" stroke="white" strokeWidth="2" />
            </svg>
          </div>
        );
      case 'nature':
        return (
          <div key={el.id} className="floating-element text-emerald-500/20 animate-[float_linear_infinite]" style={style}>
            <Leaf fill="currentColor" />
          </div>
        );
      case 'classic':
        return (
          <div key={el.id} className="floating-element text-indigo-500/10 animate-[float_linear_infinite]" style={style}>
            {el.id % 2 === 0 ? <Music fill="currentColor" /> : <Sparkles fill="currentColor" />}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {elements.map(renderElement)}
    </div>
  );
};
