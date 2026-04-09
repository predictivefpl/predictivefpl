import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'

export default function ConnectFPL() {
  const navigate = useNavigate()
  const { user } = useUser()

  useEffect(() => {
    const handler = async (e) => {
      if (e.data?.type === 'FPL_TEAM_ID') {
        const teamId = String(e.data.teamId)
        localStorage.setItem('fplTeamId', teamId)
        if (user) {
          try {
            await user.update({ unsafeMetadata: { fplTeamId: teamId } })
          } catch(err) {
            console.log('Clerk metadata update failed:', err)
          }
        }
        navigate('/syncing')
      }
      if (e.data?.type === 'FPL_SKIP') {
        navigate('/dashboard')
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [navigate, user])

  return (
    <iframe
      src="/ConnectFPL.html"
      style={{ width: '100%', height: '100vh', border: 'none' }}
    />
  )
}
