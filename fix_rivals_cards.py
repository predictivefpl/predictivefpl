import re

with open('src/pages/Rivals.jsx', encoding='utf-8') as f:
    c = f.read()

fixes = 0

# Find the table - we know it's at index ~8860
table_match = re.search(r'<table className="w-full">', c)
if not table_match:
    print('table tag not found')
else:
    table_start = table_match.start()
    # Find the matching </table>
    table_end_idx = c.find('</table>', table_start)
    if table_end_idx < 0:
        print('</table> not found')
    else:
        table_end = table_end_idx + len('</table>')
        full_table = c[table_start:table_end]
        print('Table found:', table_start, '-', table_end, '| length:', len(full_table))

        # Wrap table so it only renders on desktop
        wrapped_table = '{!isMobile && (\n                    ' + full_table + '\n                  )}'

        # Build mobile card list
        mobile_cards = '''
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
                  )}'''

        c = c[:table_start] + wrapped_table + mobile_cards + c[table_end:]
        fixes += 1
        print('Mobile cards added: OK')

with open('src/pages/Rivals.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print(f'\n{fixes} fixes applied')
