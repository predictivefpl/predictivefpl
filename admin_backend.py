with open('engine_oracle/api/server.py', encoding='utf-8') as f:
    srv = f.read()

if '/api/admin/users' in srv:
    print('Already added')
else:
    new_endpoints = '''
@app.post("/api/admin/users")
async def admin_list_users(request: Request):
    """Admin-only: list all users via service_role key (bypasses RLS)."""
    body = await request.json()
    email = (body.get("email") or "").lower()
    if not is_admin_email(email):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin only")
    import aiohttp
    SUPA_URL = os.environ.get("SUPABASE_URL", "")
    SUPA_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
    headers  = {"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}"}
    async with aiohttp.ClientSession() as sess:
        url = f"{SUPA_URL}/rest/v1/users?select=id,email,name,fpl_team_id,tier,created_at,last_sign_in&order=created_at.desc&limit=1000"
        async with sess.get(url, headers=headers) as r:
            data = await r.json()
            return data if isinstance(data, list) else []


@app.post("/api/admin/set-tier")
async def admin_set_tier(request: Request):
    """Admin-only: change a user's tier."""
    body = await request.json()
    admin_email = (body.get("admin_email") or "").lower()
    if not is_admin_email(admin_email):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin only")
    user_id  = body.get("user_id")
    new_tier = body.get("tier")
    if new_tier not in ("free", "pro"):
        return {"success": False, "error": "Invalid tier"}
    import aiohttp
    SUPA_URL = os.environ.get("SUPABASE_URL", "")
    SUPA_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
    headers  = {
        "apikey":        SUPA_KEY,
        "Authorization": f"Bearer {SUPA_KEY}",
        "Content-Type":  "application/json",
        "Prefer":        "return=minimal",
    }
    async with aiohttp.ClientSession() as sess:
        url = f"{SUPA_URL}/rest/v1/users?id=eq.{user_id}"
        async with sess.patch(url, headers=headers, json={"tier": new_tier}) as r:
            return {"success": r.status in (200, 204)}


@app.post("/api/admin/promos")
async def admin_list_promos(request: Request):
    """Admin-only: list all promo codes."""
    body = await request.json()
    email = (body.get("email") or "").lower()
    if not is_admin_email(email):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin only")
    import aiohttp
    SUPA_URL = os.environ.get("SUPABASE_URL", "")
    SUPA_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
    headers  = {"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}"}
    async with aiohttp.ClientSession() as sess:
        url = f"{SUPA_URL}/rest/v1/promo_codes?select=*&order=created_at.desc"
        async with sess.get(url, headers=headers) as r:
            data = await r.json()
            return data if isinstance(data, list) else []


@app.post("/api/admin/promo-create")
async def admin_create_promo(request: Request):
    """Admin-only: create a new promo code."""
    body = await request.json()
    admin_email = (body.get("admin_email") or "").lower()
    if not is_admin_email(admin_email):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin only")
    code = (body.get("code") or "").strip().upper()
    note = (body.get("note") or "").strip()
    if not code:
        return {"success": False, "error": "Code required"}
    import aiohttp
    SUPA_URL = os.environ.get("SUPABASE_URL", "")
    SUPA_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
    headers  = {
        "apikey":        SUPA_KEY,
        "Authorization": f"Bearer {SUPA_KEY}",
        "Content-Type":  "application/json",
        "Prefer":        "return=representation",
    }
    payload = {"code": code, "note": note or "Beta tester", "redeemed": False}
    async with aiohttp.ClientSession() as sess:
        url = f"{SUPA_URL}/rest/v1/promo_codes"
        async with sess.post(url, headers=headers, json=payload) as r:
            if r.status in (200, 201):
                return {"success": True}
            err = await r.text()
            return {"success": False, "error": err}


@app.post("/api/admin/promo-delete")
async def admin_delete_promo(request: Request):
    """Admin-only: delete a promo code."""
    body = await request.json()
    admin_email = (body.get("admin_email") or "").lower()
    if not is_admin_email(admin_email):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin only")
    promo_id = body.get("id")
    if not promo_id:
        return {"success": False}
    import aiohttp
    SUPA_URL = os.environ.get("SUPABASE_URL", "")
    SUPA_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
    headers  = {"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}"}
    async with aiohttp.ClientSession() as sess:
        url = f"{SUPA_URL}/rest/v1/promo_codes?id=eq.{promo_id}"
        async with sess.delete(url, headers=headers) as r:
            return {"success": r.status in (200, 204)}

'''
    # Insert before /api/me/tier
    srv = srv.replace('@app.post("/api/me/tier")', new_endpoints + '@app.post("/api/me/tier")')
    with open('engine_oracle/api/server.py', 'w', encoding='utf-8') as f:
        f.write(srv)
    print('Backend admin endpoints added')

# Now update AdminConsole.jsx to call the new backend endpoints
with open('src/pages/AdminConsole.jsx', encoding='utf-8') as f:
    c = f.read()

# Replace fetchUsers
old_fetch_users = '''  const fetchUsers = useCallback(async () => {
    setB('users', true)
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/users?select=id,email,name,fpl_team_id,tier,created_at,last_sign_in&order=created_at.desc&limit=1000`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
      const d = await r.json()
      setUsers(Array.isArray(d) ? d : [])
    } catch { setUsers([]) }
    setB('users', false)
  }, [])'''

new_fetch_users = '''  const fetchUsers = useCallback(async () => {
    setB('users', true)
    try {
      const adminEmail = user?.primaryEmailAddress?.emailAddress
      const r = await fetch(`${ORACLE_URL}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail }),
      })
      const d = await r.json()
      setUsers(Array.isArray(d) ? d : [])
    } catch { setUsers([]) }
    setB('users', false)
  }, [user])'''

if old_fetch_users in c:
    c = c.replace(old_fetch_users, new_fetch_users)
    print('AdminConsole fetchUsers: OK')
else:
    print('fetchUsers: NO MATCH (may already be patched)')

# Replace fetchPromos
old_fp = '''  const fetchPromos = async () => {
    setPromoLoading(true)
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/promo_codes?select=*&order=created_at.desc`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
      const d = await r.json()
      setPromos(Array.isArray(d) ? d : [])
    } catch { setPromos([]) }
    setPromoLoading(false)
  }'''

new_fp = '''  const fetchPromos = async () => {
    setPromoLoading(true)
    try {
      const adminEmail = user?.primaryEmailAddress?.emailAddress
      const r = await fetch(`${ORACLE_URL}/api/admin/promos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail }),
      })
      const d = await r.json()
      setPromos(Array.isArray(d) ? d : [])
    } catch { setPromos([]) }
    setPromoLoading(false)
  }'''

if old_fp in c:
    c = c.replace(old_fp, new_fp)
    print('fetchPromos: OK')

# Replace setUserTier to use backend
import re
old_set = re.search(r'const setUserTier = async \(userId, newTier, userEmail\) => \{[\s\S]*?fetchUsers\(\)\s*\}\s*catch[^}]+\}\s*\}', c)
if old_set:
    new_set = '''const setUserTier = async (userId, newTier, userEmail) => {
    if (!confirm(`Set ${userEmail} to "${newTier}"?`)) return
    try {
      const adminEmail = user?.primaryEmailAddress?.emailAddress
      await fetch(`${ORACLE_URL}/api/admin/set-tier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_email: adminEmail, user_id: userId, tier: newTier }),
      })
      fetchUsers()
    } catch (e) { alert('Error: ' + e.message) }
  }'''
    c = c[:old_set.start()] + new_set + c[old_set.end():]
    print('setUserTier: OK')

# Replace createPromo
old_cp_match = re.search(r'const createPromo = async \(\) => \{[\s\S]*?setTimeout\(\(\) => setPromoMsg\(\'\'\), 3000\)\s*\}', c)
if old_cp_match:
    new_cp = '''const createPromo = async () => {
    if (!newCode.trim()) return
    setPromoMsg('')
    try {
      const adminEmail = user?.primaryEmailAddress?.emailAddress
      const r = await fetch(`${ORACLE_URL}/api/admin/promo-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_email: adminEmail, code: newCode.trim(), note: newNote.trim() }),
      })
      const d = await r.json()
      if (d.success) {
        setPromoMsg('✓ Code created')
        setNewCode(''); setNewNote('')
        fetchPromos()
      } else { setPromoMsg('Error: ' + (d.error || 'Failed')) }
    } catch (e) { setPromoMsg('Error: ' + e.message) }
    setTimeout(() => setPromoMsg(''), 3000)
  }'''
    c = c[:old_cp_match.start()] + new_cp + c[old_cp_match.end():]
    print('createPromo: OK')

# Replace deletePromo
old_dp_match = re.search(r'const deletePromo = async \(id\) => \{[\s\S]*?fetchPromos\(\)\s*\}', c)
if old_dp_match:
    new_dp = '''const deletePromo = async (id) => {
    const adminEmail = user?.primaryEmailAddress?.emailAddress
    await fetch(`${ORACLE_URL}/api/admin/promo-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_email: adminEmail, id }),
    })
    fetchPromos()
  }'''
    c = c[:old_dp_match.start()] + new_dp + c[old_dp_match.end():]
    print('deletePromo: OK')

# Add ORACLE_URL constant if missing
if 'const ORACLE_URL' not in c:
    # Find SUPABASE_URL and add after
    c = c.replace(
        "const SUPABASE_URL",
        "const ORACLE_URL = window.location.hostname === 'localhost' ? 'http://localhost:8001' : 'https://predictivefpl-production.up.railway.app'\nconst SUPABASE_URL"
    )
    print('ORACLE_URL added')

with open('src/pages/AdminConsole.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print('\nDone. Now run: npm run build && git push')
