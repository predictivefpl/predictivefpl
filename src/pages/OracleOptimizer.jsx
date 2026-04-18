import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

const ORACLE_URL  = window.location.hostname === 'localhost'
  ? 'http://localhost:8001'
  : 'https://YOUR-NEW-RAILWAY-URL.up.railway.app'   // update once deployed

const ADMIN_EMAILS = ['predictivefpl@outlook.com', 'navindhillon@gmail.com']
const FPL_URL     = (path) => '/api/fpl?path=' + encodeURIComponent(path)

const POS_COLOR = { GKP:'#f59e0b', DEF:'#10b981', MID:'#3b82f6', FWD:'#ef4444' }

// ─── Utility Components ───────────────────────────────────────────────────────

function GlassCard({ children, className = '', style = {} }) {
  return (
    <div className={'rounded-2xl border border-gray-700/50 bg-white/[0.03] backdrop-blur-md ' + className} style={style}>
      {children}
    </div>
  )
}

function StatPill({ label, value, color = 'text-white', icon }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0F121D]/60 border border-white/5">
      {icon && <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
        <i className={'fa-solid ' + icon + ' text-sm ' + color}/>
      </div>}
      <div>
        <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
        <p className={'text-base font-black ' + color}>{value}</p>
      </div>
    </div>
  )
}

function PlayerToken({ p, photoMap = {}, highlight = false }) {
  const col    = POS_COLOR[p.position] || '#6b7280'
  const photo  = photoMap[p.player_id]
  const imgUrl = photo ? `https://resources.premierleague.com/premierleague/photos/players/110x140/p${photo}.png` : null
  const surname = (p.name || '').includes(' ') ? (p.name||'').split(' ').pop() : (p.name||'').split('.').pop()
  const isNew  = highlight

  return (
    <div className="flex flex-col items-center gap-1 cursor-default" style={{minWidth:68}}>
      <div className="relative" style={{width:60,height:60}}>
        {isNew && <div className="absolute inset-0 rounded-full" style={{background:`radial-gradient(circle,${col}55 0%,transparent 70%)`,transform:'scale(1.4)'}}/>}
        <div className="w-full h-full rounded-full overflow-hidden border-2 flex items-center justify-center"
          style={{borderColor: isNew ? col : p.is_captain ? '#facc15' : 'rgba(255,255,255,0.2)',
                  background:`linear-gradient(135deg,${col}22,${col}44)`,
                  boxShadow: p.is_captain ? '0 0 12px rgba(250,204,21,0.5)' : '0 2px 10px rgba(0,0,0,0.6)'}}>
          {imgUrl
            ? <img src={imgUrl} alt={p.name} className="w-full h-full object-cover object-top" style={{transform:'scale(1.15) translateY(5px)'}}
                onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }}/>
            : null}
          <div className="w-full h-full flex items-center justify-center" style={{display:imgUrl?'none':'flex'}}>
            <i className="fa-solid fa-person text-white/50 text-xl"/>
          </div>
        </div>
        {p.is_captain && <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-black text-[10px] font-black z-10" style={{background:'linear-gradient(135deg,#facc15,#f59e0b)'}}>C</div>}
        {isNew && <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-black z-10" style={{background:col}}>N</div>}
        {p.fixture_count_gw1 === 2 && <div className="absolute -bottom-1 left-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-black z-10 bg-green-500">2</div>}
      </div>
      <div className="px-2 py-0.5 rounded-md text-center" style={{background:isNew?`${col}28`:'rgba(0,0,0,0.55)',border:`1px solid ${isNew?col+'55':'rgba(255,255,255,0.1)'}`,backdropFilter:'blur(4px)',maxWidth:76}}>
        <p className="font-bold text-white leading-tight" style={{fontSize:10,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{surname}</p>
        {p.xp_gw1 != null && <p style={{fontSize:9,color:p.fixture_count_gw1===2?'#10b981':POS_COLOR[p.position]}}>{Number(p.xp_gw1).toFixed(1)}{p.fixture_count_gw1===2?' ×2':''}</p>}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OracleOptimizer() {
  const { user } = useUser()
  const navigate = useNavigate()
  const isAdmin  = ADMIN_EMAILS.includes(user?.primaryEmailAddress?.emailAddress)

  const [status, setStatus]         = useState(null)
  const [photoMap, setPhotoMap]      = useState({})
  const [currentGW, setCurrentGW]   = useState(0)
  const [dgwMap, setDgwMap]          = useState({})
  const [bgwMap, setBgwMap]          = useState({})

  // Config
  const [budget, setBudget]                     = useState(100)
  const [horizon, setHorizon]                   = useState(8)
  const [freeTx, setFreeTx]                     = useState(1)
  const [chips, setChips]                       = useState({ wildcard:true, freehit:true, benchboost:true, triplecaptain:true })
  const [forceChip, setForceChip]               = useState(null)
  const [objective, setObjective]               = useState('total_xp')

  // Results
  const [result, setResult]         = useState(null)
  const [running, setRunning]       = useState(false)
  const [training, setTraining]     = useState(false)
  const [error, setError]           = useState('')
  const [activeTab, setActiveTab]   = useState('squad')
  const [squadIds, setSquadIds]     = useState([])

  useEffect(() => {
    if (!isAdmin) { navigate('/dashboard'); return }
    fetchStatus()
    fetchBootstrap()
  }, [])

  const fetchStatus = async () => {
    try {
      const s = await fetch(ORACLE_URL + '/oracle/status').then(r => r.json())
      setStatus(s)
    } catch { setStatus({ status:'offline' }) }
  }

  const fetchBootstrap = async () => {
    try {
      const [bootstrap, fixtures] = await Promise.all([
        fetch(FPL_URL('/bootstrap-static/')).then(r => r.json()),
        fetch(FPL_URL('/fixtures/')).then(r => r.json()),
      ])
      const teamId = user?.unsafeMetadata?.fplTeamId || localStorage.getItem('fplTeamId')
      const events = bootstrap.events || []
      const cur = events.find(e => e.is_current) || events.find(e => e.is_next) || events[events.length-1]
      const gw = cur?.id || 1
      setCurrentGW(gw)

      // Build photoMap
      const pMap = {}
      ;(bootstrap.elements || []).forEach(el => { if (el.photo) pMap[el.id] = el.photo.replace('.jpg','') })
      setPhotoMap(pMap)

      // DGW / BGW maps
      const allTeams = (bootstrap.teams || []).map(t => t.id)
      const dgw = {}, bgw = {}
      for (let offset = 0; offset <= 7; offset++) {
        const gwT = gw + offset
        const gwFix = fixtures.filter(f => f.event === gwT)
        const counts = {}
        gwFix.forEach(f => {
          counts[f.team_h] = (counts[f.team_h]||0)+1
          counts[f.team_a] = (counts[f.team_a]||0)+1
        })
        dgw[gwT] = Object.entries(counts).filter(([,c])=>c>=2).map(([t])=>Number(t))
        bgw[gwT] = allTeams.filter(t => !counts[t])
      }
      setDgwMap(dgw)
      setBgwMap(bgw)

      // Fetch current squad
      if (teamId) {
        const picks = await fetch(FPL_URL(`/entry/${teamId}/event/${gw}/picks/`)).then(r => r.json())
        const bank  = picks.entry_history.bank / 10
        const value = picks.entry_history.value / 10
        setBudget(+(value + bank).toFixed(1))
        setSquadIds(picks.picks.map(p => p.element))
      }
    } catch(e) { console.log('Bootstrap failed:', e.message) }
  }

  const triggerTrain = async () => {
    setTraining(true)
    try {
      await fetch(ORACLE_URL + '/oracle/train', { method: 'POST' })
      // Poll until done
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 5000))
        const s = await fetch(ORACLE_URL + '/oracle/status').then(r => r.json())
        setStatus(s)
        if (s.training_status === 'done' || s.training_status === 'error') break
      }
    } catch(e) { setError('Training failed: ' + e.message) }
    setTraining(false)
  }

  const runOptimiser = async () => {
    setRunning(true); setError(''); setResult(null)
    try {
      const payload = {
        budget, horizon, num_free_transfers: freeTx,
        current_squad_ids: squadIds,
        objective,
        wildcard_available:     chips.wildcard,
        freehit_available:      chips.freehit,
        benchboost_available:   chips.benchboost,
        triplecaptain_available: chips.triplecaptain,
        force_chip: forceChip,
      }
      const res = await fetch(ORACLE_URL + '/oracle/optimise', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Engine error: ' + res.status)
      const data = await res.json()
      setResult(data)
      setActiveTab('squad')
    } catch(e) { setError('Optimiser failed: ' + e.message) }
    setRunning(false)
  }

  // ── Chip helper ──────────────────────────────────────────────────────────
  const chipColor = { wildcard:'#3b82f6', freehit:'#10b981', benchboost:'#f59e0b', triplecaptain:'#a855f7' }
  const chipIcon  = { wildcard:'fa-wand-magic-sparkles', freehit:'fa-bolt', benchboost:'fa-chair', triplecaptain:'fa-crown' }

  // ── Render ───────────────────────────────────────────────────────────────
  const starters = (result?.squad || []).filter(p => p.is_starter)
  const bench    = (result?.squad || []).filter(p => !p.is_starter)
  const newIds   = new Set((result?.squad||[]).filter(p => !squadIds.includes(p.player_id)).map(p => p.player_id))
  const posRows  = ['GKP','DEF','MID','FWD'].map(pos => starters.filter(p => p.position === pos))

  return (
    <div className="min-h-screen bg-[#0F121D] bg-grid flex text-white">
      <Sidebar/>
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-gray-800/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:'linear-gradient(135deg,#a855f7,#3b82f6)'}}>
              <i className="fa-solid fa-brain text-white text-sm"/>
            </div>
            <div>
              <span className="text-xl font-black bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Oracle Optimizer</span>
              <span className="text-xs text-gray-500 ml-2">8-GW MIP Engine</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">ADMIN ONLY</span>
          </div>
          <div className="flex items-center gap-3">
            {status && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                <span className={'w-2 h-2 rounded-full ' + (status.status==='ok'?'bg-green-400 animate-pulse':'bg-red-400')}/>
                <span className="text-xs text-gray-300">GW{status.current_gw || '—'}</span>
                <span className={'text-xs font-bold ' + (status.predictions_cached?'text-green-400':'text-yellow-400')}>
                  {status.predictions_cached ? 'Predictions Ready' : 'Needs Training'}
                </span>
              </div>
            )}
            <button onClick={triggerTrain} disabled={training}
              className="px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2"
              style={{background:'linear-gradient(135deg,#a855f7,#3b82f6)'}}>
              <i className={'fa-solid ' + (training ? 'fa-spinner fa-spin' : 'fa-bolt')}/>
              {training ? 'Training Oracle...' : 'Train Oracle'}
            </button>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-6 flex gap-6">

          {/* ── Left: Config ─────────────────────────────────────────────── */}
          <div className="w-72 flex-shrink-0 space-y-4">

            {/* Status */}
            {status && (
              <GlassCard className="p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Engine Status</p>
                <div className="space-y-2">
                  {[
                    ['Predictions', status.predictions_cached ? '✓ Cached' : '⚠ Not trained', status.predictions_cached ? 'text-green-400':'text-yellow-400'],
                    ['Models', status.models_available ? '✓ Loaded' : '⚠ Missing', status.models_available ? 'text-green-400':'text-red-400'],
                    ['Training', status.training_status, 'text-gray-300'],
                    ['Last Updated', status.last_updated ? new Date(status.last_updated).toLocaleTimeString() : '—', 'text-gray-300'],
                  ].map(([l,v,c]) => (
                    <div key={l} className="flex justify-between p-2 bg-white/3 rounded-lg">
                      <span className="text-xs text-gray-400">{l}</span>
                      <span className={'text-xs font-bold ' + c}>{v}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* DGW/BGW Alert */}
            {currentGW > 0 && (
              <GlassCard className="p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Fixture Intel</p>
                {Object.entries(dgwMap).filter(([,t])=>t.length>=3).slice(0,3).map(([gw,teams]) => (
                  <div key={gw} className="mb-2 p-2 rounded-lg" style={{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.2)'}}>
                    <span className="text-[10px] font-bold text-green-400">DGW{gw}</span>
                    <span className="text-[10px] text-gray-400 ml-2">{teams.length} double teams</span>
                  </div>
                ))}
                {Object.entries(bgwMap).filter(([,t])=>t.length>=5).slice(0,2).map(([gw,teams]) => (
                  <div key={gw} className="mb-2 p-2 rounded-lg" style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)'}}>
                    <span className="text-[10px] font-bold text-red-400">BGW{gw}</span>
                    <span className="text-[10px] text-gray-400 ml-2">{teams.length} blank teams</span>
                  </div>
                ))}
              </GlassCard>
            )}

            {/* Config */}
            <GlassCard className="p-4 space-y-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Configuration</p>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-gray-400">Horizon</label>
                  <span className="text-xs font-bold text-purple-400">{horizon} GWs</span>
                </div>
                <input type="range" min="1" max="8" value={horizon} onChange={e=>setHorizon(+e.target.value)} className="w-full accent-purple-500"/>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-gray-400">Free Transfers</label>
                  <span className="text-xs font-bold text-blue-400">{freeTx}</span>
                </div>
                <div className="flex gap-2">
                  {[0,1,2].map(n => (
                    <button key={n} onClick={()=>setFreeTx(n)}
                      className={'flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ' + (freeTx===n?'border-blue-500 bg-blue-500/10 text-blue-400':'border-gray-700 text-gray-500 hover:border-gray-500')}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-2">Budget</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">£</span>
                  <input type="number" value={budget} onChange={e=>setBudget(+e.target.value)} step="0.1" min="80" max="110"
                    className="flex-1 bg-[#0F121D] border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500"/>
                  <span className="text-xs text-gray-400">m</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-2">Objective</label>
                {[['total_xp','Max Total xP'],['min_variance','Min Variance'],['top10k','Top 10k']].map(([k,l]) => (
                  <button key={k} onClick={()=>setObjective(k)}
                    className={'w-full text-left px-3 py-2 rounded-lg text-xs mb-1 border transition-all ' + (objective===k?'border-purple-500 bg-purple-500/10 text-white':'border-gray-800 text-gray-400 hover:border-gray-600')}>
                    {l}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-2">Chips Available</label>
                <div className="space-y-2">
                  {Object.entries(chips).map(([chip, avail]) => (
                    <div key={chip} className="flex items-center justify-between p-2 rounded-lg border border-white/5 bg-white/3">
                      <div className="flex items-center gap-2">
                        <i className={'fa-solid text-xs ' + chipIcon[chip]} style={{color:chipColor[chip]}}/>
                        <span className="text-xs text-gray-300 capitalize">{chip}</span>
                      </div>
                      <button onClick={()=>setChips(c=>({...c,[chip]:!c[chip]}))}
                        className={'w-9 h-5 rounded-full relative transition-colors ' + (avail?'bg-purple-500':'bg-gray-700')}>
                        <div className={'w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ' + (avail?'right-0.5':'left-0.5')}/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-2">Force Chip This GW</label>
                <div className="flex flex-wrap gap-1">
                  {[null,'wildcard','freehit','benchboost','triplecaptain'].map(c => (
                    <button key={c||'none'} onClick={()=>setForceChip(c)}
                      className={'px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ' + (forceChip===c?'text-white':'text-gray-500 hover:text-gray-300')}
                      style={{borderColor: c ? chipColor[c]+'66' : 'rgba(255,255,255,0.1)', background: forceChip===c && c ? chipColor[c]+'22' : 'transparent'}}>
                      {c ? c.slice(0,2).toUpperCase() : 'None'}
                    </button>
                  ))}
                </div>
              </div>
            </GlassCard>

            <button onClick={runOptimiser} disabled={running || !status?.predictions_cached}
              className="w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{background:'linear-gradient(135deg,#a855f7,#3b82f6)',boxShadow:running?'none':'0 4px 20px rgba(168,85,247,0.3)'}}>
              {running
                ? <><i className="fa-solid fa-spinner fa-spin"/> Solving MIP...</>
                : <><i className="fa-solid fa-brain"/> Run Oracle</>}
            </button>
            {!status?.predictions_cached && (
              <p className="text-xs text-center text-yellow-400">Train Oracle first to enable optimizer</p>
            )}
          </div>

          {/* ── Right: Results ────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {error && (
              <GlassCard className="p-4 mb-4 border-red-500/30">
                <p className="text-red-400 text-sm"><i className="fa-solid fa-triangle-exclamation mr-2"/>{error}</p>
              </GlassCard>
            )}

            {!result && !running && (
              <div className="flex flex-col items-center justify-center h-96 text-gray-600">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4" style={{background:'linear-gradient(135deg,#a855f722,#3b82f622)',border:'1px solid rgba(168,85,247,0.2)'}}>
                  <i className="fa-solid fa-brain text-3xl" style={{color:'#a855f7'}}/>
                </div>
                <p className="text-lg font-bold text-gray-500">Oracle Optimizer</p>
                <p className="text-sm text-gray-600 mt-1">8-GW MIP • Chip Timing • Transfer Option Value</p>
                <p className="text-xs text-gray-700 mt-3">Configure parameters and click Run Oracle</p>
              </div>
            )}

            {result && result.status === 'Optimal' && (
              <>
                {/* Summary stats */}
                <div className="grid grid-cols-4 gap-3 mb-5">
                  <StatPill label="Total xP"    value={result.total_xp?.toFixed(1)} color="text-purple-400" icon="fa-star"/>
                  <StatPill label="Net xP"      value={result.net_xp?.toFixed(1)}   color="text-green-400"  icon="fa-chart-line"/>
                  <StatPill label="Hits"         value={result.total_hits || 0}      color={result.total_hits>0?'text-red-400':'text-gray-300'} icon="fa-minus-circle"/>
                  <StatPill label="Option Value" value={'+'+result.option_value?.toFixed(1)} color="text-blue-400" icon="fa-coins"/>
                </div>

                {/* xP by GW chart */}
                {result.xp_by_gw?.length > 0 && (
                  <GlassCard className="p-4 mb-4">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Projected xP per Gameweek</p>
                    <div className="flex items-end gap-2 h-20">
                      {result.xp_by_gw.map((xp, t) => {
                        const gw = (result.current_gw || currentGW) + t
                        const isDGW = (dgwMap[gw] || []).length >= 3
                        const isBGW = (bgwMap[gw] || []).length >= 5
                        const chip = result.chip_plan?.[t]
                        const maxXp = Math.max(...result.xp_by_gw, 1)
                        const h = Math.max(8, (xp / maxXp) * 72)
                        return (
                          <div key={t} className="flex-1 flex flex-col items-center gap-1">
                            {chip && <span className="text-[8px] font-bold" style={{color:chipColor[chip]||'#fff'}}>{chip.slice(0,2).toUpperCase()}</span>}
                            <div className="w-full rounded-t-md transition-all" style={{
                              height: h,
                              background: isDGW ? 'linear-gradient(180deg,#10b981,#059669)'
                                        : isBGW ? 'linear-gradient(180deg,#ef4444,#dc2626)'
                                        : 'linear-gradient(180deg,#a855f7,#7c3aed)',
                              boxShadow: isDGW ? '0 0 8px rgba(16,185,129,0.4)' : ''
                            }}/>
                            <span className="text-[9px] text-gray-500">{gw}</span>
                            <span className="text-[8px] font-bold text-gray-300">{xp.toFixed(0)}</span>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex gap-3 mt-2 text-[9px]">
                      <span className="text-green-400">■ DGW</span>
                      <span className="text-red-400">■ BGW</span>
                      <span className="text-purple-400">■ Normal</span>
                    </div>
                  </GlassCard>
                )}

                {/* Chip plan */}
                {result.chip_plan && Object.values(result.chip_plan).some(Boolean) && (
                  <GlassCard className="p-4 mb-4">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Chip Plan</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(result.chip_plan).filter(([,c])=>c).map(([t, chip]) => (
                        <div key={t} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{background:chipColor[chip]+'22',border:`1px solid ${chipColor[chip]}44`}}>
                          <i className={'fa-solid text-sm ' + chipIcon[chip]} style={{color:chipColor[chip]}}/>
                          <div>
                            <p className="text-xs font-bold text-white capitalize">{chip}</p>
                            <p className="text-[10px] text-gray-400">GW{(result.current_gw||currentGW)+Number(t)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                )}

                {/* Tabs */}
                <div className="flex border-b border-gray-800/50 mb-4">
                  {[['squad','Squad'],['transfers','Transfer Plan'],['analysis','Analysis']].map(([id,label]) => (
                    <button key={id} onClick={()=>setActiveTab(id)}
                      className={'px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ' + (activeTab===id?'text-purple-400 border-purple-400':'text-gray-400 border-transparent hover:text-white')}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Squad Tab */}
                {activeTab === 'squad' && result.squad?.length > 0 && (
                  <GlassCard className="overflow-hidden" style={{background:'rgba(255,255,255,0.02)'}}>
                    {/* Pitch */}
                    <div className="relative rounded-2xl overflow-hidden" style={{background:'rgba(255,255,255,0.02)'}}>
                      <div className="absolute inset-0" style={{backgroundImage:'linear-gradient(180deg,rgba(16,100,40,0.85) 0%,rgba(20,120,50,0.85) 25%,rgba(16,100,40,0.85) 50%,rgba(20,120,50,0.85) 75%,rgba(16,100,40,0.85) 100%)',backgroundSize:'100% 20%'}}/>
                      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 520" preserveAspectRatio="none" style={{opacity:0.18}}>
                        <rect x="10" y="10" width="380" height="500" fill="none" stroke="white" strokeWidth="2"/>
                        <circle cx="200" cy="260" r="50" fill="none" stroke="white" strokeWidth="1.5"/>
                        <line x1="10" y1="260" x2="390" y2="260" stroke="white" strokeWidth="1.5"/>
                        <rect x="100" y="10" width="200" height="80" fill="none" stroke="white" strokeWidth="1.5"/>
                        <rect x="145" y="10" width="110" height="40" fill="none" stroke="white" strokeWidth="1.5"/>
                        <rect x="100" y="430" width="200" height="80" fill="none" stroke="white" strokeWidth="1.5"/>
                        <rect x="145" y="470" width="110" height="40" fill="none" stroke="white" strokeWidth="1.5"/>
                        <circle cx="200" cy="260" r="3" fill="white"/>
                      </svg>
                      <div className="relative z-10 p-4 pt-6 pb-4 space-y-5">
                        {posRows.map((row, ri) => row.length > 0 && (
                          <div key={ri} className="flex justify-around w-full px-2">
                            {row.map((p, pi) => <PlayerToken key={pi} p={p} photoMap={photoMap} highlight={newIds.has(p.player_id)}/>)}
                          </div>
                        ))}
                      </div>
                      {bench.length > 0 && (
                        <div className="relative z-10 mx-4 mb-4 rounded-xl p-3" style={{background:'rgba(0,0,0,0.35)',border:'1px solid rgba(255,255,255,0.1)'}}>
                          <p className="text-[10px] text-gray-400 text-center mb-3 uppercase tracking-widest">Bench</p>
                          <div className="flex justify-around px-4">
                            {bench.map((p,i) => <PlayerToken key={i} p={p} photoMap={photoMap} highlight={newIds.has(p.player_id)}/>)}
                          </div>
                        </div>
                      )}
                    </div>
                    {newIds.size > 0 && <p className="text-center text-[10px] text-green-400 py-2">N = New Transfer · <span className="text-green-400">2</span> = Double Gameweek</p>}
                  </GlassCard>
                )}

                {/* Transfer Plan Tab */}
                {activeTab === 'transfers' && (
                  <div className="space-y-3">
                    {result.transfer_plan?.length === 0 && (
                      <GlassCard className="p-6 text-center">
                        <i className="fa-solid fa-check-circle text-green-400 text-2xl mb-2"/>
                        <p className="text-gray-300">No transfers needed — squad is already optimal across {horizon} GWs</p>
                      </GlassCard>
                    )}
                    {result.transfer_plan?.map((week, wi) => (
                      <GlassCard key={wi} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">GW{(result.current_gw||currentGW)+week.gw}</span>
                            {week.chip && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold capitalize" style={{background:chipColor[week.chip]+'22',color:chipColor[week.chip],border:`1px solid ${chipColor[week.chip]}44`}}>{week.chip}</span>}
                            {week.hit > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-500/15 text-red-400 border border-red-500/30">-{week.hit*4} pts hit</span>}
                          </div>
                          <span className="text-xs text-gray-500">{week.transfers_in?.length || 0} transfer{week.transfers_in?.length !== 1?'s':''}</span>
                        </div>
                        {week.transfers_out?.map((out, oi) => {
                          const tin = week.transfers_in?.[oi]
                          return (
                            <div key={oi} className="flex items-center gap-3 p-3 bg-[#0F121D]/60 rounded-xl border border-gray-800/50 mb-2">
                              <div className="flex-1 flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center flex-shrink-0">
                                  <i className="fa-solid fa-arrow-up text-red-400 text-xs"/>
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-red-400">{out.name}</p>
                                  <p className="text-xs text-gray-500">OUT · £{out.price?.toFixed(1)}m</p>
                                </div>
                              </div>
                              <i className="fa-solid fa-right-left text-gray-600 text-xs flex-shrink-0"/>
                              {tin && <div className="flex-1 flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center flex-shrink-0">
                                  <i className="fa-solid fa-arrow-down text-green-400 text-xs"/>
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-green-400">{tin.name}</p>
                                  <p className="text-xs text-gray-500">IN · £{tin.price?.toFixed(1)}m · {tin.xp_gw1?.toFixed(1)} xP</p>
                                </div>
                              </div>}
                            </div>
                          )
                        })}
                      </GlassCard>
                    ))}
                  </div>
                )}

                {/* Analysis Tab */}
                {activeTab === 'analysis' && (
                  <div className="grid grid-cols-2 gap-4">
                    <GlassCard className="p-4">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Return on Transfers</p>
                      <div className="space-y-2">
                        <div className="flex justify-between p-2 bg-white/3 rounded-lg">
                          <span className="text-xs text-gray-400">Gross xP</span>
                          <span className="text-sm font-bold text-white">{result.total_xp?.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-white/3 rounded-lg">
                          <span className="text-xs text-gray-400">Hit Penalties</span>
                          <span className="text-sm font-bold text-red-400">-{(result.total_hits||0)*4}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-white/3 rounded-lg">
                          <span className="text-xs text-gray-400">Option Value</span>
                          <span className="text-sm font-bold text-blue-400">+{result.option_value?.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between p-2 rounded-lg border border-purple-500/20 bg-purple-500/5">
                          <span className="text-xs text-purple-300 font-bold">Net xP</span>
                          <span className="text-sm font-black text-purple-400">{result.net_xp?.toFixed(1)}</span>
                        </div>
                      </div>
                    </GlassCard>
                    <GlassCard className="p-4">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Squad Composition</p>
                      {['GKP','DEF','MID','FWD'].map(pos => {
                        const players = (result.squad||[]).filter(p=>p.position===pos)
                        return (
                          <div key={pos} className="flex items-center gap-2 mb-2">
                            <span className="text-xs w-8 font-bold" style={{color:POS_COLOR[pos]}}>{pos}</span>
                            <div className="flex-1 flex gap-1">
                              {players.map((p,i) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded" style={{background:POS_COLOR[pos]+'22',color:POS_COLOR[pos]}}>
                                  {p.name?.split(' ').pop()}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </GlassCard>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
