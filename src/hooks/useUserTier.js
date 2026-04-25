import { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'

const SUPABASE_URL = 'https://bpwopjvvalwuisbbvimj.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwd29wanZ2YWx3dWlzYmJ2aW1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM5MTI1NjMsImV4cCI6MjA1OTQ4ODU2M30.gFVi_DXbbQGBUSBkzFpbpN4GveDoVrGODOlGLsiSz6Q'
const ADMIN_EMAILS = ['predictivefpl@outlook.com', 'navindhillon@gmail.com']

export function useUserTier() {
  const { user, isLoaded } = useUser()
  const [tier,    setTier]    = useState(null)   // null=loading, 'free', 'pro'
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoaded || !user) { setLoading(false); return }
    const email = user.primaryEmailAddress?.emailAddress
    // Admins are always pro
    if (ADMIN_EMAILS.includes(email)) { setTier('pro'); setLoading(false); return }
    // Check Supabase
    fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=tier&limit=1`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    })
      .then(r => r.json())
      .then(rows => {
        const t = rows?.[0]?.tier || 'free'
        setTier(t)
      })
      .catch(() => setTier('free'))
      .finally(() => setLoading(false))
  }, [user, isLoaded])

  const isPro  = tier === 'pro'
  const isFree = tier === 'free' || tier === null

  return { tier, isPro, isFree, loading }
}
