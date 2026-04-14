import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import Sidebar from '../components/Sidebar'

const POS_COLOR = { GKP:'#f59e0b', DEF:'#10b981', MID:'#3b82f6', FWD:'#ef4444' }

function PlayerToken({ p, photoMap, selected, onClick }) {
  const col     = POS_COLOR[p.pos] || '#6b7280'
  const photo   = photoMap?.[p.id]
  const imgUrl  = photo ? 'https://resources.premierleague.com/premierleague/photos/players/110x140/p' + photo + '.png' : null
  const surname = p.name.includes(' ') ? p.name.split(' ').pop() : p.name
  return (
    <div className="flex flex-col items-center gap-1 cursor-pointer" style={{minWidth:68}} onClick={() => onClick && onClick(p)}>
      <div className="relative" style={{width:62,height:62}}>
        {selected && <div className="absolute inset-0 rounded-full" style={{background:'radial-gradient(circle, '+col+'55 0%, transparent 70%)',transform:'scale(1.4)'}}/>}
        <div className="w-full h-full rounded-full overflow-hidden border-2 flex items-center justify-center"
          style={{
            borderColor: selected ? col : p.captain ? '#3b82f6' : 'rgba(255,255,255,0.2)',
            background: 'linear-gradient(135deg, '+col+'22, '+col+'44)',
            boxShadow: selected ? '0 0 14px '+col+'99' : p.captain ? '0 0 12px rgba(59,130,246,0.5)' : '0 2px 10px rgba(0,0,0,0.6)'
          }}>
          {imgUrl
            ? <img src={imgUrl} alt={p.name} className="w-full h-full object-cover object-top" style={{transform:'scale(1.15) translateY(5px)'}} onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }}/>
            : null}
          <div className="w-full h-full flex items-center justify-center" style={{display: imgUrl ? 'none' : 'flex'}}>
            <i className="fa-solid fa-person text-white/50 text-xl"/>
          </div>
        </div>
        {p.captain && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-black text-[10px] font-black z-10"
            style={{background:'linear-gradient(135deg,#facc15,#f59e0b)',boxShadow:'0 1px 4px rgba(0,0,0,0.5)'}}>C</div>
        )}
        {p.vice && !p.captain && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gray-500 flex items-center justify-center text-white text-[9px] font-black z-10">V</div>
        )}
      </div>
      <div className="px-2 py-0.5 rounded-md text-center" style={{
        background: selected ? col+'28' : 'rgba(0,0,0,0.55)',
        border: '1px solid '+(selected ? col+'55' : 'rgba(255,255,255,0.1)'),
        backdropFilter:'blur(4px)', maxWidth:76
      }}>
        <p className="font-bold text-white leading-tight" style={{fontSize:10,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{surname}</p>
        <p style={{fontSize:9,color: p.captain ? '#facc15' : '#9ca3af'}}>{p.ppg} ppg</p>
      </div>
    </div>
  )
}


const POS_ORDER = { GKP:0, DEF:1, MID:2, FWD:3 }
const POS_COLORS = {
  GKP:'border-yellow-400 bg-yellow-400/10 text-yellow-400',
  DEF:'border-green-400 bg-green-400/10 text-green-400',
  MID:'border-blue-400 bg-blue-400/10 text-blue-400',
  FWD:'border-red-400 bg-red-400/10 text-red-400',
}



export default function MyTeam() {
  const { user } = useUser()
  const navigate = useNavigate()
  const [squad, setSquad] = useState([])
  const [meta, setMeta] = useState({ gw:0, bank:0, value:0, teamName:'' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [photoMap, setPhotoMap] = useState({})
  const [photoMap, setPhotoMap] = useState({})

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

              {/* Current Squad Note */}
              <div className="flex items-center gap-2 px-1 py-2 rounded-xl mb-2" style={{background:'rgba(251,191,36,0.08)',border:'1px solid rgba(251,191,36,0.2)'}}>
                <i className="fa-solid fa-circle-info text-yellow-400 text-sm flex-shrink-0"/>
                <p className="text-yellow-300 text-xs">This is your <strong>current squad</strong> — not optimized. Run the <a href="/optimizer" className="underline font-bold">AI Optimizer</a> for transfer recommendations.</p>
              </div>
              {/* Pitch */}
              <div className="flex-1 relative rounded-2xl overflow-hidden" style={{
                minHeight:'520px',
                background:'rgba(255,255,255,0.03)',
                border:'1px solid rgba(255,255,255,0.08)',
                backdropFilter:'blur(12px)',
                boxShadow:'0 8px 32px rgba(0,0,0,0.4)'
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
                <div className="relative z-10 p-4 pt-6 pb-2 space-y-5 h-full flex flex-col justify-between">
                  <div className="space-y-5">
                    {[rowGKP, rowDEF, rowMID, rowFWD].map((row,ri) => (
                      <div key={ri} className="flex justify-around w-full px-2">
                        {row.map(p => <PlayerToken key={p.id} p={p} photoMap={photoMap} selected={selected?.id===p.id} onClick={setSelected}/>)}
                      </div>
                    ))}
                  </div>
                  <div className="mx-2 mb-2 rounded-xl p-3" style={{background:'rgba(0,0,0,0.35)',border:'1px solid rgba(255,255,255,0.1)',backdropFilter:'blur(8px)'}}>
                    <p className="text-[10px] text-gray-400 text-center mb-3 uppercase tracking-widest">Bench</p>
                    <div className="flex justify-around w-full px-4">
                      {bench.map(p => <PlayerToken key={p.id} p={p} photoMap={photoMap} selected={selected?.id===p.id} onClick={setSelected}/>)}
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
