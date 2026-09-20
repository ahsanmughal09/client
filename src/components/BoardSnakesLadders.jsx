import React, { useState, useEffect } from 'react';
import DiceRoller from './DiceRoller';
import SnakeItem from './SnakeItem';
import { sounds } from '../utils/audio';
import { Crown, Sparkles, Zap, MessageSquare } from 'lucide-react';

const LADDERS = {
  9: 31,
  19: 43,
  28: 76,
  37: 56,
  52: 87,
  63: 96
};

const SNAKES = {
  35: 8,
  46: 17,
  64: 40,
  85: 32,
  92: 51,
  98: 61
};

const PLAYER_COLORS = {
  red: { hex: '#FF4757', border: '#FF6B81', name: 'Red', gradient: 'linear-gradient(135deg, #FF4757, #FF6B81)', glow: 'rgba(255, 71, 87, 0.6)' },
  yellow: { hex: '#FFA502', border: '#FFC048', name: 'Yellow', gradient: 'linear-gradient(135deg, #FFA502, #FFC048)', glow: 'rgba(255, 165, 2, 0.6)' },
  green: { hex: '#2ED573', border: '#7BED9F', name: 'Green', gradient: 'linear-gradient(135deg, #2ED573, #7BED9F)', glow: 'rgba(46, 213, 115, 0.6)' },
  blue: { hex: '#1E90FF', border: '#70A1FF', name: 'Blue', gradient: 'linear-gradient(135deg, #1E90FF, #70A1FF)', glow: 'rgba(30, 144, 255, 0.6)' }
};

// Rich tile color palette for 10x10 board grid
const TILE_PALETTE = [
  '#1E293B', '#0F172A', '#1E1B4B', '#172554', '#064E3B', 
  '#312E81', '#1E293B', '#365314', '#1E1B4B', '#0F172A'
];

/**
 * Calculates percentage center coordinates (x%, y%) inside a 100% x 100% 10x10 grid.
 * Boustrophedon path (Cell 1 bottom-left, Cell 10 bottom-right, Cell 11 above 10 going left, etc.)
 */
function getCellCoords(n) {
  if (n <= 0) return { x: 5, y: 105 }; // start dock off-board
  if (n > 100) n = 100;

  const rowFromBottom = Math.floor((n - 1) / 10);
  const isReverseRow = rowFromBottom % 2 === 1;
  const colIndex = (n - 1) % 10;

  const col = isReverseRow ? (9 - colIndex) : colIndex;
  const row = 9 - rowFromBottom;

  const x = (col + 0.5) * 10; // 5% to 95%
  const y = (row + 0.5) * 10; // 5% to 95%
  return { x, y, col, row, rowFromBottom };
}

export default function BoardSnakesLadders({
  gameState,
  myColor,
  slots,
  onRollDice,
  onMoveToken,
  timeLeft,
  onOpenThrowMenu,
  onOpenReactionPicker,
  onToggleMobileChat
}) {
  const [tokenPositions, setTokenPositions] = useState({});
  const [stepState, setStepState] = useState(null); // { color, isMoving }
  const [slidingColor, setSlidingColor] = useState(null);
  const lastProcessedMoveIdRef = React.useRef(null);
  const isAnimatingRef = React.useRef(false);
  const animationTimeoutIdsRef = React.useRef([]);

  const clearAllAnimationTimeouts = () => {
    animationTimeoutIdsRef.current.forEach(id => clearTimeout(id));
    animationTimeoutIdsRef.current = [];
  };

  useEffect(() => {
    return () => clearAllAnimationTimeouts();
  }, []);

  // Continuous Smooth Box-by-Box Sliding -> Pause on Climb/Bite Box -> Smooth Slide Along Ladder/Snake
  useEffect(() => {
    if (!gameState || !gameState.players) return;

    const moveRes = gameState.lastMoveResult;

    if (
      moveRes &&
      moveRes.success &&
      moveRes.from !== undefined &&
      moveRes.finalPos !== undefined &&
      moveRes.moveId &&
      moveRes.moveId !== lastProcessedMoveIdRef.current
    ) {
      lastProcessedMoveIdRef.current = moveRes.moveId;
      isAnimatingRef.current = true;
      clearAllAnimationTimeouts();

      const { color, from, landedOn, finalPos, isLadder, isSnake } = moveRes;

      // Build array of individual box steps: [from + 1, from + 2, ..., landedOn]
      const stepTiles = [];
      const startTile = Math.max(1, from + 1);
      for (let tile = startTile; tile <= landedOn; tile++) {
        stepTiles.push(tile);
      }

      // Lock starting visual position to 'from' tile immediately
      setTokenPositions(prev => ({ ...prev, [color]: from }));
      setStepState(null);
      setSlidingColor(null);

      const STEP_DURATION = 140; // 140ms per box smooth linear slide
      let cumulativeDelay = 20;

      // Schedule continuous smooth sliding across boxes
      stepTiles.forEach((tile) => {
        const stepTimeout = setTimeout(() => {
          setTokenPositions(prev => ({ ...prev, [color]: tile }));
          setStepState({ color, isMoving: true });
          if (sounds.playMove) sounds.playMove();
        }, cumulativeDelay);
        animationTimeoutIdsRef.current.push(stepTimeout);

        cumulativeDelay += STEP_DURATION;
      });

      // Schedule ladder / snake slide or completion after box sliding ends
      const finishWalkingTimeout = setTimeout(() => {
        setStepState(null);

        if (isLadder || isSnake) {
          // Pause 300ms on climb/bite box so landing is clear
          const slidePauseTimeout = setTimeout(() => {
            setSlidingColor(color);
            if (isLadder && sounds.playLadderClimb) sounds.playLadderClimb();
            else if (isSnake && sounds.playSnakeBite) sounds.playSnakeBite();
            else if (sounds.playMove) sounds.playMove();

            // Slide token from climb/bite box to final ladder top or snake tail
            setTokenPositions(prev => ({ ...prev, [color]: finalPos }));

            const finishSlideTimeout = setTimeout(() => {
              setSlidingColor(null);
              isAnimatingRef.current = false;
            }, 750);

            animationTimeoutIdsRef.current.push(finishSlideTimeout);
          }, 300);

          animationTimeoutIdsRef.current.push(slidePauseTimeout);
        } else {
          isAnimatingRef.current = false;
        }
      }, cumulativeDelay + 30);

      animationTimeoutIdsRef.current.push(finishWalkingTimeout);
    } else {
      // Sync static positions ONLY when no animation sequence is actively running
      if (!isAnimatingRef.current) {
        setTokenPositions(prev => {
          const next = { ...prev };
          let changed = false;
          Object.keys(gameState.players).forEach(c => {
            const p = gameState.players[c];
            if (p && p.connected && next[c] !== p.position) {
              next[c] = p.position;
              changed = true;
            }
          });
          return changed ? next : prev;
        });
      }
    }
  }, [gameState?.lastMoveResult, gameState?.players]);

  if (!gameState) return null;

  const { activeColor, canRoll, currentDice, validMoves, players, gameOver } = gameState;
  const isMyTurn = activeColor === myColor;

  // Build 100 tiles (Row 10 to 1 top to bottom)
  const cells = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const rowFromBottom = 9 - r;
      const isReverseRow = rowFromBottom % 2 === 1;
      const colIndex = isReverseRow ? (9 - c) : c;
      const cellNum = rowFromBottom * 10 + colIndex + 1;

      const isFinish = cellNum === 100;
      const isStart = cellNum === 1;
      const ladderTarget = LADDERS[cellNum];
      const snakeTarget = SNAKES[cellNum];

      let bgStyle = 'linear-gradient(135deg, rgba(30, 41, 59, 0.85), rgba(15, 23, 42, 0.95))';
      let borderStyle = '1px solid rgba(255, 255, 255, 0.08)';

      if (isFinish) {
        bgStyle = 'linear-gradient(135deg, #FFD700 0%, #FF8C00 100%)';
        borderStyle = '2px solid #FFF';
      } else if (isStart) {
        bgStyle = 'linear-gradient(135deg, #10B981 0%, #059669 100%)';
        borderStyle = '2px solid #34D399';
      } else if (ladderTarget) {
        bgStyle = 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(180, 83, 9, 0.35))';
        borderStyle = '1px solid rgba(245, 158, 11, 0.5)';
      } else if (snakeTarget) {
        bgStyle = 'linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(153, 27, 27, 0.45))';
        borderStyle = '1px solid rgba(239, 68, 68, 0.6)';
      } else {
        const palIdx = (cellNum + r) % TILE_PALETTE.length;
        bgStyle = `linear-gradient(135deg, ${TILE_PALETTE[palIdx]}, rgba(15, 23, 42, 0.9))`;
      }

      cells.push(
        <div
          key={cellNum}
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: bgStyle,
            border: borderStyle,
            borderRadius: '4px',
            userSelect: 'none',
            overflow: 'hidden',
            boxShadow: isFinish ? '0 0 20px rgba(255, 215, 0, 0.8)' : 'none'
          }}
        >
          {/* Tile Number - Centered Big Display */}
          <span
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: cellNum >= 100 ? 'clamp(12px, 3.8vw, 20px)' : (cellNum >= 10 ? 'clamp(14px, 4.6vw, 25px)' : 'clamp(16px, 5.2vw, 28px)'),
              fontWeight: 900,
              color: isFinish ? '#000000' : '#FFFFFF',
              opacity: isFinish ? 0.95 : 0.85,
              textShadow: isFinish 
                ? '0 1px 2px rgba(255, 255, 255, 0.8)' 
                : '0 2px 5px rgba(0, 0, 0, 0.95), 0 0 3px rgba(0, 0, 0, 0.95)',
              letterSpacing: '-0.5px',
              lineHeight: 1,
              zIndex: 2,
              pointerEvents: 'none',
              userSelect: 'none'
            }}
          >
            {cellNum}
          </span>

          {/* Goal 100 Crown Badge */}
          {isFinish && (
            <Crown
              size={14}
              color="#000"
              style={{
                position: 'absolute',
                top: '3px',
                left: '50%',
                transform: 'translateX(-50%)',
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))',
                zIndex: 3
              }}
            />
          )}

          {/* Start 1 Sparkles Badge */}
          {isStart && (
            <Sparkles
              size={12}
              color="#FFF"
              style={{
                position: 'absolute',
                top: '3px',
                right: '3px',
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
                zIndex: 3
              }}
            />
          )}

        </div>
      );
    }
  }

  // Draw Realistic SVG Snakes & 3D Ladders
  const renderSVGOverlay = () => {
    return (
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10
        }}
      >
        <defs>
          {/* Ladder Metallic/Gold Gradient */}
          <linearGradient id="ladderRailGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="50%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#78350F" />
          </linearGradient>

          <linearGradient id="ladderRungGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>

          {/* Snake Gradients */}
          <linearGradient id="snakeRedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF4D4D" />
            <stop offset="50%" stopColor="#DC2626" />
            <stop offset="100%" stopColor="#7F1D1D" />
          </linearGradient>

          <linearGradient id="snakeGreenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="50%" stopColor="#059669" />
            <stop offset="100%" stopColor="#064E3B" />
          </linearGradient>

          <linearGradient id="snakePurpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C084FC" />
            <stop offset="50%" stopColor="#7E22CE" />
            <stop offset="100%" stopColor="#3B0764" />
          </linearGradient>

          {/* SVG Shadow */}
          <filter id="svgShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0.3" dy="0.6" stdDeviation="0.4" floodColor="#000" floodOpacity="0.75" />
          </filter>
        </defs>

        {/* Render Ladders (Bottom Start to Top End) */}
        {Object.keys(LADDERS).map(start => {
          const climbStartCell = parseInt(start, 10);
          const climbEndCell = LADDERS[climbStartCell];
          const startC = getCellCoords(climbStartCell);
          const endC = getCellCoords(climbEndCell);

          const dx = endC.x - startC.x;
          const dy = endC.y - startC.y;
          const len = Math.sqrt(dx * dx + dy * dy);

          // Perpendicular offset for rails
          const px = (-dy / len) * 1.8;
          const py = (dx / len) * 1.8;

          const r1Start = { x: startC.x + px, y: startC.y + py };
          const r1End = { x: endC.x + px, y: endC.y + py };
          const r2Start = { x: startC.x - px, y: startC.y - py };
          const r2End = { x: endC.x - px, y: endC.y - py };

          // Rungs
          const rungCount = Math.max(3, Math.floor(len / 6.5));
          const rungs = [];

          for (let i = 1; i <= rungCount; i++) {
            const t = i / (rungCount + 1);
            const rx1 = r1Start.x + t * (r1End.x - r1Start.x);
            const ry1 = r1Start.y + t * (r1End.y - r1Start.y);
            const rx2 = r2Start.x + t * (r2End.x - r2Start.x);
            const ry2 = r2Start.y + t * (r2End.y - r2Start.y);

            rungs.push(
              <line
                key={`rung_${climbStartCell}_${i}`}
                x1={rx1}
                y1={ry1}
                x2={rx2}
                y2={ry2}
                stroke="url(#ladderRungGrad)"
                strokeWidth="0.45"
                strokeLinecap="round"
                filter="url(#svgShadow)"
              />
            );
          }

          return (
            <g key={`ladder_${climbStartCell}`}>
              <line
                x1={r1Start.x}
                y1={r1Start.y}
                x2={r1End.x}
                y2={r1End.y}
                stroke="url(#ladderRailGrad)"
                strokeWidth="0.6"
                strokeLinecap="round"
                filter="url(#svgShadow)"
              />
              <line
                x1={r2Start.x}
                y1={r2Start.y}
                x2={r2End.x}
                y2={r2End.y}
                stroke="url(#ladderRailGrad)"
                strokeWidth="0.6"
                strokeLinecap="round"
                filter="url(#svgShadow)"
              />
              {rungs}
            </g>
          );
        })}

        {/* Render Modular Realistic Snakes (Snake Head at BITE cell, Snake Tail at DROP cell) */}
        {Object.keys(SNAKES).map((headKey, idx) => {
          const biteCell = parseInt(headKey, 10);
          const dropCell = SNAKES[biteCell];

          const headC = getCellCoords(biteCell);
          const tailC = getCellCoords(dropCell);
          const colorTheme = idx % 3 === 0 ? 'red' : idx % 3 === 1 ? 'green' : 'purple';

          return (
            <SnakeItem
              key={`snake_${biteCell}`}
              id={`snake_${biteCell}`}
              headCell={biteCell}
              tailCell={dropCell}
              headC={headC}
              tailC={tailC}
              colorTheme={colorTheme}
            />
          );
        })}
      </svg>
    );
  };

  // Render 3D Player Chips
  const renderPlayerTokens = () => {
    const cellOccupants = {};
    const colors = ['red', 'yellow', 'green', 'blue'];

    colors.forEach(color => {
      const pos = tokenPositions[color] !== undefined ? tokenPositions[color] : (players[color]?.position || 0);
      if (!cellOccupants[pos]) cellOccupants[pos] = [];
      cellOccupants[pos].push(color);
    });

    return colors.map(color => {
      const player = players[color];
      if (!player || !player.connected) return null;

      const pos = tokenPositions[color] !== undefined ? tokenPositions[color] : player.position;
      const coords = getCellCoords(pos);

      // Offset if multiple players are on the same cell
      const sharing = cellOccupants[pos] || [color];
      const idxInCell = sharing.indexOf(color);
      let offsetX = 0;
      let offsetY = 0;

      if (sharing.length > 1 && pos > 0) {
        const angle = (idxInCell / sharing.length) * 2 * Math.PI;
        offsetX = Math.cos(angle) * 2.2;
        offsetY = Math.sin(angle) * 2.2;
      }

      const isCurrentActive = activeColor === color;
      const isMyChip = color === myColor;

      const isStepping = stepState?.color === color;
      const isSliding = slidingColor === color;

      let transitionStyle = 'left 0.3s ease-out, top 0.3s ease-out, transform 0.3s ease-out';
      let transformStyle = isCurrentActive ? 'translate(-50%, -50%) scale(1.08)' : 'translate(-50%, -50%) scale(1.0)';

      if (isStepping) {
        transitionStyle = 'left 0.14s linear, top 0.14s linear';
        transformStyle = 'translate(-50%, -50%) scale(1.08)';
      } else if (isSliding) {
        transitionStyle = 'left 0.75s cubic-bezier(0.25, 1, 0.5, 1), top 0.75s cubic-bezier(0.25, 1, 0.5, 1)';
        transformStyle = 'translate(-50%, -50%) scale(1.15)';
      }

      return (
        <div
          key={`chip_${color}`}
          data-player-color={color}
          onClick={() => {
            if (isMyTurn && !canRoll && validMoves.length > 0 && isMyChip) {
              sounds.playClick();
              onMoveToken(0);
            }
          }}
          style={{
            position: 'absolute',
            left: `${coords.x + offsetX}%`,
            top: `${coords.y + offsetY}%`,
            transform: transformStyle,
            width: 'clamp(18px, 5vw, 36px)',
            height: 'clamp(18px, 5vw, 36px)',
            borderRadius: '50%',
            background: PLAYER_COLORS[color].gradient,
            border: `2px solid ${isCurrentActive ? '#FFF' : PLAYER_COLORS[color].border}`,
            boxShadow: isCurrentActive
              ? `0 0 16px ${PLAYER_COLORS[color].glow}, 0 4px 10px rgba(0,0,0,0.7)`
              : '0 3px 6px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFF',
            fontWeight: 900,
            fontSize: 'max(10px, min(1.8vw, 15px))',
            cursor: (isMyTurn && !canRoll && validMoves.length > 0 && isMyChip) ? 'pointer' : 'default',
            transition: transitionStyle,
            zIndex: isCurrentActive ? 35 : 25
          }}
        >
          {player.name ? player.name.charAt(0).toUpperCase() : color.charAt(0).toUpperCase()}

          {/* Active Turn Pulsing Ring */}
          {isCurrentActive && (
            <div
              style={{
                position: 'absolute',
                inset: '-6px',
                borderRadius: '50%',
                border: `2.5px solid ${PLAYER_COLORS[color].hex}`,
                animation: 'pulseRing 1.2s infinite'
              }}
            />
          )}

          {/* Rank Badge */}
          {player.rank && (
            <div
              style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                background: '#FFD700',
                color: '#000',
                borderRadius: '50%',
                width: '16px',
                height: '16px',
                fontSize: '10px',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1.5px solid #000'
              }}
            >
              #{player.rank}
            </div>
          )}
        </div>
      );
    });
  };

  const opponentColors = ['red', 'yellow', 'green', 'blue'].filter(c => c !== myColor);
  const myPlayer = players[myColor] || players[activeColor] || {};
  const myPosition = myPlayer.position || 0;

  return (
    <div className="snakes-ladders-wrapper">

      {/* MOBILE TOP DOCK: Opponents Cards & Active Turn Status */}
      <div
        className="mobile-only-sl mobile-top-dock"
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          background: 'rgba(15, 23, 42, 0.85)',
          border: `1.5px solid ${PLAYER_COLORS[activeColor]?.hex || 'rgba(255, 255, 255, 0.15)'}`,
          borderRadius: '14px',
          padding: '6px 10px',
          boxSizing: 'border-box',
          backdropFilter: 'blur(12px)',
          flexShrink: 0
        }}
      >
        {/* Active Turn Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: PLAYER_COLORS[activeColor]?.hex || '#FFF',
                boxShadow: `0 0 8px ${PLAYER_COLORS[activeColor]?.hex}`
              }}
            />
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#FFF' }}>
              {slots[activeColor]?.name || activeColor.toUpperCase()}'s Turn
              {isMyTurn && <span style={{ fontSize: '0.62rem', background: '#6366F1', marginLeft: '4px', padding: '1px 5px', borderRadius: '6px' }}>YOU</span>}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 900, color: timeLeft <= 5 ? '#F87171' : '#FBBF24' }}>
              ⏱️ {timeLeft}s
            </span>
          </div>
        </div>

        {/* Opponent Cards Row */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', width: '100%', scrollbarWidth: 'none', paddingTop: '2px' }}>
          {opponentColors.map(c => {
            const p = players[c];
            const slot = slots[c];
            if (!slot || !slot.connected) return null;
            const pos = p ? p.position : 0;
            const isTurn = activeColor === c;

            return (
              <div
                key={`m_opp_${c}`}
                data-player-color={c}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 8px',
                  borderRadius: '14px',
                  background: isTurn ? 'rgba(99, 102, 241, 0.35)' : 'rgba(30, 41, 59, 0.75)',
                  border: `1.5px solid ${isTurn ? PLAYER_COLORS[c].hex : 'rgba(255,255,255,0.12)'}`,
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: PLAYER_COLORS[c].hex }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#FFF' }}>
                  {slot.name}
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 900, color: pos > 0 ? '#4ADE80' : '#94A3B8' }}>
                  #{pos}
                </span>
                {onOpenThrowMenu && (
                  <button
                    onClick={() => onOpenThrowMenu(c, slot.name)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      padding: '2px 5px',
                      marginLeft: '2px'
                    }}
                    title={`Throw item at ${slot.name}`}
                  >
                    🎯
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* DESKTOP-ONLY LEFT PANEL: Playing Player Controls & Info */}
      <div className="glass-panel snakes-ladders-panel desktop-only-sl">
        <div>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, background: 'linear-gradient(135deg, #FFF, #818CF8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
              🎮 YOUR CONTROLS
            </h2>
            <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600 }}>Playing Player Panel</span>
          </div>

          {/* Playing Player Card */}
          <div
            data-player-color={myColor}
            style={{
              background: 'rgba(30, 41, 59, 0.8)',
              padding: '12px 14px',
              borderRadius: '14px',
              border: `2px solid ${PLAYER_COLORS[myColor]?.hex || '#6366F1'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: PLAYER_COLORS[myColor]?.hex || '#FFF',
                  boxShadow: `0 0 10px ${PLAYER_COLORS[myColor]?.hex}`
                }}
              />
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#FFF' }}>
                  {slots[myColor]?.name || myColor.toUpperCase()}
                  <span style={{ fontSize: '0.65rem', background: '#6366F1', marginLeft: '6px', padding: '1px 6px', borderRadius: '8px' }}>YOU</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 700 }}>Color: {PLAYER_COLORS[myColor]?.name || myColor}</div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700 }}>POSITION</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: (players[myColor]?.position || 0) > 0 ? '#4ADE80' : '#94A3B8' }}>
                {(players[myColor]?.position || 0) === 0 ? 'Dock (0)' : `Tile #${players[myColor]?.position}`}
              </div>
            </div>
          </div>

          {/* Integrated Dice Roller */}
          <div style={{ margin: '14px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <DiceRoller
              currentDice={currentDice}
              dicePool={[]}
              canRoll={canRoll}
              isMyTurn={isMyTurn}
              activeColor={activeColor}
              onRollDice={onRollDice}
              diceCount={1}
              compact={false}
              hideBalance={true}
            />
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%' }}>
          {isMyTurn && canRoll && !gameOver && (
            <button
              onClick={() => {
                sounds.playDiceRoll();
                onRollDice(0);
              }}
              className="glass-btn primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '14px',
                fontSize: '1.05rem',
                fontWeight: 900,
                background: 'linear-gradient(135deg, #10B981, #059669)',
                border: 'none',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.6)',
                cursor: 'pointer'
              }}
            >
              🎲 ROLL DICE NOW
            </button>
          )}

          {isMyTurn && !canRoll && validMoves.length > 0 && !gameOver && (
            <button
              onClick={() => {
                sounds.playClick();
                onMoveToken(0);
              }}
              className="glass-btn primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '14px',
                fontSize: '1.05rem',
                fontWeight: 900,
                background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
                border: 'none',
                boxShadow: '0 0 20px rgba(99, 102, 241, 0.6)',
                cursor: 'pointer'
              }}
            >
              <Zap size={20} /> STEP FORWARD
            </button>
          )}

          {isMyTurn && !canRoll && validMoves.length === 0 && !gameOver && (
            <div
              style={{
                color: '#F87171',
                fontSize: '0.85rem',
                fontWeight: 800,
                textAlign: 'center',
                background: 'rgba(239, 68, 68, 0.15)',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                width: '100%'
              }}
            >
              🚫 Exceeds 100 Goal! Passing Turn...
            </div>
          )}

          {/* Reactions & Chat Triggers */}
          <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '6px' }}>
            {onOpenReactionPicker && (
              <button
                onClick={onOpenReactionPicker}
                className="glass-btn"
                style={{ flex: 1, justifyContent: 'center', padding: '8px', fontSize: '0.85rem' }}
              >
                😍 Reactions
              </button>
            )}
            {onToggleMobileChat && (
              <button
                onClick={onToggleMobileChat}
                className="glass-btn"
                style={{ flex: 1, justifyContent: 'center', padding: '8px', fontSize: '0.85rem' }}
              >
                <MessageSquare size={16} /> Chat
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Center 10x10 Board Container */}
      <div className="snakes-ladders-board">
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(10, 1fr)',
              gridTemplateRows: 'repeat(10, 1fr)',
              width: '100%',
              height: '100%',
              gap: '2px',
              boxSizing: 'border-box'
            }}
          >
            {cells}
          </div>

          {renderSVGOverlay()}
          {renderPlayerTokens()}
        </div>
      </div>

      {/* DESKTOP-ONLY RIGHT PANEL: Opponents & Game Overview */}
      <div className="glass-panel snakes-ladders-panel desktop-only-sl">
        <div>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, background: 'linear-gradient(135deg, #FFF, #4ADE80)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
              🐍 OPPONENTS
            </h2>
            <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600 }}>100 Tiles Goal • Free For All</span>
          </div>

          {/* Active Turn Banner */}
          <div
            style={{
              background: 'rgba(30, 41, 59, 0.8)',
              padding: '10px 14px',
              borderRadius: '14px',
              border: `2px solid ${PLAYER_COLORS[activeColor]?.hex || '#6366F1'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: PLAYER_COLORS[activeColor]?.hex || '#FFF',
                  boxShadow: `0 0 10px ${PLAYER_COLORS[activeColor]?.hex}`
                }}
              />
              <div>
                <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700 }}>ACTIVE TURN</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#FFF' }}>
                  {slots[activeColor]?.name || activeColor.toUpperCase()}
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700 }}>TIMER</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: timeLeft <= 5 ? '#F87171' : '#FBBF24' }}>
                ⏱️ {timeLeft}s
              </div>
            </div>
          </div>

          {/* Opponents List with Throwables */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Opponent Players</span>
            {opponentColors.map(c => {
              const p = players[c];
              const slot = slots[c];
              if (!slot || !slot.connected) return null;

              const pos = p ? p.position : 0;
              const isTurn = activeColor === c;

              return (
                <div
                  key={`desktop_opp_${c}`}
                  data-player-color={c}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: isTurn ? 'rgba(99, 102, 241, 0.25)' : 'rgba(30, 41, 59, 0.5)',
                    border: `1px solid ${isTurn ? PLAYER_COLORS[c].hex : 'rgba(255,255,255,0.08)'}`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: PLAYER_COLORS[c].hex }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFF' }}>
                      {slot.name}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {onOpenThrowMenu && (
                      <button
                        onClick={() => onOpenThrowMenu(c, slot.name)}
                        style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', padding: '2px 6px' }}
                        title={`Throw item at ${slot.name}`}
                      >
                        🎯 Throw
                      </button>
                    )}
                    <span style={{ fontSize: '0.85rem', fontWeight: 900, color: pos > 0 ? '#4ADE80' : '#94A3B8' }}>
                      {pos === 0 ? 'Dock' : `#${pos}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* MOBILE BOTTOM DOCK: Unified Player Card (Position + Interactive 3D Dice + Reactions) */}
      <div
        className="mobile-only-sl mobile-bottom-dock"
        data-player-color={myColor}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: isMyTurn ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.85)',
          border: `2px solid ${isMyTurn ? (PLAYER_COLORS[myColor]?.hex || '#6366F1') : 'rgba(255, 255, 255, 0.15)'}`,
          borderRadius: '16px',
          padding: '6px 12px',
          boxSizing: 'border-box',
          backdropFilter: 'blur(14px)',
          flexShrink: 0,
          gap: '8px',
          boxShadow: isMyTurn ? `0 0 20px ${PLAYER_COLORS[myColor]?.glow || 'rgba(99, 102, 241, 0.4)'}` : 'none'
        }}
      >
        {/* Left: Player Profile & Tile Position */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: PLAYER_COLORS[myColor]?.hex || '#6366F1',
              boxShadow: `0 0 10px ${PLAYER_COLORS[myColor]?.hex}`
            }}
          />
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#FFF', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {slots[myColor]?.name || myColor.toUpperCase()}
              <span style={{ fontSize: '0.58rem', background: '#6366F1', padding: '1px 5px', borderRadius: '6px' }}>YOU</span>
            </div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: myPosition > 0 ? '#4ADE80' : '#94A3B8' }}>
              {myPosition === 0 ? 'Dock (0)' : `Tile #${myPosition}`}
            </div>
          </div>
        </div>

        {/* Center: Interactive 3D Dice Roller (Click Dice directly to Roll or Step) */}
        <div
          onClick={() => {
            if (isMyTurn && !gameOver) {
              if (canRoll) {
                sounds.playDiceRoll();
                onRollDice(0);
              } else if (validMoves.length > 0) {
                sounds.playClick();
                onMoveToken(0);
              }
            }
          }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: (isMyTurn && !gameOver) ? 'pointer' : 'default',
            padding: '2px 8px',
            borderRadius: '12px',
            background: isMyTurn ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
            border: isMyTurn ? '1px solid rgba(255, 255, 255, 0.2)' : 'none'
          }}
        >
          <DiceRoller
            currentDice={currentDice}
            dicePool={[]}
            canRoll={canRoll}
            isMyTurn={isMyTurn}
            activeColor={activeColor}
            onRollDice={onRollDice}
            diceCount={1}
            diceSize={48}
            hideBalance={true}
            hideHelperText={true}
          />
          {isMyTurn && !gameOver && (
            <span style={{
              fontSize: '0.62rem',
              fontWeight: 900,
              color: canRoll ? '#2ED573' : (validMoves.length > 0 ? '#818CF8' : '#F87171'),
              marginTop: '2px',
              animation: canRoll ? 'pulse 1s infinite' : 'none'
            }}>
              {canRoll ? '⚡ TAP DICE!' : (validMoves.length > 0 ? '👉 STEP' : '🚫 EXCEEDS')}
            </span>
          )}
        </div>

        {/* Right: Quick Reaction Picker & Chat Triggers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {onOpenReactionPicker && (
            <button
              onClick={onOpenReactionPicker}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '6px 8px',
                fontSize: '0.9rem',
                cursor: 'pointer',
                color: '#FFF'
              }}
              title="Reactions"
            >
              😍
            </button>
          )}
          {onToggleMobileChat && (
            <button
              onClick={onToggleMobileChat}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '6px 8px',
                cursor: 'pointer',
                color: '#FFF',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Chat"
            >
              <MessageSquare size={14} />
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
