import { Link, useLocation } from 'react-router-dom'
import { useClerk, useUser } from '@clerk/clerk-react'

const ADMIN_EMAIL = 'predictivefpl@outlook.com'
const NAV = [
  { path: '/dashboard', icon: 'fa-chart-line', label: 'User Dashboard' },
  { path: '/team', icon: 'fa-users', label: 'My Current Squad' },
  { path: '/insights', icon: 'fa-brain', label: 'Insights & Models' },
  { path: '/rivals',   icon: 'fa-trophy', label: 'Rivals' },
]

export default function Sidebar() {
  const location = useLocation()
  const { signOut } = useClerk()
  const { user } = useUser()
  const isAdmin = user?.primaryEmailAddress?.emailAddress === ADMIN_EMAIL
  const isOptimizer = location.pathname === '/optimizer'
  return (
    <aside className="w-64 border-r border-gray-800/50 bg-[#0F121D]/95 backdrop-blur-md hidden md:flex flex-col h-screen sticky top-0 z-40">
      <div className="p-6 flex items-center gap-2 border-b border-gray-800/50">
        <i className="fa-solid fa-futbol text-blue-500 text-2xl"/>
        <span className="text-xl font-bold text-white">Predictive<span className="text-blue-500">FPL</span></span>
      </div>
      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
        {NAV.map(item => {
          const active = location.pathname === item.path
          return (
            <Link key={item.path} to={item.path} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-[#1A1D2E] border border-blue-500/30 text-white font-medium' : 'text-gray-400 hover:bg-[#1A1D2E]/50 hover:text-white'}`}>
              <i className={`fa-solid ${item.icon} w-5 ${active ? 'text-blue-500' : ''}`}/>
              {item.label}
            </Link>
          )
        })}
        {isAdmin && (
          <Link to="/admin" className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-gray-400 hover:bg-[#1A1D2E]/50 hover:text-white">
            <i className="fa-solid fa-shield-halved w-5"/>
            Admin Console
          </Link>
        )}
        <div className="pt-3">
          <Link to="/optimizer" className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold transition-all border ${isOptimizer ? 'bg-green-600 border-green-500 text-white' : 'bg-green-500/10 border-green-500/40 text-green-400 hover:bg-green-500/20 hover:text-green-300'}`}>
            <i className="fa-solid fa-robot w-5"/>
            <div className="flex flex-col leading-tight">
              <span>Run Optimizer</span>
              <span className="text-[10px] font-normal opacity-70">AI Transfer Planner</span>
            </div>
            <i className="fa-solid fa-arrow-right ml-auto text-xs"/>
          </Link>
        </div>
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
