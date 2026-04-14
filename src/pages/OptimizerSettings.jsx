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
  const [strategy, setStrategy] = useState(getLS('opt_strategy', 'balanced'))
  const [transfers, setTransfers] = useState(getLS('opt_transfers', 1))
  const [activeChip, setActiveChip] = useState(getLS('opt_activechip', null))
  const [horizon, setHorizon] = useState(getLS('opt_horizon', 3))
  const [objective, setObjective] = useState(getLS('opt_objective', 'total_points'))
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState(null)
  const [originalSquad, setOriginalSquad] = useState([])
  const [error, setError] = useState('')
  const teamId = user?.unsafeMetadata?.fplTeamId || localStorage.getItem('fplTeamId')

  useEffect(() => {
    localStorage.setItem('opt_strategy', JSON.stringify(strategy))
    localStorage.setItem('opt_transfers', JSON.stringify(transfers))
    localStorage.setItem('opt_activechip', JSON.stringify(activeChip))
    localStorage.setItem('opt_horizon', JSON.stringify(horizon))
    localStorage.setItem('opt_objective', JSON.stringify(objective))
  }, [strategy, transfers, activeChip, horizon, objective])

  const runOptimiser = async () => {
    if (!teamId) { setError('No FPL Team ID found.'); return }
    setRunning(true); setError(''); setResults(null)
    try {
      const isLocal = window.location.hostname === 'localhost'
      const fplUrl = (path) => isLocal ? '/fpl' + path : '/api/fpl?path=' + encodeURIComponent(path)
      const bootstrap = await fetch(fplUrl('/bootstrap-static/')).then(r => r.json())
      const events = bootstrap.events || []
      const currentEvent = events.find(e => e.is_current) || events.find(e => e.is_next) || events[events.length - 1]
      const gw = currentEvent?.id || 1
      const picks = await fetch(fplUrl('/entry/' + teamId + '/event/' + gw + '/picks/')).then(r => r.json())
      const squadIds = picks.picks.map(p => p.element)
      const bank = picks.entry_history.bank / 10
      const teamValue = picks.entry_history.value / 10
      const payload = {
        budget: teamValue + bank,
        num_transfers: activeChip ? 15 : transfers,
        current_squad_ids: squadIds,
        chip: activeChip,
        objective: objective,
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

  const renderStats = () => {
    if (!results || results.total_xp == null) return null
    const ts = results.transfers || []
    const outs = ts.filter(t => t.action === 'out')
    const ins  = ts.filter(t => t.action === 'in')
    const squadMap = {}
    ;(results.squad || []).forEach(p => { squadMap[p.player_id] = p })
    const totalGain = outs.reduce((acc, out, i) => {
      const tin = ins[i]
      const outXp = squadMap[out.player_id]?.xp_gw1 || 0
      const inXp  = tin ? (squadMap[tin.player_id]?.xp_gw1 || tin.xp_gw1 || 0) : 0
      return acc + (inXp - outXp)
    }, 0)
    return (
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-[#0F121D]/60 rounded-xl p-3 border border-green-400/20 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-400/10 flex items-center justify-center flex-shrink-0">
            <i className="fa-solid fa-arrow-trend-up text-green-400"/>
          </div>
          <div>
            <p className="text-xs text-gray-400">xP Gain This GW</p>
            <p className={`text-lg font-black ${totalGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalGain >= 0 ? '+' : ''}{totalGain.toFixed(1)} pts
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
    const ts = results.transfers || []
    const outs = ts.filter(t => t.action === 'out')
    const ins  = ts.filter(t => t.action === 'in')
    if (outs.length === 0) {
      return <p className="text-gray-400 text-sm mb-4">No transfers needed — squad is already optimal!</p>
    }
    // xP gain: sum of xp_gw1 for players IN minus xp_gw1 for players OUT (using squad data)
    const squadMap = {}
    ;(results.squad || []).forEach(p => { squadMap[p.player_id] = p })
    const totalGain = outs.reduce((acc, out, i) => {
      const tin = ins[i]
      const outXp = squadMap[out.player_id]?.xp_gw1 || 0
      const inXp  = tin ? (squadMap[tin.player_id]?.xp_gw1 || tin.xp_gw1 || 0) : 0
      return acc + (inXp - outXp)
    }, 0)
    return (
      <div className="mb-6">
        {totalGain !== 0 && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-green-400/5 border border-green-400/20">
            <i className="fa-solid fa-chart-line text-green-400"/>
            <span className="text-sm text-gray-300">Projected xP change this GW:</span>
            <span className={`text-sm font-bold ${totalGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalGain >= 0 ? '+' : ''}{totalGain.toFixed(1)} pts
            </span>
          </div>
        )}
        <div className="space-y-3">
          {outs.map((out, i) => {
            const tin   = ins[i]
            const outXp = squadMap[out.player_id]?.xp_gw1 || 0
            const inXp  = tin ? (squadMap[tin.player_id]?.xp_gw1 || tin.xp_gw1 || 0) : 0
            const diff  = inXp - outXp
            return (
              <div key={i} className="flex items-center gap-3 p-4 bg-[#0F121D]/80 rounded-xl border border-gray-700/50">
                <div className="flex-1 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-arrow-up text-red-400 text-xs"/>
                  </div>
                  <div>
                    <p className="font-bold text-red-400">{out.name}</p>
                    <p className="text-xs text-gray-500">OUT · £{Number(out.price).toFixed(1)}m{outXp ? ` · ${outXp.toFixed(1)} xP` : ''}</p>
                  </div>
                </div>
                <div className="flex flex-col items-center flex-shrink-0 px-1">
                  <i className="fa-solid fa-right-left text-gray-500 text-sm"/>
                  {diff !== 0 && (
                    <span className={`text-[10px] font-bold mt-1 ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
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
                    <p className="text-xs text-gray-500">IN · £{tin ? Number(tin.price).toFixed(1) : '?'}m{inXp ? ` · ${inXp.toFixed(1)} xP` : ''}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

    const renderSquad = () => {
    if (!results) return null
    const squad = results.squad || []
    const starters = squad.filter(p => p.is_starter !== false).slice(0, 11)
    const bench    = squad.filter(p => p.is_starter === false).slice(0, 4)
    if (starters.length === 0) return null
    const newIds = new Set(squad.filter(p => !originalSquad.includes(p.player_id)).map(p => p.player_id))
    const posOrder = ['GKP', 'DEF', 'MID', 'FWD']
    const rows = posOrder.map(pos => starters.filter(p => p.position === pos))

    const PlayerCard = ({ p }) => {
      const isNew = newIds.has(p.player_id)
      return (
        <div className={`flex flex-col items-center gap-1 cursor-default`}>
          <div className={`relative w-12 h-12 rounded-full flex items-center justify-center border-2 ${isNew ? 'border-green-400 bg-green-400/20' : 'border-white/20 bg-white/10'}`}>
            <span className={`text-[10px] font-bold ${isNew ? 'text-green-400' : 'text-white'}`}>
              {p.position}
            </span>
            {p.is_captain && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 text-black text-[9px] font-black rounded-full flex items-center justify-center">C</span>
            )}
            {isNew && (
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 text-black text-[9px] font-black rounded-full flex items-center justify-center">N</span>
            )}
          </div>
          <p className={`text-[10px] font-bold text-center leading-tight max-w-[56px] truncate ${isNew ? 'text-green-400' : 'text-white'}`}>{p.name.split('.').pop() || p.name}</p>
          <p className="text-[9px] text-gray-400">{p.xp_gw1 != null ? p.xp_gw1.toFixed(1) + ' xP' : ''}</p>
        </div>
      )
    }

    return (
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Recommended Starting XI</h3>
          {newIds.size > 0 && <span className="text-[10px] bg-green-400/20 text-green-400 border border-green-400/30 px-2 py-0.5 rounded-full font-bold">N = New Player</span>}
        </div>
        <div className="rounded-2xl overflow-hidden border border-gray-700/50" style={{background: 'linear-gradient(180deg, #1a7a3c 0%, #166d35 50%, #1a7a3c 100%)'}}>
          <div className="p-4 space-y-4">
            {rows.map((row, ri) => (
              row.length > 0 && (
                <div key={ri} className="flex justify-center gap-3 flex-wrap">
                  {row.map((p, pi) => <PlayerCard key={pi} p={p} />)}
                </div>
              )
            ))}
          </div>
          {bench.length > 0 && (
            <div className="border-t border-white/10 bg-black/20 p-3">
              <p className="text-[10px] text-gray-400 text-center mb-2 uppercase tracking-wider">Bench</p>
              <div className="flex justify-center gap-3">
                {bench.map((p, i) => <PlayerCard key={i} p={p} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }


  const strategies = [
    { key: 'conservative', label: 'Conservative', desc: 'Focus on high ownership & established performers.' },
    { key: 'balanced', label: 'Balanced', desc: 'Mix of reliable points and calculated differentials.' },
    { key: 'aggressive', label: 'Aggressive', desc: 'High variance, chasing massive hauls and low ownership.' },
  ]
  const objectives = [
    { key: 'total_points', label: 'Maximize Total Points' },
    { key: 'team_value', label: 'Maximize Team Value' },
    { key: 'top_10k', label: 'Target Top 10k Rank' },
    { key: 'mini_league', label: 'Beat My Mini-League' },
  ]
  const chips = [
    { key: 'wildcard', label: 'Wildcard', abbr: 'WC' },
    { key: 'freehit', label: 'Free Hit', abbr: 'FH' },
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="glass-card rounded-2xl p-6 border border-gray-700/50 md:col-span-2">
              <h2 className="text-base font-bold mb-1 flex items-center gap-2"><i className="fa-solid fa-seedling text-green-400"/> Optimization Strategy</h2>
              <p className="text-gray-400 text-sm mb-4">Select the risk profile for the AI recommendations.</p>
              <div className="grid grid-cols-3 gap-4">
                {strategies.map(s => (
                  <button key={s.key} onClick={() => setStrategy(s.key)}
                    className={'p-4 rounded-xl border text-left transition-all ' + (strategy === s.key ? 'border-green-400 bg-green-400/10' : 'border-gray-700/50 bg-white/5 hover:border-gray-500')}>
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
                    className={'w-10 h-10 rounded-full font-bold text-sm transition-all border ' + (transfers === n && !activeChip ? 'border-green-400 text-green-400 bg-green-400/10' : 'border-gray-700 text-gray-400 hover:border-gray-500')}>
                    {n}
                  </button>
                ))}
              </div>
              {activeChip && <p className="text-xs text-green-400 mt-3"><i className="fa-solid fa-info-circle mr-1"/>{activeChip === 'wildcard' ? 'Wildcard' : 'Free Hit'} overrides transfer count</p>}
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
                    <button onClick={() => setActiveChip(activeChip === chip.key ? null : chip.key)}
                      className={'w-12 h-6 rounded-full relative transition-colors duration-200 ' + (activeChip === chip.key ? 'bg-green-400' : 'bg-gray-700')}>
                      <div className={'w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all duration-200 ' + (activeChip === chip.key ? 'right-0.5' : 'left-0.5')}/>
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
                    className={'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ' + (objective === o.key ? 'border-green-400 bg-green-400/10 text-white' : 'border-gray-700 bg-white/5 text-gray-400 hover:border-gray-500')}>
                    <div className={'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ' + (objective === o.key ? 'border-green-400' : 'border-gray-600')}>
                      {objective === o.key && <div className="w-2 h-2 rounded-full bg-green-400"/>}
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
                  {activeChip ? (activeChip === 'wildcard' ? 'Wildcard' : 'Free Hit') + ' chip' : transfers + ' transfer' + (transfers !== 1 ? 's' : '')}
                  {' \u2022 '}{strategies.find(s => s.key === strategy)?.label}
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
