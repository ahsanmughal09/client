import React from 'react';

/**
 * Calculates a point on a Cubic Bezier curve at parameter t (0 <= t <= 1)
 */
function getCubicPoint(t, p0, p1, p2, p3) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
  };
}

/**
 * Modular Photorealistic 3D Snake Component
 * - Centered head inside bite tile box.
 * - Full thick body across the board that smoothly tapers down to thin tail ONLY inside the ending box.
 * - Continuous sampled Bezier rendering for seamless smooth thickness transition.
 */
export default function SnakeItem({ id, headCell, tailCell, headC, tailC, colorTheme = 'red' }) {
  const dx = tailC.x - headC.x;
  const dy = tailC.y - headC.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Calculate curve control points for natural slithering S-shape
  const perpX = (-dy / dist) * (headCell % 2 === 0 ? 8 : -8);
  const perpY = (dx / dist) * (headCell % 2 === 0 ? 8 : -8);

  const c1 = {
    x: headC.x * 0.65 + tailC.x * 0.35 + perpX,
    y: headC.y * 0.65 + tailC.y * 0.35 + perpY
  };
  const c2 = {
    x: headC.x * 0.35 + tailC.x * 0.65 - perpX,
    y: headC.y * 0.35 + tailC.y * 0.65 - perpY
  };

  // Sample 12 points along the Bezier curve for ultra-smooth tapering
  const STEPS = 12;
  const points = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    points.push({
      ...getCubicPoint(t, headC, c1, c2, tailC),
      t
    });
  }

  // Full path string for shadow and texture overlays
  const fullPath = `M ${headC.x} ${headC.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${tailC.x} ${tailC.y}`;

  // Angle pointing FROM body TOWARDS head snout
  const headAngle = Math.atan2(headC.y - c1.y, headC.x - c1.x) * (180 / Math.PI);

  const themes = {
    red: {
      body: 'url(#snakeRedGrad)',
      scales: '#EF4444',
      head: '#DC2626',
      headLight: '#F87171',
      headDark: '#7F1D1D',
      eye: '#FBBF24',
      glow: 'rgba(239, 68, 68, 0.35)'
    },
    green: {
      body: 'url(#snakeGreenGrad)',
      scales: '#10B981',
      head: '#059669',
      headLight: '#34D399',
      headDark: '#064E3B',
      eye: '#F59E0B',
      glow: 'rgba(16, 185, 129, 0.35)'
    },
    purple: {
      body: 'url(#snakePurpleGrad)',
      scales: '#A855F7',
      head: '#7E22CE',
      headLight: '#C084FC',
      headDark: '#3B0764',
      eye: '#FDE047',
      glow: 'rgba(168, 85, 247, 0.35)'
    }
  };

  const theme = themes[colorTheme] || themes.red;

  /**
   * Smooth thickness function:
   * Main body stays thick (2.2px -> 1.9px) for 75% of body length,
   * then smoothly tapers down to thin tail (0.5px) in final 25% inside ending box.
   */
  const getWidthAtT = (t) => {
    if (t <= 0.72) {
      // Main body: subtle gradual taper from 2.2px to 1.9px
      return 2.2 - (t / 0.72) * 0.3;
    } else {
      // Ending box entry: smooth reduction from 1.9px down to 0.5px at tail
      const tRel = (t - 0.72) / 0.28;
      return 1.9 - tRel * 1.4;
    }
  };

  return (
    <g className="snake-item" key={id}>
      {/* 1. Tile Center Warning Glow */}
      <circle
        cx={headC.x}
        cy={headC.y}
        r="3.2"
        fill={theme.glow}
        filter="blur(1px)"
      />

      {/* 2. Deep Drop Shadow with smooth tapering */}
      {points.slice(0, points.length - 1).map((p, i) => {
        const nextP = points[i + 1];
        const w = getWidthAtT((p.t + nextP.t) / 2);
        return (
          <line
            key={`shadow_seg_${i}`}
            x1={p.x}
            y1={p.y}
            x2={nextP.x}
            y2={nextP.y}
            stroke="#000000"
            strokeWidth={w + 0.5}
            strokeLinecap="round"
            opacity="0.65"
            filter="url(#svgShadow)"
          />
        );
      })}

      {/* 3. Main Body Segments with Smooth Tapering */}
      {points.slice(0, points.length - 1).map((p, i) => {
        const nextP = points[i + 1];
        const w = getWidthAtT((p.t + nextP.t) / 2);
        return (
          <line
            key={`body_seg_${i}`}
            x1={p.x}
            y1={p.y}
            x2={nextP.x}
            y2={nextP.y}
            stroke={theme.body}
            strokeWidth={w}
            strokeLinecap="round"
          />
        );
      })}

      {/* 4. Specular Highlight Segments */}
      {points.slice(0, points.length - 1).map((p, i) => {
        const nextP = points[i + 1];
        const w = getWidthAtT((p.t + nextP.t) / 2);
        return (
          <line
            key={`spec_seg_${i}`}
            x1={p.x}
            y1={p.y}
            x2={nextP.x}
            y2={nextP.y}
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth={Math.max(0.2, w * 0.3)}
            strokeLinecap="round"
          />
        );
      })}

      {/* 5. Scale Pattern Overlay */}
      <path
        d={fullPath}
        fill="none"
        stroke="rgba(0, 0, 0, 0.4)"
        strokeWidth="0.5"
        strokeDasharray="0.5 0.7"
        strokeLinecap="round"
      />

      {/* 6. THIN TAIL TIP inside Ending Box (Drop Tile) */}
      <g transform={`translate(${tailC.x}, ${tailC.y})`}>
        <circle r="0.45" fill="#000" opacity="0.5" />
        <circle r="0.28" fill={theme.headDark} stroke="#FFF" strokeWidth="0.08" />
        <circle r="0.15" fill={theme.head} />
      </g>

      {/* 7. CENTERED PROMINENT VIPER HEAD (Inside Tile Box) */}
      <g transform={`translate(${headC.x}, ${headC.y}) rotate(${headAngle})`}>
        {/* Head Cast Shadow */}
        <path
          d="M -1.8 0 Q -1.0 -1.6, 0 -1.6 C 1.0 -1.4, 1.8 -0.8, 2.2 0 C 1.8 0.8, 1.0 1.4, 0 1.6 Q -1.0 1.6, -1.8 0 Z"
          fill="#000000"
          opacity="0.45"
          transform="translate(0.2, 0.3)"
        />

        {/* Outer Dark Base Outline */}
        <path
          d="M -1.8 0 Q -1.0 -1.6, 0 -1.6 C 1.0 -1.4, 1.8 -0.8, 2.2 0 C 1.8 0.8, 1.0 1.4, 0 1.6 Q -1.0 1.6, -1.8 0 Z"
          fill={theme.headDark}
          stroke="#000000"
          strokeWidth="0.2"
        />

        {/* Main 3D Skull Surface */}
        <path
          d="M -1.6 0 Q -0.8 -1.4, 0.1 -1.4 C 0.9 -1.2, 1.6 -0.7, 2.0 0 C 1.6 0.7, 0.9 1.2, 0.1 1.4 Q -0.8 1.4, -1.6 0 Z"
          fill={theme.head}
          stroke="rgba(255, 255, 255, 0.35)"
          strokeWidth="0.12"
        />

        {/* Crown / Nose Ridge Specular Highlight */}
        <path
          d="M -1.2 0 Q -0.4 -0.8, 0.4 -0.8 L 1.6 0 L 0.4 0.8 Q -0.4 0.8, -1.2 0 Z"
          fill={theme.headLight}
          opacity="0.6"
        />

        {/* Eyebrow / Supraocular Ridges */}
        <path
          d="M 0.1 -1.2 Q 0.9 -1.3, 1.4 -0.9"
          stroke={theme.headDark}
          strokeWidth="0.25"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 0.1 1.2 Q 0.9 1.3, 1.4 0.9"
          stroke={theme.headDark}
          strokeWidth="0.25"
          fill="none"
          strokeLinecap="round"
        />

        {/* LEFT EYE */}
        <circle cx="0.8" cy="-0.85" r="0.38" fill="#000000" />
        <circle cx="0.8" cy="-0.85" r="0.32" fill={theme.eye} />
        <ellipse cx="0.8" cy="-0.85" rx="0.08" ry="0.24" fill="#000000" />
        <circle cx="0.92" cy="-0.98" r="0.08" fill="#FFFFFF" />

        {/* RIGHT EYE */}
        <circle cx="0.8" cy="0.85" r="0.38" fill="#000000" />
        <circle cx="0.8" cy="0.85" r="0.32" fill={theme.eye} />
        <ellipse cx="0.8" cy="0.85" rx="0.08" ry="0.24" fill="#000000" />
        <circle cx="0.92" cy="0.98" r="0.08" fill="#FFFFFF" />

        {/* Nostrils */}
        <circle cx="1.7" cy="-0.25" r="0.08" fill="#000000" />
        <circle cx="1.7" cy="0.25" r="0.08" fill="#000000" />

        {/* Venom Fangs */}
        <path
          d="M 1.9 -0.3 L 2.2 -0.6 M 1.9 0.3 L 2.2 0.6"
          stroke="#FFFFFF"
          strokeWidth="0.2"
          strokeLinecap="round"
        />

        {/* Red Flickering Forked Tongue */}
        <path
          d="M 2.0 0 L 2.8 0 M 2.8 0 Q 3.1 -0.15, 3.4 -0.45 M 2.8 0 Q 3.1 0.15, 3.4 0.45"
          stroke="#FF1744"
          strokeWidth="0.22"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </g>
  );
}
