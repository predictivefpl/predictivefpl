import os

# ── 1. Create UserSync component ─────────────────────────────────────────────
user_sync = r"""import { useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'

const SUPABASE_URL = 'https://bpwopjvvalwuisbbvimj.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwd29wanZ2YWx3dWlzYmJ2aW1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNzMwODksImV4cCI6MjA5MDk0OTA4OX0.j7iIHWpsd0fKk9MRKEywSEWt90M7dokO5JR2D65GqeA'

/**
 * Silently upserts the current Clerk user into Supabase 'users' table.
 * Renders nothing. Mount once at app level (e.g. in App.jsx).
 */
export default function UserSync() {
  const { user, isLoaded } = useUser()

  useEffect(() => {
    if (!isLoaded || !user) return

    const email = user.primaryEmailAddress?.emailAddress
    if (!email) return

    // Don't re-sync within 5 minutes of last sync (per browser session)
    const cacheKey = `user_synced_${user.id}`
    const lastSync = sessionStorage.getItem(cacheKey)
    if (lastSync && Date.now() - Number(lastSync) < 5 * 60 * 1000) return

    const payload = {
      id:               user.id,
      email:            email,
      name:             user.fullName || user.firstName || email.split('@')[0],
      created_at:       user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
      last_sign_in:     new Date().toISOString(),
    }

    fetch(`${SUPABASE_URL}/rest/v1/users?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey:           SUPABASE_KEY,
        Authorization:    `Bearer ${SUPABASE_KEY}`,
        'Content-Type':   'application/json',
        Prefer:           'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(payload),
    })
      .then(r => {
        if (r.ok) sessionStorage.setItem(cacheKey, String(Date.now()))
      })
      .catch(() => {})  // silent fail - never block UI
  }, [user, isLoaded])

  return null
}
"""

with open('src/components/UserSync.jsx', 'w', encoding='utf-8') as f:
    f.write(user_sync)
print('UserSync.jsx: created')

# ── 2. Mount it in App.jsx ──────────────────────────────────────────────────
with open('src/App.jsx', encoding='utf-8') as f:
    app = f.read()

if 'UserSync' not in app:
    # Add import after other component imports
    if "import UpgradePage" in app:
        app = app.replace(
            "import UpgradePage from './pages/UpgradePage'",
            "import UpgradePage from './pages/UpgradePage'\nimport UserSync from './components/UserSync'"
        )
    else:
        # Add at top after other imports
        lines = app.split('\n')
        last_import = max((i for i, ln in enumerate(lines) if ln.startswith('import ')), default=0)
        lines.insert(last_import + 1, "import UserSync from './components/UserSync'")
        app = '\n'.join(lines)

    # Mount UserSync inside the BrowserRouter or main return
    # Look for <BrowserRouter> or <Router>
    for marker in ['<BrowserRouter>', '<Router>']:
        if marker in app:
            app = app.replace(marker, marker + '\n      <UserSync />', 1)
            break
    else:
        # Fallback - mount inside <ClerkProvider>
        if '<ClerkProvider' in app:
            # Find end of ClerkProvider opening tag
            import re
            m = re.search(r'<ClerkProvider[^>]*>', app)
            if m:
                app = app[:m.end()] + '\n      <UserSync />' + app[m.end():]
                print('Mounted UserSync inside ClerkProvider')

    with open('src/App.jsx', 'w', encoding='utf-8') as f:
        f.write(app)
    print('App.jsx: UserSync mounted')
else:
    print('App.jsx: UserSync already mounted')

print('\nIMPORTANT: Run this SQL in Supabase SQL Editor to ensure the users table exists with right schema:')
print('''
CREATE TABLE IF NOT EXISTS users (
  id              text PRIMARY KEY,
  email           text UNIQUE NOT NULL,
  name            text,
  fpl_team_id     bigint,
  tier            text DEFAULT 'free',
  created_at      timestamptz DEFAULT now(),
  last_sign_in    timestamptz
);

-- Allow anon key to read/write users (for the sync to work)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all users to be inserted/updated" ON users
  FOR ALL USING (true) WITH CHECK (true);
''')
