import re

# ══════════════════════════════════════════════════════════════════════════════
# 1. MyTeam.jsx — header stack + pitch full-width + smaller avatars on mobile
# ══════════════════════════════════════════════════════════════════════════════
with open('src/pages/MyTeam.jsx', encoding='utf-8') as f:
    c = f.read()

fixes_mt = 0

# Fix the header h-[60px] - stack vertically on mobile
old_h = '<header className="h-[60px] px-6 flex items-center justify-between border-b border-gray-800/50 bg-[#0F121D] flex-shrink-0">'
new_h = '<header className="px-3 md:px-6 py-3 border-b border-gray-800/50 bg-[#0F121D] flex-shrink-0" style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexDirection: isMobile ? "column" : "row",gap:isMobile?8:0,minHeight: isMobile?"auto":60}}>'
if old_h in c:
    c = c.replace(old_h, new_h)
    fixes_mt += 1
    print('MyTeam: header stack OK')

# Make stat boxes wrap on mobile - they're inside the first flex
# Find first inner div with gap-3 (the 4 stat boxes container)
old_stats = '<div className="flex items-center gap-3">'
# Only replace the first occurrence (which is the stats wrapper)
idx = c.find(old_stats)
if idx > 0:
    c = c[:idx] + '<div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",justifyContent:"center"}}>' + c[idx+len(old_stats):]
    fixes_mt += 1
    print('MyTeam: stats wrap OK')

# Avatar 62 -> clamp
if 'style={{width:62,height:62}}' in c:
    c = c.replace('style={{width:62,height:62}}', 'style={{width:"clamp(36px,9vw,62px)",height:"clamp(36px,9vw,62px)"}}')
    fixes_mt += 1
    print('MyTeam: avatar clamp OK')

# Pitch min-height -> aspect ratio (already done but verify)
# Looking at structure: minHeight:'520px' was already replaced

with open('src/pages/MyTeam.jsx', 'w', encoding='utf-8') as f:
    f.write(c)
print(f'MyTeam: {fixes_mt} fixes applied\n')


# ══════════════════════════════════════════════════════════════════════════════
# 2. Rivals.jsx — convert table to card list on mobile
# ══════════════════════════════════════════════════════════════════════════════
with open('src/pages/Rivals.jsx', encoding='utf-8') as f:
    c2 = f.read()

fixes_rv = 0

# Find the table element and wrap it conditionally
# Strategy: keep table on desktop, render cards on mobile
# Look for <table className=...> and add conditional rendering

# Find the table opening
table_match = re.search(r'<table[^>]*>', c2)
if table_match:
    table_start = table_match.start()
    table_end_match = c2.find('</table>', table_start)
    if table_end_match > 0:
        table_end = table_end_match + len('</table>')
        full_table = c2[table_start:table_end]
        print('Rivals: found table, length:', len(full_table))

        # Wrap with conditional - keep table on desktop, cards on mobile
        # Add the cards version next to the table
        # Look for the data variable used in tbody
        # Find {standings.map or similar
        map_match = re.search(r'\{(\w+)\.map\(\(s,', full_table)
        if map_match:
            data_var = map_match.group(1)
            print('Rivals: data variable is', data_var)

            # Build mobile cards version
            mobile_cards = (
                '\n          {/* Mobile cards view */}\n'
                '          {isMobile && (\n'
                f'            <div style={{{{display:"flex",flexDirection:"column",gap:8,padding:"12px 8px"}}}}>\n'
                f'              {{{data_var}.map((s, i) => {{\n'
                '                const isMe = s.entry === entry || s.entry_id === entry\n'
                f'                return (\n'
                '                  <div key={s.entry || s.entry_id || i}\n'
                '                    style={{padding:12,borderRadius:10,background: isMe ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.03)",border: "1px solid " + (isMe ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.06)")}}>\n'
                '                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>\n'
                '                      <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>\n'
                '                        <span style={{fontSize:14,fontWeight:700,color: s.rank <= 3 ? "#fbbf24" : "#d1d5db",minWidth:24}}>\n'
                '                          {s.rank <= 3 ? ["🥇","🥈","🥉"][s.rank-1] : "#" + s.rank}\n'
                '                        </span>\n'
                '                        <div style={{flex:1,minWidth:0}}>\n'
                '                          <p style={{margin:0,fontSize:13,fontWeight:600,color: isMe ? "#93c5fd" : "white",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>\n'
                '                            {s.entry_name}{isMe && " (you)"}\n'
                '                          </p>\n'
                '                          <p style={{margin:0,fontSize:11,color:"#6b7280",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.player_name}</p>\n'
                '                        </div>\n'
                '                      </div>\n'
                '                      <div style={{textAlign:"right",flexShrink:0}}>\n'
                '                        <p style={{margin:0,fontSize:14,fontWeight:700,color:"white"}}>{s.total || s.event_total || 0}</p>\n'
                '                        <p style={{margin:0,fontSize:10,color:"#6b7280"}}>pts</p>\n'
                '                      </div>\n'
                '                    </div>\n'
                '                  </div>\n'
                '                )\n'
                '              })}\n'
                '            </div>\n'
                '          )}\n'
            )

            # Wrap table in {!isMobile && (...)}
            new_table = '{!isMobile && (\n          ' + full_table + '\n          )}'
            c2 = c2[:table_start] + new_table + mobile_cards + c2[table_end:]
            fixes_rv += 1
            print('Rivals: mobile card view added')

# Make the page content use less padding on mobile
old_main_pad = re.search(r'className="(flex-1[^"]*)\bp-[68]\b([^"]*)"', c2)
if old_main_pad:
    full = old_main_pad.group(0)
    new_full = full.replace('p-8', '').replace('p-6', '').rstrip('"') + '" style={{padding: isMobile ? 8 : 32}}'
    c2 = c2.replace(full, new_full, 1)
    fixes_rv += 1
    print('Rivals: padding OK')

with open('src/pages/Rivals.jsx', 'w', encoding='utf-8') as f:
    f.write(c2)
print(f'Rivals: {fixes_rv} fixes applied')
