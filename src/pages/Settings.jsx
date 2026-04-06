import { useState, useEffect } from 'react'
import { useUser, useClerk } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

const getLS = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback } catch { return fallback }
}

export default function Settings() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const navigate = useNavigate()

  const [profile, setProfile] = useState({
    name: `${user?.firstName||''} ${user?.lastName||''}`.trim() || 'Manager',
    email: user?.primaryEmailAddress?.emailAddress || '',
  })
  const [teamId, setTeamId] = useState(localStorage.getItem('fplTeamId') || '')
  const [saved, setSaved] = useState(false)
  const [prefs, setPrefs] = useState({
    emailNotifs: getLS('pref_emailNotifs', true),
    aiUpdates: getLS('pref_aiUpdates', false),
    marketing: getLS('pref_marketing', false),
    darkMode: getLS('pref_darkMode', true),
    demoMode: getLS('pref_demoMode', true),
    debugMode: getLS('pref_debugMode', false),
  })

  // Persist prefs to localStorage whenever they change
  useEffect(() => {
    Object.entries(prefs).forEach(([k,v]) => localStorage.setItem(`pref_${k}`, JSON.stringify(v)))
  }, [prefs])

  const togglePref = (key) => setPrefs(p => ({...p, [key]: !p[key]}))

  const save = async () => {
    localStorage.setItem('fplTeamId', teamId)
    if (user) await user.update({ unsafeMetadata: { fplTeamId: teamId } }).catch(()=>{})
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const disconnectFPL = () => {
    localStorage.removeItem('fplTeamId')
    navigate('/connect')
  }

  const NOTIF_ITEMS = [
    { key:'emailNotifs', label:'Email Notifications', sub:'Get alerts about team updates and deadline reminders' },
    { key:'aiUpdates', label:'AI Model Updates', sub:'Get notified when new AI features are available' },
    { key:'marketing', label:'Marketing & Promotions', sub:'Receive updates about new features and offers' },
  ]

  const APP_PREFS = [
    { key:'darkMode', label:'Dark Mode', sub:'Always use dark theme (recommended)', color:'bg-blue-500' },
    { key:'demoMode', label:'Demo Mode', sub:'Use mock data instead of live FPL API — great for demos', color:'bg-purple-500' },
    { key:'debugMode', label:'Debug / Developer Mode', sub:'Enable verbose console logging for development', color:'bg-yellow-500' },
  ]

  return (
    <div className="min-h-screen bg-[#0F121D] bg-grid flex text-white">
      <Sidebar/>
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <main className="flex-1 overflow-y-auto custom-scroll p-6 md:p-8 lg:p-10 max-w-5xl mx-auto w-full">

          <div className="mb-10">
            <h1 className="text-4xl font-bold mb-2">Account Settings</h1>
            <p className="text-gray-400 text-lg">Manage your profile, subscription, and preferences</p>
          </div>

          {/* Profile */}
          <div className="glass-card rounded-2xl p-6 md:p-8 mb-6 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-[#1A1D2E] border border-blue-500/30 flex items-center justify-center">
                <i className="fa-solid fa-user text-blue-400 text-xl"/>
              </div>
              <h2 className="text-xl font-bold">Profile</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Full Name</label>
                <input type="text" value={profile.name}
                  onChange={e => setProfile(p => ({...p, name: e.target.value}))}
                  className="w-full bg-[#1A1D2E] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none transition-colors"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Email Address</label>
                <input type="email" value={profile.email}
                  onChange={e => setProfile(p => ({...p, email: e.target.value}))}
                  className="w-full bg-[#1A1D2E] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none transition-colors"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">FPL Team ID</label>
                <div className="flex gap-2">
                  <input type="text" value={teamId} onChange={e=>setTeamId(e.target.value)}
                    placeholder="e.g. 3321638"
                    className="flex-1 bg-[#1A1D2E] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none transition-colors"/>
                  <button onClick={disconnectFPL}
                    className="px-4 py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium whitespace-nowrap">
                    <i className="fa-solid fa-unlink mr-1"/> Disconnect
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  fantasy.premierleague.com/entry/<strong className="text-gray-400">ID</strong>/event
                  {teamId && <span className="ml-2 text-blue-400">Current: {teamId}</span>}
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              {saved && <span className="text-sm text-green-400 flex items-center gap-2"><i className="fa-solid fa-check"/> Saved!</span>}
              <button onClick={save} className="neon-button rounded-xl py-3 px-6 font-bold text-sm flex items-center gap-2">
                <i className="fa-solid fa-check"/> Save Changes
              </button>
            </div>
          </div>

          {/* FPL Connection Status */}
          <div className="glass-card rounded-2xl p-6 md:p-8 mb-6 border border-blue-500/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-[#1A1D2E] border border-blue-500/30 flex items-center justify-center">
                <i className="fa-solid fa-link text-blue-400 text-xl"/>
              </div>
              <h2 className="text-xl font-bold">FPL Account Connection</h2>
            </div>
            <div className={`rounded-xl p-5 border ${teamId ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${teamId ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}/>
                  <div>
                    <p className={`font-bold ${teamId ? 'text-green-400' : 'text-red-400'}`}>
                      {teamId ? 'Connected' : 'Not Connected'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {teamId ? `Team ID: ${teamId}` : 'No FPL account linked'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {teamId && (
                    <button onClick={() => navigate('/dashboard')}
                      className="px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium hover:bg-green-500/20 transition-colors">
                      <i className="fa-solid fa-chart-line mr-1"/> View Dashboard
                    </button>
                  )}
                  <button onClick={disconnectFPL}
                    className="px-4 py-2 rounded-xl bg-[#1A1D2E] border border-gray-700 text-gray-400 text-sm font-medium hover:text-white transition-colors">
                    <i className="fa-solid fa-rotate mr-1"/> {teamId ? 'Update' : 'Connect'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Subscription */}
          <div className="glass-card rounded-2xl p-6 md:p-8 mb-6 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-[#1A1D2E] border border-blue-500/30 flex items-center justify-center">
                <i className="fa-solid fa-crown text-yellow-400 text-xl"/>
              </div>
              <h2 className="text-xl font-bold">Subscription & Billing</h2>
            </div>
            <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/30 rounded-xl p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-bold border border-green-500/30 mb-3 inline-block">ACTIVE</span>
                  <h3 className="text-2xl font-bold text-white mb-1">Early Bird Free Pass</h3>
                  <p className="text-sm text-gray-400">Full access to all AI features until pre-season 2025/26</p>
                </div>
                <i className="fa-solid fa-gift text-3xl text-blue-400"/>
              </div>
              <div className="pt-4 border-t border-green-500/20">
                <p className="text-xs text-gray-400 mb-1">Next Season Plan</p>
                <p className="text-lg font-bold text-white">$4.99 <span className="text-sm text-gray-400 font-normal">AUD/month</span></p>
              </div>
            </div>
            <div className="flex justify-end">
              <button className="neon-button rounded-xl py-3 px-6 font-bold text-sm flex items-center gap-2">
                <i className="fa-solid fa-external-link-alt"/> Manage via Stripe Portal
              </button>
            </div>
          </div>

          {/* App Preferences */}
          <div className="glass-card rounded-2xl p-6 md:p-8 mb-6 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-[#1A1D2E] border border-blue-500/30 flex items-center justify-center">
                <i className="fa-solid fa-sliders text-blue-400 text-xl"/>
              </div>
              <h2 className="text-xl font-bold">App Preferences</h2>
            </div>
            <div className="space-y-4">
              {APP_PREFS.map(item => (
                <div key={item.key} className="flex items-center justify-between p-4 bg-[#1A1D2E]/50 rounded-xl border border-gray-700/50">
                  <div>
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.sub}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {prefs[item.key] && (
                      <span className="text-xs text-green-400 font-medium">ON</span>
                    )}
                    <button onClick={() => togglePref(item.key)}
                      className={`w-11 h-6 rounded-full relative transition-colors ${prefs[item.key] ? item.color : 'bg-gray-700'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${prefs[item.key] ? 'right-0.5' : 'left-0.5'}`}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {prefs.demoMode && (
              <div className="mt-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                <p className="text-xs text-purple-400">
                  <i className="fa-solid fa-circle-info mr-2"/>
                  <strong>Demo Mode is ON</strong> — The app is using mock data. Toggle off to connect to the live FPL API.
                </p>
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="glass-card rounded-2xl p-6 md:p-8 mb-6 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-[#1A1D2E] border border-blue-500/30 flex items-center justify-center">
                <i className="fa-solid fa-bell text-blue-400 text-xl"/>
              </div>
              <h2 className="text-xl font-bold">Notifications</h2>
            </div>
            <div className="space-y-4">
              {NOTIF_ITEMS.map(item => (
                <div key={item.key} className="flex items-center justify-between p-4 bg-[#1A1D2E]/50 rounded-xl border border-gray-700/50">
                  <div>
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.sub}</p>
                  </div>
                  <button onClick={() => togglePref(item.key)}
                    className={`w-11 h-6 rounded-full relative transition-colors ${prefs[item.key] ? 'bg-blue-500' : 'bg-gray-700'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${prefs[item.key] ? 'right-0.5' : 'left-0.5'}`}/>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="glass-card rounded-2xl p-6 md:p-8 border border-red-500/20">
            <h2 className="text-xl font-bold mb-4 text-red-400">Danger Zone</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#1A1D2E]/50 rounded-xl border border-gray-700/50">
                <div>
                  <p className="text-sm font-medium text-white">Disconnect FPL Account</p>
                  <p className="text-xs text-gray-500">Clears your Team ID and returns to the connection screen.</p>
                </div>
                <button onClick={disconnectFPL}
                  className="px-5 py-2.5 rounded-xl border border-red-500/30 text-red-400 font-medium hover:bg-red-500/10 transition-all text-sm flex items-center gap-2">
                  <i className="fa-solid fa-unlink"/> Disconnect
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-[#1A1D2E]/50 rounded-xl border border-gray-700/50">
                <div>
                  <p className="text-sm font-medium text-white">Sign Out</p>
                  <p className="text-xs text-gray-500">You'll need to sign in again to access your account.</p>
                </div>
                <button onClick={() => signOut(() => navigate('/'))}
                  className="px-5 py-2.5 rounded-xl border border-red-500/30 text-red-400 font-medium hover:bg-red-500/10 transition-all text-sm flex items-center gap-2">
                  <i className="fa-solid fa-right-from-bracket"/> Sign Out
                </button>
              </div>
            </div>
          </div>

        </main>
      </div>
    </div>
  )
}
