import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import Sidebar from '../components/Sidebar'

const POS_ORDER = { GKP:0, DEF:1, MID:2, FWD:3 }
const POS_COLORS = {
  GKP:'border-yellow-400 bg-yellow-400/10 text-yellow-400',
  DEF:'border-green-400 bg-green-400/10 text-green-400',
  MID:'border-blue-400 bg-blue-400/10 text-blue-400',
  FWD:'border-red-400 bg-red-400/10 text-red-400',
}

function PitchPlayer({ p, selected, onClick }) {
  return (
    <div className={"flex flex-col items-center cursor-pointer group "+(selected?"scale-105":"")} onClick={()=>onClick(p)}>
      <div className={"w-12 h-12 rounded-full border-2 flex items-center justify-center mb-1 relative transition-all group-hover:scale-110 "+POS_COLORS[p.pos]+(p.captain?" shadow-[0_0_12px_rgba(59,130,246,0.5)]":"")}>
        <span className="text-xs font-bold text-white">{p.name.slice(0,3).toUpperCase()}</span>
        {p.captain && <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-[8px] font-bold text-white">C</div>}
        {p.vice && <div className="absolute -top-1 -right-1 w-4 h-4 bg-gray-500 rounded-full flex items-center justify-center text-[8px] font-bold text-white">V</div>}
      </div>
      <div className="bg-[#0F121D]/90 rounded px-2 py-0.5 text-center min-w-[56px]">
        <p className="text-[11px] font-bold text-white truncate">{p.name.split(' ').pop()}</p>
        <p className="text-[10px] text-blue-400 font-medium">{p.team}</p>
        <p className="text-[10px] text-green-400 font-medium">{p.ppg} pts</p>
      </div>
    </div>
  )
}

export default function MyTeam() {
  const { user } = useUser()
  const navigate = useNavigate()
  const [squad, setSquad] = useState([])
  const [meta, setMeta] = useState({ gw:0, bank:0, value:0, teamName:'' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)

  const teamId = (user?.unsafeMetadata?.fplTeamId) || localStorage.getItem('fplTeamId')

  useEffect(() => {
    if (!teamId) { navigate('/connect'); return }
    loadTeam(teamId)
  }, [teamId])

  const loadTeam = async (id) => {
    setLoading(true)
    setError('')
    try {
      const isLocal = window.location.hostname === 'localhost'
      const base = isLocal ? '/fpl' : '/api/fpl?path='
      const url = (path) => isLocal ? base + path : base + encodeURIComponent(path)

      const [bootstrap, entry] = await Promise.all([
        fetch(url('/bootstrap-static/')).then(r => { if(!r.ok) throw new Error('Bootstrap failed'); return r.json() }),
        fetch(url('/entry/' + id + '/')).then(r => { if(!r.ok) throw new Error('Entry failed'); return r.json() })
      ])

      const events = bootstrap.events || []
      const currentEvent = events.find(e => e.is_current) || events.find(e => e.is_next) || events[events.length-1]
      const gw = currentEvent?.id || 1

      const picks = await fetch(url('/entry/' + id + '/event/' + gw + '/picks/')).then(r => { if(!r.ok) throw new Error('Picks failed'); return r.json() })

      const playerMap = {}
      bootstrap.elements.forEach(p => { playerMap[p.id] = p })
      const teamMap = {}
      bootstrap.teams.forEach(t => { teamMap[t.id] = t.short_name })

      const players = picks.picks.map(pick => {
        const p = playerMap[pick.element]
        if (!p) return null
        return {
          id: p.id,
          name: p.web_name,
          pos: ['','GKP','DEF','MID','FWD'][p.element_type],
          team: teamMap[p.team] || '???',
          price: p.now_cost / 10,
          form: parseFloat(p.form) || 0,
          pts: p.total_points,
          ppg: parseFloat(p.points_per_game) || 0,
          xgi: parseFloat(p.expected_goal_involvements_per_90) || 0,
          bench: pick.position > 11,
          captain: pick.is_captain,
          vice: pick.is_vice_captain,
          position: pick.position,
        }
      }).filter(Boolean)

      setSquad(players)
      setMeta({
        gw,
        bank: picks.entry_history.bank / 10,
        value: picks.entry_history.value / 10,
        teamName: entry.name,
      })
    } catch(e) {
      setError('Failed to load team: ' + e.message)
      console.error('MyTeam load error:', e)
    }
    setLoading(false)
  }

  const starters = squad.filter(p => !p.bench).sort((a,b) => POS_ORDER[a.pos]-POS_ORDER[b.pos])
  const bench = squad.filter(p => p.bench).sort((a,b) => a.position-b.position)
  const rowGKP = starters.filter(p => p.pos==='GKP')
  const rowDEF = starters.filter(p => p.pos==='DEF')
  const rowMID = starters.filter(p => p.pos==='MID')
  const rowFWD = starters.filter(p => p.pos==='FWD')
  const projectedPts = starters.reduce((sum,p) => {
    let pts = p.ppg
    if (p.captain) pts *= 2
    return sum + pts
  }, 0).toFixed(1)


  return (
    <div className="min-h-screen bg-[#0F121D] bg-grid flex text-white">
      <Sidebar/>
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-[60px] px-6 flex items-center justify-between border-b border-gray-800/50 bg-[#0F121D] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#1A1D2E] rounded-md px-3 py-1.5 border border-blue-500/30">
              <span className="text-blue-400 text-xs">GW</span>
              <span className="text-white text-sm font-semibold">{meta.gw}</span>
            </div>
            <div className="flex items-center gap-2 bg-[#1A1D2E] rounded-md px-3 py-1.5 border border-gray-700">
              <span className="text-gray-400 text-xs">Bank:</span>
              <span className="text-green-400 text-sm font-semibold">£{meta.bank}m</span>
            </div>
            <div className="flex items-center gap-2 bg-[#1A1D2E] rounded-md px-3 py-1.5 border border-gray-700">
              <span className="text-gray-400 text-xs">Value:</span>
              <span className="text-white text-sm font-semibold">£{meta.value}m</span>
            </div>
            <div className="flex items-center gap-2 bg-[#1A1D2E] rounded-md px-3 py-1.5 border border-purple-500/30">
              <span className="text-purple-400 text-xs">Proj:</span>
              <span className="text-white text-sm font-semibold">{projectedPts} pts</span>
            </div>
          </div>
          <button onClick={() => loadTeam(teamId)} className="neon-button rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-2">
            <i className="fa-solid fa-arrows-rotate"/> Refresh
          </button>
        </header>

        <main className="flex-1 overflow-y-auto custom-scroll p-6 flex gap-6">
          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                <p className="text-gray-400 text-sm">Loading your squad...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-red-400 mb-4">{error}</p>
                <button onClick={() => loadTeam(teamId)} className="neon-button rounded-xl px-6 py-3">Retry</button>
              </div>
            </div>
          )}

          {!loading && !error && squad.length > 0 && (
            <div className="flex-1 flex flex-col gap-4 min-w-0">
              {/* Chips */}
              <div className="glass-card rounded-2xl p-3 flex items-center gap-3 flex-wrap">
                
              </div>

              {/* Pitch */}
              <div className="flex-1 rounded-xl overflow-hidden relative" style={{minHeight:'520px', background:'linear-gradient(180deg,#1a6e43 0%,#1d7a4a 50%,#1a6e43 100%)'}}>
                <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                  <rect x="5" y="2" width="90" height="96" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5"/>
                  <line x1="5" y1="50" x2="95" y2="50" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5"/>
                  <circle cx="50" cy="50" r="12" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5"/>
                  <rect x="30" y="2" width="40" height="15" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
                  <rect x="30" y="83" width="40" height="15" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
                </svg>
                <div className="relative z-10 flex flex-col justify-between py-6 px-4 h-full">
                  {[rowGKP, rowDEF, rowMID, rowFWD].map((row,ri) => (
                    <div key={ri} className="flex justify-around w-full">
                      {row.map(p => <PitchPlayer key={p.id} p={p} selected={selected?.id===p.id} onClick={setSelected}/>)}
                    </div>
                  ))}
                  <div className="border-t border-dashed border-white/20 pt-4">
                    <p className="text-center text-xs text-white/40 font-semibold tracking-widest uppercase mb-3">BENCH</p>
                    <div className="flex justify-around w-full">
                      {bench.map(p => <PitchPlayer key={p.id} p={p} selected={selected?.id===p.id} onClick={setSelected}/>)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Selected player panel */}
              {selected && (
                <div className="glass-card rounded-2xl p-4 border border-blue-500/30">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className={"w-14 h-14 rounded-full border-2 flex items-center justify-center "+POS_COLORS[selected.pos]}>
                      <span className="text-sm font-bold text-white">{selected.name.slice(0,2).toUpperCase()}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold">{selected.name}</h3>
                      <p className="text-sm text-gray-400">{selected.team} &bull; {selected.pos} &bull; £{selected.price}m</p>
                    </div>
                    <div className="flex gap-6">
                      {[['Form',selected.form,'text-blue-400'],['PPG',selected.ppg,'text-green-400'],['xGI',selected.xgi?.toFixed(2),'text-yellow-400']].map(([l,v,c]) => (
                        <div key={l} className="text-center">
                          <p className={"text-xl font-bold "+c}>{v}</p>
                          <p className="text-xs text-gray-500">{l}</p>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-xl">&times;</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Right sidebar */}
          {!loading && !error && (
            <div className="w-72 flex-shrink-0 flex flex-col gap-4">

              <div className="glass-card rounded-2xl p-4 border border-gray-700/50 flex-1">
                <h4 className="text-sm font-bold mb-3">Squad Stats</h4>
                <div className="space-y-3">
                  {[
                    ['Team', meta.teamName, 'text-blue-400'],
                    ['GW', meta.gw, 'text-white'],
                    ['Projected Pts', projectedPts, 'text-purple-400'],
                    ['Total Season Pts', squad.reduce((s,p)=>s+p.pts,0), 'text-blue-400'],
                    ['Avg PPG', (squad.reduce((s,p)=>s+p.ppg,0)/15).toFixed(1), 'text-green-400'],
                    ['Bank', '£'+meta.bank+'m', 'text-yellow-400'],
                    ['Team Value', '£'+meta.value+'m', 'text-white'],
                  ].map(([l,v,c]) => (
                    <div key={l} className="flex justify-between items-center p-2 bg-[#0F121D]/50 rounded-lg">
                      <span className="text-xs text-gray-400">{l}</span>
                      <span className={"text-sm font-bold "+c}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
