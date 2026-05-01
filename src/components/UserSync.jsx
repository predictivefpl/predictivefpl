import { useEffect } from 'react'
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
