with open('src/pages/OracleOptimizer.jsx', encoding='utf-8') as f:
    c = f.read()

fixes = 0

# Helper component - StatLine - we'll inline render stats nicely
# We add it as a small JSX helper at the start of the Insights section

# ── 1. Enhanced Captain reasoning with breakdown ──────────────────────────────
old_cap = '''          {/* Captain reasoning */}
          {captain && (
            <div className="p-3 rounded-xl" style={{background:'rgba(250,204,21,0.06)',border:'1px solid rgba(250,204,21,0.15)'}}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center text-black text-[9px] font-black">C</span>
                <span className="text-xs font-bold text-yellow-300">Captain: {captain.name}</span>
                {captain.fixture_count_gw1 === 2 && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-green-400/20 text-green-400">DGW ×2</span>}
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                Selected with <span className="text-yellow-400 font-bold">{captain.xp_gw1?.toFixed(1)} xP</span> projected this GW
                {captain.fixture_count_gw1 === 2 ? ' across 2 fixtures (Double Gameweek)' : ''}.
                {captain.ownership_pct ? ` Owned by ${Number(captain.ownership_pct).toFixed(1)}% of managers` +
                  (captain.ownership_pct < 20 ? ' — high-value differential captain pick.' : ' — popular template choice.') : ''}
              </p>
            </div>
          )}'''

new_cap = '''          {/* Captain reasoning */}
          {captain && (
            <div className="p-3 rounded-xl" style={{background:'rgba(250,204,21,0.06)',border:'1px solid rgba(250,204,21,0.15)'}}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center text-black text-[9px] font-black">C</span>
                <span className="text-xs font-bold text-yellow-300">Captain: {captain.name}</span>
                {captain.fixture_count_gw1 === 2 && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-green-400/20 text-green-400">DGW ×2</span>}
                {captain.team_short && <span className="text-[9px] text-gray-500">({captain.team_short})</span>}
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed mb-2">
                Projected <span className="text-yellow-400 font-bold">{captain.xp_gw1?.toFixed(1)} xP</span> this GW
                {captain.fixture_count_gw1 === 2 ? ' across 2 fixtures (DGW)' : ''}
                {captain.ownership_pct ? ` · ${Number(captain.ownership_pct).toFixed(1)}% owned` : ''}.
              </p>
              <div className="space-y-1 text-[10px] text-gray-400">
                {captain.ict_index !== undefined && captain.ict_index !== null && (
                  <div className="flex items-start gap-1.5"><span className="text-yellow-500/70 mt-0.5">▸</span><span><span className="text-gray-300">ICT index <span className="font-bold text-white">{Number(captain.ict_index).toFixed(1)}</span></span> — combined Influence/Creativity/Threat score; higher = more involved in goal-creating actions.</span></div>
                )}
                {captain.xg_90 !== undefined && captain.xg_90 !== null && Number(captain.xg_90) > 0 && (
                  <div className="flex items-start gap-1.5"><span className="text-yellow-500/70 mt-0.5">▸</span><span><span className="text-gray-300">xG per 90: <span className="font-bold text-white">{Number(captain.xg_90).toFixed(2)}</span></span> — expected goals from shot quality; predicts scoring output beyond raw points.</span></div>
                )}
                {captain.xa_90 !== undefined && captain.xa_90 !== null && Number(captain.xa_90) > 0 && (
                  <div className="flex items-start gap-1.5"><span className="text-yellow-500/70 mt-0.5">▸</span><span><span className="text-gray-300">xA per 90: <span className="font-bold text-white">{Number(captain.xa_90).toFixed(2)}</span></span> — expected assists from chance creation; signals creative output.</span></div>
                )}
                {captain.fdr_dynamic !== undefined && captain.fdr_dynamic !== null && (
                  <div className="flex items-start gap-1.5"><span className="text-yellow-500/70 mt-0.5">▸</span><span><span className="text-gray-300">Fixture difficulty (Elo): <span className="font-bold text-white">{Number(captain.fdr_dynamic).toFixed(1)}/5</span></span> — opponent strength using live Elo ratings; lower = easier matchup.</span></div>
                )}
                {captain.starts_pct !== undefined && captain.starts_pct !== null && (
                  <div className="flex items-start gap-1.5"><span className="text-yellow-500/70 mt-0.5">▸</span><span><span className="text-gray-300">Starts %: <span className="font-bold text-white">{Math.round(Number(captain.starts_pct)*100)}%</span></span> — share of recent games started; rotation risk indicator.</span></div>
                )}
                {captain.net_transfers !== undefined && captain.net_transfers !== null && Math.abs(Number(captain.net_transfers)) > 1000 && (
                  <div className="flex items-start gap-1.5"><span className="text-yellow-500/70 mt-0.5">▸</span><span><span className="text-gray-300">Transfer momentum: <span className={'font-bold ' + (Number(captain.net_transfers) > 0 ? 'text-green-400' : 'text-red-400')}>{Number(captain.net_transfers) > 0 ? '+' : ''}{Number(captain.net_transfers).toLocaleString()}</span></span> — net transfers this GW; community signal of perceived value.</span></div>
                )}
              </div>
            </div>
          )}'''

if old_cap in c:
    c = c.replace(old_cap, new_cap)
    fixes += 1
    print('Captain reasoning: OK')
else:
    print('Captain reasoning: NO MATCH')

# ── 2. Enhanced Transfer Targets with reasoning ──────────────────────────────
old_tr = '''          {/* Transfer reasoning */}
          {newPlayers.length > 0 && (
            <div className="p-3 rounded-xl" style={{background:'rgba(59,130,246,0.06)',border:'1px solid rgba(59,130,246,0.15)'}}>
              <div className="flex items-center gap-2 mb-1">
                <i className="fa-solid fa-right-left text-blue-400 text-xs"/>
                <span className="text-xs font-bold text-blue-300">Transfer Targets</span>
              </div>
              <div className="space-y-2">
                {newPlayers.map((p,i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[10px] font-bold text-blue-400 mt-0.5 flex-shrink-0">→</span>
                    <p className="text-[11px] text-gray-300 leading-relaxed">
                      <span className="font-bold text-white">{p.name}</span>
                      {p.team_short ? ` (${p.team_short})` : ''}
                      {p.position ? ` · ${p.position}` : ''}
                      {p.price ? ` · £${Number(p.price).toFixed(1)}m` : ''} —
                      projected <span className="text-blue-400 font-bold">{p.xp_gw1?.toFixed(1)} xP</span> next GW
                      {p.fixture_count_gw1 === 2 ? ' with a Double Gameweek fixture' : ''}.
                      {p.ownership_pct ? ` Owned by ${Number(p.ownership_pct).toFixed(1)}% of managers.` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}'''

new_tr = '''          {/* Transfer reasoning */}
          {newPlayers.length > 0 && (
            <div className="p-3 rounded-xl" style={{background:'rgba(59,130,246,0.06)',border:'1px solid rgba(59,130,246,0.15)'}}>
              <div className="flex items-center gap-2 mb-2">
                <i className="fa-solid fa-right-left text-blue-400 text-xs"/>
                <span className="text-xs font-bold text-blue-300">Transfer Targets</span>
              </div>
              <div className="space-y-3">
                {newPlayers.map((p,i) => (
                  <div key={i} className="pl-2 border-l-2 border-blue-400/30">
                    <p className="text-[11px] text-gray-300 leading-relaxed mb-1.5">
                      <span className="font-bold text-white">{p.name}</span>
                      {p.team_short ? <span className="text-gray-500"> ({p.team_short})</span> : ''}
                      {p.position ? <span className="text-gray-500"> · {p.position}</span> : ''}
                      {p.price ? <span className="text-gray-500"> · £{Number(p.price).toFixed(1)}m</span> : ''}
                      <span className="text-blue-400 font-bold"> · {p.xp_gw1?.toFixed(1)} xP</span>
                      {p.fixture_count_gw1 === 2 && <span className="ml-1 text-[9px] px-1 py-0.5 rounded font-bold bg-green-400/20 text-green-400">DGW</span>}
                      {p.fixture_count_gw1 === 0 && <span className="ml-1 text-[9px] px-1 py-0.5 rounded font-bold bg-red-400/20 text-red-400">BGW</span>}
                    </p>
                    <div className="space-y-0.5 text-[10px] text-gray-400">
                      {p.ict_index !== undefined && p.ict_index !== null && Number(p.ict_index) > 0 && (
                        <div>▸ ICT <span className="font-bold text-white">{Number(p.ict_index).toFixed(1)}</span> — Influence/Creativity/Threat composite.</div>
                      )}
                      {p.xg_90 !== undefined && Number(p.xg_90) > 0 && (
                        <div>▸ xG/90 <span className="font-bold text-white">{Number(p.xg_90).toFixed(2)}</span>{p.xa_90 !== undefined && Number(p.xa_90) > 0 ? <> · xA/90 <span className="font-bold text-white">{Number(p.xa_90).toFixed(2)}</span></> : null} — expected goal/assist quality.</div>
                      )}
                      {p.fdr_dynamic !== undefined && p.fdr_dynamic !== null && (
                        <div>▸ Fixture FDR (Elo) <span className={'font-bold ' + (Number(p.fdr_dynamic) <= 2.5 ? 'text-green-400' : Number(p.fdr_dynamic) >= 4 ? 'text-red-400' : 'text-white')}>{Number(p.fdr_dynamic).toFixed(1)}/5</span> — {Number(p.fdr_dynamic) <= 2.5 ? 'easy matchup' : Number(p.fdr_dynamic) >= 4 ? 'tough fixture' : 'average difficulty'}.</div>
                      )}
                      {p.starts_pct !== undefined && p.starts_pct !== null && (
                        <div>▸ Starts <span className={'font-bold ' + (Number(p.starts_pct) >= 0.8 ? 'text-green-400' : Number(p.starts_pct) >= 0.5 ? 'text-yellow-400' : 'text-red-400')}>{Math.round(Number(p.starts_pct)*100)}%</span> — {Number(p.starts_pct) >= 0.8 ? 'nailed starter' : Number(p.starts_pct) >= 0.5 ? 'rotation risk' : 'bench risk'}.</div>
                      )}
                      {p.net_transfers !== undefined && p.net_transfers !== null && Math.abs(Number(p.net_transfers)) > 5000 && (
                        <div>▸ Transfers this GW <span className={'font-bold ' + (Number(p.net_transfers) > 0 ? 'text-green-400' : 'text-red-400')}>{Number(p.net_transfers) > 0 ? '+' : ''}{Number(p.net_transfers).toLocaleString()}</span> — {Number(p.net_transfers) > 0 ? 'community buying' : 'community selling'}.</div>
                      )}
                      {p.ownership_pct !== undefined && p.ownership_pct !== null && (
                        <div>▸ Ownership <span className="font-bold text-white">{Number(p.ownership_pct).toFixed(1)}%</span> — {Number(p.ownership_pct) < 10 ? 'differential pick' : Number(p.ownership_pct) > 30 ? 'template essential' : 'mid-popularity'}.</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-gray-600 mt-2 italic">FDR = Fixture Difficulty Rating. Elo = live team strength rating, more accurate than FPL's static 1-5.</p>
            </div>
          )}'''

if old_tr in c:
    c = c.replace(old_tr, new_tr)
    fixes += 1
    print('Transfer reasoning: OK')
else:
    print('Transfer reasoning: NO MATCH')

# ── 3. Enhanced DGW players section ───────────────────────────────────────────
old_dgw = '''          {/* DGW players */}
          {dgwPlayers.length > 0 && (
            <div className="p-3 rounded-xl" style={{background:'rgba(16,185,129,0.06)',border:'1px solid rgba(16,185,129,0.15)'}}>
              <div className="flex items-center gap-2 mb-1">
                <i className="fa-solid fa-calendar-plus text-green-400 text-xs"/>
                <span className="text-xs font-bold text-green-300">Double Gameweek Assets ({dgwPlayers.length} players)</span>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed mb-2">
                Oracle has maximised DGW exposure — these players each have 2 fixtures this gameweek:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {dgwPlayers.map((p,i) => (
                  <span key={i} className="text-[10px] font-bold px-2 py-1 rounded-lg"
                    style={{background:'rgba(16,185,129,0.15)',color:'#10b981'}}>
                    {p.name} <span className="opacity-60">{p.team_short}</span> · {p.xp_gw1?.toFixed(1)} xP
                  </span>
                ))}
              </div>
            </div>
          )}'''

new_dgw = '''          {/* DGW players */}
          {dgwPlayers.length > 0 && (
            <div className="p-3 rounded-xl" style={{background:'rgba(16,185,129,0.06)',border:'1px solid rgba(16,185,129,0.15)'}}>
              <div className="flex items-center gap-2 mb-1">
                <i className="fa-solid fa-calendar-plus text-green-400 text-xs"/>
                <span className="text-xs font-bold text-green-300">Double Gameweek Assets ({dgwPlayers.length} players)</span>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed mb-2">
                Players with 2 fixtures this GW — each appearance is a separate scoring opportunity (clean sheets, goals, bonus all double up):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {dgwPlayers.map((p,i) => (
                  <span key={i} className="text-[10px] font-bold px-2 py-1 rounded-lg"
                    style={{background:'rgba(16,185,129,0.15)',color:'#10b981'}}>
                    {p.name} <span className="opacity-60">{p.team_short}</span> · {p.xp_gw1?.toFixed(1)} xP
                  </span>
                ))}
              </div>
              <p className="text-[9px] text-gray-600 mt-2 italic">DGW = team plays twice in one GW (rescheduled fixtures). BGW = team blanks (0 fixtures).</p>
            </div>
          )}'''

if old_dgw in c:
    c = c.replace(old_dgw, new_dgw)
    fixes += 1
    print('DGW reasoning: OK')
else:
    print('DGW reasoning: NO MATCH')

# ── 4. Enhanced Top Performers with stat hints ────────────────────────────────
old_top = '''          {/* Top performers */}
          <div className="p-3 rounded-xl" style={{background:'rgba(168,85,247,0.06)',border:'1px solid rgba(168,85,247,0.15)'}}>
            <div className="flex items-center gap-2 mb-2">
              <i className="fa-solid fa-star text-purple-400 text-xs"/>
              <span className="text-xs font-bold text-purple-300">Top xP Performers in Squad</span>
            </div>
            <div className="space-y-1.5">
              {topPicks.map((p,i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 w-4">{i+1}.</span>
                  <span className="text-[11px] font-bold text-white flex-1">{p.name}</span>
                  <span className="text-[10px] text-gray-500">{p.team_short} · {p.position}</span>
                  <span className="text-[10px] font-bold text-purple-400">{p.xp_gw1?.toFixed(1)} xP</span>
                  {p.fixture_count_gw1 === 2 && <span className="text-[9px] font-bold text-green-400">DGW</span>}
                </div>
              ))}
            </div>
          </div>'''

new_top = '''          {/* Top performers */}
          <div className="p-3 rounded-xl" style={{background:'rgba(168,85,247,0.06)',border:'1px solid rgba(168,85,247,0.15)'}}>
            <div className="flex items-center gap-2 mb-2">
              <i className="fa-solid fa-star text-purple-400 text-xs"/>
              <span className="text-xs font-bold text-purple-300">Top xP Performers in Squad</span>
            </div>
            <div className="space-y-2">
              {topPicks.map((p,i) => (
                <div key={i} className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 w-4">{i+1}.</span>
                    <span className="text-[11px] font-bold text-white flex-1">{p.name}</span>
                    <span className="text-[10px] text-gray-500">{p.team_short} · {p.position}</span>
                    <span className="text-[10px] font-bold text-purple-400">{p.xp_gw1?.toFixed(1)} xP</span>
                    {p.fixture_count_gw1 === 2 && <span className="text-[9px] font-bold text-green-400">DGW</span>}
                  </div>
                  <div className="ml-6 text-[10px] text-gray-500">
                    {p.fdr_dynamic !== undefined && p.fdr_dynamic !== null && <>FDR <span className="text-gray-300">{Number(p.fdr_dynamic).toFixed(1)}</span> · </>}
                    {p.ict_index !== undefined && Number(p.ict_index) > 0 && <>ICT <span className="text-gray-300">{Number(p.ict_index).toFixed(0)}</span> · </>}
                    {p.xg_90 !== undefined && Number(p.xg_90) > 0 && <>xG/90 <span className="text-gray-300">{Number(p.xg_90).toFixed(2)}</span> · </>}
                    {p.starts_pct !== undefined && <>Starts <span className="text-gray-300">{Math.round(Number(p.starts_pct)*100)}%</span></>}
                  </div>
                </div>
              ))}
            </div>
          </div>'''

if old_top in c:
    c = c.replace(old_top, new_top)
    fixes += 1
    print('Top performers: OK')
else:
    print('Top performers: NO MATCH')

# ── 5. Add a "Stat glossary" footer ───────────────────────────────────────────
old_chip_block_end = '''          {/* Chip recommendation */}'''
new_with_glossary = '''          {/* Stat glossary - explain what each metric means */}
          <details className="p-3 rounded-xl text-[10px] text-gray-400" style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.05)'}}>
            <summary className="cursor-pointer text-[11px] font-bold text-gray-300 flex items-center gap-2">
              <i className="fa-solid fa-circle-info text-gray-500 text-xs"/>
              How Oracle scores players (tap to expand)
            </summary>
            <div className="mt-2 space-y-1.5 leading-relaxed">
              <div><span className="font-bold text-white">ICT Index</span> — FPL's Influence/Creativity/Threat composite. Higher = more goal-creating actions per match.</div>
              <div><span className="font-bold text-white">xG / xA per 90</span> — Expected Goals/Assists per 90 minutes. Predicts future scoring beyond raw past returns.</div>
              <div><span className="font-bold text-white">Team form (rolling 5)</span> — Goals scored/conceded by team in last 5 GWs. Strong attack + weak opponent defence = better xP.</div>
              <div><span className="font-bold text-white">Opponent defensive strength</span> — Goals conceded by opponent recently. Used to scale xG against likely defensive resistance.</div>
              <div><span className="font-bold text-white">Starts %</span> — Share of recent games started (≥45 min). Below 80% = rotation risk.</div>
              <div><span className="font-bold text-white">Transfer momentum</span> — Net transfers this GW. Positive = community buying (price likely to rise + perceived form).</div>
              <div><span className="font-bold text-white">Fixture difficulty (Elo-based)</span> — Live team strength rating beats FPL's static 1-5 by accounting for current form. Rating 1-5; lower = easier.</div>
              <div><span className="font-bold text-white">DGW / BGW detection</span> — DGW: team plays twice (double scoring opportunities). BGW: team blanks (0 fixtures, player will score 0 unless rescheduled).</div>
            </div>
          </details>
          {/* Chip recommendation */}'''

if old_chip_block_end in c:
    c = c.replace(old_chip_block_end, new_with_glossary)
    fixes += 1
    print('Glossary: OK')
else:
    print('Glossary: NO MATCH')

with open('src/pages/OracleOptimizer.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print(f'\n{fixes}/5 applied')
