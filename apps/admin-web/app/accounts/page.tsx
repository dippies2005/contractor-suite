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

const amberButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: '#d97706',
  color: '#fff',
  border: 'none',
}

export default function AccountsDashboardPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const [jobs, setJobs] = useState<Job[]>([])
  const [photos, setPhotos] = useState<JobPhoto[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null)

  const [savingPdfJobId, setSavingPdfJobId] = useState<string | null>(null)

  const accountingJobs = useMemo(
    () =>
      jobs.filter(
        (job) =>
          job.status === 'completed' ||
          job.sent_to_accounting === true ||
          job.invoice_status === 'ready_to_invoice' ||
          job.invoice_status === 'invoiced'
      ),
    [jobs]
  )

  const loadAllData = async () => {
    const [
      { data: jobsData },
      { data: photosData },
      { data: profilesData },
      { data: clientsData },
      { data: companyData },
    ] = await Promise.all([
      supabase.from('jobs').select('*').order('created_at', { ascending: false }),
      supabase.from('job_photos').select('*'),
      supabase.from('profiles').select('*'),
      supabase.from('clients').select('*'),
      supabase.from('company_profile').select('*').maybeSingle(),
    ])

    setJobs(jobsData || [])
    setPhotos(photosData || [])
    setProfiles(profilesData || [])
    setClients(clientsData || [])
    setCompanyProfile(companyData || null)
  }

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)

      if (!data.session) {
        window.location.href = '/accounts/login'
        return
      }

      const { data: authData } = await supabase.auth.getUser()
      const userId = authData.user?.id

      if (!userId) {
        window.location.href = '/accounts/login'
        return
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

      if (error || !profile || profile.role !== 'accounts') {
        await supabase.auth.signOut()
        window.location.href = '/accounts/login'
        return
      }

      await loadAllData()
      setLoading(false)
    }

    void init()

    const { data } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)

      if (!nextSession) {
        window.location.href = '/accounts/login'
        return
      }

      await loadAllData()
    })

    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return

    const channel = supabase
      .channel('accounts-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        void loadAllData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_photos' }, () => {
        void loadAllData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        void loadAllData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        void loadAllData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_profile' }, () => {
        void loadAllData()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [session])

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/accounts/login'
  }

  const updateInvoiceStatus = async (
    jobId: string,
    invoiceStatus: 'ready_to_invoice' | 'invoiced' | 'paid'
  ) => {
    const { error } = await supabase
      .from('jobs')
      .update({ invoice_status: invoiceStatus })
      .eq('id', jobId)

    if (error) {
      alert(error.message)
      return
    }

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

  if (loading) {
    return <div style={{ padding: 24 }}>Loading accounts dashboard...</div>
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
          <h1 style={{ margin: 0 }}>Accounts Portal</h1>
          <p style={{ margin: '6px 0 0 0', opacity: 0.8 }}>
            Completed jobs, invoices, and payments.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => (window.location.href = '/admin')} style={buttonStyle}>
            Admin Portal
          </button>
          <button onClick={signOut} style={buttonStyle}>
            Sign Out
          </button>
        </div>
      </div>

      <h2 style={{ marginBottom: 16 }}>Accounting Queue</h2>

      {accountingJobs.length === 0 ? (
        <p>No jobs ready for accounting.</p>
      ) : (
        accountingJobs.map((job) => {
          const assignedUser = profiles.find((p) => p.id === job.assigned_to_user_id)
          const client = clients.find((c) => c.id === job.client_id)
          const jobPhotos = photos.filter((p) => p.job_id === job.id)

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
              <strong style={{ fontSize: 18 }}>{job.title}</strong>
              <p>{job.description}</p>
              <p>Client: {client?.name || 'No client selected'}</p>
              <p>Assigned: {assignedUser?.name || assignedUser?.email || 'Unassigned'}</p>
              <p>Status: {job.status}</p>
              <p>Invoice Status: {job.invoice_status || 'not_ready'}</p>
              <p>Completed at: {job.completed_at || 'Not completed yet'}</p>

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

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                <button
                  onClick={() => downloadAndSavePDF(job)}
                  style={primaryButtonStyle}
                  disabled={savingPdfJobId === job.id}
                >
                  {savingPdfJobId === job.id ? 'Saving PDF...' : 'Download Job Card'}
                </button>

                <button
                  onClick={() => updateInvoiceStatus(job.id, 'ready_to_invoice')}
                  style={amberButtonStyle}
                >
                  Ready
                </button>

                <button
                  onClick={() => updateInvoiceStatus(job.id, 'invoiced')}
                  style={primaryButtonStyle}
                >
                  Mark Invoiced
                </button>

                <button
                  onClick={() => updateInvoiceStatus(job.id, 'paid')}
                  style={greenButtonStyle}
                >
                  Mark Paid
                </button>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}