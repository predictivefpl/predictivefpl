import { useNavigate } from 'react-router-dom'
import { SignInButton, SignUpButton, useAuth } from '@clerk/clerk-react'
import { useState, useEffect } from 'react'

// Countdown to next deadline
function useDeadline() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => {
      // Next Saturday 11am BST (approximate next FPL deadline)
      const now   = new Date()
      const next  = new Date(now)
      next.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7))
      next.setHours(11, 0, 0, 0)
      const diff  = next - now
      if (diff <= 0) { setTime('Deadline passed'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setTime(`${h}h ${m}m`)
    }
    tick()
    const iv = setInterval(tick, 60000)
    return () => clearInterval(iv)
  }, [])
  return time
}

export default function LandingPage() {
  const { isSignedIn } = useAuth()
  const navigate       = useNavigate()
  const deadline       = useDeadline()
  const [annual, setAnnual] = useState(false)

  return (
    <div className="min-h-screen bg-[#080A10] text-white overflow-x-hidden" style={{fontFamily:'system-ui,-apple-system,sans-serif'}}>

      {/* Ambient */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] pointer-events-none -z-10"
        style={{background:'radial-gradient(ellipse at 50% 0%,rgba(168,85,247,0.08) 0%,transparent 70%)'}}/>

      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 px-6 md:px-12 h-16 flex items-center justify-between"
        style={{background:'rgba(8,10,16,0.85)',backdropFilter:'blur(16px)',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-futbol text-purple-500"/>
          <span className="font-bold text-white">Predictive<span className="text-purple-400">FPL</span></span>
        </div>
        <div className="flex items-center gap-2">
          {isSignedIn ? (
            <button onClick={() => navigate('/dashboard')}
              className="px-5 py-2 rounded-xl text-sm font-bold text-white"
              style={{background:'linear-gradient(135deg,#a855f7,#3b82f6)'}}>
              Dashboard →
            </button>
          ) : (
            <>
              <SignInButton mode="modal">
                <button className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors">Sign in</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="px-5 py-2 rounded-xl text-sm font-bold text-white"
                  style={{background:'linear-gradient(135deg,#a855f7,#3b82f6)'}}>
                  Start Free
                </button>
              </SignUpButton>
            </>
          )}
        </div>
      </nav>

      {/* ── Deadline ticker ─────────────────────────────────────────────── */}
      {deadline && (
        <div className="text-center py-2 text-xs font-bold"
          style={{background:'rgba(239,68,68,0.08)',borderBottom:'1px solid rgba(239,68,68,0.15)',color:'#fca5a5'}}>
          <i className="fa-solid fa-clock mr-1.5"/>
          GW DEADLINE IN {deadline} — IS YOUR SQUAD OPTIMISED?
        </div>
      )}

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-bold mb-8"
          style={{background:'rgba(168,85,247,0.1)',border:'1px solid rgba(168,85,247,0.25)',color:'#c084fc'}}>
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse inline-block"/>
          THE ALGORITHM THE TOP 10K ARE USING
        </div>

        <h1 className="text-5xl md:text-7xl font-black leading-[1.05] mb-5 tracking-tight">
          Your rivals have<br/>
          <span style={{background:'linear-gradient(135deg,#a855f7,#3b82f6)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
            an AI advantage.
          </span>
        </h1>

        <p className="text-lg md:text-xl text-gray-400 max-w-xl mx-auto mb-3 leading-relaxed">
          PredictiveFPL analyses every player, every fixture, every gameweek —
          and tells you exactly what to do.
        </p>
        <p className="text-sm text-gray-600 mb-10">No spreadsheets. No guesswork. Just better decisions.</p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {isSignedIn ? (
            <button onClick={() => navigate('/dashboard')}
              className="px-10 py-4 rounded-2xl font-black text-lg text-white hover:opacity-90 transition-all"
              style={{background:'linear-gradient(135deg,#a855f7,#3b82f6)',boxShadow:'0 8px 40px rgba(168,85,247,0.25)'}}>
              Open Dashboard →
            </button>
          ) : (
            <>
              <SignUpButton mode="modal">
                <button className="px-10 py-4 rounded-2xl font-black text-lg text-white hover:opacity-90 transition-all"
                  style={{background:'linear-gradient(135deg,#a855f7,#3b82f6)',boxShadow:'0 8px 40px rgba(168,85,247,0.25)'}}>
                  Start Free — No Card Required →
                </button>
              </SignUpButton>
              <SignInButton mode="modal">
                <button className="px-8 py-4 rounded-2xl font-bold text-gray-400 hover:text-white transition-all border border-gray-800 hover:border-gray-600 text-sm">
                  I have an account
                </button>
              </SignInButton>
            </>
          )}
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 mb-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { n: '800+',  l: 'Players analysed' },
            { n: '5 GW',  l: 'Prediction horizon' },
            { n: 'Live',  l: 'DGW/BGW detection' },
            { n: '3×',    l: 'ML model ensemble' },
          ].map(({ n, l }) => (
            <div key={l} className="rounded-xl py-4 text-center" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)'}}>
              <p className="text-2xl font-black text-white">{n}</p>
              <p className="text-[11px] text-gray-500 mt-1">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pain / problem ─────────────────────────────────────────────── */}
      <section className="max-w-2xl mx-auto px-6 mb-20 text-center">
        <div className="rounded-2xl p-8" style={{background:'rgba(239,68,68,0.04)',border:'1px solid rgba(239,68,68,0.12)'}}>
          <i className="fa-solid fa-arrow-trend-down text-red-400 text-2xl mb-4 block"/>
          <h2 className="text-xl font-black text-white mb-3">You're losing points every week. Here's why.</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            The average FPL manager leaves <span className="text-white font-bold">15–20 points</span> on the pitch each gameweek
            through poor transfer timing, wrong captain picks, and missed Double Gameweeks.
            Over a season, that's the difference between <span className="text-white font-bold">top 50k and top 1m</span>.
            <span className="text-red-400 font-bold"> The data to fix this exists. Most managers just don't have access to it.</span>
          </p>
        </div>
      </section>

      {/* ── Free vs Pro features ────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 mb-20">
        <h2 className="text-3xl font-black text-center mb-2">Two tiers. One clear choice.</h2>
        <p className="text-gray-500 text-center text-sm mb-10">Start free. Upgrade when you're ready to win.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Free */}
          <div className="rounded-2xl p-7" style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)'}}>
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Free Forever</p>
            <div className="text-3xl font-black mb-5">$0</div>
            <div className="space-y-3">
              {['Live squad & fixture sync','Player form & insights','Rivals & mini-league tracker','Chip timing guidance','GW stats & averages'].map(f => (
                <div key={f} className="flex items-center gap-2.5 text-sm text-gray-400">
                  <i className="fa-solid fa-check text-gray-700 text-xs flex-shrink-0"/>
                  {f}
                </div>
              ))}
              <div className="flex items-center gap-2.5 text-sm text-gray-700 line-through mt-4">
                <i className="fa-solid fa-lock text-gray-800 text-xs flex-shrink-0"/>
                Oracle AI Transfer Optimizer
              </div>
            </div>
            {!isSignedIn ? (
              <SignUpButton mode="modal">
                <button className="w-full mt-6 py-3 rounded-xl text-sm font-bold border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-all">
                  Start Free
                </button>
              </SignUpButton>
            ) : (
              <button onClick={() => navigate('/dashboard')}
                className="w-full mt-6 py-3 rounded-xl text-sm font-bold border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-all">
                Go to Dashboard
              </button>
            )}
          </div>

          {/* Pro */}
          <div className="rounded-2xl p-7 relative" style={{background:'linear-gradient(135deg,rgba(168,85,247,0.09),rgba(59,130,246,0.06))',border:'1px solid rgba(168,85,247,0.3)'}}>
            <div className="absolute -top-3 left-6">
              <span className="px-3 py-1 rounded-full text-[10px] font-black text-white" style={{background:'linear-gradient(90deg,#a855f7,#3b82f6)'}}>
                MOST POPULAR
              </span>
            </div>
            <p className="text-xs font-black text-purple-400 uppercase tracking-widest mb-4">Pro</p>
            <div className="flex items-end gap-2 mb-1">
              <span className="text-3xl font-black">$4.99</span>
              <span className="text-gray-400 text-sm mb-0.5">AUD / month</span>
            </div>
            <p className="text-[11px] text-gray-500 mb-5">Less than a coffee. Cancel anytime.</p>
            <div className="space-y-3">
              {['Everything in Free','Oracle AI Transfer Optimizer','5-GW horizon + DGW/BGW detection','Wildcard & Free Hit optimizer','Captain recommendation engine','ICT + xG/xA algorithm','Priority support'].map((f, i) => (
                <div key={f} className="flex items-center gap-2.5 text-sm" style={{color: i===0?'#6b7280':'#e5e7eb'}}>
                  <i className={`fa-solid fa-check text-xs flex-shrink-0 ${i===0?'text-gray-700':'text-purple-400'}`}/>
                  {f}
                </div>
              ))}
            </div>
            {isSignedIn ? (
              <button onClick={() => navigate('/upgrade')}
                className="w-full mt-6 py-3.5 rounded-xl text-sm font-black text-white transition-all hover:opacity-90"
                style={{background:'linear-gradient(135deg,#a855f7,#3b82f6)',boxShadow:'0 4px 20px rgba(168,85,247,0.3)'}}>
                Upgrade to Pro →
              </button>
            ) : (
              <SignUpButton mode="modal">
                <button className="w-full mt-6 py-3.5 rounded-xl text-sm font-black text-white transition-all hover:opacity-90"
                  style={{background:'linear-gradient(135deg,#a855f7,#3b82f6)',boxShadow:'0 4px 20px rgba(168,85,247,0.3)'}}>
                  Start Free · Upgrade Anytime →
                </button>
              </SignUpButton>
            )}
          </div>
        </div>
      </section>

      {/* ── Social proof ────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 mb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { q: 'The Oracle told me to bring in Semenyo before his DGW hat-trick. Never would have spotted that myself.', name: 'FPL Manager', rank: 'Top 50k' },
            { q: "I went from rank 800k to 120k in 8 weeks after upgrading. The transfer recommendations are scary accurate.", name: 'FPL Manager', rank: 'Top 120k' },
            { q: "The rivals page alone is worth it. Knowing what my league opponents are predicted to score changes how I play.", name: 'FPL Manager', rank: 'Mini-League Winner' },
          ].map((t, i) => (
            <div key={i} className="rounded-2xl p-5" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)'}}>
              <div className="flex gap-0.5 mb-3">
                {[1,2,3,4,5].map(s => <i key={s} className="fa-solid fa-star text-yellow-400 text-xs"/>)}
              </div>
              <p className="text-gray-300 text-sm leading-relaxed mb-4">"{t.q}"</p>
              <div>
                <p className="text-xs font-bold text-white">{t.name}</p>
                <p className="text-xs text-purple-400">{t.rank}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <section className="max-w-xl mx-auto px-6 mb-24 text-center">
        <h2 className="text-3xl font-black mb-3">
          {isSignedIn ? 'Ready to activate Oracle?' : 'Join free. Upgrade when you see it work.'}
        </h2>
        <p className="text-gray-500 text-sm mb-8">
          {isSignedIn
            ? 'Unlock AI transfer picks, DGW detection, and captain recommendations for $4.99 AUD/month.'
            : 'Sign up in 30 seconds. No card. No commitment. Just better FPL decisions.'}
        </p>
        {isSignedIn ? (
          <button onClick={() => navigate('/upgrade')}
            className="px-10 py-4 rounded-2xl font-black text-lg text-white hover:opacity-90 transition-all"
            style={{background:'linear-gradient(135deg,#a855f7,#3b82f6)',boxShadow:'0 8px 40px rgba(168,85,247,0.25)'}}>
            Upgrade to Pro — $4.99 AUD/mo →
          </button>
        ) : (
          <SignUpButton mode="modal">
            <button className="px-10 py-4 rounded-2xl font-black text-lg text-white hover:opacity-90 transition-all"
              style={{background:'linear-gradient(135deg,#a855f7,#3b82f6)',boxShadow:'0 8px 40px rgba(168,85,247,0.25)'}}>
              Start Free →
            </button>
          </SignUpButton>
        )}
        <p className="text-xs text-gray-700 mt-3">Free plan available forever · Pro is $4.99 AUD/mo · Cancel anytime</p>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-gray-700"
        style={{borderColor:'rgba(255,255,255,0.05)'}}>
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-futbol text-purple-500 text-sm"/>
          <span className="font-bold text-gray-500">Predictive<span className="text-purple-500">FPL</span></span>
        </div>
        <p>Not affiliated with the Premier League or Fantasy Premier League.</p>
        <p>© 2025 PredictiveFPL. All rights reserved.</p>
      </footer>
    </div>
  )
}
