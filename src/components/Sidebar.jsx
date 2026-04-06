import { Link, useLocation } from 'react-router-dom'
import { useClerk, useUser } from '@clerk/clerk-react'

const navItems = [
  { path: '/dashboard', icon: 'fa-chart-line', label: 'User Dashboard' },
  { path: '/team', icon: 'fa-users', label: 'My Team & Planner' },
  { path: '/insights', icon: 'fa-brain', label: 'Insights & Models' },
  { path: '/admin', icon: 'fa-shield-halved', label: 'Admin Console' },
]

export default function Sidebar() {
  const location = useLocation()
  const { signOut } = useClerk()
  const { user } = useUser()

  return (
    <aside className="w-64 border-r border-gray-800/50 bg-[#0F121D]/95 backdrop-blur-md hidden md:flex flex-col h-screen sticky top-0 z-40">
      <div className="p-6 flex items-center gap-2 border-b border-gray-800/50">
        <i className="fa-solid fa-futbol text-blue-500 text-2xl"/>
        <span className="text-xl font-bold text-white">Predictive<span className="text-blue-500">FPL</span></span>
      </div>
      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
        {navItems.map(item => {
          const active = location.pathname === item.path
          return (
            <Link key={item.path} to={item.path} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-[#1A1D2E] border border-blue-500/30 text-white font-medium shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'text-gray-400 hover:bg-[#1A1D2E]/50 hover:text-white'}`}>
              <i className={`fa-solid ${item.icon} w-5 ${active ? 'text-blue-500' : ''}`}/>
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-gray-800/50">
        <Link to="/settings" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-[#1A1D2E]/50 hover:text-white transition-all">
          <i className="fa-solid fa-gear w-5"/><span>Account Settings</span>
        </Link>
        <div className="mt-4 flex items-center gap-3 px-4 py-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            {user?.firstName?.[0] || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-[10px] text-gray-500 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
          </div>
          <button onClick={() => signOut()} className="text-gray-500 hover:text-white transition-colors">
            <i className="fa-solid fa-right-from-bracket"/>
          </button>
        </div>
      </div>
    </aside>
  )
}