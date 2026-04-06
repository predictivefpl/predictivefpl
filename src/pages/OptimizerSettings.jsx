import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

const getLS = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback } catch { return fallback }
}

export default function OptimizerSettings() {
  const navigate = useNavigate()
  const [strategy, setStrategy] = useState(getLS('opt_strategy', 'Balanced'))
  const [numTransfers, setNumTransfers] = useState(getLS('opt_transfers', 1))
  const [wildcard, setWildcard] = useState(getLS('opt_wildcard', false))
  const [freeHit, setFreeHit] = useState(getLS('opt_freehit', false))
  const [horizon, setHorizon] = useState(getLS('opt_horizon', 5))
  const [objective, setObjective] = useState(getLS('opt_objective', 'Maximize Total Points'))
  const [saved, setSaved] = useState(false)
  const [running, setRunning] = useState(false)

  const bank = parseFloat(localStorage.getItem('opt_bank') || '0.5')

  const STRATEGIES = [
    { id: 'Conservative', desc: 'Focus on high ownership & established performers.' },
    { id: 'Balanced', desc: 'Mix of reliable points and calculated differentials.' },
    { id: 'Aggressive', desc: 'High variance, chasing massive hauls and low ownership.' },
  ]

  const OBJECTIVES = [
    'Maximize Total Points',
    'Maximize Team Value',
    'Target Top 10k Rank',
    'Beat My Mini-League',
  ]

  const saveAndRun = () => {
    localStorage.setItem('opt_strategy', JSON.stringify(strategy))
    localStorage.setItem('opt_transfers', JSON.stringify(numTransfers))
    localStorage.setItem('opt_wildcard', JSON.stringify(wildcard))
    localStorage.setItem('opt_freehit', JSON.stringify(freeHit))
    localStorage.setItem('opt_horizon', JSON.stringify(horizon))
    localStorage.setItem('opt_objective', JSON.stringify(objective))
    setRunning(true)
    setTimeout(() => {
      setRunning(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }, 2000)
  }

  return (
    <div className="min-h-screen flex text-white" style={{ background: '#0d0f1a' }}>
      <Sidebar/>
      <div className="flex-1 flex flex-col h-screen overflow-hidden">

        {/* Top bar */}
        <header className="flex items-center justify-between px-8 py-4 border-b border-white/10" style={{ background: '#1a0a2e' }}>
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-robot text-green-400 text-xl"/>
            <span className="font-bold text-white text-lg">Predictor<span className="text-green-400">AI</span></span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <span className="text-gray-400">Squad Value: <span className="text-green-400 font-bold">£102.4M</span></span>
            <span className="px-3 py-1 rounded-lg border border-white/10 text-gray-400">In Bank: <span className="text-green-400 font-bold">£{bank}M</span></span>
            <i className="fa-solid fa-bell text-gray-400"/>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scroll p-6 max-w-5xl mx-auto w-full">

          {/* Optimization Strategy */}
          <div className="rounded-2xl p-6 mb-6 border border-white/10" style={{ background: '#141625' }}>
            <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
              <i className="fa-solid fa-seedling text-green-400"/> Optimization Strategy
            </h2>
            <p className="text-gray-400 text-sm mb-5">Select the risk profile for the AI's recommendations.</p>
            <div className="grid grid-cols-3 gap-4">
              {STRATEGIES.map(s => (
                <button key={s.id} onClick={() => setStrategy(s.id)}
                  className={`p-5 rounded-xl border text-left transition-all duration-200 ${
                    strategy === s.id
                      ? 'border-green-400 bg-green-400/10 shadow-[0_0_20px_rgba(74,222,128,0.15)]'
                      : 'border-white/10 bg-white/5 hover:border-green-400/50'
                  }`}>
                  <p className="font-bold text-white mb-1">{s.id}</p>
                  <p className="text-xs text-gray-400">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Planned Transfers + Active Chips */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="rounded-2xl p-6 border border-white/10" style={{ background: '#141625' }}>
              <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
                <i className="fa-solid fa-right-left text-green-400"/> Planned Transfers
              </h2>
              <p className="text-gray-400 text-sm mb-5">How many transfers per Gameweek?</p>
              <div className="flex gap-3">
                {[0,1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setNumTransfers(n)}
                    className={`w-11 h-11 rounded-xl font-bold text-sm border transition-all duration-200 ${
                      numTransfers === n
                        ? 'border-green-400 text-green-400 bg-green-400/10 shadow-[0_0_12px_rgba(74,222,128,0.3)]'
                        : 'border-white/10 text-gray-400 bg-white/5 hover:border-green-400/50 hover:text-green-300'
                    }`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl p-6 border border-white/10" style={{ background: '#141625' }}>
              <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
                <i className="fa-solid fa-microchip text-green-400"/> Active Chips
              </h2>
              <p className="text-gray-400 text-sm mb-5">Include chips in this optimization run.</p>
              <div className="space-y-3">
                {[
                  { key: 'wildcard', label: 'Wildcard', abbr: 'WC', state: wildcard, set: setWildcard },
                  { key: 'freehit', label: 'Free Hit', abbr: 'FH', state: freeHit, set: setFreeHit },
                ].map(chip => (
                  <div key={chip.key} className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-400/10 text-green-400 border border-green-400/20">{chip.abbr}</span>
                      <span className="text-sm text-white font-medium">{chip.label}</span>
                    </div>
                    <button onClick={() => chip.set(!chip.state)}
                      className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${chip.state ? 'bg-green-400' : 'bg-gray-700'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all duration-200 ${chip.state ? 'right-0.5' : 'left-0.5'}`}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Planning Horizon + Optimization Objective */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="rounded-2xl p-6 border border-white/10" style={{ background: '#141625' }}>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <i className="fa-solid fa-calendar text-green-400"/> Planning Horizon
                </h2>
                <span className="text-green-400 font-bold text-sm">{horizon} GWs</span>
              </div>
              <p className="text-gray-400 text-sm mb-5">How far ahead should the AI look?</p>
              <input type="range" min="1" max="8" value={horizon}
                onChange={e => setHorizon(parseInt(e.target.value))}
                className="w-full accent-green-400"
                style={{ accentColor: '#4ade80' }}/>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                {[1,2,3,4,5,6,7,8].map(n => <span key={n}>{n}</span>)}
              </div>
            </div>

            <div className="rounded-2xl p-6 border border-white/10" style={{ background: '#141625' }}>
              <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
                <i className="fa-solid fa-bullseye text-green-400"/> Optimization Objective
              </h2>
              <p className="text-gray-400 text-sm mb-4">What is the primary goal?</p>
              <div className="space-y-2">
                {OBJECTIVES.map(obj => (
                  <button key={obj} onClick={() => setObjective(obj)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 text-sm ${
                      objective === obj
                        ? 'border-green-400/40 bg-green-400/10 text-white'
                        : 'border-white/10 bg-white/5 text-gray-400 hover:border-green-400/30 hover:text-white'
                    }`}>
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${objective === obj ? 'border-green-400' : 'border-gray-600'}`}>
                      {objective === obj && <span className="w-2 h-2 rounded-full bg-green-400"/>}
                    </span>
                    {obj}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Save & Run */}
          <div className="rounded-2xl p-6 border border-white/10 flex items-center justify-between" style={{ background: '#141625' }}>
            <div>
              <p className="text-white font-bold mb-1">Ready to Optimize</p>
              <p className="text-gray-400 text-sm">
                {numTransfers} transfer{numTransfers !== 1 ? 's' : ''} &bull; {strategy} &bull; {horizon} GW horizon &bull; {objective}
                {wildcard && ' • Wildcard ON'}
                {freeHit && ' • Free Hit ON'}
              </p>
              {saved && <p className="text-green-400 text-sm mt-1 flex items-center gap-1"><i className="fa-solid fa-check"/> Configuration saved!</p>}
            </div>
            <button onClick={saveAndRun} disabled={running}
              className={`px-8 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all duration-200 ${
                running
                  ? 'bg-green-400/20 border border-green-400/30 text-green-400 cursor-wait'
                  : 'bg-green-400 text-black hover:bg-green-300 shadow-[0_0_20px_rgba(74,222,128,0.4)]'
              }`}>
              {running ? (
                <><div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin"/> Running...</>
              ) : (
                <><i className="fa-solid fa-play"/> Save Configuration & Run Optimizer</>
              )}
            </button>
          </div>

        </main>
      </div>
    </div>
  )
}
