'use client'

import type { Stats } from '@/lib/advice'

export default function FieldZoneChart({ stats }: { stats: Stats }) {
  const zones = [
    { label: 'Attacking Third',  pct: stats.offensivePct,  color: '#f97316', desc: 'Time near opponent goal' },
    { label: 'Midfield',         pct: stats.neutralPct,    color: '#a855f7', desc: 'Time in neutral zone' },
    { label: 'Defensive Third',  pct: stats.defensivePct,  color: '#3b82f6', desc: 'Time near own goal' },
  ]

  // The field is 8192 x 10240 uu — we'll draw a simplified top-down view
  // Zones split the field into thirds along the Y axis
  const fieldW = 300
  const fieldH = 420
  const thirdH = fieldH / 3

  // Convert pct to opacity/intensity for the zone fill
  const maxPct = Math.max(...zones.map(z => z.pct))

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
        <span className="text-[11px] text-white/40 uppercase tracking-widest font-mono">Field Positioning</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center sm:items-start justify-center">
        {/* SVG Field */}
        <svg width={fieldW} height={fieldH} viewBox={`0 0 ${fieldW} ${fieldH}`} className="flex-shrink-0 w-full max-w-[300px] sm:w-[300px]">
          {/* Field background */}
          <rect x={0} y={0} width={fieldW} height={fieldH} rx={8} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

          {/* Zone fills - intensity based on time spent */}
          {zones.map((zone, i) => {
            const y = i * thirdH
            const intensity = zone.pct / maxPct
            const colors: Record<string, string> = {
              '#f97316': `rgba(249,115,22,${intensity * 0.35})`,
              '#a855f7': `rgba(168,85,247,${intensity * 0.35})`,
              '#3b82f6': `rgba(59,130,246,${intensity * 0.35})`,
            }
            return (
              <rect
                key={zone.label}
                x={1} y={y + 1}
                width={fieldW - 2}
                height={thirdH - 2}
                rx={i === 0 ? 7 : i === 2 ? 0 : 0}
                fill={colors[zone.color]}
              />
            )
          })}

          {/* Zone divider lines */}
          <line x1={0} y1={thirdH} x2={fieldW} y2={thirdH} stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeDasharray="4 4" />
          <line x1={0} y1={thirdH * 2} x2={fieldW} y2={thirdH * 2} stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeDasharray="4 4" />

          {/* Center line */}
          <line x1={20} y1={fieldH / 2} x2={fieldW - 20} y2={fieldH / 2} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />

          {/* Center circle */}
          <circle cx={fieldW / 2} cy={fieldH / 2} r={40} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

          {/* Opponent goal (top) */}
          <rect x={fieldW / 2 - 35} y={0} width={70} height={12} rx={2} fill="rgba(249,115,22,0.3)" stroke="rgba(249,115,22,0.5)" strokeWidth={1} />

          {/* Own goal (bottom) */}
          <rect x={fieldW / 2 - 35} y={fieldH - 12} width={70} height={12} rx={2} fill="rgba(59,130,246,0.3)" stroke="rgba(59,130,246,0.5)" strokeWidth={1} />

          {/* Boost pads — big ones */}
          {[
            [60, 70], [fieldW - 60, 70],
            [60, fieldH - 70], [fieldW - 60, fieldH - 70],
            [60, fieldH / 2], [fieldW - 60, fieldH / 2],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={5} fill="rgba(251,191,36,0.5)" stroke="rgba(251,191,36,0.8)" strokeWidth={1} />
          ))}

          {/* Percentage labels on zones */}
          {zones.map((zone, i) => {
            const y = i * thirdH + thirdH / 2
            return (
              <text
                key={zone.label}
                x={fieldW / 2}
                y={y + 5}
                textAnchor="middle"
                fill="rgba(255,255,255,0.7)"
                fontSize={18}
                fontWeight={600}
                fontFamily="DM Sans, sans-serif"
              >
                {zone.pct.toFixed(0)}%
              </text>
            )
          })}

          {/* Direction labels */}
          <text x={fieldW / 2} y={22} textAnchor="middle" fill="rgba(249,115,22,0.7)" fontSize={9} fontFamily="DM Mono, monospace" letterSpacing={2}>ATTACK</text>
          <text x={fieldW / 2} y={fieldH - 4} textAnchor="middle" fill="rgba(59,130,246,0.7)" fontSize={9} fontFamily="DM Mono, monospace" letterSpacing={2}>DEFEND</text>
        </svg>

        {/* Legend */}
        <div className="flex flex-row sm:flex-col gap-4 sm:gap-4 sm:pt-2 flex-wrap justify-center sm:justify-start">
          {zones.map(zone => (
            <div key={zone.label} className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: zone.color }} />
                <span className="text-xs text-white/40 font-mono uppercase tracking-wider whitespace-nowrap">{zone.label}</span>
              </div>
              <p className="text-2xl font-semibold tracking-tight pl-4" style={{ color: zone.color }}>
                {zone.pct.toFixed(1)}%
              </p>
              <p className="text-xs text-white/25 pl-4 max-w-[120px] leading-relaxed">{zone.desc}</p>

              {/* Mini bar */}
              <div className="pl-4 w-32 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${zone.pct}%`, background: zone.color, opacity: 0.7 }}
                />
              </div>
            </div>
          ))}

          <div className="pt-2 border-t border-white/[0.06]">
            <p className="text-[10px] text-white/20 font-mono uppercase tracking-wider">Yellow = boost pads</p>
          </div>
        </div>
      </div>
    </div>
  )
}
