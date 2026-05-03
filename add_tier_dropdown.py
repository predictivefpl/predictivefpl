import re

with open('src/pages/AdminConsole.jsx', encoding='utf-8') as f:
    c = f.read()

fixes = 0

# ── 1. Add Actions column header ──────────────────────────────────────────────
# Find the table headers
old_headers = "{['User','Email','FPL Team ID','Tier','Joined','Last Login'].map(h => ("
new_headers = "{['User','Email','FPL Team ID','Tier','Joined','Last Login','Actions'].map(h => ("
if old_headers in c:
    c = c.replace(old_headers, new_headers)
    fixes += 1
    print('Header added: OK')
else:
    # Try with the old "Access" header
    old_headers2 = "{['User','Email','FPL Team ID','Tier','Joined','Last Login','Access'].map(h => ("
    new_headers2 = "{['User','Email','FPL Team ID','Tier','Joined','Last Login','Actions'].map(h => ("
    if old_headers2 in c:
        c = c.replace(old_headers2, new_headers2)
        fixes += 1
        print('Header renamed Access -> Actions')

# ── 2. Add the new TD cell after the last_sign_in cell ────────────────────────
# Find: last cell ending with last_sign_in
old_last_cell = """last_sign_in ? new Date(u.last_sign_in).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : '—'}
                                  </td>"""

new_last_cell = """last_sign_in ? new Date(u.last_sign_in).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : '—'}
                                  </td>
                                  <td className="px-5 py-3.5">
                                    <select
                                      value={u.tier || 'free'}
                                      onChange={(e) => setUserTier(u.id, e.target.value, u.email)}
                                      className="text-[10px] font-bold px-2 py-1 rounded-lg cursor-pointer focus:outline-none transition-all"
                                      style={{
                                        background: (u.tier === 'pro') ? 'rgba(168,85,247,0.1)' : 'rgba(255,255,255,0.04)',
                                        border: '1px solid ' + ((u.tier === 'pro') ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.1)'),
                                        color: (u.tier === 'pro') ? '#c084fc' : 'white',
                                      }}>
                                      <option value="free" style={{background:'#0F121D',color:'white'}}>Free</option>
                                      <option value="pro"  style={{background:'#0F121D',color:'white'}}>Pro</option>
                                    </select>
                                  </td>"""

if old_last_cell in c:
    c = c.replace(old_last_cell, new_last_cell)
    fixes += 1
    print('Tier dropdown cell: OK')
else:
    print('Tier dropdown cell: NO MATCH')
    # Search for the variant
    idx = c.find('last_sign_in ? new Date')
    if idx >= 0:
        end = c.find('</td>', idx)
        print('Found last_sign_in cell, ends at:', end)
        print('Cell text:', repr(c[idx:end+5]))

# ── 3. Remove any old Grant Pro / Revoke Pro cell that may still exist ────────
old_buttons_cell = '''                            <td className="px-5 py-3.5">
                              {(u.tier || 'free') === 'pro'
                                ? <button onClick={() => revokePro(u.id, u.email)}
                                    className="text-[10px] font-bold px-2 py-1 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all">
                                    Revoke
                                  </button>
                                : <button onClick={() => grantPro(u.id, u.email)}
                                    className="text-[10px] font-bold px-2 py-1 rounded-lg border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition-all">
                                    Grant Pro
                                  </button>
                              }
                            </td>'''
if old_buttons_cell in c:
    c = c.replace(old_buttons_cell, '')
    fixes += 1
    print('Old buttons cell: removed')

with open('src/pages/AdminConsole.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print(f'\n{fixes}/3 applied')
