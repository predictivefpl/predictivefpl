import { useNavigate } from 'react-router-dom'
import { SignInButton, SignUpButton, useAuth } from '@clerk/clerk-react'

export default function LandingPage() {
  const { isSignedIn } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#0F121D] bg-grid text-white font-sans">
      {/* Ambient glows */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none -z-10"/>
      <div className="fixed bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[150px] pointer-events-none -z-10"/>

      {/* Header */}
      <header className="w-full px-8 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-futbol text-blue-500 text-2xl"/>
          <span className="text-xl font-bold">Predictive<span className="text-blue-500">FPL</span></span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#pricing" className="text-sm text-gray-300 hover:text-white transition-colors">Pricing</a>
          {isSignedIn ? (
            <button onClick={() => navigate('/dashboard')} className="neon-button rounded-xl px-6 py-2 text-sm font-bold">Dashboard</button>
          ) : (
            <SignInButton mode="modal">
              <button className="text-sm text-gray-300 hover:text-white transition-colors">Sign In</button>
            </SignInButton>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Hero */}
        <section className="text-center mb-32 max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-8 border border-blue-500/20">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"/>
            <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">Join 10,000+ Managers</span>
          </div>
          <h1 className="text-6xl md:text-8xl font-extrabold leading-tight mb-6 tracking-tight">
            Gain the AI<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-500 to-cyan-400">Unfair Advantage</span><br/>
            in FPL.
          </h1>
          <p className="text-xl text-gray-300 mb-4 max-w-3xl mx-auto leading-relaxed">
            Master your mini-leagues with predictive models, real-time data sync, and elite chip strategy.
          </p>
          <p className="text-2xl font-bold text-blue-400 mb-10">Free until Preseason 2025/26.</p>
          {isSignedIn ? (
            <button onClick={() => navigate('/dashboard')} className="neon-button rounded-2xl px-12 py-5 font-bold text-lg flex items-center gap-3 mx-auto">
              Go to Dashboard <i className="fa-solid fa-arrow-right"/>
            </button>
          ) : (
            <SignUpButton mode="modal">
              <button className="neon-button rounded-2xl px-12 py-5 font-bold text-lg flex items-center gap-3 mx-auto">
                Start for Free <i className="fa-solid fa-arrow-right"/>
              </button>
            </SignUpButton>
          )}
          <p className="text-sm text-gray-500 mt-6">No credit card required • Access all features during beta</p>
        </section>

        {/* Features */}
        <section className="mb-32">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Core Intelligence</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Everything you need to analyse fixtures, automate transfers, and accelerate your rank climb.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: 'fa-brain', title: 'Expected Points (xPts)', desc: 'ML models trained on 5 years of Opta data to predict player performance with high accuracy.' },
              { icon: 'fa-route', title: 'Transfer Planner', desc: 'Look ahead up to 8 gameweeks. The AI calculates the optimal sequence of transfers to maximise total squad value.' },
              { icon: 'fa-chart-line', title: 'Chip Strategy AI', desc: 'Optimal timing for Wildcard, Free Hit, Bench Boost and Triple Captain based on fixture analysis.' },
            ].map((f, i) => (
              <div key={i} className="glass-card rounded-[24px] p-8 hover:border-blue-500/30 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-[#1A1D2E] border border-gray-700 flex items-center justify-center mb-6 group-hover:border-blue-500/50 transition-colors">
                  <i className={`fa-solid ${f.icon} text-blue-400`}/>
                </div>
                <h3 className="text-xl font-semibold mb-3">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Stats */}
        <section className="mb-32">
          <div className="glass-card rounded-[32px] p-12 neon-border relative overflow-hidden">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-5xl font-bold mb-6">Why Join Now?</h2>
              <p className="text-lg text-gray-300 mb-12 leading-relaxed">
                Build your predictive model history <span className="text-blue-400 font-semibold">before the new season starts</span>. The more data our AI learns from your team, the more accurate your predictions become.
              </p>
              <div className="grid grid-cols-3 gap-6">
                {[['5+','Seasons of Training Data'],['92%','Prediction Accuracy'],['24/7','Real-time Updates']].map(([v,l]) => (
                  <div key={l} className="text-center">
                    <div className="text-4xl font-bold text-blue-400 mb-2">{v}</div>
                    <p className="text-sm text-gray-400">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mb-32">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-gray-400">One plan. All features. Unlimited potential.</p>
          </div>
          <div className="max-w-md mx-auto">
            <div className="glass-card rounded-[32px] p-10 neon-border relative overflow-hidden">
              <div className="absolute top-6 right-6 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Free until Preseason</span>
              </div>
              <h3 className="text-2xl font-bold mb-2">Pro Plan</h3>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-5xl font-extrabold">$4.99</span>
                <span className="text-gray-400">AUD/month</span>
              </div>
              <p className="text-sm text-gray-400 mb-8">Billed monthly. Cancel anytime.</p>
              <ul className="space-y-4 mb-8">
                {['AI Chip Strategy – Optimal timing for all chips','Real-time Injury Sync – Live updates','Advanced Transfer Modeling – 8-week lookahead','Captaincy Optimization – AI captain suggestions','Team Performance Analytics'].map(f => (
                  <li key={f} className="flex items-start gap-3">
                    <i className="fa-solid fa-check text-blue-400 mt-1"/>
                    <span className="text-gray-300 text-sm">{f}</span>
                  </li>
                ))}
              </ul>
              {isSignedIn ? (
                <button onClick={() => navigate('/dashboard')} className="neon-button w-full rounded-xl py-4 font-bold text-lg flex justify-center items-center gap-2">
                  Go to Dashboard <i className="fa-solid fa-arrow-right"/>
                </button>
              ) : (
                <SignUpButton mode="modal">
                  <button className="neon-button w-full rounded-xl py-4 font-bold text-lg flex justify-center items-center gap-2">
                    Get Started <i className="fa-solid fa-arrow-right"/>
                  </button>
                </SignUpButton>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-800 bg-[#0F121D]/80 py-8">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-futbol text-gray-500"/>
            <span className="text-sm font-semibold text-gray-400">PredictiveFPL</span>
          </div>
          <div className="flex gap-6 text-sm text-gray-500">
            <a href="#" className="hover:text-blue-400 transition-colors">Privacy</a>
            <a href="#" className="hover:text-blue-400 transition-colors">Terms</a>
            <a href="#" className="hover:text-blue-400 transition-colors">Contact</a>
          </div>
          <div className="text-xs text-gray-600">&copy; 2026 PredictiveFPL. Not affiliated with the Premier League.</div>
        </div>
      </footer>
    </div>
  )
}