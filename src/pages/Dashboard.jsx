import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { useUser } from '@clerk/clerk-react'

const MOCK_DATA = {
  gw: 31, manager: 'Navin Dhillon', teamName: 'Saka Potatoes',
  rank: 145201, bank: 0.5, teamValue: 103.2, gwPts: 72, totalPts: 1420,
  chips: ['FH','BB'],
  captain: { id:1, name:'Saka', team:'ARS', pos:'MID', form:8.2, ppg:8.4, xgi:0.71, price:9.8 },
  starters: [
    { id:1, name:'Saka', pos:'MID', team:'ARS', price:9.8, ppg:8.4, xgi:0.71, form:8.2, pts:142, captain:true, vice:false, bench:false },
    { id:2, name:'Salah', pos:'MID', team:'LIV', price:13.1, ppg:9.1, xgi:0.82, form:9.1, pts:168, captain:false, vice:true, bench:false },
    { id:3, name:'Palmer', pos:'MID', team:'CHE', price:10.8, ppg:7.8, xgi:0.65, form:7.4, pts:128, captain:false, vice:false, bench:false },
    { id:4, name:'Watkins', pos:'FWD', team:'AVL', price:8.7, ppg:6.9, xgi:0.58, form:6.2, pts:110, captain:false, vice:false, bench:false },
  ],
  players: [
    { id:1, name:'Saka', pos:'MID', team:'ARS', price:9.8, ppg:8.4, pts:142, captain:true, vice:false, bench:false },
    { id:2, name:'Salah', pos:'MID', team:'LIV', price:13.1, ppg:9.1, pts:168, captain:false, vice:true, bench:false },
    { id:3, name:'Palmer', pos:'MID', team:'CHE', price:10.8, ppg:7.8, pts:128, captain:false, vice:false, bench:false },
    { id:4, name:'Watkins', pos:'FWD', team:'AVL', price:8.7, ppg:6.9, pts:110, captain:false, vice:false, bench:false },
    { id:5, name:'Alexander-Arnold', pos:'DEF', team:'LIV', price:7.2, ppg:6.1, pts:98, captain:false, vice:false, bench:false },
    { id:6, name:'Pedro Porro', pos:'DEF', team:'TOT', price:5.8, ppg:5.2, pts:82, captain:false, vice:false, bench:false },
    { id:7, name:'Flekken', pos:'GKP', team:'BRE', price:4.5, ppg:4.8, pts:74, captain:false, vice:false, bench:false },
    { id:8, name:'Mykolenko', pos:'DEF', team:'EVE', price:4.2, ppg:3.1, pts:48, captain:false, vice:false, bench:true },
    { id:9, name:'Welbeck', pos:'FWD', team:'BHA', price:5.5, ppg:4.2, pts:62, captain:false, vice:false, bench:true },
    { id:10, name:'Mbeumo', pos:'FWD', team:'BRE', price:7.4, ppg:6.4, pts:98, captain:false, vice:false, bench:true },
    { id:11, name:'Raya', pos:'GKP', team:'ARS', price:5.8, ppg:5.4, pts:86, captain:false, vice:false, bench:true },
  ]
}

const fetchFPL = async (path) => {
  const isLocal = window.location.hostname === "localhost"
  const url = isLocal ? `/fpl${path}` : `/api/fpl?path=${encodeURIComponent(path)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error("FPL API error")
  return res.json()
}`)
  if (!res.ok) throw new Error('FPL API error')
  return res.json()
}

const fetchEngine = async (path) => {
  const res = await fetch(`/engine${path}`)
  if (!res.ok) throw new Error('Engine API error')
  return res.json()
}

export default function Dashboard() {
  const { user } = useUser()
  const navigate = useNavigate()
  const [data, setData] = useState(MOCK_DATA)
  const [engineData, setEngineData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [demoMode, setDemoMode] = useState(true)
  const [engineStatus, setEngineStatus] = useState(null)
  const teamId = localStorage.getItem('fplTeamId') || user?.unsafeMetadata?.fplTeamId || '3321638'

  useEffect(() => {
    checkEngine()
    if (teamId && !demoMode) loadData(teamId)
  }, [teamId, demoMode])

  const checkEngine = async () => {
    try {
      const status = await fetchEngine('/api/status')
      setEngineStatus(status)
      if (status.predictions_cached) {
        loadEngineData()
      }
    } catch (e) {
      setEngineStatus(null)
    }
  }

  const loadEngineData = async () => {
    try {
      const [captainRes, diffsRes, essentialsRes] = await Promise.all([
        fetchEngine('/api/captain?top_n=3'),
        fetchEngine('/api/differentials?top_n=4'),
        fetchEngine('/api/essentials?top_n=3'),
      ])
      setEngineData({
        captain: captainRes.captain_picks,
        differentials: diffsRes.differentials,
        essentials: essentialsRes.essential_picks,
      })
    } catch (e) {
      console.log('Engine data load failed:', e)
    }
  }

  const loadData = async (id) => {
    setLoading(true); setError('')
    try {
      const [bootstrap, history] = await Promise.all([
        fetchFPL('/bootstrap-static/'),
        fetchFPL(`/entry/${id}/`)
      ])
      const gwArr = history.current || []
      const gw = gwArr.length ? gwArr[gwArr.length-1].event : (bootstrap.events.find(e=>e.is_current)?.id || 1)
      const picks = await fetchFPL(`/entry/${id}/event/${gw}/picks/`)
      const playerMap = {}
      bootstrap.elements.forEach(p => playerMap[p.id] = p)
      const teamMap = {}
      bootstrap.teams.forEach(t => teamMap[t.id] = t.short_name)
      const players = picks.picks.map(pick => {
        const p = playerMap[pick.element]
        return {
          id: p.id, name: p.web_name, pos: ['','GKP','DEF','MID','FWD'][p.element_type],
          team: teamMap[p.team], price: p.now_cost/10, form: parseFloat(p.form)||0,
          pts: p.total_points, ppg: parseFloat(p.points_per_game)||0,
          xgi: parseFloat(p.expected_goal_involvements_per_90)||0,
          bench: pick.position > 11, captain: pick.is_captain, vice: pick.is_vice_captain,
        }
      })
      const chips = [
        !history.chips?.find(c=>c.name==='wildcard') ? 'WC' : null,
        !history.chips?.find(c=>c.name==='freehit') ? 'FH' : null,
        !history.chips?.find(c=>c.name==='bboost') ? 'BB' : null,
        !history.chips?.find(c=>c.name==='3xc') ? 'TC' : null,
      ].filter(Boolean)
      setData({
        gw, manager: `${history.player_first_name} ${history.player_last_name}`,
        teamName: history.name, rank: history.summary_overall_rank,
        bank: picks.entry_history.bank/10, teamValue: picks.entry_history.value/10,
        gwPts: picks.entry_history.points, totalPts: history.summary_overall_points,
        players, chips, starters: players.filter(p=>!p.bench), captain: players.find(p=>p.captain),
      })
      setDemoMode(false)
    } catch(e) {
      setError('Could not load live FPL data. Showing demo data.')
    }
    setLoading(false)
  }

  // Use engine captain if available, otherwise fall back to squad captain
  const captainPick = engineData?.captain?.[0] || (data.captain ? {
    name: data.captain.name, team: data.captain.team,
    position: data.captain.pos, xp_next_gw: data.captain.ppg,
    captain_score: data.captain.ppg * 2, ownership: 0,
  } : null)

  return (
    <div className="min-h-screen bg-[#0F121D] bg-grid flex text-white">
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] -z-10 pointer-events-none"/>
      <Sidebar/>
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <main className="flex-1 overflow-y-auto custom-scroll p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
          <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">Welcome back, {data?.manager?.split(' ')[0] || 'Manager'}!</h1>
              <p className="text-gray-400 text-lg">Gameweek {data?.gw} &bull; <span className="text-blue-400 font-medium">{data?.teamName}</span></p>
            </div>
            <div className="flex items-center gap-3">
              {demoMode && <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold border border-yellow-500/30">DEMO MODE</span>}
              {engineStatus?.predictions_cached && (
                <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-bold border border-green-500/30">
                  <i className="fa-solid fa-circle-check mr-1"/>ML ENGINE GW{engineStatus.current_gw}
                </span>
              )}
              <button onClick={() => loadData(teamId)} className="neon-button rounded-xl px-5 py-2.5 font-medium flex items-center gap-2 text-sm">
                <i className="fa-solid fa-arrows-rotate"/> Sync Live Data
              </button>
            </div>
          </div>

          {loading && <div className="flex items-center justify-center py-20"><div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/></div>}
          {error && <div className="glass-card rounded-2xl p-4 border border-yellow-500/30 text-yellow-400 mb-6 text-sm"><i className="fa-solid fa-triangle-exclamation mr-2"/>{error}</div>}

          {data && !loading && <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              {[
                { icon:'fa-globe', label:'Overall Rank', value:'#'+data.rank?.toLocaleString(), color:'text-blue-400', badge:null },
                { icon:'fa-bullseye', label:'GW Points', value:`${data.gwPts} / ${data.totalPts}`, color:'text-white', badge:'Avg: 50' },
                { icon:'fa-pound-sign', label:'Team Value', value:'£'+data.teamValue+'m', color:'text-white', badge:'ITB: £'+data.bank+'m' },
                { icon:'fa-layer-group', label:'Chips Available', value:null, color:'', badge:null, chips:data.chips },
              ].map((k,i) => (
                <div key={i} className="glass-card rounded-2xl p-6 relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-full bg-[#1A1D2E] border border-gray-700 flex items-center justify-center">
                      <i className={`fa-solid ${k.icon} text-blue-400`}/>
                    </div>
                    {k.badge && <span className="px-2.5 py-1 rounded-full bg-[#1A1D2E] text-gray-300 text-[10px] font-bold border border-gray-700">{k.badge}</span>}
                  </div>
                  <h3 className="text-sm font-medium text-gray-400 mb-1">{k.label}</h3>
                  {k.chips ? (
                    <div className="flex gap-2 flex-wrap">
                      {['WC','FH','BB','TC'].map(c => (
                        <span key={c} className={`px-2 py-1 rounded text-xs font-medium border ${k.chips.includes(c) ? 'bg-[#1A1D2E] border-blue-500/30 text-blue-400' : 'bg-[#1A1D2E] border-gray-700 text-gray-500 opacity-50 line-through'}`}>{c}</span>
                      ))}
                    </div>
                  ) : (
                    <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <div className="xl:col-span-2 flex flex-col gap-8">
                {/* AI Command Center */}
                <div className="glass-card rounded-[24px] p-6 lg:p-8 border border-blue-500/20">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <i className="fa-solid fa-robot text-blue-400"/> AI Command Center
                      {engineStatus?.predictions_cached && <span className="text-xs text-green-400 font-normal ml-2">(ML Powered)</span>}
                    </h2>
                    <button onClick={() => navigate('/team')} className="neon-button rounded-xl py-3 px-5 font-bold text-sm flex items-center gap-2">
                      <i className="fa-solid fa-sparkles"/> Optimize My Team
                    </button>
                  </div>

                  {/* Captain */}
                  {captainPick && (
                    <div className="bg-[#0F121D]/80 rounded-2xl p-6 border border-gray-700/50 mb-8">
                      <div className="flex flex-col md:flex-row gap-6 items-center">
                        <div className="w-20 h-20 rounded-full bg-[#1A1D2E] border-2 border-blue-500 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.2)] relative">
                          <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[#0F121D] border border-blue-500 flex items-center justify-center">
                            <span className="text-blue-400 font-bold text-xs">C</span>
                          </div>
                          <span className="text-2xl font-bold text-blue-400">{captainPick.name.slice(0,2).toUpperCase()}</span>
                        </div>
                        <div className="flex-1 text-center md:text-left">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase mb-2 border border-blue-500/20">
                            <i className="fa-solid fa-bolt"/> Captain Pick
                          </div>
                          <h3 className="text-2xl font-bold">{captainPick.name}</h3>
                          <p className="text-sm text-gray-400">{captainPick.team} &bull; {captainPick.position}</p>
                        </div>
                        <div className="flex flex-col gap-2 text-center md:border-l border-gray-800 md:pl-6">
                          <div>
                            <p className="text-[10px] text-gray-500 uppercase">xP Next GW</p>
                            <p className="text-2xl font-bold text-blue-400">{captainPick.xp_next_gw?.toFixed(1)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-500 uppercase">Ownership</p>
                            <p className="text-lg font-medium">{captainPick.ownership?.toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Top players — use engine essentials if available */}
                  <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">
                    {engineData?.essentials ? 'AI Top Picks (ML Engine)' : 'Top Squad Players'}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(engineData?.essentials || data.starters.sort((a,b)=>b.ppg-a.ppg).slice(0,4).map(p => ({
                      name: p.name, team: p.team, position: p.pos,
                      xp_gw1: p.ppg, price: p.price,
                    }))).slice(0,4).map((p,i) => (
                      <div key={i} className="bg-[#1A1D2E]/50 rounded-xl p-4 border border-gray-700/50 hover:border-gray-500 transition-colors cursor-pointer">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-medium text-gray-400">{p.position || p.pos}</span>
                          <span className="text-sm font-bold text-white">{p.xp_gw1?.toFixed(1)} <span className="text-[10px] text-gray-500 font-normal">xP</span></span>
                        </div>
                        <p className="text-base font-semibold truncate">{p.name}</p>
                        <p className="text-[11px] text-gray-500 mt-1">{p.team} &bull; £{p.price}m</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Differentials + Transfers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="glass-card rounded-2xl p-6 border border-gray-700/50">
                    <h3 className="text-base font-bold flex items-center gap-2 mb-5">
                      <i className="fa-solid fa-gem text-yellow-400"/> Differentials
                    </h3>
                    <div className="space-y-2">
                      {(engineData?.differentials || []).slice(0,3).map((p,i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-[#0F121D]/60 rounded-xl">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-[10px] font-bold text-yellow-400">
                              {p.name.slice(0,2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white">{p.name}</p>
                              <p className="text-[10px] text-gray-500">{p.team} &bull; {p.ownership?.toFixed(1)}% own</p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-yellow-400">{p.xp_total?.toFixed(1)} xP</span>
                        </div>
                      ))}
                      {!engineData?.differentials && (
                        <p className="text-sm text-gray-400 text-center p-4">Connect engine for AI differentials</p>
                      )}
                    </div>
                  </div>
                  <div className="glass-card rounded-2xl p-6 border border-gray-700/50">
                    <div className="flex justify-between items-center mb-5">
                      <h3 className="text-base font-bold flex items-center gap-2">
                        <i className="fa-solid fa-right-left text-blue-400"/> AI Transfers
                      </h3>
                      <button onClick={() => navigate('/team')} className="text-xs text-blue-400 hover:underline">View All</button>
                    </div>
                    <div className="p-4 rounded-xl bg-[#0F121D]/60 border border-blue-500/20 text-center">
                      <p className="text-sm text-gray-400">Go to My Team & Planner for AI transfer recommendations.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div className="flex flex-col gap-6">
                <div className="glass-card rounded-2xl p-6 border border-gray-700/50">
                  <h3 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-wider">Quick Actions</h3>
                  <div className="space-y-3">
                    <button onClick={() => navigate('/team')} className="w-full neon-button rounded-xl py-4 px-4 font-bold text-sm flex justify-between items-center">
                      <span className="flex items-center gap-2"><i className="fa-solid fa-users text-lg"/> Squad Planner</span>
                      <i className="fa-solid fa-arrow-right"/>
                    </button>
                    <button onClick={() => navigate('/insights')} className="w-full bg-[#1A1D2E] hover:bg-[#252A3F] text-white rounded-xl py-4 px-4 font-bold text-sm flex justify-between items-center border border-gray-700 transition-colors">
                      <span className="flex items-center gap-2"><i className="fa-solid fa-brain text-blue-400"/> AI Insights</span>
                      <i className="fa-solid fa-arrow-right text-gray-500"/>
                    </button>
                    <button onClick={() => navigate('/optimizer')} className="w-full bg-[#1A1D2E] hover:bg-[#252A3F] text-white rounded-xl py-4 px-4 font-bold text-sm flex justify-between items-center border border-gray-700 transition-colors">
                      <span className="flex items-center gap-2"><i className="fa-solid fa-robot text-green-400"/> Run Optimizer</span>
                      <i className="fa-solid fa-arrow-right text-gray-500"/>
                    </button>
                  </div>
                </div>
                <div className="glass-card rounded-2xl p-6 border border-gray-700/50 flex-1">
                  <h3 className="text-sm font-bold mb-4">Your Squad</h3>
                  <div className="space-y-2 overflow-y-auto custom-scroll max-h-80">
                    {data.players.map(p => (
                      <div key={p.id} className={`flex items-center justify-between p-2 rounded-lg ${p.bench ? 'opacity-50' : ''}`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${p.pos==='GKP'?'bg-yellow-500/20 text-yellow-400':p.pos==='DEF'?'bg-green-500/20 text-green-400':p.pos==='MID'?'bg-blue-500/20 text-blue-400':'bg-red-500/20 text-red-400'}`}>{p.pos}</span>
                          <span className="text-sm text-white font-medium">{p.name}</span>
                          {p.captain && <span className="text-[9px] bg-blue-500 text-white px-1 rounded font-bold">C</span>}
                          {p.vice && <span className="text-[9px] bg-gray-600 text-white px-1 rounded font-bold">V</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">{p.team}</span>
                          <span className="text-xs text-blue-400 font-medium">£{p.price}m</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>}
        </main>
      </div>
    </div>
  )
}

