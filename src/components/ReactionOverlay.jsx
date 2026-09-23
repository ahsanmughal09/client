import React, { useState, useEffect, useRef } from 'react';
import { sounds } from '../utils/audio';

export default function ReactionOverlay({ activeReactions = [] }) {
  const [displayedReactions, setDisplayedReactions] = useState([]);
  const processedIdsRef = useRef(new Set());

  useEffect(() => {
    activeReactions.forEach((r) => {
      if (!r || !r.id) return;
      if (processedIdsRef.current.has(r.id)) return;
      processedIdsRef.current.add(r.id);

      const colorKey = r.fromColor ? r.fromColor.toLowerCase() : 'red';

      // Default screen position fallback per color
      const defaultColorCoords = {
        red: { x: window.innerWidth * 0.25, y: window.innerHeight * 0.25 },
        green: { x: window.innerWidth * 0.75, y: window.innerHeight * 0.25 },
        yellow: { x: window.innerWidth * 0.75, y: window.innerHeight * 0.75 },
        blue: { x: window.innerWidth * 0.25, y: window.innerHeight * 0.75 },
        orange: { x: window.innerWidth * 0.85, y: window.innerHeight * 0.5 },
        purple: { x: window.innerWidth * 0.15, y: window.innerHeight * 0.5 }
      };

      // Helper to find visible element center on screen
      const getVisibleElementCenter = (c) => {
        if (!c) return null;
        const normalizedColor = c.toLowerCase();
        const selectors = [
          `[data-corner-pod="${normalizedColor}"]`,
          `[data-player-color="${normalizedColor}"]`,
          `[data-corner-pod="${c}"]`,
          `[data-player-color="${c}"]`
        ];
        const elements = document.querySelectorAll(selectors.join(', '));
        for (const el of elements) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return {
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2
            };
          }
        }
        return null;
      };

      const podCenter = getVisibleElementCenter(colorKey);
      const defaultPos = defaultColorCoords[colorKey] || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      const posX = podCenter ? podCenter.x : defaultPos.x;
      const posY = podCenter ? podCenter.y : defaultPos.y;

      // Play audio sound effect safely
      try {
        sounds.playReaction(r.reactionId);
      } catch (err) {
        console.warn('Audio playback error ignored:', err);
      }

      const newReactionItem = {
        id: r.id,
        fromColor: colorKey,
        reactionId: r.reactionId,
        emoji: r.emoji,
        x: posX,
        y: posY
      };

      setDisplayedReactions(prev => [...prev, newReactionItem]);

      // Remove after animation finishes (2.2s)
      setTimeout(() => {
        setDisplayedReactions(prev => prev.filter(item => item.id !== r.id));
      }, 2200);
    });
  }, [activeReactions]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 999999,
      overflow: 'visible'
    }}>
      {displayedReactions.map((item) => (
        <div
          key={item.id}
          className="cute-single-reaction-popout"
          style={{
            position: 'absolute',
            left: `${item.x}px`,
            top: `${item.y - 30}px`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 999999
          }}
        >
          <span
            className={`cute-emoji-sprite cute-anim-${item.reactionId}`}
            style={{
              fontSize: '4.8rem',
              display: 'inline-block',
              filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))'
            }}
          >
            {item.emoji}
          </span>
        </div>
      ))}
    </div>
  );
}
