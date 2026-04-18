import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import LandingPage from './pages/LandingPage'
import ConnectFPL from './pages/ConnectFPL'
import SyncingData from './pages/SyncingData'
import Dashboard from './pages/Dashboard'
import MyTeam from './pages/MyTeam'
import Insights from './pages/Insights'
import AdminConsole from './pages/AdminConsole'
import OptimizerSettings from './pages/OptimizerSettings'
import Rivals from './pages/Rivals'
import OracleOptimizer from './pages/OracleOptimizer'
import Settings from './pages/Settings'

function ProtectedRoute({ children }) {
  const { isSignedIn, isLoaded } = useAuth()
  if (!isLoaded) return <div className="min-h-screen bg-[#0F121D] flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/></div>
  if (!isSignedIn) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/connect" element={<ProtectedRoute><ConnectFPL /></ProtectedRoute>} />
        <Route path="/syncing" element={<ProtectedRoute><SyncingData /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/team" element={<ProtectedRoute><MyTeam /></ProtectedRoute>} />
        <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminConsole /></ProtectedRoute>} />
        <Route path="/optimizer" element={<ProtectedRoute><OptimizerSettings /></ProtectedRoute>} />
        <Route path="/rivals" element={<ProtectedRoute><Rivals /></ProtectedRoute>} />
        <Route path="/oracle" element={<ProtectedRoute><OracleOptimizer /></ProtectedRoute>} /><Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

