'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { supabase } from '../../lib/supabase'
import type { Session } from '@supabase/supabase-js'

type Job = {
  id: string
  title: string
  description: string
  status: string
  assigned_to_user_id: string | null
  client_id: string | null
  signature_url: string | null
  site_lat?: number | null
  site_lng?: number | null
  checked_in_at?: string | null
  completed_at?: string | null
  sent_to_accounting?: boolean | null
  accounting_sent_at?: string | null
  invoice_status?: string | null
  rejection_reason?: string | null
  technician_notes?: string | null
}

type Profile = {
  id: string
  email: string
  name: string
  role?: string | null
}

type Client = {
  id: string
  name: string
  company_name?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
}

type JobPhoto = {
  id: string
  job_id: string
  image_url: string
}

type UserPresence = {
  user_id: string
  is_online?: boolean | null
  availability_status?: string | null
  last_seen?: string | null
}

type JobMessage = {
  id: string
  job_id: string
  sender_user_id: string
  message: string
  created_at: string
}

type CompanyProfile = {
  id: string
  company_name: string
  trading_name?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  logo_url?: string | null
  job_card_prefix?: string | null
  footer_text?: string | null
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

const buttonStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  cursor: 'pointer',
}

const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: '#2563eb',
  color: '#fff',
  border: 'none',
}

const greenButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: '#16a34a',
  color: '#fff',
  border: 'none',
}

const dangerButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: '#dc2626',
  color: '#fff',
  border: 'none',
}

const sectionCardStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 20,
  marginBottom: 24,
}

export default function AdminDashboardPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null)

  const [jobs, setJobs] = useState<Job[]>([])
  const [photos, setPhotos] = useState<JobPhoto[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [presence, setPresence] = useState<UserPresence[]>([])
  const [messages, setMessages] = useState<JobMessage[]>([])

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')

  const [clientName, setClientName] = useState('')
  const [clientCompanyName, setClientCompanyName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientAddress, setClientAddress] = useState('')

  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserName, setNewUserName] = useState('')
  const [newUserRole, setNewUserRole] = useState<'technician' | 'admin' | 'accounts'>('technician')
  const [creatingUser, setCreatingUser] = useState(false)

  const [editingJobId, setEditingJobId] = useState<string | null>(null)
  const [newAssignedUserId, setNewAssignedUserId] = useState('')
  const [openChatJobId, setOpenChatJobId] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [savingPdfJobId, setSavingPdfJobId] = useState<string | null>(null)

  const currentUser = profiles.find((p) => p.id === session?.user?.id)
  const technicians = profiles.filter((p) => p.role === 'technician')

  const activeJobs = useMemo(
    () => jobs.filter((job) => job.status !== 'completed'),
    [jobs]
  )

  const loadAllData = async () => {
    const [
      jobsRes,
      photosRes,
      profilesRes,
      clientsRes,
      presenceRes,
      messagesRes,
      companyRes,
    ] = await Promise.all([
      supabase.from('jobs').select('*').order('created_at', { ascending: false }),
      supabase.from('job_photos').select('*'),
      supabase.from('profiles').select('*'),
      supabase.from('clients').select('*').order('created_at', { ascending: false }),
      supabase.from('user_presence').select('*'),
      supabase.from('job_messages').select('*').order('created_at', { ascending: true }),
      supabase.from('company_profile').select('*').maybeSingle(),
    ])

    if (jobsRes.error) throw new Error(`Jobs: ${jobsRes.error.message}`)
    if (photosRes.error) throw new Error(`Photos: ${photosRes.error.message}`)
    if (profilesRes.error) throw new Error(`Profiles: ${profilesRes.error.message}`)
    if (clientsRes.error) throw new Error(`Clients: ${clientsRes.error.message}`)
    if (presenceRes.error) throw new Error(`Presence: ${presenceRes.error.message}`)
    if (messagesRes.error) throw new Error(`Messages: ${messagesRes.error.message}`)
    if (companyRes.error) throw new Error(`Company: ${companyRes.error.message}`)

    setJobs(jobsRes.data || [])
    setPhotos(photosRes.data || [])
    setProfiles(profilesRes.data || [])
    setClients(clientsRes.data || [])
    setPresence(presenceRes.data || [])
    setMessages(messagesRes.data || [])
    setCompanyProfile(companyRes.data || null)
  }

  useEffect(() => {
    const init = async () => {
      try {
        setPageError(null)

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw new Error(sessionError.message)

        setSession(sessionData.session)

        if (!sessionData.session) {
          window.location.href = '/admin/login'
          return
        }

        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError) throw new Error(authError.message)

        const userId = authData.user?.id
        if (!userId) {
          window.location.href = '/admin/login'
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single()

        if (profileError) throw new Error(profileError.message)

        if (!profile || profile.role !== 'admin') {
          await supabase.auth.signOut()
          window.location.href = '/admin/login'
          return
        }

        await loadAllData()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load admin dashboard.'
        console.error('Admin init error:', err)
        setPageError(message)
      } finally {
        setLoading(false)
      }
    }

    void init()

    const { data } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)

      if (!nextSession) {
        window.location.href = '/admin/login'
        return
      }

      try {
        await loadAllData()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to refresh admin dashboard.'
        console.error('Admin auth refresh error:', err)
        setPageError(message)
      }
    })

    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return

    let timeout: ReturnType<typeof setTimeout> | null = null
    const triggerRefresh = () => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(async () => {
        try {
          await loadAllData()
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Realtime refresh failed.'
          console.error('Admin realtime error:', err)
          setPageError(message)
        }
      }, 250)
    }

    const channel = supabase
      .channel('admin-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, triggerRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, triggerRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, triggerRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_photos' }, triggerRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_messages' }, triggerRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' }, triggerRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_profile' }, triggerRefresh)
      .subscribe()

    return () => {
      if (timeout) clearTimeout(timeout)
      void supabase.removeChannel(channel)
    }
  }, [session])

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/admin/login'
  }

  const createManagedUser = async () => {
    if (!session?.access_token) {
      alert('Missing session token')
      return
    }

    if (!newUserEmail.trim() || !newUserPassword.trim() || !newUserName.trim()) {
      alert('Please fill in name, email, and password')
      return
    }

    try {
      setCreatingUser(true)

      const response = await fetch('/api/admin-create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: newUserEmail.trim(),
          password: newUserPassword,
          name: newUserName.trim(),
          role: newUserRole,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.error || 'Failed to create user')
      }

      setNewUserEmail('')
      setNewUserPassword('')
      setNewUserName('')
      setNewUserRole('technician')
      await loadAllData()
      alert('User created successfully.')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setCreatingUser(false)
    }
  }

  const createClient = async () => {
    if (!clientName.trim()) {
      alert('Please enter a client name')
      return
    }

    const { error } = await supabase.from('clients').insert({
      name: clientName.trim(),
      company_name: clientCompanyName.trim() || null,
      email: clientEmail.trim() || null,
      phone: clientPhone.trim() || null,
      address: clientAddress.trim() || null,
    })

    if (error) {
      alert(error.message)
      return
    }

    setClientName('')
    setClientCompanyName('')
    setClientEmail('')
    setClientPhone('')
    setClientAddress('')
    await loadAllData()
  }

  const createJob = async () => {
    if (!title.trim()) {
      alert('Please enter a title')
      return
    }

    const { error } = await supabase.from('jobs').insert({
      title: title.trim(),
      description: description.trim(),
      assigned_to_user_id: selectedUserId || null,
      client_id: selectedClientId || null,
      status: 'new',
      invoice_status: 'not_ready',
    })

    if (error) {
      alert(error.message)
      return
    }

    setTitle('')
    setDescription('')
    setSelectedUserId('')
    setSelectedClientId('')
    await loadAllData()
  }

  const updateAssignment = async (jobId: string) => {
    const { error } = await supabase
      .from('jobs')
      .update({ assigned_to_user_id: newAssignedUserId || null })
      .eq('id', jobId)

    if (error) {
      alert(error.message)
      return
    }

    setEditingJobId(null)
    setNewAssignedUserId('')
    await loadAllData()
  }

  const deleteJob = async (jobId: string) => {
    if (!confirm('Delete this job?')) return

    const { error } = await supabase.from('jobs').delete().eq('id', jobId)

    if (error) {
      alert(error.message)
      return
    }

    await loadAllData()
  }

  const sendJobMessage = async (jobId: string) => {
    if (!session?.user?.id || !newMessage.trim()) return

    const { error } = await supabase.from('job_messages').insert({
      job_id: jobId,
      sender_user_id: session.user.id,
      message: newMessage.trim(),
    })

    if (error) {
      alert(error.message)
      return
    }

    setNewMessage('')
    await loadAllData()
  }

  const savePdfToServer = async (base64: string, fileName: string) => {
    const response = await fetch('/api/save-jobcard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, base64 }),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => null)
      throw new Error(data?.error || 'Failed to save PDF to server')
    }
  }

  const downloadAndSavePDF = async (job: Job) => {
    try {
      setSavingPdfJobId(job.id)

      const { jsPDF } = await import('jspdf')

      const assignedUser = profiles.find((p) => p.id === job.assigned_to_user_id)
      const client = clients.find((c) => c.id === job.client_id)
      const relatedPhotos = photos.filter((photo) => photo.job_id === job.id)

      const logoHtml = companyProfile?.logo_url
        ? `<img src="${companyProfile.logo_url}" style="max-height:70px; max-width:180px; object-fit:contain;" />`
        : `<div style="font-size:20px; font-weight:700;">${companyProfile?.trading_name || companyProfile?.company_name || 'Company'}</div>`

      const photoHtml = relatedPhotos
        .map(
          (photo) => `
            <div style="display:inline-block; margin:0 8px 8px 0;">
              <img
                src="${photo.image_url}"
                style="
                  width:110px;
                  height:110px;
                  object-fit:cover;
                  border:1px solid #000;
                "
              />
            </div>
          `
        )
        .join('')

      const customerSignatureHtml = job.signature_url
        ? `
          <div style="
            width:200px;
            height:90px;
            display:flex;
            align-items:center;
            justify-content:center;
            background:#fff;
          ">
            <img
              src="${job.signature_url}"
              style="
                max-width:190px;
                max-height:80px;
                object-fit:contain;
                image-rendering:auto;
              "
            />
          </div>
        `
        : '<div style="height:90px;"></div>'

      const html = `
        <div style="font-family:Arial, sans-serif; width:760px; color:#111; background:#fff; padding:18px;">
          <div style="border:2px solid #111;">
            <div style="display:flex; align-items:stretch; min-height:100px;">
              <div style="width:40%; border-right:1px solid #111; padding:10px;">
                ${logoHtml}
                <div style="margin-top:8px; font-size:13px;">
                  <div>${companyProfile?.phone || ''}</div>
                  <div>${companyProfile?.email || ''}</div>
                  <div>${companyProfile?.address || ''}</div>
                </div>
              </div>
              <div style="width:60%; padding:10px;">
                <div style="font-size:16px; font-weight:700; text-align:center;">JOB CARD</div>
                <div style="margin-top:10px; font-size:13px;">
                  <div><strong>Job No:</strong> ${(companyProfile?.job_card_prefix || 'JC')}-${job.id.slice(0, 8).toUpperCase()}</div>
                  <div><strong>Status:</strong> ${job.status}</div>
                  <div><strong>Invoice Status:</strong> ${job.invoice_status || 'not_ready'}</div>
                </div>
              </div>
            </div>
          </div>

          <div style="border:2px solid #111; border-top:none; margin-top:12px;">
            <div style="text-align:center; font-weight:700; border-bottom:1px solid #111; padding:4px;">COMPANY INFORMATION</div>
            <div style="padding:8px; font-size:13px;">
              <div style="display:flex; border-bottom:1px solid #ccc;">
                <div style="width:180px; font-weight:700;">NAME:</div>
                <div style="flex:1;">${client?.name || '-'}</div>
              </div>
              <div style="display:flex; border-bottom:1px solid #ccc;">
                <div style="width:180px; font-weight:700;">COMPANY:</div>
                <div style="flex:1;">${client?.company_name || '-'}</div>
              </div>
              <div style="display:flex; border-bottom:1px solid #ccc;">
                <div style="width:180px; font-weight:700;">PHYSICAL ADDRESS:</div>
                <div style="flex:1; min-height:50px;">${client?.address || '-'}</div>
              </div>
              <div style="display:flex;">
                <div style="width:180px; font-weight:700;">TELEPHONE NO:</div>
                <div style="flex:1;">${client?.phone || '-'}</div>
                <div style="width:120px; font-weight:700; border-left:1px solid #111; padding-left:8px;">Contact:</div>
                <div style="width:180px;">${client?.email || '-'}</div>
              </div>
            </div>
          </div>

          <div style="border:2px solid #111; border-top:none; margin-top:12px;">
            <div style="text-align:center; font-weight:700; border-bottom:1px solid #111; padding:4px;">DESCRIPTION OF WORK DONE</div>
            <div style="padding:10px; min-height:180px; font-size:13px; white-space:pre-wrap;">
              ${job.description || '-'}
            </div>
          </div>

          <div style="border:2px solid #111; border-top:none; margin-top:12px; font-size:13px;">
            <div style="display:flex; font-weight:700; border-bottom:1px solid #111;">
              <div style="width:160px; padding:4px; border-right:1px solid #111;">Technician Code</div>
              <div style="flex:1; padding:4px; border-right:1px solid #111;">Technician Name</div>
              <div style="width:120px; padding:4px; border-right:1px solid #111;">Time IN</div>
              <div style="width:180px; padding:4px;">Technician Signature</div>
            </div>
            <div style="display:flex; min-height:60px;">
              <div style="width:160px; padding:6px; border-right:1px solid #111;">${assignedUser ? assignedUser.id.slice(0, 5).toUpperCase() : '-'}</div>
              <div style="flex:1; padding:6px; border-right:1px solid #111;">${assignedUser?.name || assignedUser?.email || '-'}</div>
              <div style="width:120px; padding:6px; border-right:1px solid #111;">${job.checked_in_at ? new Date(job.checked_in_at).toLocaleTimeString() : '-'}</div>
              <div style="width:180px; padding:6px;">Digitally logged by technician</div>
            </div>
            <div style="border-top:1px solid #111; padding:6px;">
              <strong>Technical Comments:</strong> ${job.technician_notes || '-'}
            </div>
          </div>

          <div style="border:2px solid #111; border-top:none; margin-top:12px; font-size:13px;">
            <div style="text-align:center; font-weight:700; border-bottom:1px solid #111; padding:4px;">
              WORK FULLY COMPLETED AND APPROVED FOR PAYMENT
            </div>
            <div style="display:flex; font-weight:700; border-bottom:1px solid #111;">
              <div style="width:180px; padding:4px; border-right:1px solid #111;">Customer Name</div>
              <div style="width:220px; padding:4px; border-right:1px solid #111;">Customer Signature</div>
              <div style="width:120px; padding:4px; border-right:1px solid #111;">Time OUT</div>
              <div style="flex:1; padding:4px;">Date</div>
            </div>
            <div style="display:flex; min-height:80px;">
              <div style="width:180px; padding:6px; border-right:1px solid #111;">${client?.name || '-'}</div>
              <div style="width:220px; padding:6px; border-right:1px solid #111;">${customerSignatureHtml}</div>
              <div style="width:120px; padding:6px; border-right:1px solid #111;">${job.completed_at ? new Date(job.completed_at).toLocaleTimeString() : '-'}</div>
              <div style="flex:1; padding:6px;">${job.completed_at ? new Date(job.completed_at).toLocaleDateString() : '-'}</div>
            </div>
            <div style="border-top:1px solid #111; padding:6px;">
              <strong>Customer Comments:</strong> -
            </div>
            <div style="border-top:1px solid #111; padding:6px;">
              <strong>Follow Up:</strong> -
            </div>
          </div>

          <div style="margin-top:14px; font-size:12px;">
            <strong>Accounting:</strong> Sent to Accounting: ${job.sent_to_accounting ? 'Yes' : 'No'} | Accounting Sent At: ${job.accounting_sent_at || '-'} | Invoice Status: ${job.invoice_status || 'not_ready'}
          </div>

          <div style="margin-top:12px; font-size:11px; text-align:center;">
            ${companyProfile?.footer_text || ''}
          </div>

          <div style="margin-top:12px;">
            <strong>Attached Job Photos:</strong>
            <div style="margin-top:8px;">${photoHtml || '<p>No photos uploaded.</p>'}</div>
          </div>
        </div>
      `

      const pdf = new jsPDF('p', 'mm', 'a4')

      await pdf.html(html, {
        x: 6,
        y: 6,
        width: 198,
        windowWidth: 820,
        autoPaging: 'text',
        margin: [6, 6, 6, 6],
      })

      const fileName = `${(companyProfile?.job_card_prefix || 'JC')}-${job.id.slice(0, 8)}.pdf`

      pdf.save(fileName)

      const pdfBlob = pdf.output('blob')
      const reader = new FileReader()
      reader.readAsDataURL(pdfBlob)

      reader.onloadend = async () => {
        try {
          const result = reader.result?.toString() || ''
          const base64 = result.split(',')[1]

          if (!base64) {
            throw new Error('Could not convert PDF to base64')
          }

          await savePdfToServer(base64, fileName)
          alert('PDF downloaded and saved to backup location.')
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Backup save failed')
        } finally {
          setSavingPdfJobId(null)
        }
      }
    } catch (err) {
      setSavingPdfJobId(null)
      alert(err instanceof Error ? err.message : 'PDF generation failed')
    }
  }

  const getPresence = (userId: string) => {
    return presence.find((p) => p.user_id === userId)
  }

  const renderPresenceBadge = (userId: string) => {
    const item = getPresence(userId)
    const status = item?.availability_status || 'offline'
    const isOnline = item?.is_online

    const color =
      status === 'available'
        ? '#16a34a'
        : status === 'busy' || status === 'on_job'
        ? '#d97706'
        : status === 'on_break'
        ? '#2563eb'
        : '#6b7280'

    return (
      <span
        style={{
          display: 'inline-block',
          padding: '4px 8px',
          borderRadius: 999,
          background: color,
          color: '#fff',
          fontSize: 12,
          marginLeft: 8,
        }}
      >
        {isOnline ? status : 'offline'}
      </span>
    )
  }

  if (loading) {
    return <div style={{ padding: 24, color: '#111' }}>Loading admin dashboard...</div>
  }

  if (pageError) {
    return (
      <div style={{ padding: 24, color: '#111', fontFamily: 'Arial, sans-serif' }}>
        <h2>Admin dashboard failed to load</h2>
        <p>{pageError}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={() => window.location.reload()} style={primaryButtonStyle}>
            Retry
          </button>
          <button onClick={() => (window.location.href = '/admin/login')} style={buttonStyle}>
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        padding: 24,
        background: 'var(--bg)',
        color: 'var(--text)',
        minHeight: '100vh',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>
            {companyProfile?.trading_name || companyProfile?.company_name || 'Admin Panel'}
          </h1>
          <p style={{ margin: '6px 0 0 0', opacity: 0.8 }}>
            Welcome, {currentUser?.name || currentUser?.email}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => (window.location.href = '/accounts')} style={buttonStyle}>
            Accounts Portal
          </button>
          <button onClick={signOut} style={buttonStyle}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={sectionCardStyle}>
        <h2 style={{ marginTop: 0 }}>Create User</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <input
            placeholder="Full name"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Email"
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Temporary password"
            type="password"
            value={newUserPassword}
            onChange={(e) => setNewUserPassword(e.target.value)}
            style={inputStyle}
          />
          <select
            value={newUserRole}
            onChange={(e) =>
              setNewUserRole(e.target.value as 'technician' | 'admin' | 'accounts')
            }
            style={inputStyle}
          >
            <option value="technician">Technician</option>
            <option value="admin">Admin</option>
            <option value="accounts">Accounts</option>
          </select>
          <button
            onClick={createManagedUser}
            style={greenButtonStyle}
            disabled={creatingUser}
          >
            {creatingUser ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </div>

      <div style={sectionCardStyle}>
        <h2 style={{ marginTop: 0 }}>Create Client</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <input
            placeholder="Client Name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Company Name"
            value={clientCompanyName}
            onChange={(e) => setClientCompanyName(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Phone"
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Address"
            value={clientAddress}
            onChange={(e) => setClientAddress(e.target.value)}
            style={{ ...inputStyle, minWidth: 320 }}
          />
          <button onClick={createClient} style={greenButtonStyle}>
            Save Client
          </button>
        </div>
      </div>

      <div style={sectionCardStyle}>
        <h2 style={{ marginTop: 0 }}>Create Job</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...inputStyle, minWidth: 320 }}
          />
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            style={inputStyle}
          >
            <option value="">Select Client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name} {client.company_name ? `- ${client.company_name}` : ''}
              </option>
            ))}
          </select>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            style={inputStyle}
          >
            <option value="">Select Technician</option>
            {technicians.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name || user.email}
              </option>
            ))}
          </select>
          <button onClick={createJob} style={primaryButtonStyle}>
            Create Job
          </button>
        </div>
      </div>

      <div style={sectionCardStyle}>
        <h2 style={{ marginTop: 0 }}>Technicians</h2>
        {technicians.length === 0 ? (
          <p>No technicians found.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {technicians.map((user) => {
              const p = getPresence(user.id)
              return (
                <div
                  key={user.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: 12,
                    background: 'var(--bg)',
                  }}
                >
                  <strong>{user.name || 'No name'}</strong>
                  <p style={{ margin: '6px 0' }}>{user.email}</p>
                  <p style={{ margin: 0 }}>
                    Presence: {p?.is_online ? p?.availability_status || 'online' : 'offline'}
                    {p?.last_seen
                      ? ` | Last seen: ${new Date(p.last_seen).toLocaleString()}`
                      : ''}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <h2 style={{ marginBottom: 16 }}>Active Jobs</h2>

      {activeJobs.length === 0 ? (
        <p>No active jobs.</p>
      ) : (
        activeJobs.map((job) => {
          const assignedUser = profiles.find((p) => p.id === job.assigned_to_user_id)
          const jobClient = clients.find((c) => c.id === job.client_id)
          const jobPhotos = photos.filter((p) => p.job_id === job.id)
          const jobMessages = messages.filter((m) => m.job_id === job.id)

          return (
            <div
              key={job.id}
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 18,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 260 }}>
                  <strong style={{ fontSize: 18 }}>{job.title}</strong>
                  <p>{job.description}</p>
                  <p>Client: {jobClient?.name || 'No client selected'}</p>
                  <p>
                    Assigned: {assignedUser?.name || assignedUser?.email || 'Unassigned'}
                    {assignedUser ? renderPresenceBadge(assignedUser.id) : null}
                  </p>
                  <p>Status: {job.status}</p>
                  <p>
                    GPS:{' '}
                    {job.site_lat != null && job.site_lng != null
                      ? `${job.site_lat}, ${job.site_lng}`
                      : 'Not captured'}
                  </p>
                  <p>Checked in at: {job.checked_in_at || 'Not checked in yet'}</p>
                  {job.rejection_reason ? <p>Rejection reason: {job.rejection_reason}</p> : null}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignContent: 'flex-start' }}>
                  {editingJobId === job.id ? (
                    <>
                      <select
                        value={newAssignedUserId}
                        onChange={(e) => setNewAssignedUserId(e.target.value)}
                        style={inputStyle}
                      >
                        <option value="">Select Technician</option>
                        {technicians.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name || user.email}
                          </option>
                        ))}
                      </select>

                      <button onClick={() => updateAssignment(job.id)} style={primaryButtonStyle}>
                        Save
                      </button>

                      <button
                        onClick={() => {
                          setEditingJobId(null)
                          setNewAssignedUserId('')
                        }}
                        style={buttonStyle}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingJobId(job.id)
                        setNewAssignedUserId(job.assigned_to_user_id || '')
                      }}
                      style={buttonStyle}
                    >
                      Reassign
                    </button>
                  )}

                  <button onClick={() => deleteJob(job.id)} style={dangerButtonStyle}>
                    Delete
                  </button>

                  <button
                    onClick={() => downloadAndSavePDF(job)}
                    style={primaryButtonStyle}
                    disabled={savingPdfJobId === job.id}
                  >
                    {savingPdfJobId === job.id ? 'Saving PDF...' : 'Export PDF'}
                  </button>
                </div>
              </div>

              {jobClient && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 12,
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    background: 'var(--bg)',
                  }}
                >
                  <strong>Client Details</strong>
                  <p>Name: {jobClient.name}</p>
                  <p>Company: {jobClient.company_name || '-'}</p>
                  <p>Email: {jobClient.email || '-'}</p>
                  <p>Phone: {jobClient.phone || '-'}</p>
                  <p>Address: {jobClient.address || '-'}</p>
                </div>
              )}

              {jobPhotos.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    marginTop: 16,
                  }}
                >
                  {jobPhotos.map((p) => (
                    <Image
                      key={p.id}
                      src={p.image_url}
                      alt="Job photo"
                      width={100}
                      height={100}
                      style={{
                        borderRadius: 8,
                        objectFit: 'cover',
                        border: '1px solid var(--border)',
                      }}
                    />
                  ))}
                </div>
              )}

              {job.signature_url && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ marginBottom: 8 }}>Signature</p>
                  <Image
                    src={job.signature_url}
                    alt="Signature"
                    width={220}
                    height={110}
                    style={{
                      borderRadius: 8,
                      objectFit: 'contain',
                      border: '1px solid var(--border)',
                      background: '#fff',
                    }}
                  />
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                {openChatJobId !== job.id ? (
                  <button onClick={() => setOpenChatJobId(job.id)} style={buttonStyle}>
                    Open Chat
                  </button>
                ) : (
                  <div
                    style={{
                      marginTop: 8,
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: 12,
                      background: 'var(--bg)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <strong>Job Chat</strong>
                      <button onClick={() => setOpenChatJobId(null)} style={buttonStyle}>
                        Close
                      </button>
                    </div>

                    <div
                      style={{
                        maxHeight: 220,
                        overflowY: 'auto',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: 10,
                        background: 'var(--card)',
                        marginBottom: 10,
                      }}
                    >
                      {jobMessages.length === 0 ? (
                        <p>No messages yet.</p>
                      ) : (
                        jobMessages.map((msg) => {
                          const sender = profiles.find((p) => p.id === msg.sender_user_id)
                          return (
                            <div
                              key={msg.id}
                              style={{
                                marginBottom: 10,
                                paddingBottom: 8,
                                borderBottom: '1px solid var(--border)',
                              }}
                            >
                              <strong>{sender?.name || sender?.email || 'User'}</strong>
                              <p style={{ margin: '4px 0' }}>{msg.message}</p>
                              <small>{new Date(msg.created_at).toLocaleString()}</small>
                            </div>
                          )
                        })
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message"
                        style={{ ...inputStyle, flex: 1, minWidth: 240 }}
                      />
                      <button onClick={() => sendJobMessage(job.id)} style={primaryButtonStyle}>
                        Send
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}