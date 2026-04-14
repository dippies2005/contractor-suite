'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkSetup = async () => {
      const { data, error } = await supabase
        .from('company_profile')
        .select('id')
        .limit(1)

      if (error) {
        console.error('Company profile check failed:', error.message)
        setLoading(false)
        return
      }

      if (!data || data.length === 0) {
        router.push('/setup')
        return
      }

      setLoading(false)
    }

    void checkSetup()
  }, [router])

  if (loading) {
    return <div style={{ padding: 20 }}>Loading...</div>
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Contractor Suite</h1>
      <p>Select your portal</p>

      <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
        <button onClick={() => router.push('/admin/login')}>
          Admin Portal
        </button>

        <button onClick={() => router.push('/accounts/login')}>
          Accounts Portal
        </button>
      </div>
    </div>
  )
}