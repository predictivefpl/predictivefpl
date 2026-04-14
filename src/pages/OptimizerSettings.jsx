import { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'
import Sidebar from '../components/Sidebar'

const getLS = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback }
  catch { return fallback }
}

const ENGINE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : 'https://web-production-21545.up.railway.app'

export default function OptimizerSettings() {
  const { user } = useUser()
  const [strategy, setStrategy]     = useState(getLS('opt_strategy', 'balanced'))
  const [transfers, setTransfers]   = useState(getLS('opt_transfers', 1))
  const [activeChip, setActiveChip] = useState(getLS('opt_activechip', null))
  const [horizon, setHorizon]       = useState(getLS('opt_horizon', 3))
  const [objective, setObjective]   = useState(getLS('opt_objective', 'total_points'))
  const [running, setRunning]       = useState(false)
  const [results, setResults]       = useState(null)
  const [originalSquad, setOriginalSquad] = useState([])
  const [photoMap, setPhotoMap]     = useState({})
  const [error, setError]           = useState('')
  const teamId = user?.unsafeMetadata?.fplTeamId || localStorage.getItem('fplTeamId')

  useEffect(() => {
    localStorage.setItem('opt_strategy',   JSON.stringify(strategy))
    localStorage.setItem('opt_transfers',  JSON.stringify(transfers))
    localStorage.setItem('opt_activechip', JSON.stringify(activeChip))
    localStorage.setItem('opt_horizon',    JSON.stringify(horizon))
    localStorage.setItem('opt_objective',  JSON.stringify(objective))
  }, [strategy, transfers, activeChip, horizon, objective])

  const runOptimiser = async () => {
    if (!teamId) { setError('No FPL Team ID found.'); return }
    setRunning(true); setError(''); setResults(null)
    try {
      const isLocal = window.location.hostname === 'localhost'
      const fplUrl  = (path) => isLocal ? '/fpl' + path : '/api/fpl?path=' + encodeURIComponent(path)
      const bootstrap = await fetch(fplUrl('/bootstrap-static/')).then(r => r.json())
      const pMap = {}
      ;(bootstrap.elements || []).forEach(el => { if (el.photo) pMap[el.id] = el.photo.replace('.jpg','') })
      setPhotoMap(pMap)
      const events = bootstrap.events || []
      const cur = events.find(e => e.is_current) || events.find(e => e.is_next) || events[events.length-1]
      const gw  = cur?.id || 1
      const picks = await fetch(fplUrl('/entry/' + teamId + '/event/' + gw + '/picks/')).then(r => r.json())
      const squadIds = picks.picks.map(p => p.element)
      const bank      = picks.entry_history.bank / 10
      const teamValue = picks.entry_history.value / 10
      const payload = {
        budget: teamValue + bank,
        num_transfers: activeChip ? 15 : transfers,
        current_squad_ids: squadIds,
        chip: activeChip,
        objective,
        horizon_gws: horizon,
      }
      const res = await fetch(ENGINE_URL + '/api/optimise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Engine returned ' + res.status)
      setOriginalSquad(squadIds)
      setResults(await res.json())
    } catch (e) { setError('Optimiser failed: ' + e.message) }
    setRunning(false)
  }

  const renderChipAdvice = () => {
    const chips = [
      {
        id: 'wildcard',
        icon: 'fa-wand-magic-sparkles',
        color: '#3b82f6',
        label: 'Wildcard',
        abbr: 'WC',
        algorithm: (gw) => {
          // Best: GW1-8 (early restructure), GW20-28 (mid-season reset), or after injury crisis
          // Avoid: final 5 GWs (too late), BGW/DGW unknown
          if (gw <= 8)  return { score: 90, reason: 'Early season — ideal to build an optimal template squad from scratch.' }
          if (gw >= 20 && gw <= 28) return { score: 85, reason: 'Mid-season reset window. Strong DGW fixtures typically occur here.' }
          if (gw >= 29 && gw <= 33) return { score: 70, reason: 'Acceptable — use before a Double Gameweek to maximise returns.' }
          if (gw >= 34) return { score: 30, reason: 'Late season — limited GWs remaining to benefit from a full restructure.' }
          return { score: 60, reason: 'Neutral window. Consider saving for a Double Gameweek.' }
        }
      },
      {
        id: 'freehit',
        icon: 'fa-bolt',
        color: '#10b981',
        label: 'Free Hit',
        abbr: 'FH',
        algorithm: (gw) => {
          // Best: Blank Gameweeks (typically GW16, GW19, FA Cup rounds)
          // Common BGW windows: GW16-17, GW19, GW28-30
          if (gw === 16 || gw === 17 || gw === 19) return { score: 95, reason: 'Classic Blank Gameweek window. Free Hit lets you field a full 11 from playing teams.' }
          if (gw >= 28 && gw <= 30) return { score: 88, reason: 'FA Cup / international break blanks common here. Ideal Free Hit window.' }
          if (gw >= 34 && gw <= 37) return { score: 75, reason: 'End-of-season blanks likely. Good time if 5+ teams are without a fixture.' }
          return { score: 40, reason: 'Save for a confirmed Blank Gameweek when 5+ teams do not play.' }
        }
      },
      {
        id: 'benchboost',
        icon: 'fa-chair',
        color: '#f59e0b',
        label: 'Bench Boost',
        abbr: 'BB',
        algorithm: (gw) => {
          // Best: Double Gameweeks when bench players have 2 fixtures
          // Requires strong bench — plan ahead by loading bench with DGW players
          if (gw >= 29 && gw <= 36) return { score: 92, reason: 'Peak Double Gameweek territory. Use when your bench has 2 fixtures each — potential 30+ extra points.' }
          if (gw >= 20 && gw <= 28) return { score: 75, reason: 'Early DGWs possible. Only use if bench has confirmed double fixtures.' }
          return { score: 35, reason: 'Save for a Double Gameweek. Load your bench with DGW assets first for maximum gain.' }
        }
      },
      {
        id: 'triplecaptain',
        icon: 'fa-crown',
        color: '#a855f7',
        label: 'Triple Captain',
        abbr: 'TC',
        algorithm: (gw) => {
          // Best: DGW with premium captain (Salah, Haaland, Son) having 2 home fixtures
          if (gw >= 29 && gw <= 36) return { score: 90, reason: 'Prime DGW window. Triple a premium asset (Haaland/Salah) with 2 home fixtures for 40+ point potential.' }
          if (gw >= 20 && gw <= 28) return { score: 72, reason: 'Viable if your captain has a confirmed double. Check fixture difficulty first.' }
          if (gw <= 8) return { score: 45, reason: 'Too early — save for a guaranteed Double Gameweek with a premium captain.' }
          return { score: 50, reason: 'Only play on a Double Gameweek when your captain has 2 favourable fixtures.' }
        }
      },
    ]

    const gw = 32 // TODO: use live GW from engine status

    return (
      <div className="glass-card rounded-2xl p-6 border border-gray-700/50 mb-6">
        <h2 className="text-base font-bold mb-1 flex items-center gap-2">
          <i className="fa-solid fa-lightbulb text-yellow-400"/> Chip Timing Advisor
        </h2>
        <p className="text-gray-400 text-sm mb-5">AI-powered suggestions on when to play each chip based on current gameweek patterns.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {chips.map(chip => {
            const { score, reason } = chip.algorithm(gw)
            const barColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'
            const label = score >= 80 ? 'Play Soon' : score >= 60 ? 'Consider' : 'Hold'
            return (
              <div key={chip.id} className="bg-[#0F121D]/60 rounded-xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background: chip.color + '22', border: '1px solid ' + chip.color + '44'}}>
                      <i className={'fa-solid ' + chip.icon} style={{color: chip.color, fontSize: 13}}/>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{chip.label}</p>
                      <p className="text-[10px] font-bold uppercase" style={{color: barColor}}>{label}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black" style={{color: barColor}}>{score}</p>
                    <p className="text-[10px] text-gray-500">/ 100</p>
                  </div>
                </div>
                {/* Score bar */}
                <div className="h-1.5 rounded-full bg-white/5 mb-3 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{width: score + '%', background: barColor}}/>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">{reason}</p>
              </div>
            )
          })}
        </div>
        <p className="text-[10px] text-gray-600 mt-4">* Scores based on historical FPL patterns. Always check official fixture announcements before playing a chip.</p>
      </div>
    )
  }

    const renderStats = () => {
    if (!results || results.total_xp == null) return null
    const ts  = results.transfers || []
    const outs = ts.filter(t => t.action === 'out')
    const ins  = ts.filter(t => t.action === 'in')
    const sqMap = {}
    ;(results.squad || []).forEach(p => { sqMap[p.player_id] = p })
    const gain = outs.reduce((acc, out, i) => {
      const tin = ins[i]
      return acc + ((sqMap[tin?.player_id]?.xp_gw1 || tin?.xp_gw1 || 0) - (sqMap[out.player_id]?.xp_gw1 || 0))
    }, 0)
    return (
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-[#0F121D]/60 rounded-xl p-3 border border-green-400/20 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-400/10 flex items-center justify-center flex-shrink-0">
            <i className="fa-solid fa-arrow-trend-up text-green-400"/>
          </div>
          <div>
            <p className="text-xs text-gray-400">xP Gain This GW</p>
            <p className={'text-lg font-black ' + (gain >= 0 ? 'text-green-400' : 'text-red-400')}>
              {gain >= 0 ? '+' : ''}{gain.toFixed(1)} pts
            </p>
          </div>
        </div>
        <div className="bg-[#0F121D]/60 rounded-xl p-3 border border-blue-400/20 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-400/10 flex items-center justify-center flex-shrink-0">
            <i className="fa-solid fa-star text-blue-400"/>
          </div>
          <div>
            <p className="text-xs text-gray-400">Total Squad xP</p>
            <p className="text-lg font-black text-blue-400">{Number(results.total_xp).toFixed(1)} pts</p>
          </div>
        </div>
      </div>
    )
  }

  const renderTransfers = () => {
    if (!results) return null
    const ts   = results.transfers || []
    const outs = ts.filter(t => t.action === 'out')
    const ins  = ts.filter(t => t.action === 'in')
    if (outs.length === 0) return <p className="text-gray-400 text-sm mb-4">No transfers needed — squad is already optimal!</p>
    const sqMap = {}
    ;(results.squad || []).forEach(p => { sqMap[p.player_id] = p })
    return (
      <div className="space-y-3 mb-6">
        {outs.map((out, i) => {
          const tin    = ins[i]
          const outXp  = sqMap[out.player_id]?.xp_gw1 || 0
          const inXp   = sqMap[tin?.player_id]?.xp_gw1 || tin?.xp_gw1 || 0
          const diff   = inXp - outXp
          return (
            <div key={i} className="flex items-center gap-3 p-4 bg-[#0F121D]/80 rounded-xl border border-gray-700/50">
              <div className="flex-1 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-arrow-up text-red-400 text-xs"/>
                </div>
                <div>
                  <p className="font-bold text-red-400">{out.name}</p>
                  <p className="text-xs text-gray-500">OUT · £{Number(out.price).toFixed(1)}m{outXp ? ' · ' + outXp.toFixed(1) + ' xP' : ''}</p>
                </div>
              </div>
              <div className="flex flex-col items-center flex-shrink-0 px-1">
                <i className="fa-solid fa-right-left text-gray-500 text-sm"/>
                {diff !== 0 && (
                  <span className={'text-[10px] font-bold mt-1 ' + (diff > 0 ? 'text-green-400' : 'text-red-400')}>
                    {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                  </span>
                )}
              </div>
              <div className="flex-1 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-arrow-down text-green-400 text-xs"/>
                </div>
                <div>
                  <p className="font-bold text-green-400">{tin ? tin.name : '—'}</p>
                  <p className="text-xs text-gray-500">IN · £{tin ? Number(tin.price).toFixed(1) : '?'}m{inXp ? ' · ' + inXp.toFixed(1) + ' xP' : ''}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderSquad = () => {
    if (!results) return null
    const squad    = results.squad || []
    const starters = squad.filter(p => p.is_starter !== false).slice(0, 11)
    const bench    = squad.filter(p => p.is_starter === false).slice(0, 4)
    if (starters.length === 0) return null
    const newIds   = new Set(squad.filter(p => !originalSquad.includes(p.player_id)).map(p => p.player_id))
    const rows     = ['GKP','DEF','MID','FWD'].map(pos => starters.filter(p => p.position === pos))
    const posColor = { GKP:'#f59e0b', DEF:'#10b981', MID:'#3b82f6', FWD:'#ef4444' }

    const PlayerToken = ({ p }) => {
      const isNew   = newIds.has(p.player_id)
      const photo   = photoMap[p.player_id]
      const imgUrl  = photo ? 'https://resources.premierleague.com/premierleague/photos/players/110x140/p' + photo + '.png' : null
      const col     = posColor[p.position] || '#6b7280'
      const surname = p.name.includes('.') ? p.name.split('.').pop()?.trim() : p.name.split(' ').pop()
      return (
        <div className="flex flex-col items-center gap-1" style={{minWidth:68}}>
          <div className="relative" style={{width:62,height:62}}>
            {isNew && (
              <div className="absolute inset-0 rounded-full" style={{background:'radial-gradient(circle, ' + col + '44 0%, transparent 70%)', transform:'scale(1.4)'}}/>
            )}
            <div className="w-full h-full rounded-full overflow-hidden border-2 flex items-center justify-center"
              style={{
                borderColor: isNew ? col : 'rgba(255,255,255,0.25)',
                background: 'linear-gradient(135deg, ' + col + '22, ' + col + '44)',
                boxShadow: isNew ? '0 0 14px ' + col + '99' : '0 2px 10px rgba(0,0,0,0.6)'
              }}>
              {imgUrl
                ? <img src={imgUrl} alt={p.name} className="w-full h-full object-cover object-top" style={{transform:'scale(1.15) translateY(5px)'}} onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }}/>
                : null
              }
              <div className="w-full h-full flex items-center justify-center" style={{display: imgUrl ? 'none' : 'flex'}}>
                <i className="fa-solid fa-person text-white/50 text-xl"/>
              </div>
            </div>
            {p.is_captain && (
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-black text-[10px] font-black z-10"
                style={{background:'linear-gradient(135deg,#facc15,#f59e0b)',boxShadow:'0 1px 4px rgba(0,0,0,0.5)'}}>C</div>
            )}
            {isNew && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-black z-10"
                style={{background:col,boxShadow:'0 1px 4px ' + col + '88'}}>N</div>
            )}
          </div>
          <div className="px-2 py-0.5 rounded-md text-center" style={{
            background: isNew ? col + '28' : 'rgba(0,0,0,0.55)',
            border: '1px solid ' + (isNew ? col + '55' : 'rgba(255,255,255,0.1)'),
            backdropFilter: 'blur(4px)', maxWidth:76
          }}>
            <p className="font-bold text-white leading-tight" style={{fontSize:10,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{surname}</p>
            {p.xp_gw1 != null && <p style={{fontSize:9, color: isNew ? col : '#9ca3af'}}>{p.xp_gw1.toFixed(1)} xP</p>}
          </div>
        </div>
      )
    }

    return (
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Recommended Starting XI</h3>
          {newIds.size > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{background:'rgba(16,185,129,0.15)',border:'1px solid rgba(16,185,129,0.3)',color:'#10b981'}}>
              N = New Transfer
            </span>
          )}
        </div>
        <div className="relative rounded-2xl overflow-hidden" style={{
          background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',
          backdropFilter:'blur(12px)',boxShadow:'0 8px 32px rgba(0,0,0,0.4)'
        }}>
          <div className="absolute inset-0" style={{
            backgroundImage:'linear-gradient(180deg,rgba(16,100,40,0.85) 0%,rgba(20,120,50,0.85) 25%,rgba(16,100,40,0.85) 50%,rgba(20,120,50,0.85) 75%,rgba(16,100,40,0.85) 100%)',
            backgroundSize:'100% 20%'
          }}/>
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 520" preserveAspectRatio="none" style={{opacity:0.2}}>
            <rect x="10" y="10" width="380" height="500" fill="none" stroke="white" strokeWidth="2"/>
            <circle cx="200" cy="260" r="50" fill="none" stroke="white" strokeWidth="1.5"/>
            <line x1="10" y1="260" x2="390" y2="260" stroke="white" strokeWidth="1.5"/>
            <rect x="100" y="10"  width="200" height="80" fill="none" stroke="white" strokeWidth="1.5"/>
            <rect x="145" y="10"  width="110" height="40" fill="none" stroke="white" strokeWidth="1.5"/>
            <rect x="100" y="430" width="200" height="80" fill="none" stroke="white" strokeWidth="1.5"/>
            <rect x="145" y="470" width="110" height="40" fill="none" stroke="white" strokeWidth="1.5"/>
            <circle cx="200" cy="260" r="3" fill="white"/>
          </svg>
          <div className="relative z-10 p-4 pt-6 pb-4 space-y-5">
            {rows.map((row, ri) => row.length > 0 && (
              <div key={ri} className="flex justify-around w-full px-2">
                {row.map((p, pi) => <PlayerToken key={pi} p={p}/>)}
              </div>
            ))}
          </div>
          {bench.length > 0 && (
            <div className="relative z-10 mx-4 mb-4 rounded-xl p-3" style={{
              background:'rgba(0,0,0,0.35)',border:'1px solid rgba(255,255,255,0.1)',backdropFilter:'blur(8px)'
            }}>
              <p className="text-[10px] text-gray-400 text-center mb-3 uppercase tracking-widest">Bench</p>
              <div className="flex justify-around w-full px-4">
                {bench.map((p, i) => <PlayerToken key={i} p={p}/>)}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const strategies = [
    { key:'conservative', label:'Conservative', desc:'Focus on high ownership & established performers.' },
    { key:'balanced',     label:'Balanced',     desc:'Mix of reliable points and calculated differentials.' },
    { key:'aggressive',   label:'Aggressive',   desc:'High variance, chasing massive hauls and low ownership.' },
  ]
  const objectives = [
    { key:'total_points', label:'Maximize Total Points' },
    { key:'team_value',   label:'Maximize Team Value' },
    { key:'top_10k',      label:'Target Top 10k Rank' },
    { key:'mini_league',  label:'Beat My Mini-League' },
  ]
  const chips = [
    { key:'wildcard', label:'Wildcard', abbr:'WC' },
    { key:'freehit',  label:'Free Hit',  abbr:'FH' },
  ]

  return (
    <div className="min-h-screen bg-[#0F121D] bg-grid flex text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-8 py-4 border-b border-gray-800/50">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-robot text-green-400 text-xl"/>
            <span className="text-xl font-bold text-green-400">PredictorAI</span>
          </div>
        </div>
        <main className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full">
          {renderChipAdvice()}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="glass-card rounded-2xl p-6 border border-gray-700/50 md:col-span-2">
              <h2 className="text-base font-bold mb-1 flex items-center gap-2"><i className="fa-solid fa-seedling text-green-400"/> Optimization Strategy</h2>
              <p className="text-gray-400 text-sm mb-4">Select the risk profile for the AI recommendations.</p>
              <div className="grid grid-cols-3 gap-4">
                {strategies.map(s => (
                  <button key={s.key} onClick={() => setStrategy(s.key)}
                    className={'p-4 rounded-xl border text-left transition-all ' + (strategy===s.key ? 'border-green-400 bg-green-400/10' : 'border-gray-700/50 bg-white/5 hover:border-gray-500')}>
                    <p className="font-bold text-white mb-1">{s.label}</p>
                    <p className="text-xs text-gray-400">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="glass-card rounded-2xl p-6 border border-gray-700/50">
              <h2 className="text-base font-bold mb-1 flex items-center gap-2"><i className="fa-solid fa-right-left text-green-400"/> Planned Transfers</h2>
              <p className="text-gray-400 text-sm mb-5">How many transfers per Gameweek?</p>
              <div className="flex gap-3">
                {[0,1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setTransfers(n)}
                    className={'w-10 h-10 rounded-full font-bold text-sm transition-all border ' + (transfers===n&&!activeChip ? 'border-green-400 text-green-400 bg-green-400/10' : 'border-gray-700 text-gray-400 hover:border-gray-500')}>
                    {n}
                  </button>
                ))}
              </div>
              {activeChip && <p className="text-xs text-green-400 mt-3"><i className="fa-solid fa-info-circle mr-1"/>{activeChip==='wildcard'?'Wildcard':'Free Hit'} overrides transfer count</p>}
            </div>
            <div className="glass-card rounded-2xl p-6 border border-gray-700/50">
              <h2 className="text-base font-bold mb-1 flex items-center gap-2"><i className="fa-solid fa-microchip text-green-400"/> Active Chips</h2>
              <p className="text-gray-400 text-sm mb-5">Only one chip can be active at a time.</p>
              <div className="space-y-3">
                {chips.map(chip => (
                  <div key={chip.key} className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-400/10 text-green-400 border border-green-400/20">{chip.abbr}</span>
                      <span className="text-sm text-white font-medium">{chip.label}</span>
                    </div>
                    <button onClick={() => setActiveChip(activeChip===chip.key ? null : chip.key)}
                      className={'w-12 h-6 rounded-full relative transition-colors duration-200 ' + (activeChip===chip.key ? 'bg-green-400' : 'bg-gray-700')}>
                      <div className={'w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all duration-200 ' + (activeChip===chip.key ? 'right-0.5' : 'left-0.5')}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card rounded-2xl p-6 border border-gray-700/50">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-bold flex items-center gap-2"><i className="fa-solid fa-calendar text-green-400"/> Planning Horizon</h2>
                <span className="text-green-400 font-bold text-sm">{horizon} GWs</span>
              </div>
              <p className="text-gray-400 text-sm mb-5">How far ahead should the AI look?</p>
              <input type="range" min="1" max="8" value={horizon} onChange={e => setHorizon(Number(e.target.value))} className="w-full accent-green-400"/>
              <div className="flex justify-between text-xs text-gray-500 mt-1">{[1,2,3,4,5,6,7,8].map(n => <span key={n}>{n}</span>)}</div>
            </div>
            <div className="glass-card rounded-2xl p-6 border border-gray-700/50">
              <h2 className="text-base font-bold mb-1 flex items-center gap-2"><i className="fa-solid fa-bullseye text-green-400"/> Optimization Objective</h2>
              <p className="text-gray-400 text-sm mb-4">What is the primary goal?</p>
              <div className="space-y-2">
                {objectives.map(o => (
                  <button key={o.key} onClick={() => setObjective(o.key)}
                    className={'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ' + (objective===o.key ? 'border-green-400 bg-green-400/10 text-white' : 'border-gray-700 bg-white/5 text-gray-400 hover:border-gray-500')}>
                    <div className={'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ' + (objective===o.key ? 'border-green-400' : 'border-gray-600')}>
                      {objective===o.key && <div className="w-2 h-2 rounded-full bg-green-400"/>}
                    </div>
                    <span className="text-sm font-medium">{o.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="glass-card rounded-2xl p-6 border border-gray-700/50 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="font-bold text-white mb-1">Ready to Optimize</p>
                <p className="text-sm text-gray-400">
                  {activeChip ? (activeChip==='wildcard' ? 'Wildcard' : 'Free Hit') + ' chip' : transfers + ' transfer' + (transfers!==1 ? 's' : '')}
                  {' \u2022 '}{strategies.find(s => s.key===strategy)?.label}
                  {' \u2022 '}{horizon} GW horizon
                </p>
              </div>
              <button onClick={runOptimiser} disabled={running}
                className="bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl px-8 py-3 font-bold text-sm flex items-center gap-2 text-black transition-colors">
                {running ? <><i className="fa-solid fa-spinner fa-spin"/> Running AI...</> : <><i className="fa-solid fa-play"/> Save Configuration &amp; Run Optimizer</>}
              </button>
            </div>
            {error && <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm"><i className="fa-solid fa-triangle-exclamation mr-2"/>{error}</div>}
          </div>
          {results && (
            <div className="glass-card rounded-2xl p-6 border border-green-500/30">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <i className="fa-solid fa-robot text-green-400"/> AI Transfer Recommendations
              </h2>
              {renderStats()}
              {renderTransfers()}
              {renderSquad()}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
