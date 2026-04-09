import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export default function ConnectFPL() {
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'FPL_TEAM_ID') {
        localStorage.setItem('fplTeamId', String(e.data.teamId))
        navigate('/syncing')
      }
      if (e.data?.type === 'FPL_SKIP') {
        navigate('/dashboard')
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [navigate])

  return (
    <iframe
      src="/ConnectFPL.html"
      style={{ width: '100%', height: '100vh', border: 'none' }}
    />
  )
}
