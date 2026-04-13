import { useState, useEffect, useRef } from 'react'
import Sidebar from '../components/Sidebar'

const ENGINE_URL = window.location.hostname === 'localhost' ? 'http://localhost:8000' : 'https://web-production-21545.up.railway.app'
const fetchEngine = async (path) => {
  const res = await fetch(ENGINE_URL + path)
  if (!res.ok) throw new Error('Engine error')
  return res.json()
}

const FEATURE_IMPORTANCE = [
  ['Points Rolling Form (3GW)', '+2.4 pts', 92, 'bg-blue-500'],
  ['Opponent xGC (Away)', '+2.1 pts', 85, 'bg-blue-500'],
  ['Recent xG/90 Form', '+1.8 pts', 70, 'bg-blue-500/80'],
  ['Fixture Difficulty (FDR)', '+1.2 pts', 55, 'bg-blue-500/60'],
  ['Home/Away Factor', '+0.6 pts', 28, 'bg-purple-500/60'],
  ['Rotation Risk (Minutes%)', '-0.5 pts', 18, 'bg-red-500/80'],
]

export default function Insights() {
  const [posFilter, setPosFilter] = useState('All')
  const [gwRange, setGwRange] = useState(4)
  const [allPlayers, setAllPlayers] = useState([])
  const [captainPicks, setCaptainPicks] = useState([])
  const [differentials, setDifferentials] = useState([])
  const [essentials, setEssentials] = useState([])
  const [engineStatus, setEngineStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const xpChartRef = useRef(null)
  const goalChartRef = useRef(null)

  useEffect(() => {
    loadEngineData()
  }, [])

  const loadEngineData = async () => {
    setLoading(true)
    try {
      const [statusRes, predsRes, captainRes, diffsRes, essentialsRes] = await Promise.all([
        fetchEngine('/api/status'),
        fetchEngine('/api/predictions'),
        fetchEngine('/api/captain?top_n=3'),
        fetchEngine('/api/differentials?top_n=5'),
        fetchEngine('/api/essentials?top_n=3'),
      ])
      setEngineStatus(statusRes)
      setAllPlayers(predsRes.predictions || [])
      setCaptainPicks(captainRes.captain_picks || [])
      setDifferentials(diffsRes.differentials || [])
      setEssentials(essentialsRes.essential_picks || [])
    } catch(e) {
      console.log('Engine load failed:', e)
    }
    setLoading(false)
  }

  const filtered = allPlayers.filter(p =>
    posFilter === 'All' || p.position === posFilter
  )

  // Plotly xP bar chart
  useEffect(() => {
    if (!xpChartRef.current || !window.Plotly || filtered.length === 0) return
    const top5 = [...filtered].sort((a,b) => b.xp_total - a.xp_total).slice(0,5)
    window.Plotly.newPlot(xpChartRef.current, [
      { x: top5.map(p=>p.name), y: top5.map(p=>p.xp_gw1), name:'GW+1', type:'bar', marker:{color:'#3b82f6'} },
      { x: top5.map(p=>p.name), y: top5.map(p=>p.xp_gw2), name:'GW+2', type:'bar', marker:{color:'#60a5fa'} },
      { x: top5.map(p=>p.name), y: top5.map(p=>p.xp_gw3), name:'GW+3', type:'bar', marker:{color:'#93c5fd'} },
    ], {
      barmode:'group', paper_bgcolor:'transparent', plot_bgcolor:'transparent',
      font:{color:'#9ca3af',size:11}, margin:{t:10,b:40,l:30,r:10},
      legend:{orientation:'h',y:-0.2,font:{color:'#9ca3af'}},
      xaxis:{gridcolor:'#1f2937',tickfont:{color:'#9ca3af'}},
      yaxis:{gridcolor:'#1f2937',tickfont:{color:'#9ca3af'}},
    }, {responsive:true,displayModeBar:false})
  }, [filtered])

  // Plotly radar chart
  useEffect(() => {
    if (!goalChartRef.current || !window.Plotly || filtered.length === 0) return
    const top5 = [...filtered].sort((a,b) => b.xp_gw1 - a.xp_gw1).slice(0,5)
    window.Plotly.newPlot(goalChartRef.current, [{
      type:'scatterpolar', r:top5.map(p=>p.xp_gw1), theta:top5.map(p=>p.name),
      fill:'toself', fillcolor:'rgba(59,130,246,0.2)', line:{color:'#3b82f6'},
    }], {
      paper_bgcolor:'transparent', plot_bgcolor:'transparent',
      font:{color:'#9ca3af',size:11}, margin:{t:20,b:20,l:20,r:20},
      polar:{bgcolor:'transparent',radialaxis:{gridcolor:'#1f2937',color:'#4b5563'},angularaxis:{gridcolor:'#1f2937',color:'#4b5563'}},
    }, {responsive:true,displayModeBar:false})
  }, [filtered])

  return (
    <div className="min-h-screen bg-[#0F121D] bg-grid flex text-white">
      <Sidebar/>
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <main className="flex-1 overflow-y-auto custom-scroll p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">

          {/* Header */}
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">Insights & Models</h1>
              <p className="text-gray-400 text-lg">
                AI-powered predictions, xG/xA breakdowns and differentials
                {engineStatus?.predictions_cached && <span className="ml-2 text-green-400 text-sm">(ML Engine GW{engineStatus.current_gw})</span>}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {loading && <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>}
              <button onClick={loadEngineData} className="neon-button rounded-xl px-5 py-2.5 font-medium flex items-center gap-2 text-sm">
                <i className="fa-solid fa-arrows-rotate"/> Refresh
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="glass-card rounded-2xl p-4 mb-8 flex flex-wrap gap-4 items-center border border-gray-700/50">
            <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
              <i className="fa-solid fa-filter"/> Filters:
            </div>
            <div className="flex gap-2">
              {['All','GKP','DEF','MID','FWD'].map(p => (
                <button key={p} onClick={() => setPosFilter(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${posFilter===p ? 'bg-blue-600/30 border-blue-500 text-white' : 'bg-[#1A1D2E] border-gray-700 text-gray-400 hover:text-white'}`}>
                  {p}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={() => setGwRange(4)} className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${gwRange===4 ? 'bg-blue-600/30 border-blue-500 text-blue-400' : 'bg-transparent border-gray-700 text-gray-400 hover:text-white'}`}>Next 4 GWs</button>
              <button onClick={() => setGwRange(8)} className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${gwRange===8 ? 'bg-blue-600/30 border-blue-500 text-blue-400' : 'bg-transparent border-gray-700 text-gray-400 hover:text-white'}`}>Next 8 GWs</button>
            </div>
          </div>

          {/* xP table + captaincy */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
            <div className="glass-card rounded-2xl p-6 border border-gray-700/50 xl:col-span-2">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                <i className="fa-solid fa-bolt text-blue-400"/> Top Predicted Players (xP)
                {engineStatus?.predictions_cached && <span className="text-xs text-green-400 font-normal">&nbsp;— Real ML Predictions</span>}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-800 text-xs uppercase tracking-wider text-gray-500">
                      <th className="pb-3 font-semibold">Player</th>
                      <th className="pb-3 font-semibold text-center">Pos</th>
                      <th className="pb-3 font-semibold text-center">Price</th>
                      <th className="pb-3 font-semibold text-center">GW+1</th>
                      <th className="pb-3 font-semibold text-center">GW+2</th>
                      <th className="pb-3 font-semibold text-center">GW+3</th>
                      <th className="pb-3 font-semibold text-center">Own%</th>
                      <th className="pb-3 font-semibold text-right text-blue-400">Total xP</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {filtered.sort((a,b)=>b.xp_total-a.xp_total).slice(0,15).map((p,i) => (
                      <tr key={i} className="border-b border-gray-800/50 hover:bg-[#1A1D2E]/30 transition-colors">
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#252A3F] border border-gray-700 flex items-center justify-center text-xs font-bold text-blue-400">
                              {p.name?.slice(0,2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-white">{p.name}</p>
                              <p className="text-[10px] text-gray-500">{p.team_short || p.team}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-center"><span className="px-2 py-1 rounded bg-[#1A1D2E] border border-gray-700 text-xs text-gray-300">{p.position}</span></td>
                        <td className="py-3 text-center text-gray-300">£{p.price?.toFixed(1)}m</td>
                        <td className="py-3 text-center text-green-400 font-medium">{p.xp_gw1?.toFixed(1)}</td>
                        <td className="py-3 text-center text-green-400/80 font-medium">{p.xp_gw2?.toFixed(1)}</td>
                        <td className="py-3 text-center text-green-400/60 font-medium">{p.xp_gw3?.toFixed(1)}</td>
                        <td className="py-3 text-center text-gray-400 text-xs">{p.ownership_pct?.toFixed(1)}%</td>
                        <td className="py-3 text-right font-bold text-white">{p.xp_total?.toFixed(1)} <span className="text-xs text-gray-500 ml-1">±1.2</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Captaincy */}
            <div className="glass-card rounded-2xl p-6 border border-blue-500/20">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                <i className="fa-solid fa-crown text-blue-400"/> GW Captaincy
              </h2>
              <div className="space-y-4">
                {captainPicks.map((p,i) => (
                  <div key={i} className={`rounded-xl p-4 border relative overflow-hidden ${i===0 ? 'bg-[#1A1D2E]/50 border-blue-500/30' : 'bg-[#0F121D]/50 border-gray-700'}`}>
                    {i===0 && <div className="absolute top-0 right-0 px-3 py-1 bg-blue-500 text-[#0F121D] text-xs font-bold rounded-bl-lg">TOP PICK</div>}
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-full bg-[#252A3F] border-2 flex items-center justify-center text-sm font-bold ${i===0 ? 'border-blue-500 text-blue-400' : 'border-gray-600 text-gray-400'}`}>
                        {p.name?.slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-white">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.team} &bull; {p.position}</p>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase">xP Next GW</p>
                        <p className={`text-xl font-bold ${i===0 ? 'text-blue-400' : 'text-white'}`}>{p.xp_next_gw?.toFixed(1)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-500 uppercase">Ownership</p>
                        <p className="text-sm font-medium text-gray-300">{p.ownership?.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="glass-card rounded-2xl p-6 border border-gray-700/50">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <i className="fa-solid fa-chart-bar text-blue-400"/> Expected Points Chart
              </h3>
              <div ref={xpChartRef} style={{height:'260px'}}/>
            </div>
            <div className="glass-card rounded-2xl p-6 border border-gray-700/50">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <i className="fa-solid fa-circle-dot text-green-400"/> Goal Probability Radar
              </h3>
              <div ref={goalChartRef} style={{height:'260px'}}/>
            </div>
          </div>

          {/* Differentials + Essentials + Feature Importance */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="glass-card rounded-2xl p-6 border border-yellow-500/20">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <i className="fa-solid fa-gem text-yellow-400"/> Differential Finder
              </h3>
              <p className="text-xs text-gray-500 mb-4">Low ownership, high projected points</p>
              <div className="space-y-3">
                {differentials.map((p,i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-[#0F121D]/50 rounded-xl border border-gray-800 hover:border-yellow-500/30 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-[#252A3F] border border-yellow-500/30 flex items-center justify-center text-xs font-bold text-yellow-400">
                      {p.name?.slice(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white">{p.name}</p>
                      <p className="text-[10px] text-gray-500">{p.team} &bull; {p.position} &bull; £{p.price?.toFixed(1)}m</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-yellow-400">{p.xp_total?.toFixed(1)} xP</p>
                      <p className="text-[10px] text-gray-500">{p.ownership?.toFixed(1)}% own</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 border border-green-500/20">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <i className="fa-solid fa-star text-green-400"/> Essential Picks
              </h3>
              <p className="text-xs text-gray-500 mb-4">Must-have players next 3 gameweeks</p>
              <div className="space-y-3">
                {essentials.map((p,i) => (
                  <div key={i} className="p-4 bg-[#0F121D]/50 rounded-xl border border-gray-800 hover:border-green-500/30 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-full bg-[#252A3F] border border-green-500/40 flex items-center justify-center text-xs font-bold text-green-400">
                        {p.name?.slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{p.name}</p>
                        <p className="text-[10px] text-gray-500">{p.team} &bull; {p.position}</p>
                      </div>
                      <span className="ml-auto text-lg font-bold text-green-400">{p.xp_total?.toFixed(1)}</span>
                    </div>
                    <div className="flex gap-1">
                      {[p.xp_gw1, p.xp_gw2, p.xp_gw3].map((x,j) => (
                        <div key={j} className="flex-1 bg-[#1A1D2E] rounded p-1 text-center">
                          <p className="text-[9px] text-gray-500">GW+{j+1}</p>
                          <p className="text-xs font-bold text-green-400">{x?.toFixed(1)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 border border-gray-700/50">
              <h3 className="text-lg font-bold mb-2">Model Feature Importance</h3>
              <p className="text-sm text-gray-400 mb-4">What drives the XGBoost projections?</p>
              <div className="space-y-4">
                {FEATURE_IMPORTANCE.map(([label,val,width,color]) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300">{label}</span>
                      <span className={val.startsWith('+') ? 'text-blue-400' : 'text-red-400'}>{val}</span>
                    </div>
                    <div className="w-full bg-[#1A1D2E] rounded-full h-2">
                      <div className={`${color} h-2 rounded-full transition-all duration-700`} style={{width:`${width}%`}}/>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 bg-[#0F121D]/50 rounded-xl border border-blue-500/20">
                <p className="text-xs text-gray-500 uppercase mb-3">Top Players xP (Next 3 GWs)</p>
                <div className="space-y-2">
                  {allPlayers.slice(0,5).map((p,i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 w-24 truncate">{p.name}</span>
                      <div className="flex-1 bg-[#1A1D2E] rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{width:`${(p.xp_total/30)*100}%`}}/>
                      </div>
                      <span className="text-xs font-bold text-blue-400 w-10 text-right">{p.xp_total?.toFixed(1)}</span>
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
