'use client'

/**
 * Boost — NeedBoost AI Coach Mascot
 * 
 * Option C architecture:
 * - One continuous float animation that NEVER stops or resets
 * - State-specific overlays fade in/out on top
 * - The drone always feels physically present; only its expression changes
 */

import { useEffect, useState } from 'react'

export type BoostState = 'idle' | 'searching' | 'analyzing' | 'coaching' | 'success' | 'error'

interface BoostProps {
  state?: BoostState
  size?: number
  className?: string
  style?: React.CSSProperties
}

const STYLES = `
  /* ── BASE: always running, never stops ───────────────────────────────────── */
  @keyframes b-base-float {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-5px); }
  }
  @keyframes b-base-glow {
    0%, 100% { opacity: 0.3; transform: scaleX(1); }
    50%       { opacity: 0.5; transform: scaleX(1.1); }
  }
  @keyframes b-base-blink {
    0%, 88%, 100% { transform: scaleY(1); }
    92%            { transform: scaleY(0.06); }
    95%            { transform: scaleY(1); }
  }
  @keyframes b-base-pupil {
    0%, 100% { opacity: 0.9; }
    50%       { opacity: 1; }
  }

  /* ── SEARCHING overlay ───────────────────────────────────────────────────── */
  @keyframes b-tilt {
    0%, 100% { transform: rotate(0deg); }
    25%       { transform: rotate(-8deg); }
    75%       { transform: rotate(8deg); }
  }
  @keyframes b-eye-scan {
    0%, 100% { transform: translateX(0px); }
    25%       { transform: translateX(-5px); }
    75%       { transform: translateX(5px); }
  }
  @keyframes b-scan-ring {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes b-search-glow {
    0%, 100% { opacity: 0.4; transform: scaleX(1.1); }
    50%       { opacity: 0.65; transform: scaleX(1.3); }
  }

  /* ── ANALYZING overlay ───────────────────────────────────────────────────── */
  @keyframes b-iris-contract {
    0%, 100% { transform: scale(1); }
    45%       { transform: scale(0.32); }
    55%       { transform: scale(0.32); }
  }
  @keyframes b-ring-cw {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes b-ring-ccw {
    from { transform: rotate(0deg); }
    to   { transform: rotate(-360deg); }
  }
  @keyframes b-analyze-glow {
    0%, 100% { opacity: 0.6; transform: scaleX(1.3); }
    50%       { opacity: 0.9; transform: scaleX(1.6); }
  }
  @keyframes b-panel-flicker {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.75; }
  }

  /* ── COACHING overlay ────────────────────────────────────────────────────── */
  @keyframes b-coach-iris {
    0%, 100% { transform: scale(1.08); opacity: 1; }
    50%       { transform: scale(1.0);  opacity: 0.92; }
  }
  @keyframes b-coach-glow {
    0%, 100% { opacity: 0.75; transform: scaleX(1.5); }
    50%       { opacity: 1.0; transform: scaleX(1.75); }
  }

  /* ── SUCCESS overlay (plays once) ────────────────────────────────────────── */
  @keyframes b-hop {
    0%   { transform: translateY(0px); }
    28%  { transform: translateY(-14px); }
    52%  { transform: translateY(-8px); }
    72%  { transform: translateY(-12px); }
    100% { transform: translateY(-5px); }
  }
  @keyframes b-pulse-ring {
    0%   { r: 10; opacity: 1;   stroke-width: 2.5; }
    100% { r: 44; opacity: 0;   stroke-width: 0.3; }
  }
  @keyframes b-success-glow {
    0%   { opacity: 1;   transform: scaleX(1.8); }
    100% { opacity: 0.5; transform: scaleX(1.2); }
  }

  /* ── ERROR overlay (plays once, holds) ───────────────────────────────────── */
  @keyframes b-shake {
    0%, 100% { transform: translateX(0px); }
    15%       { transform: translateX(-7px); }
    30%       { transform: translateX(7px); }
    45%       { transform: translateX(-5px); }
    60%       { transform: translateX(5px); }
    75%       { transform: translateX(-2px); }
  }
  @keyframes b-eye-narrow {
    0%, 100% { transform: scaleY(0.18); }
  }
  @keyframes b-error-glow {
    0%, 100% { opacity: 0.12; transform: scaleX(0.7); }
    50%       { opacity: 0.2;  transform: scaleX(0.85); }
  }

  /* ── Fade transition for overlay layers ──────────────────────────────────── */
  .b-overlay {
    transition: opacity 0.6s ease;
  }
`

function injectStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById('boost-v4-styles')) return
  const el = document.createElement('style')
  el.id = 'boost-v4-styles'
  el.textContent = STYLES
  document.head.appendChild(el)
}

// Visibility helpers — overlays fade in/out smoothly
function vis(active: boolean): React.CSSProperties {
  return { opacity: active ? 1 : 0, transition: 'opacity 0.55s ease', pointerEvents: 'none' }
}
// One-shot: visible only briefly, use animation fill to hold
function once(active: boolean): React.CSSProperties {
  return { opacity: active ? 1 : 0, transition: active ? 'opacity 0.1s ease' : 'opacity 0.8s ease' }
}

const O = '50px 50px' // shared transform origin

export default function Boost({ state = 'idle', size = 48, className, style }: BoostProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    injectStyles()
    const t = setTimeout(() => setMounted(true), 40)
    return () => clearTimeout(t)
  }, [])

  // Colors per state — these transition smoothly via CSS filter
  const isError    = state === 'error'
  const isCoaching = state === 'coaching' || state === 'success'
  const eyeColor   = isError ? '#AA3300' : '#FF5C1A'
  const eyeFilter  = isError
    ? 'drop-shadow(0 0 4px rgba(150,40,0,0.6))'
    : isCoaching
    ? 'drop-shadow(0 0 9px rgba(255,92,26,1))'
    : 'drop-shadow(0 0 6px rgba(255,92,26,0.75))'

  if (!mounted) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none"
        className={className} style={{ overflow: 'visible', ...style }}>
        <polygon points="50,6 86,27 86,73 50,94 14,73 14,27"
          fill="#0A0D10" stroke="rgba(255,255,255,0.13)" strokeWidth="1.2" />
        <polygon points="50,28 72,36 74,55 72,64 50,72 28,64 26,55 28,36"
          fill="#161C24" stroke="rgba(255,255,255,0.10)" strokeWidth="0.7" />
        <circle cx="50" cy="50" r="16" fill="#08090C" stroke="#FF5C1A" strokeWidth="1.4" strokeOpacity="0.5" />
        <circle cx="50" cy="50" r="4.5" fill="#FF5C1A" />
        <circle cx="53.8" cy="46.2" r="2" fill="white" fillOpacity="0.7" />
      </svg>
    )
  }

  return (
    <svg
      width={size} height={size} viewBox="0 0 100 100"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className} style={{ overflow: 'visible', ...style }}
    >
      <defs>
        <filter id="bv4-shadow" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#000" floodOpacity="0.5" />
        </filter>
      </defs>

      {/* ── GROUND GLOW LAYER ── base always on, overlays fade in/out ── */}
      {/* Base glow — always present */}
      <ellipse cx="50" cy="92" rx="18" ry="3.5" fill="#FF5C1A"
        style={{ animation: 'b-base-glow 4s ease-in-out infinite', transformOrigin: '50px 92px' }} />

      {/* Searching glow overlay */}
      <ellipse cx="50" cy="92" rx="20" ry="4" fill="#FF5C1A"
        style={{ ...vis(state === 'searching'), animation: 'b-search-glow 2.4s ease-in-out infinite', transformOrigin: '50px 92px' }} />

      {/* Analyzing glow overlay */}
      <ellipse cx="50" cy="92" rx="24" ry="4" fill="#FF5C1A"
        style={{ ...vis(state === 'analyzing'), animation: 'b-analyze-glow 1.6s ease-in-out infinite', transformOrigin: '50px 92px' }} />

      {/* Coaching glow overlay */}
      <ellipse cx="50" cy="92" rx="28" ry="5.5" fill="#FF5C1A"
        style={{ ...vis(state === 'coaching'), animation: 'b-coach-glow 3.5s ease-in-out infinite', transformOrigin: '50px 92px' }} />

      {/* Success glow overlay */}
      <ellipse cx="50" cy="92" rx="32" ry="6" fill="#FF5C1A"
        style={{ ...once(state === 'success'), animation: 'b-success-glow 1s ease-out forwards', transformOrigin: '50px 92px' }} />

      {/* Error glow overlay — dims everything */}
      <ellipse cx="50" cy="92" rx="12" ry="2" fill="#AA3300"
        style={{ ...vis(state === 'error'), animation: 'b-error-glow 2s ease-in-out infinite', transformOrigin: '50px 92px' }} />

      {/* ── BODY ── */}
      <g filter="url(#bv4-shadow)">

        {/* ── CONTINUOUS BASE FLOAT — never changes, never resets ── */}
        <g style={{ animation: 'b-base-float 4s ease-in-out infinite', transformOrigin: O }}>

          {/* ── SEARCHING TILT OVERLAY — fades in on top of float ── */}
          <g style={{ ...vis(state === 'searching'), animation: state === 'searching' ? 'b-tilt 2.4s ease-in-out infinite' : 'none', transformOrigin: O }}>
          {/* This group wraps the whole body for tilt — when opacity 0 it doesn't affect base float */}
          </g>

          {/* ── ERROR SHAKE — one-shot, on top of float ── */}
          <g style={{ ...once(state === 'error'), animation: state === 'error' ? 'b-shake 0.5s ease-out 1 forwards' : 'none', transformOrigin: O }}>
          </g>

          {/* ── SUCCESS HOP — overrides float briefly, then blends back ── */}
          <g style={{ ...once(state === 'success'), animation: state === 'success' ? 'b-hop 0.9s cubic-bezier(0.2,0.8,0.4,1) forwards' : 'none', transformOrigin: O }}>
          </g>

          {/* ── HEX BODY — always rendered ── */}
          {/* Outer frame */}
          <polygon points="50,6 86,27 86,73 50,94 14,73 14,27"
            fill="#0A0D10" stroke="rgba(255,255,255,0.13)" strokeWidth="1.2" />

          {/* Armor panels */}
          <polygon points="50,6 86,27 72,36 50,28 28,36 14,27"
            fill="#15191F" stroke="rgba(255,255,255,0.09)" strokeWidth="0.6"
            style={state === 'analyzing' ? { animation: 'b-panel-flicker 1.6s ease-in-out infinite' } : {}} />
          <polygon points="86,27 86,55 74,55 72,36"
            fill="#1B2029" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5"
            style={state === 'analyzing' ? { animation: 'b-panel-flicker 1.6s 0.2s ease-in-out infinite' } : {}} />
          <polygon points="14,27 14,55 26,55 28,36"
            fill="#131820" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5"
            style={state === 'analyzing' ? { animation: 'b-panel-flicker 1.6s 0.4s ease-in-out infinite' } : {}} />
          <polygon points="86,55 86,73 72,64 74,55"
            fill="#101418" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
          <polygon points="14,55 14,73 28,64 26,55"
            fill="#0D1115" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
          <polygon points="50,94 86,73 72,64 50,72 28,64 14,73"
            fill="#09090C" stroke="rgba(255,255,255,0.07)" strokeWidth="0.6" />
          <polygon points="50,28 72,36 74,55 72,64 50,72 28,64 26,55 28,36"
            fill="#161C24" stroke="rgba(255,255,255,0.10)" strokeWidth="0.7" />

          {/* Edge highlights */}
          <line x1="14" y1="27" x2="28" y2="36" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" />
          <line x1="86" y1="27" x2="72" y2="36" stroke="rgba(255,255,255,0.13)" strokeWidth="0.8" />
          <line x1="28" y1="36" x2="50" y2="28" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />
          <line x1="50" y1="28" x2="72" y2="36" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />

          {/* Vent lines */}
          <line x1="38" y1="18" x2="43" y2="22" stroke="rgba(255,255,255,0.13)" strokeWidth="0.7" />
          <line x1="50" y1="14" x2="50" y2="20" stroke="rgba(255,255,255,0.11)" strokeWidth="0.7" />
          <line x1="62" y1="18" x2="57" y2="22" stroke="rgba(255,255,255,0.13)" strokeWidth="0.7" />

          {/* Hex vertex accent dots */}
          <circle cx="50" cy="9"  r="1.8" fill={eyeColor} fillOpacity="0.7" />
          <circle cx="83" cy="28" r="1.3" fill={eyeColor} fillOpacity="0.4" />
          <circle cx="83" cy="72" r="1.3" fill={eyeColor} fillOpacity="0.4" />
          <circle cx="50" cy="91" r="1.8" fill={eyeColor} fillOpacity="0.55" />
          <circle cx="17" cy="72" r="1.3" fill={eyeColor} fillOpacity="0.4" />
          <circle cx="17" cy="28" r="1.3" fill={eyeColor} fillOpacity="0.4" />

          {/* ── EYE SYSTEM ── */}

          {/* Searching scan ring — fades in, rotates */}
          <g style={{ ...vis(state === 'searching'), animation: state === 'searching' ? 'b-scan-ring 1.8s linear infinite' : 'none', transformOrigin: O }}>
            <circle cx="50" cy="50" r="23" fill="none"
              stroke={eyeColor} strokeWidth="0.9" strokeOpacity="0.5" strokeDasharray="4 6" />
          </g>

          {/* Analyzing rings — fade in, orbit in opposite directions */}
          <g style={vis(state === 'analyzing')}>
            <g style={{ animation: state === 'analyzing' ? 'b-ring-cw 3s linear infinite' : 'none', transformOrigin: O }}>
              <circle cx="50" cy="50" r="25" fill="none"
                stroke={eyeColor} strokeWidth="0.8" strokeOpacity="0.45" strokeDasharray="3 7" />
            </g>
            <g style={{ animation: state === 'analyzing' ? 'b-ring-ccw 2s linear infinite' : 'none', transformOrigin: O }}>
              <circle cx="50" cy="50" r="20" fill="none"
                stroke={eyeColor} strokeWidth="0.6" strokeOpacity="0.3" strokeDasharray="2 9" />
            </g>
          </g>

          {/* Eye group — base blink always running */}
          <g style={{ animation: 'b-base-blink 7s ease-in-out infinite', transformOrigin: O }}>

            {/* Searching eye scan — fades in on top of blink */}
            <g style={{ ...vis(state === 'searching'), animation: state === 'searching' ? 'b-eye-scan 2.4s ease-in-out infinite' : 'none', transformOrigin: O }}>
            </g>

            {/* Error eye narrow — fades in and holds */}
            <g style={{ ...vis(state === 'error'), animation: state === 'error' ? 'b-eye-narrow 1s ease-out forwards' : 'none', transformOrigin: O }}>
            </g>

            {/* Eye layers with drop-shadow filter */}
            <g style={{ filter: eyeFilter, transition: 'filter 0.6s ease' }}>

              {/* Socket */}
              <circle cx="50" cy="50" r="16"
                fill="#08090C"
                stroke={eyeColor} strokeWidth="1.4"
                strokeOpacity={isError ? 0.3 : isCoaching ? 0.75 : 0.5}
                style={{ transition: 'stroke-opacity 0.6s ease' }} />

              {/* Depth ring */}
              <circle cx="50" cy="50" r="11.5"
                fill="#060708"
                stroke={eyeColor} strokeWidth="0.8"
                strokeOpacity={isError ? 0.2 : isCoaching ? 0.5 : 0.35}
                style={{ transition: 'stroke-opacity 0.6s ease' }} />

              {/* Iris — analyzing contracts it, coaching expands it, error fades it */}
              <circle cx="50" cy="50" r="8"
                fill={eyeColor}
                fillOpacity={isError ? 0.08 : isCoaching ? 0.25 : 0.16}
                stroke={eyeColor} strokeWidth="1.1"
                strokeOpacity={isError ? 0.3 : isCoaching ? 1 : 0.85}
                style={{
                  transition: 'fill-opacity 0.6s ease, stroke-opacity 0.6s ease',
                  ...(state === 'analyzing' ? { animation: 'b-iris-contract 1.6s ease-in-out infinite', transformOrigin: O } : {}),
                  ...(state === 'coaching'  ? { animation: 'b-coach-iris 2.5s ease-in-out infinite', transformOrigin: O } : {}),
                }} />

              {/* Pupil */}
              <circle cx="50" cy="50" r="4.5"
                fill={eyeColor}
                fillOpacity={isError ? 0.4 : 1}
                style={{
                  transition: 'fill-opacity 0.6s ease',
                  animation: 'b-base-pupil 4s ease-in-out infinite',
                }} />

              {/* Inner core */}
              <circle cx="50" cy="50" r="2.2"
                fill="white"
                fillOpacity={isError ? 0.08 : isCoaching ? 0.65 : 0.5}
                style={{ transition: 'fill-opacity 0.6s ease' }} />

              {/* Primary specular */}
              <circle cx="53.8" cy="46.2" r="2"
                fill="white"
                fillOpacity={isError ? 0.06 : isCoaching ? 0.85 : 0.72}
                style={{ transition: 'fill-opacity 0.6s ease' }} />

              {/* Secondary specular */}
              <circle cx="45.5" cy="54.5" r="0.9"
                fill="white"
                fillOpacity={isError ? 0.03 : 0.28}
                style={{ transition: 'fill-opacity 0.6s ease' }} />

            </g>
          </g>

          {/* Success pulse ring — one shot */}
          {state === 'success' && (
            <circle cx="50" cy="50" r="10" fill="none"
              stroke="#FF5C1A" strokeWidth="2.5"
              style={{ animation: 'b-pulse-ring 0.9s ease-out forwards', transformOrigin: O }} />
          )}

        </g>{/* end base float */}
      </g>{/* end shadow filter */}
    </svg>
  )
}
