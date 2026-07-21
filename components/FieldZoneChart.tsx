'use client'

import type { Stats } from '@/lib/advice'

export default function FieldZoneChart({ stats }: { stats: Stats }) {
  const zones = [
    { label: 'Attacking',  pct: stats.offensivePct, color: '#FF5C1A', desc: 'Time in offensive third' },
    { label: 'Midfield',   pct: stats.neutralPct,   color: '#F5A623', desc: 'Time in neutral zone'    },
    { label: 'Defending',  pct: stats.defensivePct, color: '#3B8BF5', desc: 'Time in defensive third' },
  ]
  const maxPct = Math.max(...zones.map(z => z.pct))
  const W = 280, H = 400, T = H / 3

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
        <div style={{ width: '4px', height: '14px', borderRadius: '2px', background: '#22C97A' }} />
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Field Positioning</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        {/* SVG field */}
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: `${W}px` }}>
          {/* Field bg */}
          <rect x={0} y={0} width={W} height={H} rx={10} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.07)" strokeWidth={1} />

          {/* Zone fills */}
          {zones.map((zone, i) => {
            const intensity = zone.pct / maxPct
            const hex = zone.color
            return (
              <rect key={i} x={1} y={i * T + 1} width={W - 2} height={T - 2}
                rx={i === 0 ? 9 : 0}
                fill={hex} fillOpacity={intensity * 0.22}
              />
            )
          })}

          {/* Zone dividers */}
          <line x1={0} y1={T}     x2={W} y2={T}     stroke="rgba(255,255,255,0.07)" strokeWidth={1} strokeDasharray="4 4" />
          <line x1={0} y1={T * 2} x2={W} y2={T * 2} stroke="rgba(255,255,255,0.07)" strokeWidth={1} strokeDasharray="4 4" />

          {/* Center line */}
          <line x1={20} y1={H / 2} x2={W - 20} y2={H / 2} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
          {/* Center circle */}
          <circle cx={W / 2} cy={H / 2} r={36} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={1} />

          {/* Goals */}
          <rect x={W / 2 - 32} y={0}      width={64} height={11} rx={2} fill="rgba(255,92,26,0.25)"  stroke="rgba(255,92,26,0.5)"  strokeWidth={1} />
          <rect x={W / 2 - 32} y={H - 11} width={64} height={11} rx={2} fill="rgba(59,139,245,0.25)" stroke="rgba(59,139,245,0.5)" strokeWidth={1} />

          {/* Boost pads */}
          {[[55,65],[W-55,65],[55,H-65],[W-55,H-65],[55,H/2],[W-55,H/2]].map(([x,y],i) => (
            <circle key={i} cx={x} cy={y} r={5} fill="rgba(245,166,35,0.5)" stroke="rgba(245,166,35,0.8)" strokeWidth={1} />
          ))}

          {/* Pct labels */}
          {zones.map((zone, i) => (
            <text key={i} x={W / 2} y={i * T + T / 2 + 7} textAnchor="middle"
              fill="rgba(232,235,240,0.75)" fontSize={20} fontWeight={700} fontFamily="system-ui">
              {zone.pct.toFixed(0)}%
            </text>
          ))}

          {/* Direction labels */}
          <text x={W / 2} y={20} textAnchor="middle" fill="rgba(255,92,26,0.6)"  fontSize={8} fontFamily="monospace" letterSpacing={3}>ATTACK</text>
          <text x={W / 2} y={H - 4} textAnchor="middle" fill="rgba(59,139,245,0.6)" fontSize={8} fontFamily="monospace" letterSpacing={3}>DEFEND</text>
        </svg>

        {/* Legend row */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {zones.map(zone => (
            <div key={zone.label} style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center', marginBottom: '2px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: zone.color }} />
                <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{zone.label}</span>
              </div>
              <p style={{ fontSize: '1.1rem', fontWeight: 700, color: zone.color }}>{zone.pct.toFixed(1)}%</p>
              <p style={{ fontSize: '10px', color: 'var(--muted)' }}>{zone.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
