import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function ProBanner({ compact = false }) {
  const navigate   = useNavigate()
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  if (compact) return (
    <div className="mx-4 mt-3 rounded-xl px-4 py-2.5 flex items-center gap-3 cursor-pointer group"
      style={{background:'linear-gradient(90deg,rgba(168,85,247,0.12),rgba(59,130,246,0.08))',border:'1px solid rgba(168,85,247,0.25)'}}
      onClick={() => navigate('/upgrade')}>
      <i className="fa-solid fa-brain text-purple-400 text-sm flex-shrink-0"/>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-bold text-white">Unlock Oracle AI Optimizer</span>
        <span className="text-[10px] text-gray-400 ml-1.5">$4.99 AUD/mo</span>
      </div>
      <span className="text-[10px] font-black text-purple-400 group-hover:text-purple-300 flex-shrink-0">Upgrade →</span>
    </div>
  )

  return (
    <div className="rounded-2xl p-4 mb-4 relative" style={{background:'linear-gradient(135deg,rgba(168,85,247,0.1),rgba(59,130,246,0.07))',border:'1px solid rgba(168,85,247,0.25)'}}>
      <button onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-gray-600 hover:text-gray-400 transition-colors">
        <i className="fa-solid fa-times text-xs"/>
      </button>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{background:'rgba(168,85,247,0.2)'}}>
          <i className="fa-solid fa-brain text-purple-400 text-sm"/>
        </div>
        <div className="flex-1 min-w-0 pr-4">
          <p className="text-sm font-bold text-white mb-0.5">
            Your rivals are using Oracle. Are you?
          </p>
          <p className="text-xs text-gray-400 leading-relaxed">
            AI transfer picks, 5-GW horizon, DGW detection. One good transfer covers 12 months.
          </p>
        </div>
      </div>
      <button onClick={() => navigate('/upgrade')}
        className="w-full mt-3 py-2.5 rounded-xl text-xs font-black text-white transition-all hover:opacity-90"
        style={{background:'linear-gradient(90deg,#a855f7,#3b82f6)'}}>
        Unlock Oracle — $4.99 AUD/mo →
      </button>
    </div>
  )
}
