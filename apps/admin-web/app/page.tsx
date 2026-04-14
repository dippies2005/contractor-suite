'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function HomePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [checkError, setCheckError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const checkSetup = async () => {
      try {
        const { data, error } = await supabase
          .from('company_profile')
          .select('id')
          .limit(1)

        if (!isMounted) return

        if (error) {
          console.error('Company profile check failed:', error.message)
          setCheckError(error.message)
          setLoading(false)
          return
        }

        if (!data || data.length === 0) {
          window.location.href = '/setup'
          return
        }

        setLoading(false)
      } catch (err) {
        console.error('Startup check failed:', err)
        if (!isMounted) return
        setCheckError('Could not load startup check.')
        setLoading(false)
      }
    }

    void checkSetup()

    return () => {
      isMounted = false
    }
  }, [])

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          color: '#ffffff',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ marginBottom: 8 }}>Contractor Suite</h1>
          <p style={{ margin: 0, opacity: 0.8 }}>Loading portal...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: '#111827',
          border: '1px solid #334155',
          borderRadius: 16,
          padding: 32,
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
          textAlign: 'center',
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 10 }}>Contractor Suite</h1>
        <p style={{ marginTop: 0, marginBottom: 24, color: '#cbd5e1' }}>
          Select your portal to continue.
        </p>

        {checkError ? (
          <div
            style={{
              marginBottom: 20,
              padding: 12,
              borderRadius: 10,
              background: '#7f1d1d',
              color: '#fecaca',
              fontSize: 14,
            }}
          >
            {checkError}
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <button
            onClick={() => router.push('/admin/login')}
            style={primaryButton}
          >
            Admin Portal
          </button>

          <button
            onClick={() => router.push('/accounts/login')}
            style={secondaryButton}
          >
            Accounts Portal
          </button>

          <button
            onClick={() => router.push('/setup')}
            style={ghostButton}
          >
            Setup Company
          </button>
        </div>
      </div>
    </div>
  )
}

const primaryButton: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  border: 'none',
  background: '#2563eb',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 15,
}

const secondaryButton: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  border: 'none',
  background: '#16a34a',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 15,
}

const ghostButton: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  border: '1px solid #475569',
  background: '#1e293b',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 15,
}