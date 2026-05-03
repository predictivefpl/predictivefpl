import { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'

const ORACLE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8001'
  : 'https://predictivefpl-production.up.railway.app'
const ADMIN_EMAILS = ['predictivefpl@outlook.com', 'navindhillon@gmail.com']

export function useUserTier() {
  const { user, isLoaded } = useUser()
  const [tier,    setTier]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!isLoaded || !user) { setLoading(false); return }
    const email = user.primaryEmailAddress?.emailAddress
    if (!email) { setLoading(false); return }

    if (ADMIN_EMAILS.includes(email)) { setTier('pro'); setIsAdmin(true); setLoading(false); return }

    // Server-authoritative tier check (cannot be bypassed by frontend manipulation)
    fetch(`${ORACLE_URL}/api/me/tier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email }),
    })
      .then(r => r.json())
      .then(d => {
        setTier(d.tier || 'free')
        setIsAdmin(!!d.is_admin)
      })
      .catch(() => setTier('free'))
      .finally(() => setLoading(false))
  }, [user, isLoaded])

  return { tier, isPro: tier === 'pro', isFree: tier === 'free' || tier === null, loading, isAdmin }
}

// Standalone promo code redemption — server should validate this too in future
export async function redeemPromoCode(email, code) {
  if (!email || !code) return { success: false, error: 'Email and code required' }
  try {
    const r = await fetch(`${ORACLE_URL}/api/promo/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code: code.trim().toUpperCase() }),
    })
    const data = await r.json()
    if (data.success) return { success: true }
    return { success: false, error: data.error || 'Invalid or already used code.' }
  } catch (e) {
    return { success: false, error: 'Network error - please try again' }
  }
}
