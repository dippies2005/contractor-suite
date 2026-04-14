'use client'

import { useState } from 'react'

export default function SetupPage() {
  const [companyName, setCompanyName] = useState('')
  const [tradingName, setTradingName] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')

  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')

  const [loading, setLoading] = useState(false)

  const handleSetup = async () => {
    if (
      !companyName.trim() ||
      !companyEmail.trim() ||
      !companyPhone.trim() ||
      !adminName.trim() ||
      !adminEmail.trim() ||
      !adminPassword.trim()
    ) {
      alert('Please fill in all required fields.')
      return
    }

    try {
      setLoading(true)

      const response = await fetch('/api/bootstrap-company', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: companyName.trim(),
          tradingName: tradingName.trim(),
          companyEmail: companyEmail.trim(),
          companyPhone: companyPhone.trim(),
          companyAddress: companyAddress.trim(),
          adminName: adminName.trim(),
          adminEmail: adminEmail.trim(),
          adminPassword,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.error || 'Failed to set up company')
      }

      alert('Company setup complete. You can now log in as admin.')
      window.location.href = '/admin/login'
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 40,
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: '0 auto',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 24,
        }}
      >
        <h1 style={{ marginTop: 0 }}>Set Up Your Company</h1>
        <p>Create your company profile and first admin account.</p>

        <h2 style={{ marginTop: 28 }}>Company Details</h2>

        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          }}
        >
          <input
            placeholder="Company Name *"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Trading Name"
            value={tradingName}
            onChange={(e) => setTradingName(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Company Email *"
            value={companyEmail}
            onChange={(e) => setCompanyEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Company Phone *"
            value={companyPhone}
            onChange={(e) => setCompanyPhone(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Company Address"
            value={companyAddress}
            onChange={(e) => setCompanyAddress(e.target.value)}
            style={{ ...inputStyle, gridColumn: '1 / -1' }}
          />
        </div>

        <h2 style={{ marginTop: 28 }}>First Admin Login</h2>

        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          }}
        >
          <input
            placeholder="Admin Full Name *"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Admin Email *"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Admin Password *"
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
          <button
            onClick={handleSetup}
            disabled={loading}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#16a34a',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {loading ? 'Creating...' : 'Create Company'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  outline: 'none',
  minWidth: 220,
}