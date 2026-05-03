import re

with open('src/pages/AdminConsole.jsx', encoding='utf-8') as f:
    c = f.read()

# ── 1. Remove "premium" from any tier arrays/objects ──────────────────────────
# Common patterns: ['free','pro','premium'] or {free:..., pro:..., premium:...}
c = re.sub(r"\s*,?\s*['\"]premium['\"]", '', c)
c = re.sub(r"\s*,?\s*premium\s*:[^,}]+", '', c)
# Remove any "Premium" labels in JSX
c = re.sub(r"\s*,?\s*['\"]Premium['\"]", '', c)
# Clean up double commas left behind
c = re.sub(r',\s*,', ',', c)
c = re.sub(r',\s*\]', ']', c)
c = re.sub(r',\s*\}', '}', c)

print('Removed premium references')

# ── 2. Find the user row's tier cell and replace with a dropdown ──────────────
# Look for the tier display column in the users table
# It's typically a span/div showing u.tier
# We'll find any cell rendering u.tier and add a setTier function + select dropdown

# First, ensure setTier function exists
if 'const setTier' not in c and 'setUserTier' not in c:
    # Add it after grantPro function
    insert_marker = '  const grantPro = async (userId, userEmail) => {'
    if insert_marker in c:
        new_fn = '''  const setUserTier = async (userId, newTier, userEmail) => {
    if (!confirm(`Set ${userEmail} to "${newTier}"?`)) return
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal'
        },
        body: JSON.stringify({ tier: newTier })
      })
      fetchUsers()
    } catch (e) { alert('Error: ' + e.message) }
  }

'''
        c = c.replace(insert_marker, new_fn + insert_marker)
        print('Added setUserTier function')

# ── 3. Replace the existing Grant Pro / Revoke Pro buttons with a dropdown ────
# Find the Access column TD that has the buttons
old_access_cell = '''                            <td className="px-5 py-3.5">
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

new_access_cell = '''                            <td className="px-5 py-3.5">
                              <select
                                value={u.tier || 'free'}
                                onChange={(e) => setUserTier(u.id, e.target.value, u.email)}
                                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.1] text-white cursor-pointer focus:outline-none focus:border-purple-500/50">
                                <option value="free" style={{background:'#0F121D'}}>Free</option>
                                <option value="pro"  style={{background:'#0F121D'}}>Pro</option>
                              </select>
                            </td>'''

if old_access_cell in c:
    c = c.replace(old_access_cell, new_access_cell)
    print('Tier dropdown: OK')
else:
    print('Tier dropdown: NO MATCH - searching alternative...')
    # Try a more flexible match
    import re
    pat = re.compile(
        r"<td className=\"px-5 py-3\.5\">\s*\{[^}]*tier[^}]*\?\s*<button[^<]*revokePro[^<]*<[^>]*>[\s\S]*?Revoke\s*</button>\s*:\s*<button[^<]*grantPro[^<]*<[^>]*>[\s\S]*?Grant Pro\s*</button>[\s\S]*?</td>"
    )
    m = pat.search(c)
    if m:
        c = c[:m.start()] + new_access_cell + c[m.end():]
        print('Tier dropdown (regex): OK')
    else:
        print('Tier dropdown: still NO MATCH')

# ── 4. Update tier badge in profile header to only show free/pro ──────────────
# Look for tier display showing "Premium" anywhere in JSX text
c = re.sub(
    r'\{?\s*u\.tier\s*===\s*[\'"]premium[\'"][^}]*\}?',
    "{u.tier === 'pro' ? 'Pro' : 'Free'}",
    c
)
c = re.sub(
    r'\{?\s*tier\s*===\s*[\'"]premium[\'"][^}]*\}?',
    "{tier === 'pro' ? 'Pro' : 'Free'}",
    c
)

with open('src/pages/AdminConsole.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print('\nDone.')
