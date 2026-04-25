import { useNavigate } from 'react-router-dom'

export default function ProPaywall() {
  const navigate = useNavigate()
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Lock icon with glow */}
        <div className="relative inline-block mb-6">
          <div className="absolute inset-0 rounded-full blur-2xl opacity-40" style={{background:'radial-gradient(circle,#a855f7,transparent)'}}/>
          <div className="relative w-20 h-20 rounded-2xl flex items-center justify-center mx-auto"
            style={{background:'linear-gradient(135deg,rgba(168,85,247,0.2),rgba(59,130,246,0.15))',border:'1px solid rgba(168,85,247,0.4)'}}>
            <i className="fa-solid fa-brain text-purple-400 text-3xl"/>
          </div>
        </div>

        <h2 className="text-2xl font-black text-white mb-2">Oracle is a Pro Feature</h2>
        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
          The Oracle AI analyses 800+ players, detects Double Gameweeks, and tells you the exact transfer to make.
          Upgraded managers average <span className="text-white font-semibold">+12 rank positions</span> per gameweek.
        </p>

        {/* Mini feature list */}
        <div className="rounded-xl p-4 mb-6 text-left space-y-2" style={{background:'rgba(168,85,247,0.06)',border:'1px solid rgba(168,85,247,0.15)'}}>
          {[
            'AI transfer recommendations for your exact squad',
            '5-GW horizon with DGW/BGW detection',
            'Wildcard & Free Hit full squad rebuild',
            'Captain pick optimiser',
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <i className="fa-solid fa-check text-purple-400 text-xs flex-shrink-0"/>
              <span className="text-sm text-gray-300">{f}</span>
            </div>
          ))}
        </div>

        <button onClick={() => navigate('/upgrade')}
          className="w-full py-4 rounded-xl font-black text-white text-base mb-3 transition-all hover:opacity-90 active:scale-95"
          style={{background:'linear-gradient(135deg,#a855f7,#3b82f6)',boxShadow:'0 4px 32px rgba(168,85,247,0.35)'}}>
          Unlock Oracle — $4.99 AUD/mo →
        </button>
        <p className="text-xs text-gray-600">Cancel anytime · Instant access · Secure via Stripe</p>
      </div>
    </div>
  )
}
