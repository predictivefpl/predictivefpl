import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { useUser } from '@clerk/clerk-react'

const fetchFPL = async (path) => {
  const isLocal = false // Always use Railway engine
  const ENGINE_URL = 'https://web-production-21545.up.railway.app'
  const url = isLocal ? "/fpl" + path : "/api/fpl?path=" + encodeURIComponent(path)
  const res = await fetch(url)
  if (!res.ok) throw new Error("FPL API error")
  return res.json()
}

const ENGINE_URL = window.location.hostname === 'localhost' ? 'http://localhost:8000' : 'https://web-production-21545.up.railway.app'
const fetchEngine = async (path) => {
  const res = await fetch(ENGINE_URL + path)
  if (!res.ok) throw new Error('Engine error')
  return res.json()
}

export default function Dashboard() {
  const { user } = useUser()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [engineData, setEngineData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [engineStatus, setEngineStatus] = useState(null)

  localStorage.removeItem('pref_demoMode')
  const teamId = (user?.unsafeMetadata?.fplTeamId) || localStorage.getItem("fplTeamId")

  useEffect(() => {
    if (!teamId && !user?.unsafeMetadata?.fplTeamId) {
      navigate("/connect")
      return
    }
    loadData(teamId)
    checkEngine()
  }, [teamId])

  const checkEngine = async () => {
    try {
      const status = await fetchEngine("/api/status")
      setEngineStatus(status)
      if (status.predictions_cached) loadEngineData()
    } catch (e) {}
  }

  const loadEngineData = async () => {
    try {
      const [captainRes, diffsRes, essentialsRes] = await Promise.all([
        fetchEngine("/api/captain?top_n=3"),
        fetchEngine("/api/differentials?top_n=4"),
        fetchEngine("/api/essentials?top_n=3"),
      ])
      setEngineData({
        captain: captainRes.captain_picks,
        differentials: diffsRes.differentials,
        essentials: essentialsRes.essential_picks,
      })
    } catch (e) {}
  }

  const loadData = async (id) => {
    setLoading(true)
    setError("")
    try {
      const [bootstrap, entry] = await Promise.all([
        fetchFPL("/bootstrap-static/"),
        fetchFPL("/entry/" + id + "/")
      ])
      const gwArr = entry.current || []
      const gw = gwArr.length
        ? gwArr[gwArr.length - 1].event
        : (bootstrap.events.find(e => e.is_current)?.id || 1)
      const picks = await fetchFPL("/entry/" + id + "/event/" + gw + "/picks/")
      const playerMap = {}
      bootstrap.elements.forEach(p => { playerMap[p.id] = p })
      const teamMap = {}
      bootstrap.teams.forEach(t => { teamMap[t.id] = t.short_name })
      const players = picks.picks.map(pick => {
        const p = playerMap[pick.element]
        return {
          id: p.id,
          name: p.web_name,
          pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type],
          team: teamMap[p.team],
          price: p.now_cost / 10,
          form: parseFloat(p.form) || 0,
          pts: p.total_points,
          ppg: parseFloat(p.points_per_game) || 0,
          xgi: parseFloat(p.expected_goal_involvements_per_90) || 0,
          bench: pick.position > 11,
          captain: pick.is_captain,
          vice: pick.is_vice_captain,
        }
      })
      const chips = ["wildcard", "freehit", "bboost", "3xc"].map(name => {
        const used = entry.chips?.find(c => c.name === name)
        return { name, used: !!used }
      })
      setData({
        gw,
        manager: entry.player_first_name + " " + entry.player_last_name,
        teamName: entry.name,
        rank: entry.summary_overall_rank,
        bank: picks.entry_history.bank / 10,
        teamValue: picks.entry_history.value / 10,
        gwPts: picks.entry_history.points,
        totalPts: entry.summary_overall_points,
        players,
        chips,
        starters: players.filter(p => !p.bench),
        captain: players.find(p => p.captain),
      })
    } catch (e) {
      setError("Could not load FPL data: " + e.message)
    }
    setLoading(false)
  }

  const captainPick = engineData?.captain?.[0] || (data?.captain ? {
    name: data.captain.name, team: data.captain.team,
    position: data.captain.pos, xp_next_gw: data.captain.ppg,
    captain_score: data.captain.ppg * 2, ownership: 0,
  } : null)

  if (loading) return (
    <div className="min-h-screen bg-[#0F121D] flex items-center justify-center text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
        <p className="text-gray-400">Loading your FPL data...</p>
      </div>
    </div>
  )

  if (!data) return (
    <div className="min-h-screen bg-[#0F121D] flex items-center justify-center text-white">
      <div className="text-center">
        <p className="text-red-400 mb-4">{error || "Failed to load data"}</p>
        <button onClick={() => loadData(teamId)} className="neon-button rounded-xl px-6 py-3">Retry</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0F121D] bg-grid flex text-white">
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] -z-10 pointer-events-none"/>
      <Sidebar/>
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <main className="flex-1 overflow-y-auto custom-scroll p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
          <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">Welcome back, {data.manager.split(" ")[0]}!</h1>
              <p className="text-gray-400 text-lg">Gameweek {data.gw} &bull; <span className="text-blue-400 font-medium">{data.teamName}</span></p>
            </div>
            <div className="flex items-center gap-3">
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

          {error && <div className="glass-card rounded-2xl p-4 border border-yellow-500/30 text-yellow-400 mb-6 text-sm"><i className="fa-solid fa-triangle-exclamation mr-2"/>{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {[
              { icon:"fa-globe", label:"Overall Rank", value:"#"+data.rank?.toLocaleString(), color:"text-blue-400" },
              { icon:"fa-bullseye", label:"GW Points", value:data.gwPts+" / "+data.totalPts, badge:"Avg: 50" },
              { icon:"fa-pound-sign", label:"Team Value", value:"£"+data.teamValue+"m", badge:"ITB: £"+data.bank+"m" },
              { icon:"fa-layer-group", label:"Chips Available", chips: data.chips },
            ].map((k,i) => (
              <div key={i} className="glass-card rounded-2xl p-6 relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#1A1D2E] border border-gray-700 flex items-center justify-center">
                    <i className={"fa-solid "+k.icon+" text-blue-400"}/>
                  </div>
                  {k.badge && <span className="px-2.5 py-1 rounded-full bg-[#1A1D2E] text-gray-300 text-[10px] font-bold border border-gray-700">{k.badge}</span>}
                </div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">{k.label}</h3>
                {k.chips ? (
                  <div className="flex gap-2 flex-wrap">
                    {k.chips.map(c => (
                      <span key={c.name} className={"px-2 py-1 rounded text-xs font-medium border " + (!c.used ? "bg-[#1A1D2E] border-blue-500/30 text-blue-400" : "bg-[#1A1D2E] border-gray-700 text-gray-500 opacity-50 line-through")}>
                        {c.name === "wildcard" ? "WC" : c.name === "freehit" ? "FH" : c.name === "bboost" ? "BB" : "TC"}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className={"text-3xl font-bold "+(k.color||"text-white")}>{k.value}</p>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2 flex flex-col gap-8">
              <div className="glass-card rounded-[24px] p-6 lg:p-8 border border-blue-500/20">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <i className="fa-solid fa-robot text-blue-400"/> AI Command Center
                    {engineStatus?.predictions_cached && <span className="text-xs text-green-400 font-normal ml-2">(ML Powered)</span>}
                  </h2>
                  <button onClick={() => navigate("/optimizer")} className="neon-button rounded-xl py-3 px-5 font-bold text-sm flex items-center gap-2">
                    <i className="fa-solid fa-sparkles"/> Optimize My Team
                  </button>
                </div>
                {captainPick && (
                  <div className="bg-[#0F121D]/80 rounded-2xl p-6 border border-gray-700/50 mb-8">
                    <div className="flex flex-col md:flex-row gap-6 items-center">
                      <div className="w-20 h-20 rounded-full bg-[#1A1D2E] border-2 border-blue-500 flex items-center justify-center relative">
                        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[#0F121D] border border-blue-500 flex items-center justify-center">
                          <span className="text-blue-400 font-bold text-xs">C</span>
                        </div>
                        <span className="text-2xl font-bold text-blue-400">{captainPick.name?.slice(0,2).toUpperCase()}</span>
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
                <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">
                  {engineData?.essentials ? "AI Top Picks (ML Engine)" : "Top Squad Players"}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(engineData?.essentials || data.starters.sort((a,b)=>b.ppg-a.ppg).slice(0,4).map(p => ({
                    name:p.name, team:p.team, position:p.pos, xp_gw1:p.ppg, price:p.price
                  }))).slice(0,4).map((p,i) => (
                    <div key={i} className="bg-[#1A1D2E]/50 rounded-xl p-4 border border-gray-700/50 hover:border-gray-500 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-medium text-gray-400">{p.position||p.pos}</span>
                        <span className="text-sm font-bold text-white">{p.xp_gw1?.toFixed(1)} <span className="text-[10px] text-gray-500 font-normal">xP</span></span>
                      </div>
                      <p className="text-base font-semibold truncate">{p.name}</p>
                      <p className="text-[11px] text-gray-500 mt-1">{p.team} &bull; £{p.price?.toFixed(1)}m</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card rounded-2xl p-6 border border-gray-700/50">
                  <h3 className="text-base font-bold flex items-center gap-2 mb-5">
                    <i className="fa-solid fa-gem text-yellow-400"/> Differentials
                  </h3>
                  <div className="space-y-2">
                    {(engineData?.differentials||[]).slice(0,3).map((p,i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-[#0F121D]/60 rounded-xl">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-[10px] font-bold text-yellow-400">
                            {p.name?.slice(0,2).toUpperCase()}
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
                      <p className="text-sm text-gray-400 text-center p-4">Engine offline — differentials unavailable</p>
                    )}
                  </div>
                </div>
                <div className="glass-card rounded-2xl p-6 border border-gray-700/50">
                  <div className="flex justify-between items-center mb-5">
                    <h3 className="text-base font-bold flex items-center gap-2">
                      <i className="fa-solid fa-right-left text-blue-400"/> AI Transfers
                    </h3>
                    <button onClick={() => navigate("/team")} className="text-xs text-blue-400 hover:underline">View All</button>
                  </div>
                  <div className="p-4 rounded-xl bg-[#0F121D]/60 border border-blue-500/20 text-center">
                    <p className="text-sm text-gray-400">Go to My Team for AI transfer recommendations.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-6">
              <div className="glass-card rounded-2xl p-6 border border-gray-700/50">
                <h3 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-wider">Quick Actions</h3>
                <div className="space-y-3">
                  <button onClick={() => navigate("/team")} className="w-full neon-button rounded-xl py-4 px-4 font-bold text-sm flex justify-between items-center">
                    <span className="flex items-center gap-2"><i className="fa-solid fa-users text-lg"/> Squad Planner</span>
                    <i className="fa-solid fa-arrow-right"/>
                  </button>
                  <button onClick={() => navigate("/insights")} className="w-full bg-[#1A1D2E] hover:bg-[#252A3F] text-white rounded-xl py-4 px-4 font-bold text-sm flex justify-between items-center border border-gray-700 transition-colors">
                    <span className="flex items-center gap-2"><i className="fa-solid fa-brain text-blue-400"/> AI Insights</span>
                    <i className="fa-solid fa-arrow-right text-gray-500"/>
                  </button>
                  <button onClick={() => navigate("/optimizer")} className="w-full bg-[#1A1D2E] hover:bg-[#252A3F] text-white rounded-xl py-4 px-4 font-bold text-sm flex justify-between items-center border border-gray-700 transition-colors">
                    <span className="flex items-center gap-2"><i className="fa-solid fa-robot text-green-400"/> Run Optimizer</span>
                    <i className="fa-solid fa-arrow-right text-gray-500"/>
                  </button>
                </div>
              </div>
              <div className="glass-card rounded-2xl p-6 border border-gray-700/50 flex-1">
                <h3 className="text-sm font-bold mb-4">Your Squad</h3>
                <div className="space-y-2 overflow-y-auto custom-scroll max-h-80">
                  {data.players.map(p => (
                    <div key={p.id} className={"flex items-center justify-between p-2 rounded-lg "+(p.bench?"opacity-50":"")}>
                      <div className="flex items-center gap-2">
                        <span className={"text-[10px] px-1.5 py-0.5 rounded font-bold "+(p.pos==="GKP"?"bg-yellow-500/20 text-yellow-400":p.pos==="DEF"?"bg-green-500/20 text-green-400":p.pos==="MID"?"bg-blue-500/20 text-blue-400":"bg-red-500/20 text-red-400")}>{p.pos}</span>
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
        </main>
      </div>
    </div>
  )
}





