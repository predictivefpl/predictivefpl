import { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'

const SUPABASE_URL = 'https://bpwopjvvalwuisbbvimj.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwd29wanZ2YWx3dWlzYmJ2aW1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNzMwODksImV4cCI6MjA5MDk0OTA4OX0.j7iIHWpsd0fKk9MRKEywSEWt90M7dokO5JR2D65GqeA'
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

// Standalone function to redeem a promo code
export async function redeemPromoCode(email, code) {
  const upper = code.trim().toUpperCase()
  // 1. Check code exists and is not redeemed
  const r1 = await fetch(
    `${SUPABASE_URL}/rest/v1/promo_codes?code=eq.${upper}&redeemed=eq.false&select=id`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  )
  const codes = await r1.json()
  if (!Array.isArray(codes) || codes.length === 0) {
    return { success: false, error: 'Invalid or already used code.' }
  }
  const codeId = codes[0].id

  // 2. Mark code as redeemed
  await fetch(`${SUPABASE_URL}/rest/v1/promo_codes?id=eq.${codeId}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal'
    },
    body: JSON.stringify({ redeemed: true, redeemed_by: email, redeemed_at: new Date().toISOString() })
  })

  // 3. Upgrade user tier to pro
  await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal'
    },
    body: JSON.stringify({ tier: 'pro' })
  })

  return { success: true }
}
