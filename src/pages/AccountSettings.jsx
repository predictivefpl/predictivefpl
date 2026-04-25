import { useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { useUserTier, redeemPromoCode } from '../hooks/useUserTier'

export default function AccountSettings() {
  const { user }             = useUser()
  const navigate             = useNavigate()
  const { tier, isPro }      = useUserTier()
  const [code,     setCode]  = useState('')
  const [msg,      setMsg]   = useState('')
  const [loading,  setLoading] = useState(false)

  const handleRedeem = async () => {
    if (!code.trim()) return
    setLoading(true); setMsg('')
    const email = user?.primaryEmailAddress?.emailAddress
    const result = await redeemPromoCode(email, code)
    if (result.success) {
      setMsg('🎉 Pro access unlocked! Refresh the page to see your upgrade.')
      setCode('')
    } else {
      setMsg('❌ ' + result.error)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0B0D14] flex text-white">
      <Sidebar/>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-6 py-10">
          <h1 className="text-2xl font-black mb-8">Account Settings</h1>

          {/* Current plan */}
          <div className="rounded-2xl p-5 mb-5 flex items-center justify-between"
            style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)'}}>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Current Plan</p>
              <p className="text-lg font-black text-white">
                {isPro ? 'Pro' : 'Free'}
                {isPro && <span className="ml-2 text-xs font-bold text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full">ACTIVE</span>}
              </p>
            </div>
            {!isPro && (
              <button onClick={() => navigate('/upgrade')}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white"
                style={{background:'linear-gradient(135deg,#a855f7,#3b82f6)'}}>
                Upgrade →
              </button>
            )}
          </div>

          {/* Promo code */}
          {!isPro && (
            <div className="rounded-2xl p-5 mb-5"
              style={{background:'rgba(168,85,247,0.05)',border:'1px solid rgba(168,85,247,0.2)'}}>
              <p className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <i className="fa-solid fa-ticket text-purple-400 text-xs"/>
                Have a promo code?
              </p>
              <p className="text-xs text-gray-500 mb-4">Enter your code below to unlock Pro access instantly.</p>
              <div className="flex gap-2">
                <input type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="Enter promo code"
                  className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-purple-500/50 placeholder-gray-600 uppercase"/>
                <button onClick={handleRedeem} disabled={!code.trim() || loading}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 flex-shrink-0"
                  style={{background:'linear-gradient(135deg,#a855f7,#3b82f6)'}}>
                  {loading ? <i className="fa-solid fa-spinner fa-spin"/> : 'Redeem'}
                </button>
              </div>
              {msg && (
                <p className={`text-xs mt-3 font-semibold ${msg.startsWith('🎉') ? 'text-green-400' : 'text-red-400'}`}>
                  {msg}
                </p>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
