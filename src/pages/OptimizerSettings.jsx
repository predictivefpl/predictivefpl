import { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'
import Sidebar from '../components/Sidebar'

const getLS = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback }
  catch { return fallback }
}

const ENGINE_URL = import.meta.env.VITE_ENGINE_URL || 'http://localhost:8000'

export default function OptimizerSettings() {
  const { user } = useUser()
  const [strategy, setStrategy] = useState(getLS('opt_strategy', 'balanced'))
  const [transfers, setTransfers] = useState(getLS('opt_transfers', 1))
  const [activeChip, setActiveChip] = useState(getLS('opt_activechip', null))
  const [horizon, setHorizon] = useState(getLS('opt_horizon', 3))
  const [objective, setObjective] = useState(getLS('opt_objective', 'total_points'))
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState(null)
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
    if (!teamId) { setError('No FPL Team ID found. Go to Settings to connect your team.'); return }
    setRunning(true)
    setError('')
    setResults(null)
    try {
      const isLocal = window.location.hostname === 'localhost'
      const fplBase = isLocal ? '/fpl' : '/api/fpl?path='
      const fplUrl = (path) => isLocal ? fplBase + path : fplBase + encodeURIComponent(path)

      const [bootstrap, entry] = await Promise.all([
        fetch(fplUrl('/bootstrap-static/')).then(r => r.json()),
        fetch(fplUrl('/entry/' + teamId + '/')).then(r => r.json()),
      ])
      const events = bootstrap.events || []
      const currentEvent = events.find(e => e.is_current) || events.find(e => e.is_next) || events[events.length - 1]
      const gw = currentEvent?.id || 1
      const picks = await fetch(fplUrl('/entry/' + teamId + '/event/' + gw + '/picks/')).then(r => r.json())
      const squadIds = picks.picks.map(p => p.element)
      const bank = picks.entry_history.bank / 10

      const payload = {
        budget: bank,
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
      const data = await res.json()
      setResults(data)
    } catch (e) {
      setError('Optimiser failed: ' + e.message)
    }
    setRunning(false)
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
        <main className="flex-1 overflow-y-auto custom-scroll p-8 max-w-5xl mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="glass-card rounded-2xl p-6 border border-gray-700/50 md:col-span-2">
              <h2 className="text-base font-bold mb-1 flex items-center gap-2"><i className="fa-solid fa-seedling text-green-400"/> Optimization Strategy</h2>
              <p className="text-gray-400 text-sm mb-4">Select the risk profile for the AI recommendations.</p>
              <div className="grid grid-cols-3 gap-4">
                {strategies.map(s => (
                  <button key={s.key} onClick={() => setStrategy(s.key)}
                    className={"p-4 rounded-xl border text-left transition-all "+(strategy===s.key?'border-green-400 bg-green-400/10':'border-gray-700/50 bg-white/5 hover:border-gray-500')}>
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
                    className={"w-10 h-10 rounded-full font-bold text-sm transition-all border "+(transfers===n&&!activeChip?'border-green-400 text-green-400 bg-green-400/10':'border-gray-700 text-gray-400 hover:border-gray-500')}>
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
                    <button onClick={() => setActiveChip(activeChip===chip.key?null:chip.key)}
                      className={"w-12 h-6 rounded-full relative transition-colors duration-200 "+(activeChip===chip.key?'bg-green-400':'bg-gray-700')}>
                      <div className={"w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all duration-200 "+(activeChip===chip.key?'right-0.5':'left-0.5')}/>
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
              <div className="flex justify-between text-xs text-gray-500 mt-1">{[1,2,3,4,5,6,7,8].map(n=><span key={n}>{n}</span>)}</div>
            </div>
            <div className="glass-card rounded-2xl p-6 border border-gray-700/50">
              <h2 className="text-base font-bold mb-1 flex items-center gap-2"><i className="fa-solid fa-bullseye text-green-400"/> Optimization Objective</h2>
              <p className="text-gray-400 text-sm mb-4">What is the primary goal?</p>
              <div className="space-y-2">
                {objectives.map(o => (
                  <button key={o.key} onClick={() => setObjective(o.key)}
                    className={"w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all "+(objective===o.key?'border-green-400 bg-green-400/10 text-white':'border-gray-700 bg-white/5 text-gray-400 hover:border-gray-500')}>
                    <div className={"w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 "+(objective===o.key?'border-green-400':'border-gray-600')}>
                      {objective===o.key&&<div className="w-2 h-2 rounded-full bg-green-400"/>}
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
                  {activeChip?(activeChip==='wildcard'?'Wildcard':'Free Hit')+' chip':transfers+' transfer'+(transfers!==1?'s':'')}
                  {' \u2022 '}{strategies.find(s=>s.key===strategy)?.label}
                  {' \u2022 '}{horizon} GW horizon
                </p>
              </div>
              <button onClick={runOptimiser} disabled={running}
                className="bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl px-8 py-3 font-bold text-sm flex items-center gap-2 text-black transition-colors">
                {running?<><i className="fa-solid fa-spinner fa-spin"/> Running AI...</>:<><i className="fa-solid fa-play"/> Save Configuration &amp; Run Optimizer</>}
              </button>
            </div>
            {error && <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm"><i className="fa-solid fa-triangle-exclamation mr-2"/>{error}</div>}
          </div>

          {results && (
            <div className="glass-card rounded-2xl p-6 border border-green-500/30">
              <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
                <i className="fa-solid fa-robot text-green-400"/> AI Transfer Recommendations
                {results.projected_gain != null && (
                  <span className="text-xs text-green-400 font-normal ml-2 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">
                    +{Number(results.projected_gain).toFixed(1)} xP gain
                  </span>
                )}
              </h2>
              {results.transfers && results.transfers.length > 0 ? (
                <div className="space-y-3 mb-6">
                  {results.transfers.map((t, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-[#0F121D]/80 rounded-xl border border-gray-700/50">
                      <div className="flex-1 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                          <i className="fa-solid fa-arrow-up text-red-400 text-xs"/>
                        </div>
                        <div>
                          <p className="font-bold text-red-400">{t.transfer_out}</p>
                          <p className="text-xs text-gray-500">Transfer Out{t.transfer_out_price?' \u2022 \u00a3'+Number(t.transfer_out_price).toFixed(1)+'m':''}</p>
                        </div>
                      </div>
                      <i className="fa-solid fa-right-left text-gray-500"/>
                      <div className="flex-1 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                          <i className="fa-solid fa-arrow-down text-green-400 text-xs"/>
                        </div>
                        <div>
                          <p className="font-bold text-green-400">{t.transfer_in}</p>
                          <p className="text-xs text-gray-500">Transfer In{t.transfer_in_price?' \u2022 \u00a3'+Number(t.transfer_in_price).toFixed(1)+'m':''}</p>
                        </div>
                      </div>
                      {t.xp_gain != null && (
                        <div className="text-right">
                          <p className="text-sm font-bold text-white">+{Number(t.xp_gain).toFixed(1)}</p>
                          <p className="text-xs text-gray-500">xP gain</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm mb-4">No transfers recommended — your squad is already optimal for the selected settings!</p>
              )}
              {results.recommended_squad && results.recommended_squad.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-300 mb-3 uppercase tracking-wider">Recommended Squad</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {results.recommended_squad.filter(p => !p.bench).map((p, i) => (
                      <div key={i} className="bg-[#0F121D]/60 rounded-xl p-3 border border-gray-700/50">
                        <div className="flex justify-between items-start mb-1">
                          <span className={"text-[10px] px-1.5 py-0.5 rounded font-bold "+(p.position==='GKP'?'bg-yellow-500/20 text-yellow-400':p.position==='DEF'?'bg-green-500/20 text-green-400':p.position==='MID'?'bg-blue-500/20 text-blue-400':'bg-red-500/20 text-red-400')}>
                            {p.position}
                          </span>
                          <span className="text-xs text-blue-400 font-medium">{p.price!=null?'\u00a3'+Number(p.price).toFixed(1)+'m':''}</span>
                        </div>
                        <p className="text-sm font-bold text-white truncate">{p.name}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{p.team}{p.xp!=null?' \u2022 '+Number(p.xp).toFixed(1)+' xP':''}</p>
                        {p.captain&&<span className="text-[9px] bg-blue-500 text-white px-1 rounded font-bold mt-1 inline-block">C</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
