import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import Sidebar from '../components/Sidebar'

// Replace with your live Stripe Payment Link for $4.99 AUD/mo
// Create at: https://dashboard.stripe.com/payment-links
const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/YOUR_PAYMENT_LINK'

export default function UpgradePage() {
  const navigate    = useNavigate()
  const { user }    = useUser()
  const [loading, setLoading] = useState(false)

  const handleUpgrade = () => {
    setLoading(true)
    // Append user email so Stripe pre-fills it
    const email = user?.primaryEmailAddress?.emailAddress || ''
    const url   = `${STRIPE_PAYMENT_LINK}?prefilled_email=${encodeURIComponent(email)}`
    window.location.href = url
  }

  const FREE_FEATURES = [
    'Live FPL squad sync',
    'Fixture difficulty ratings',
    'Rivals & mini-league tracker',
    'Player insights & form data',
    'Chip timing advisor (basic)',
    'GW average & top score tracking',
  ]

  const PRO_FEATURES = [
    'Everything in Free',
    'Oracle AI Transfer Optimizer',
    'AI-powered xP predictions (800+ players)',
    '5-GW horizon planning',
    'DGW/BGW automatic detection',
    'Wildcard & Free Hit optimizer',
    'ICT + xG/xA + team form algorithm',
    'Captain recommendation engine',
    'Priority email support',
  ]

  return (
    <div className="min-h-screen bg-[#0B0D14] flex text-white">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-12">

          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold mb-6"
              style={{background:'rgba(168,85,247,0.12)',border:'1px solid rgba(168,85,247,0.3)',color:'#c084fc'}}>
              <i className="fa-solid fa-bolt text-[10px]"/>
              UPGRADE TO PRO
            </div>
            <h1 className="text-4xl font-black mb-3">The AI edge your rivals already have.</h1>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              The Oracle Optimizer analyses 800+ players across 5 gameweeks to find the exact transfer that moves your rank.
            </p>
          </div>

          {/* Pricing cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">

            {/* Free */}
            <div className="rounded-2xl p-6" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)'}}>
              <div className="mb-5">
                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Free</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-black text-white">$0</span>
                  <span className="text-gray-500 mb-1">/ forever</span>
                </div>
              </div>
              <ul className="space-y-2.5 mb-6">
                {FREE_FEATURES.map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-gray-400">
                    <i className="fa-solid fa-check text-gray-600 mt-0.5 flex-shrink-0"/>
                    {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate('/dashboard')}
                className="w-full py-3 rounded-xl text-sm font-bold border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-all">
                Continue Free
              </button>
            </div>

            {/* Pro */}
            <div className="rounded-2xl p-6 relative" style={{background:'linear-gradient(135deg,rgba(168,85,247,0.1),rgba(59,130,246,0.08))',border:'1px solid rgba(168,85,247,0.35)'}}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 rounded-full text-[10px] font-black text-white"
                  style={{background:'linear-gradient(90deg,#a855f7,#3b82f6)'}}>
                  MOST POPULAR
                </span>
              </div>
              <div className="mb-5">
                <p className="text-sm font-bold text-purple-400 uppercase tracking-wider mb-1">Pro</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-black text-white">$4.99</span>
                  <span className="text-gray-400 mb-1">AUD / month</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Less than a coffee. Cancel anytime.</p>
              </div>
              <ul className="space-y-2.5 mb-6">
                {PRO_FEATURES.map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm" style={{color: i === 0 ? '#6b7280' : '#e5e7eb'}}>
                    <i className={`fa-solid fa-check mt-0.5 flex-shrink-0 ${i === 0 ? 'text-gray-600' : 'text-purple-400'}`}/>
                    {f}
                  </li>
                ))}
              </ul>
              <button onClick={handleUpgrade} disabled={loading}
                className="w-full py-3.5 rounded-xl text-sm font-black text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
                style={{background:'linear-gradient(135deg,#a855f7,#3b82f6)',boxShadow:'0 4px 24px rgba(168,85,247,0.3)'}}>
                {loading ? <><i className="fa-solid fa-spinner fa-spin"/>Redirecting to checkout...</> : <>Upgrade to Pro — $4.99 AUD/mo <i className="fa-solid fa-arrow-right text-xs"/></>}
              </button>
              <p className="text-center text-[10px] text-gray-600 mt-2">
                Secure payment via Stripe · Cancel anytime · Instant access
              </p>
            </div>
          </div>

          {/* ROI calculator */}
          <div className="rounded-2xl p-6 text-center" style={{background:'rgba(59,130,246,0.05)',border:'1px solid rgba(59,130,246,0.15)'}}>
            <p className="text-sm text-gray-400 mb-2">
              The average FPL manager loses <span className="text-white font-bold">15–20 points</span> per gameweek to poor transfers.
              That's the difference between <span className="text-white font-bold">top 50k and top 1m</span>.
            </p>
            <p className="text-sm text-blue-400 font-bold">
              Oracle costs less than a cup of coffee. One good transfer recommendation pays for 12 months.
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
