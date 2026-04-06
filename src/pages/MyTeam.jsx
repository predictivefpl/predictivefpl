import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import { useUser } from '@clerk/clerk-react'

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

const MOCK_PLAYERS = [
  { id:1, name:'Flekken', pos:'GKP', team:'BRE', price:4.5, form:4.5, pts:74, ppg:4.8, xgi:0.00, bench:false, captain:false, vice:false },
  { id:2, name:'Alexander-Arnold', pos:'DEF', team:'LIV', price:7.2, form:6.8, pts:98, ppg:6.1, xgi:0.44, bench:false, captain:false, vice:false },
  { id:3, name:'Pedro Porro', pos:'DEF', team:'TOT', price:5.8, form:5.1, pts:82, ppg:5.2, xgi:0.31, bench:false, captain:false, vice:false },
  { id:4, name:'Saliba', pos:'DEF', team:'ARS', price:6.2, form:5.8, pts:88, ppg:5.6, xgi:0.22, bench:false, captain:false, vice:false },
  { id:5, name:'Mykolenko', pos:'DEF', team:'EVE', price:4.2, form:3.1, pts:48, ppg:3.1, xgi:0.12, bench:true, captain:false, vice:false },
  { id:6, name:'Salah', pos:'MID', team:'LIV', price:13.1, form:9.1, pts:168, ppg:9.1, xgi:0.82, bench:false, captain:false, vice:true },
  { id:7, name:'Saka', pos:'MID', team:'ARS', price:9.8, form:8.2, pts:142, ppg:8.4, xgi:0.71, bench:false, captain:true, vice:false },
  { id:8, name:'Palmer', pos:'MID', team:'CHE', price:10.8, form:7.4, pts:128, ppg:7.8, xgi:0.65, bench:false, captain:false, vice:false },
  { id:9, name:'Mbeumo', pos:'MID', team:'BRE', price:7.4, form:6.4, pts:98, ppg:6.4, xgi:0.55, bench:false, captain:false, vice:false },
  { id:10, name:'Watkins', pos:'FWD', team:'AVL', price:8.7, form:6.2, pts:110, ppg:6.9, xgi:0.58, bench:false, captain:false, vice:false },
  { id:11, name:'Welbeck', pos:'FWD', team:'BHA', price:5.5, form:4.2, pts:62, ppg:4.2, xgi:0.38, bench:false, captain:false, vice:false },
  { id:12, name:'Raya', pos:'GKP', team:'ARS', price:5.8, form:5.4, pts:86, ppg:5.4, xgi:0.00, bench:true, captain:false, vice:false },
  { id:13, name:'Trippier', pos:'DEF', team:'NEW', price:6.5, form:5.0, pts:76, ppg:5.0, xgi:0.40, bench:true, captain:false, vice:false },
  { id:14, name:'Andreas', pos:'MID', team:'FUL', price:5.5, form:5.2, pts:80, ppg:5.2, xgi:0.35, bench:true, captain:false, vice:false },
]

const MOCK_DATA = {
  gw: 29,
  teamName: 'Saka Potatoes',
  bank: 0.5,
  teamValue: 103.2,
  players: MOCK_PLAYERS,
}

const POS_ORDER = { GKP:0, DEF:1, MID:2, FWD:3 }
const POS_COLORS = {
  GKP: 'border-yellow-400 bg-yellow-400/10',
  DEF: 'border-green-400 bg-green-400/10',
  MID: 'border-blue-400 bg-blue-400/10',
  FWD: 'border-red-400 bg-red-400/10',
}

function PitchPlayer({ p, selected, onClick }) {
  return (
    <div className={`flex flex-col items-center cursor-pointer group ${selected ? 'scale-105' : ''}`} onClick={() => onClick(p)}>
      <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center mb-1 relative transition-all group-hover:scale-110 ${POS_COLORS[p.pos]} ${p.captain ? 'shadow-[0_0_12px_rgba(59,130,246,0.5)]' : ''}`}>
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
  const [data, setData] = useState(MOCK_DATA)
  const [draftSquad, setDraftSquad] = useState(MOCK_PLAYERS)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [activeChip, setActiveChip] = useState(null)
  const [draftBank, setDraftBank] = useState(MOCK_DATA.bank)
  const [transferCount, setTransferCount] = useState(0)
  const teamId = localStorage.getItem('fplTeamId') || user?.unsafeMetadata?.fplTeamId || '3321638'

  useEffect(() => {
    if (teamId) loadTeam(teamId)
  }, [teamId])

  const loadTeam = async (id) => {
    setLoading(true)
    try {
      const [bootstrap, history] = await Promise.all([
        fetchFPL('/bootstrap-static/'),
        fetchFPL(`/entry/${id}/`)
      ])
      const gwArr = history.current || []
      const gw = gwArr.length ? gwArr[gwArr.length-1].event : 1
      const picks = await fetchFPL(`/entry/${id}/event/${gw}/picks/`)
      const playerMap = {}
      bootstrap.elements.forEach(p => playerMap[p.id] = p)
      const teamMap = {}
      bootstrap.teams.forEach(t => teamMap[t.id] = t.short_name)
      const players = picks.picks.map(pick => {
        const p = playerMap[pick.element]
        return {
          id: p.id, name: p.web_name,
          pos: ['','GKP','DEF','MID','FWD'][p.element_type],
          team: teamMap[p.team], price: p.now_cost/10,
          form: parseFloat(p.form)||0, pts: p.total_points,
          ppg: parseFloat(p.points_per_game)||0,
          xgi: parseFloat(p.expected_goal_involvements_per_90)||0,
          bench: pick.position > 11,
          captain: pick.is_captain, vice: pick.is_vice_captain,
        }
      }).sort((a,b) => a.bench !== b.bench ? (a.bench?1:-1) : POS_ORDER[a.pos]-POS_ORDER[b.pos])
      const newData = {
        gw, players,
        bank: picks.entry_history.bank/10,
        teamValue: picks.entry_history.value/10,
        teamName: history.name
      }
      setData(newData)
      setDraftSquad([...players])
      setDraftBank(picks.entry_history.bank/10)
    } catch(e) {
      console.error(e)
    }
    setLoading(false)
  }

  // Captain/Vice toggle - updates draft squad
  const setCaptain = (playerId) => {
    setDraftSquad(prev => prev.map(p => ({
      ...p,
      captain: p.id === playerId,
      vice: p.vice && p.id !== playerId
    })))
    setSelected(null)
  }

  const setVice = (playerId) => {
    setDraftSquad(prev => prev.map(p => ({
      ...p,
      vice: p.id === playerId,
      captain: p.captain && p.id !== playerId
    })))
    setSelected(null)
  }

  // Bench swap
  const swapWithBench = (playerId) => {
    setDraftSquad(prev => {
      const updated = [...prev]
      const idx = updated.findIndex(p => p.id === playerId)
      const benchIdx = updated.findIndex(p => p.bench && p.pos === updated[idx].pos)
      if (benchIdx !== -1) {
        updated[idx] = { ...updated[idx], bench: true }
        updated[benchIdx] = { ...updated[benchIdx], bench: false }
      }
      return updated
    })
    setSelected(null)
  }

  // Projected points calculation
  const projectedPts = draftSquad
    .filter(p => !p.bench)
    .reduce((sum, p) => {
      let pts = p.ppg
      if (p.captain) pts *= activeChip === 'tc' ? 3 : 2
      return sum + pts
    }, 0).toFixed(1)

  const starters = draftSquad.filter(p=>!p.bench).sort((a,b) => POS_ORDER[a.pos]-POS_ORDER[b.pos])
  const bench = draftSquad.filter(p=>p.bench)
  const rowGKP = starters.filter(p=>p.pos==='GKP')
  const rowDEF = starters.filter(p=>p.pos==='DEF')
  const rowMID = starters.filter(p=>p.pos==='MID')
  const rowFWD = starters.filter(p=>p.pos==='FWD')

  const chips = [
    { id:'wc', icon:'fa-wand-magic-sparkles', label:'Wildcard', color:'text-blue-400' },
    { id:'fh', icon:'fa-bolt', label:'Free Hit', color:'text-green-400' },
    { id:'bb', icon:'fa-chair', label:'Bench Boost', color:'text-yellow-400' },
    { id:'tc', icon:'fa-crown', label:'Triple Capt', color:'text-purple-400' },
  ]

  return (
    <div className="min-h-screen bg-[#0F121D] bg-grid flex text-white">
      <Sidebar/>
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-[60px] px-6 flex items-center justify-between border-b border-gray-800/50 bg-[#0F121D] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#1A1D2E] rounded-md px-3 py-1.5 border border-blue-500/30">
              <span className="text-blue-400 text-xs">GW</span>
              <span className="text-white text-sm font-semibold">{data.gw}</span>
            </div>
            <div className="flex items-center gap-2 bg-[#1A1D2E] rounded-md px-3 py-1.5 border border-gray-700">
              <span className="text-gray-400 text-xs">Bank:</span>
              <span className="text-green-400 text-sm font-semibold">£{draftBank}m</span>
            </div>
            <div className="flex items-center gap-2 bg-[#1A1D2E] rounded-md px-3 py-1.5 border border-gray-700">
              <span className="text-gray-400 text-xs">Value:</span>
              <span className="text-white text-sm font-semibold">£{data.teamValue}m</span>
            </div>
            <div className="flex items-center gap-2 bg-[#1A1D2E] rounded-md px-3 py-1.5 border border-purple-500/30">
              <span className="text-purple-400 text-xs">Proj:</span>
              <span className="text-white text-sm font-semibold">{projectedPts} pts</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {transferCount > 0 && (
              <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold border border-yellow-500/30">
                {transferCount} transfer{transferCount > 1 ? 's' : ''} pending
              </span>
            )}
            <button onClick={() => { setDraftSquad([...data.players]); setDraftBank(data.bank); setTransferCount(0) }}
              className="px-4 py-1.5 rounded-lg text-xs font-medium bg-gray-800 border border-gray-700 text-gray-400 hover:text-white transition-colors">
              Reset
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scroll p-6 flex gap-6">
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {/* Chips bar */}
            <div className="glass-card rounded-2xl p-3 flex items-center gap-3 flex-wrap">
              {chips.map(c => (
                <button key={c.id} onClick={() => setActiveChip(activeChip===c.id ? null : c.id)}
                  className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 border transition-all ${activeChip===c.id ? 'bg-blue-600/30 border-blue-500 text-white' : 'bg-[#0F121D] border-[#252A3F] text-gray-400 hover:text-white'}`}>
                  <i className={`fa-solid ${c.icon} ${c.color}`}/> {c.label}
                </button>
              ))}
              {activeChip && (
                <div className="ml-auto text-xs text-blue-400 flex items-center gap-2">
                  <i className="fa-solid fa-circle-info"/>
                  {activeChip==='wc' && 'Wildcard: Full squad rebuild for the next 4 GWs'}
                  {activeChip==='fh' && 'Free Hit: One-week squad change, reverts next GW'}
                  {activeChip==='bb' && 'Bench Boost: All 15 players score points this GW'}
                  {activeChip==='tc' && 'Triple Captain: Captain scores 3x points this GW'}
                </div>
              )}
            </div>

            {loading && <div className="flex-1 flex items-center justify-center"><div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/></div>}

            {/* Pitch */}
            <div className="flex-1 rounded-xl overflow-hidden relative" style={{ minHeight: '520px', background: 'linear-gradient(180deg, #1a6e43 0%, #1d7a4a 50%, #1a6e43 100%)' }}>
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                <rect x="5" y="2" width="90" height="96" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5"/>
                <line x1="5" y1="50" x2="95" y2="50" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5"/>
                <circle cx="50" cy="50" r="12" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5"/>
                <rect x="30" y="2" width="40" height="15" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
                <rect x="30" y="83" width="40" height="15" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
              </svg>
              <div className="relative z-10 flex flex-col justify-between py-6 px-4 h-full">
                {[rowGKP, rowDEF, rowMID, rowFWD].map((row, ri) => (
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
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center ${POS_COLORS[selected.pos]}`}>
                    <span className="text-sm font-bold text-white">{selected.name.slice(0,2).toUpperCase()}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold">{selected.name}</h3>
                    <p className="text-sm text-gray-400">{selected.team} &bull; {selected.pos} &bull; £{selected.price}m</p>
                  </div>
                  <div className="flex gap-2">
                    {!selected.captain && (
                      <button onClick={() => setCaptain(selected.id)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600/20 border border-blue-500/40 text-blue-400 hover:bg-blue-600/40 transition-colors">
                        <i className="fa-solid fa-crown mr-1"/>Set Captain
                      </button>
                    )}
                    {!selected.vice && !selected.captain && (
                      <button onClick={() => setVice(selected.id)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-600/20 border border-gray-500/40 text-gray-400 hover:bg-gray-600/40 transition-colors">
                        <i className="fa-solid fa-crown mr-1"/>Set Vice
                      </button>
                    )}
                    <button onClick={() => swapWithBench(selected.id)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600/20 border border-green-500/40 text-green-400 hover:bg-green-600/40 transition-colors">
                      <i className="fa-solid fa-arrow-right-arrow-left mr-1"/>Bench Swap
                    </button>
                  </div>
                  <div className="flex gap-6">
                    {[['Form',selected.form,'text-blue-400'],['PPG',selected.ppg,'text-green-400'],['xGI',selected.xgi?.toFixed(2),'text-yellow-400']].map(([l,v,c]) => (
                      <div key={l} className="text-center">
                        <p className={`text-xl font-bold ${c}`}>{v}</p>
                        <p className="text-xs text-gray-500">{l}</p>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-xl ml-4">&times;</button>
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="w-72 flex-shrink-0 flex flex-col gap-4">
            <div className="glass-card rounded-2xl p-4 border border-gray-700/50">
              <div className="flex items-center gap-2 mb-3">
                <i className="fa-solid fa-lightbulb text-yellow-400"/>
                <h4 className="text-sm font-bold">Chip Strategy</h4>
              </div>
              <div className="space-y-3">
                <div className="bg-[#0F121D] rounded-xl p-3 border border-blue-500/30">
                  <div className="flex items-center gap-1.5 mb-1">
                    <i className="fa-solid fa-wand-magic-sparkles text-blue-400 text-xs"/>
                    <span className="text-blue-400 font-bold text-[10px] uppercase">Wildcard</span>
                  </div>
                  <p className="text-gray-300 text-[10px] leading-relaxed">Best used during a Double Gameweek to maximise template players.</p>
                </div>
                <div className="bg-[#0F121D] rounded-xl p-3 border border-gray-800">
                  <div className="flex items-center gap-1.5 mb-1">
                    <i className="fa-solid fa-bolt text-gray-500 text-xs"/>
                    <span className="text-gray-400 font-bold text-[10px] uppercase">Free Hit</span>
                  </div>
                  <p className="text-gray-400 text-[10px] leading-relaxed">Save for a Blank Gameweek when 6+ teams do not play.</p>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-4 border border-gray-700/50 flex-1">
              <h4 className="text-sm font-bold mb-3">Squad Stats</h4>
              <div className="space-y-3">
                {[
                  ['Projected Pts', projectedPts, 'text-purple-400'],
                  ['Total Season Pts', draftSquad.reduce((s,p)=>s+p.pts,0), 'text-blue-400'],
                  ['Avg PPG', (draftSquad.reduce((s,p)=>s+p.ppg,0)/15).toFixed(1), 'text-green-400'],
                  ['Bank', '£'+draftBank+'m', 'text-yellow-400'],
                  ['Team Value', '£'+data.teamValue+'m', 'text-white'],
                ].map(([l,v,c]) => (
                  <div key={l} className="flex justify-between items-center p-2 bg-[#0F121D]/50 rounded-lg">
                    <span className="text-xs text-gray-400">{l}</span>
                    <span className={`text-sm font-bold ${c}`}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

