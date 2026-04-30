import { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'
import Sidebar from '../components/Sidebar'
import { useIsMobile } from '../hooks/useIsMobile'

const ENGINE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : 'https://web-production-21545.up.railway.app'

export default function Rivals() {
  const isMobile = useIsMobile()
  const { user } = useUser()
  const teamId = user?.unsafeMetadata?.fplTeamId || localStorage.getItem('fplTeamId')

  const [leagues, setLeagues]           = useState([])
  const [selectedLeague, setSelected]   = useState(null)
  const [standings, setStandings]       = useState([])
  const [predictions, setPredictions]   = useState({})
  const [myEntry, setMyEntry]           = useState(null)
  const [loading, setLoading]           = useState(true)
  const [loadingStandings, setLoadingS] = useState(false)
  const [error, setError]               = useState('')
  const [currentGW, setCurrentGW]       = useState(0)

  const fplUrl = (path) => {
    const isLocal = window.location.hostname === 'localhost'
    return isLocal ? '/fpl' + path : '/api/fpl?path=' + encodeURIComponent(path)
  }

  useEffect(() => {
    if (!teamId) return
    loadLeagues()
    loadPredictions()
  }, [teamId])

  const loadLeagues = async () => {
    setLoading(true)
    try {
      const [entry, bootstrap] = await Promise.all([
        fetch(fplUrl('/entry/' + teamId + '/')).then(r => r.json()),
        fetch(fplUrl('/bootstrap-static/')).then(r => r.json()),
      ])
      setMyEntry(entry)
      const events = bootstrap.events || []
      const cur = events.find(e => e.is_current) || events.find(e => e.is_next) || events[events.length-1]
      setCurrentGW(cur?.id || 1)

      // Classic leagues only (exclude overall/system leagues with id < 200)
      const classic = (entry.leagues?.classic || []).filter(l => l.league_type === 'x' || l.id > 200)
      setLeagues(classic)
      if (classic.length > 0) loadStandings(classic[0])
    } catch(e) { setError('Failed to load leagues: ' + e.message) }
    setLoading(false)
  }

  const loadPredictions = async () => {
    try {
      const data = await fetch(ENGINE_URL + '/api/predictions').then(r => r.json())
      const predMap = {}
      ;(data.predictions || data || []).forEach(p => { predMap[p.player_id] = p })
      setPredictions(predMap)
    } catch(e) { console.log('Predictions unavailable') }
  }

  const loadStandings = async (league) => {
    setSelected(league)
    setLoadingS(true)
    setStandings([])
    try {
      const data = await fetch(fplUrl('/leagues-classic/' + league.id + '/standings/')).then(r => r.json())
      const results = data.standings?.results || []
      setStandings(results)
    } catch(e) { setError('Failed to load standings') }
    setLoadingS(false)
  }

  // Predict next GW for an entry by fetching their current picks
  const [picksCache, setPicksCache] = useState({})
  const loadEntryPicks = async (entryId) => {
    if (picksCache[entryId]) return picksCache[entryId]
    try {
      const picks = await fetch(fplUrl('/entry/' + entryId + '/event/' + currentGW + '/picks/')).then(r => r.json())
      const updated = { ...picksCache, [entryId]: picks }
      setPicksCache(updated)
      return picks
    } catch { return null }
  }

  const predictGW = (picks) => {
    if (!picks?.picks || Object.keys(predictions).length === 0) return null
    const starters = picks.picks.filter(p => p.position <= 11)
    let total = 0
    starters.forEach(pick => {
      const pred = predictions[pick.element]
      if (pred) {
        let xp = pred.xp_gw1 || pred.xp || 0
        if (pick.is_captain) xp *= 2
        total += xp
      }
    })
    return total > 0 ? total.toFixed(1) : null
  }

  const myRank  = standings.find(s => String(s.entry) === String(teamId))
  const myTotal = myEntry?.summary_overall_points || 0

  const rankChange = (s) => {
    const diff = s.last_rank - s.rank
    if (diff > 0) return <span className="text-green-400 text-xs font-bold">▲{diff}</span>
    if (diff < 0) return <span className="text-red-400 text-xs font-bold">▼{Math.abs(diff)}</span>
    return <span className="text-gray-500 text-xs">–</span>
  }

  return (
    <div className="min-h-screen bg-[#0F121D] bg-grid flex text-white" style={{paddingBottom: isMobile ? 60 : 0}}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between py-4 border-b border-gray-800/50 flex-shrink-0" style={{paddingLeft: isMobile ? 16 : 32, paddingRight: isMobile ? 16 : 32}}>
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-trophy text-yellow-400 text-xl"/>
            <span className="text-xl font-bold text-white">Rivals</span>
            {currentGW > 0 && <span className="text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">GW{currentGW}</span>}
          </div>
          {myEntry && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-400">{myEntry.name}</span>
              <span className="text-white font-bold">{myTotal} pts</span>
            </div>
          )}
        </div>

        <main className="flex-1 overflow-y-auto  flex ga" style={{padding: isMobile ? 8 : 32}}>
          {/* League selector */}
          <div className="w-64 flex-shrink-0 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 px-1">Your Leagues</p>
            {loading && (
              <div className="flex items-center gap-2 text-gray-400 text-sm px-2">
                <i className="fa-solid fa-spinner fa-spin"/> Loading leagues...
              </div>
            )}
            {leagues.map(l => (
              <button key={l.id} onClick={() => loadStandings(l)}
                className={'w-full text-left px-4 py-3 rounded-xl border transition-all ' +
                  (selectedLeague?.id === l.id
                    ? 'bg-blue-600/20 border-blue-500/40 text-white'
                    : 'bg-white/3 border-white/5 text-gray-400 hover:bg-white/8 hover:text-white hover:border-white/15')}>
                <p className="text-sm font-medium truncate">{l.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">Rank: {l.entry_rank ?? '—'}</p>
              </button>
            ))}
          </div>

          {/* Standings + prediction */}
          <div className="flex-1 min-w-0">
            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-4">
                <i className="fa-solid fa-triangle-exclamation mr-2"/>{error}
              </div>
            )}

            {selectedLeague && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">{selectedLeague.name}</h2>
                  {loadingStandings && <i className="fa-solid fa-spinner fa-spin text-blue-400"/>}
                </div>

                {/* Stats bar */}
                {standings.length > 0 && myRank && (
                  <div className="grid gap-3 mb-5" style={{gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap:12}}>
                    {[
                      { label: 'Your Rank',    value: '#' + myRank.rank,              color: 'text-blue-400',   icon: 'fa-ranking-star' },
                      { label: 'Last GW',      value: (myRank.last_rank - myRank.rank) >= 0 ? '▲' + Math.abs(myRank.last_rank - myRank.rank) : '▼' + Math.abs(myRank.last_rank - myRank.rank), color: (myRank.last_rank - myRank.rank) >= 0 ? 'text-green-400' : 'text-red-400', icon: 'fa-arrow-trend-up' },
                      { label: 'GW Points',    value: myRank.event_total + ' pts',    color: 'text-yellow-400', icon: 'fa-star' },
                    ].map((s,i) => (
                      <div key={i} className="glass-card rounded-xl p-3 border border-gray-700/50 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                          <i className={'fa-solid ' + s.icon + ' text-sm ' + s.color}/>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">{s.label}</p>
                          <p className={'text-base font-black ' + s.color}>{s.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Standings table */}
                {standings.length > 0 && (
                  <div className="glass-card rounded-2xl border border-gray-700/50 overflow-hidden">
                    {!isMobile && (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-700/50">
                          <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium w-12">Rank</th>
                          <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Team / Manager</th>
                          <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium">GW{currentGW}</th>
                          <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium">Total</th>
                          <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium w-24">
                            <span className="text-blue-400">GW{currentGW + 1} Pred</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.slice(0, 20).map((s, i) => {
                          const isMe = String(s.entry) === String(teamId)
                          const gap  = s.total - (myRank?.total || 0)
                          return (
                            <tr key={s.entry}
                              className={'border-b border-gray-800/30 transition-colors ' + (isMe ? 'bg-blue-600/10' : 'hover:bg-white/3')}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <span className={'text-sm font-bold ' + (s.rank <= 3 ? 'text-yellow-400' : 'text-gray-300')}>
                                    {s.rank <= 3 ? ['🥇','🥈','🥉'][s.rank-1] : s.rank}
                                  </span>
                                  <span className="text-xs">{rankChange(s)}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className={'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ' + (isMe ? 'bg-blue-600 text-white' : 'bg-white/8 text-gray-300')}>
                                    {s.player_name?.charAt(0) || '?'}
                                  </div>
                                  <div>
                                    <p className={'text-sm font-medium ' + (isMe ? 'text-blue-300' : 'text-white')}>{s.entry_name}{isMe && ' (you)'}</p>
                                    <p className="text-xs text-gray-500">{s.player_name}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-sm font-bold text-white">{s.event_total}</span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div>
                                  <span className="text-sm font-bold text-white">{s.total}</span>
                                  {!isMe && gap !== 0 && (
                                    <p className={'text-[10px] ' + (gap > 0 ? 'text-red-400' : 'text-green-400')}>
                                      {gap > 0 ? '+' : ''}{gap}
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <PredictionCell entryId={s.entry} currentGW={currentGW} fplUrl={fplUrl} predictions={predictions}/>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                  {/* Mobile cards */}
                  {isMobile && (
                    <div style={{display:"flex",flexDirection:"column",gap:8,padding:8}}>
                      {standings.slice(0, 20).map((s, i) => {
                        const isMe = String(s.entry) === String(teamId)
                        const gap  = s.total - (myRank?.total || 0)
                        return (
                          <div key={s.entry}
                            style={{padding:12,borderRadius:10,
                              background: isMe ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.03)",
                              border: "1px solid " + (isMe ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.06)")}}>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:6}}>
                              <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
                                <span style={{fontSize:14,fontWeight:700,color: s.rank <= 3 ? "#fbbf24" : "#9ca3af",minWidth:28}}>
                                  {s.rank <= 3 ? ["🥇","🥈","🥉"][s.rank-1] : "#" + s.rank}
                                </span>
                                <div style={{flex:1,minWidth:0}}>
                                  <p style={{margin:0,fontSize:13,fontWeight:600,color: isMe ? "#93c5fd" : "white",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                    {s.entry_name}{isMe && " (you)"}
                                  </p>
                                  <p style={{margin:0,fontSize:11,color:"#6b7280",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.player_name}</p>
                                </div>
                              </div>
                              <div style={{textAlign:"right",flexShrink:0}}>
                                <p style={{margin:0,fontSize:14,fontWeight:700,color:"white"}}>{s.total}</p>
                                <p style={{margin:0,fontSize:10,color:"#6b7280"}}>total</p>
                              </div>
                            </div>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:11,color:"#9ca3af",paddingTop:6,borderTop:"1px solid rgba(255,255,255,0.04)"}}>
                              <span>GW{currentGW}: <strong style={{color:"#e5e7eb"}}>{s.event_total}</strong></span>
                              {!isMe && (
                                <span style={{color: gap >= 0 ? "#10b981" : "#ef4444"}}>
                                  {gap >= 0 ? "+" : ""}{gap} vs you
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                    {standings.length > 20 && (
                      <div className="px-4 py-3 border-t border-gray-800/30 text-center">
                        <p className="text-xs text-gray-500">Showing top 20 of {standings.length} entries</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Prediction note */}
                {standings.length > 0 && (
                  <p className="text-xs text-gray-600 mt-3">
                    * GW{currentGW + 1} predictions based on each manager's current squad xP from the ML engine. Accuracy improves closer to the deadline.
                  </p>
                )}
              </>
            )}

            {!selectedLeague && !loading && (
              <div className="flex items-center justify-center h-64">
                <div className="text-center text-gray-500">
                  <i className="fa-solid fa-trophy text-4xl mb-3 opacity-20"/>
                  <p>Select a league to view standings</p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

// Lazy-loading prediction cell per manager
function PredictionCell({ entryId, currentGW, fplUrl, predictions }) {
  const [xp, setXp]     = useState(null)
  const [tried, setTried] = useState(false)

  useEffect(() => {
    if (tried || !currentGW || Object.keys(predictions).length === 0) return
    setTried(true)
    fetch(fplUrl('/entry/' + entryId + '/event/' + currentGW + '/picks/'))
      .then(r => r.json())
      .then(picks => {
        const starters = (picks.picks || []).filter(p => p.position <= 11)
        let total = 0
        starters.forEach(pick => {
          const pred = predictions[pick.element]
          if (pred) {
            let xp = pred.xp_gw1 || 0
            if (pick.is_captain) xp *= 2
            total += xp
          }
        })
        setXp(total > 0 ? total.toFixed(1) : null)
      })
      .catch(() => setXp(null))
  }, [currentGW, predictions])

  if (!tried || xp === null) return <span className="text-gray-600 text-xs">—</span>
  return <span className="text-blue-400 font-bold text-sm">{xp}</span>
}
