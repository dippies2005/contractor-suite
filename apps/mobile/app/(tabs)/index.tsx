import { useEffect, useRef, useState, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import SignatureScreen from 'react-native-signature-canvas'
import * as Location from 'expo-location'
import { supabase } from '../../lib/supabase'
import type { Session } from '@supabase/supabase-js'

type Job = {
  id: string
  title: string
  description: string
  status: string
  assigned_to_user_id: string | null
  signature_url: string | null
  site_lat: number | null
  site_lng: number | null
  checked_in_at: string | null
  completed_at?: string | null
  sent_to_accounting?: boolean | null
  accounting_sent_at?: string | null
  invoice_status?: string | null
  rejection_reason?: string | null
  technician_notes?: string | null
}

type Profile = {
  id: string
  name: string | null
  email: string | null
}

type JobMessage = {
  id: string
  job_id: string
  sender_user_id: string
  message: string
  created_at: string
}

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [messages, setMessages] = useState<JobMessage[]>([])
  const [signingJobId, setSigningJobId] = useState<string | null>(null)
  const [chatJobId, setChatJobId] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [availabilityStatus, setAvailabilityStatus] = useState('available')
  const [newMessage, setNewMessage] = useState('')
  const [rejectingJobId, setRejectingJobId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [jobNotes, setJobNotes] = useState<Record<string, string>>({})
  const [roleChecked, setRoleChecked] = useState(false)

  const signatureRef = useRef<any>(null)

  const userId = session?.user?.id ?? null
  const currentProfile = profiles.find((p) => p.id === userId)

  useEffect(() => {
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
    }

    void loadSession()

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const verifyTechnicianRole = async () => {
      if (!session?.user?.id) {
        setRoleChecked(false)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (error || !data || data.role !== 'technician') {
        await supabase.auth.signOut()
        Alert.alert('Access denied', 'This mobile app is for technician accounts only.')
        setRoleChecked(false)
        return
      }

      setRoleChecked(true)
    }

    void verifyTechnicianRole()
  }, [session])

  const loadData = useCallback(async () => {
    if (!userId) {
      setJobs([])
      setProfiles([])
      setMessages([])
      return
    }

    const [
      { data: jobsData, error: jobsError },
      { data: profilesData, error: profilesError },
      { data: messagesData, error: messagesError },
    ] = await Promise.all([
      supabase
        .from('jobs')
        .select('*')
        .eq('assigned_to_user_id', userId)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, name, email'),
      supabase.from('job_messages').select('*').order('created_at', { ascending: true }),
    ])

    if (jobsError) {
      console.log('Jobs load error:', jobsError.message)
      setJobs([])
    } else {
      setJobs(jobsData || [])

      const notesMap: Record<string, string> = {}
      ;(jobsData || []).forEach((job) => {
        notesMap[job.id] = job.technician_notes || ''
      })
      setJobNotes(notesMap)
    }

    if (profilesError) {
      console.log('Profiles load error:', profilesError.message)
      setProfiles([])
    } else {
      setProfiles(profilesData || [])
    }

    if (messagesError) {
      console.log('Messages load error:', messagesError.message)
      setMessages([])
    } else {
      setMessages(messagesData || [])
    }
  }, [userId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!userId) return

    const updatePresence = async () => {
      await supabase.from('user_presence').upsert({
        user_id: userId,
        is_online: true,
        availability_status: availabilityStatus,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }

    void updatePresence()

    const interval = setInterval(() => {
      void updatePresence()
    }, 30000)

    return () => {
      clearInterval(interval)
      void supabase.from('user_presence').upsert({
        user_id: userId,
        is_online: false,
        availability_status: 'offline',
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }
  }, [userId, availabilityStatus])

  useEffect(() => {
    if (!session) return

    const channel = supabase
      .channel('technician-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        void loadData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_messages' }, () => {
        void loadData()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [session, loadData])

  const signIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing details', 'Please enter email and password.')
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      Alert.alert('Login failed', error.message)
      return
    }

    setPassword('')
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      Alert.alert('Sign out failed', error.message)
      return
    }

    if (userId) {
      await supabase.from('user_presence').upsert({
        user_id: userId,
        is_online: false,
        availability_status: 'offline',
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }

    setJobs([])
    setProfiles([])
    setMessages([])
    setRoleChecked(false)
  }

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('jobs').update({ status }).eq('id', id)

    if (error) {
      Alert.alert('Update failed', error.message)
      return
    }

    if (status === 'accepted' || status === 'on_route' || status === 'on site') {
      setAvailabilityStatus('on_job')
    }

    await loadData()
  }

  const rejectJob = async (jobId: string) => {
    if (!rejectionReason.trim()) {
      Alert.alert('Reason required', 'Please enter a reason for rejecting this job.')
      return
    }

    const { error } = await supabase
      .from('jobs')
      .update({
        status: 'rejected',
        rejection_reason: rejectionReason.trim(),
      })
      .eq('id', jobId)

    if (error) {
      Alert.alert('Reject failed', error.message)
      return
    }

    setRejectingJobId(null)
    setRejectionReason('')
    setAvailabilityStatus('available')
    await loadData()
  }

  const saveTechnicianNotes = async (jobId: string) => {
    const noteValue = jobNotes[jobId]?.trim() || null

    const { error } = await supabase
      .from('jobs')
      .update({ technician_notes: noteValue })
      .eq('id', jobId)

    if (error) {
      Alert.alert('Notes failed', error.message)
      return
    }

    Alert.alert('Saved', 'Technician notes saved.')
    await loadData()
  }

  const completeJob = async (jobId: string) => {
    const now = new Date().toISOString()
    const noteValue = jobNotes[jobId]?.trim() || null

    const { error } = await supabase
      .from('jobs')
      .update({
        status: 'completed',
        completed_at: now,
        sent_to_accounting: true,
        accounting_sent_at: now,
        invoice_status: 'ready_to_invoice',
        technician_notes: noteValue,
      })
      .eq('id', jobId)

    if (error) {
      Alert.alert('Complete failed', error.message)
      return
    }

    setAvailabilityStatus('available')
    Alert.alert('Success', 'Job marked as completed and sent to accounting.')
    await loadData()
  }

  const uploadPhoto = async (jobId: string) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo access.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      quality: 0.7,
    })

    if (result.canceled) return

    const image = result.assets[0]

    const base64 = await FileSystem.readAsStringAsync(image.uri, {
      encoding: 'base64' as any,
    })

    const fileName = `${jobId}-${Date.now()}.jpg`

    const { error: uploadError } = await supabase.storage
      .from('job-photos')
      .upload(`jobs/${fileName}`, decode(base64), {
        contentType: 'image/jpeg',
      })

    if (uploadError) {
      Alert.alert('Upload failed', uploadError.message)
      return
    }

    const { data } = supabase.storage
      .from('job-photos')
      .getPublicUrl(`jobs/${fileName}`)

    const { error: insertError } = await supabase.from('job_photos').insert({
      job_id: jobId,
      image_url: data.publicUrl,
    })

    if (insertError) {
      Alert.alert('Database error', insertError.message)
      return
    }

    Alert.alert('Success', 'Photo uploaded.')
  }

  const handleSignature = async (signature: string) => {
    if (!signingJobId) return

    const base64 = signature.replace('data:image/png;base64,', '')
    const fileName = `${signingJobId}-${Date.now()}.png`

    const { error: uploadError } = await supabase.storage
      .from('job-photos')
      .upload(`signatures/${fileName}`, decode(base64), {
        contentType: 'image/png',
      })

    if (uploadError) {
      Alert.alert('Upload failed', uploadError.message)
      return
    }

    const { data } = supabase.storage
      .from('job-photos')
      .getPublicUrl(`signatures/${fileName}`)

    const { error: updateError } = await supabase
      .from('jobs')
      .update({ signature_url: data.publicUrl })
      .eq('id', signingJobId)

    if (updateError) {
      Alert.alert('Update failed', updateError.message)
      return
    }

    setSigningJobId(null)
    await loadData()
  }

  const checkInOnSite = async (jobId: string) => {
    const permission = await Location.requestForegroundPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow location access.')
      return
    }

    const loc = await Location.getCurrentPositionAsync({})

    const { error } = await supabase
      .from('jobs')
      .update({
        status: 'on site',
        site_lat: loc.coords.latitude,
        site_lng: loc.coords.longitude,
        checked_in_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    if (error) {
      Alert.alert('Update failed', error.message)
      return
    }

    setAvailabilityStatus('on_job')
    await loadData()
  }

  const sendJobMessage = async (jobId: string) => {
    if (!session?.user?.id || !newMessage.trim()) return

    const { error } = await supabase.from('job_messages').insert({
      job_id: jobId,
      sender_user_id: session.user.id,
      message: newMessage.trim(),
    })

    if (error) {
      Alert.alert('Message failed', error.message)
      return
    }

    setNewMessage('')
    await loadData()
  }

  if (!session) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: 24,
          backgroundColor: '#fff',
        }}
      >
        <Text style={{ fontSize: 28, marginBottom: 20, color: '#111' }}>
          Technician Login
        </Text>

        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor="#888"
          style={{
            borderWidth: 1,
            borderColor: '#ccc',
            padding: 12,
            marginBottom: 10,
            borderRadius: 8,
            backgroundColor: '#fff',
            color: '#111',
          }}
        />

        <TextInput
          placeholder="Password"
          value={password}
          secureTextEntry
          onChangeText={setPassword}
          placeholderTextColor="#888"
          style={{
            borderWidth: 1,
            borderColor: '#ccc',
            padding: 12,
            marginBottom: 14,
            borderRadius: 8,
            backgroundColor: '#fff',
            color: '#111',
          }}
        />

        <Pressable
          onPress={signIn}
          style={{
            backgroundColor: '#4CAF50',
            padding: 12,
            borderRadius: 8,
            marginBottom: 10,
          }}
        >
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>
            Login
          </Text>
        </Pressable>

        <Text style={{ color: '#444', textAlign: 'center', marginTop: 6 }}>
          Accounts are created by admin.
        </Text>
      </View>
    )
  }

  if (session && !roleChecked) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#fff',
        }}
      >
        <Text style={{ color: '#111', fontSize: 18 }}>Checking account access...</Text>
      </View>
    )
  }

  if (signingJobId) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#ccc',
          }}
        >
          <Pressable
            onPress={() => setSigningJobId(null)}
            style={{
              backgroundColor: '#eee',
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 8,
            }}
          >
            <Text style={{ fontWeight: '600', color: '#111' }}>Cancel</Text>
          </Pressable>

          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111' }}>
            Customer Signature
          </Text>

          <Pressable
            onPress={() => signatureRef.current?.readSignature()}
            style={{
              backgroundColor: '#4CAF50',
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text>
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          <SignatureScreen
            ref={signatureRef}
            onOK={handleSignature}
            onEmpty={() => Alert.alert('Please sign first')}
            autoClear={false}
            webStyle={`
              .m-signature-pad {
                box-shadow: none;
                border: none;
              }
              .m-signature-pad--body {
                border: 1px solid #ccc;
                margin: 10px;
              }
              .m-signature-pad--footer {
                display: none;
              }
              body, html {
                height: 100%;
                margin: 0;
                padding: 0;
                overflow: hidden;
              }
            `}
          />
        </View>
      </View>
    )
  }

  if (chatJobId) {
    const chatMessages = messages.filter((m) => m.job_id === chatJobId)

    return (
      <View style={{ flex: 1, backgroundColor: '#fff', padding: 16 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#111' }}>
            Job Chat
          </Text>
          <Pressable
            onPress={() => setChatJobId(null)}
            style={{
              backgroundColor: '#eee',
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: '#111', fontWeight: '600' }}>Back</Text>
          </Pressable>
        </View>

        <ScrollView
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: '#ddd',
            borderRadius: 8,
            padding: 10,
            marginBottom: 12,
          }}
        >
          {chatMessages.length === 0 ? (
            <Text style={{ color: '#666' }}>No messages yet.</Text>
          ) : (
            chatMessages.map((msg) => {
              const sender = profiles.find((p) => p.id === msg.sender_user_id)
              return (
                <View
                  key={msg.id}
                  style={{
                    marginBottom: 12,
                    paddingBottom: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: '#eee',
                  }}
                >
                  <Text style={{ fontWeight: '700', color: '#111' }}>
                    {sender?.name || sender?.email || 'User'}
                  </Text>
                  <Text style={{ color: '#111', marginTop: 4 }}>{msg.message}</Text>
                  <Text style={{ color: '#666', marginTop: 4 }}>
                    {new Date(msg.created_at).toLocaleString()}
                  </Text>
                </View>
              )
            })
          )}
        </ScrollView>

        <TextInput
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message"
          placeholderTextColor="#888"
          style={{
            borderWidth: 1,
            borderColor: '#ccc',
            padding: 12,
            marginBottom: 10,
            borderRadius: 8,
            backgroundColor: '#fff',
            color: '#111',
          }}
        />

        <Pressable
          onPress={() => sendJobMessage(chatJobId)}
          style={{
            backgroundColor: '#2563eb',
            padding: 12,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>
            Send
          </Text>
        </Pressable>
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, backgroundColor: '#fff' }}>
      <Text
        style={{
          fontSize: 22,
          fontWeight: '700',
          color: '#111',
          marginBottom: 8,
        }}
      >
        Jobs for {currentProfile?.name || currentProfile?.email || session.user.email}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 }}>
        {['available', 'on_job', 'on_break'].map((status) => (
          <Pressable
            key={status}
            onPress={() => setAvailabilityStatus(status)}
            style={{
              backgroundColor: availabilityStatus === status ? '#2563eb' : '#eee',
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 8,
              marginRight: 8,
              marginBottom: 8,
            }}
          >
            <Text
              style={{
                color: availabilityStatus === status ? '#fff' : '#111',
                fontWeight: '600',
              }}
            >
              {status.replace('_', ' ')}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={signOut}
        style={{
          alignSelf: 'flex-start',
          backgroundColor: '#eee',
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <Text style={{ color: '#111', fontWeight: '600' }}>Sign Out</Text>
      </Pressable>

      {jobs.map((job) => {
        const isCompleted = job.status === 'completed'
        const needsDecision = job.status === 'new' || job.status === 'offered'
        const showRejectBox = rejectingJobId === job.id

        return (
          <View
            key={job.id}
            style={{
              marginTop: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: '#ddd',
              borderRadius: 10,
              backgroundColor: '#fff',
            }}
          >
            <Text style={{ fontWeight: '700', fontSize: 18, color: '#111' }}>
              {job.title}
            </Text>

            <Text style={{ marginTop: 6, color: '#111' }}>{job.description}</Text>

            <Text
              style={{
                marginTop: 6,
                fontWeight: '700',
                color:
                  job.status === 'completed'
                    ? '#16a34a'
                    : job.status === 'on site'
                    ? '#f59e0b'
                    : job.status === 'rejected'
                    ? '#dc2626'
                    : '#6b7280',
              }}
            >
              Status: {job.status.toUpperCase()}
            </Text>

            {job.rejection_reason ? (
              <Text style={{ marginTop: 6, color: '#111' }}>
                Rejection reason: {job.rejection_reason}
              </Text>
            ) : null}

            <Text style={{ marginTop: 6, color: '#111' }}>
              Signature: {job.signature_url ? 'Captured' : 'Not added yet'}
            </Text>

            <Text style={{ marginTop: 6, color: '#111' }}>
              GPS:{' '}
              {job.site_lat !== null && job.site_lng !== null
                ? `${job.site_lat}, ${job.site_lng}`
                : 'Not captured'}
            </Text>

            <Text style={{ marginTop: 6, color: '#111' }}>
              Check-in: {job.checked_in_at || 'Not checked in yet'}
            </Text>

            <Text style={{ marginTop: 6, color: '#111' }}>
              Completed: {job.completed_at || 'Not completed yet'}
            </Text>

            <Text style={{ marginTop: 6, color: '#111' }}>
              Accounting: {job.invoice_status || 'not_ready'}
            </Text>

            {!isCompleted && (
              <>
                <TextInput
                  value={jobNotes[job.id] ?? ''}
                  onChangeText={(text) =>
                    setJobNotes((prev) => ({
                      ...prev,
                      [job.id]: text,
                    }))
                  }
                  placeholder="Technician notes"
                  placeholderTextColor="#888"
                  style={{
                    borderWidth: 1,
                    borderColor: '#ccc',
                    padding: 12,
                    marginTop: 12,
                    borderRadius: 8,
                    backgroundColor: '#fff',
                    color: '#111',
                  }}
                />

                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    marginTop: 12,
                  }}
                >
                  {needsDecision && (
                    <>
                      <Pressable
                        onPress={() => updateStatus(job.id, 'accepted')}
                        style={{
                          backgroundColor: '#ddd',
                          padding: 8,
                          borderRadius: 8,
                          marginRight: 8,
                          marginBottom: 8,
                        }}
                      >
                        <Text style={{ color: '#111' }}>Accept</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => setRejectingJobId(job.id)}
                        style={{
                          backgroundColor: '#ffd5d5',
                          padding: 8,
                          borderRadius: 8,
                          marginRight: 8,
                          marginBottom: 8,
                        }}
                      >
                        <Text style={{ color: '#111' }}>Reject</Text>
                      </Pressable>
                    </>
                  )}

                  <Pressable
                    onPress={() => updateStatus(job.id, 'on_route')}
                    style={{
                      backgroundColor: '#ddd',
                      padding: 8,
                      borderRadius: 8,
                      marginRight: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: '#111' }}>On Route</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => checkInOnSite(job.id)}
                    style={{
                      backgroundColor: '#ddd',
                      padding: 8,
                      borderRadius: 8,
                      marginRight: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: '#111' }}>On Site</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => uploadPhoto(job.id)}
                    style={{
                      backgroundColor: '#cde7ff',
                      padding: 8,
                      borderRadius: 8,
                      marginRight: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: '#111' }}>Add Photo</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setSigningJobId(job.id)}
                    style={{
                      backgroundColor: '#d8f5d0',
                      padding: 8,
                      borderRadius: 8,
                      marginRight: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: '#111' }}>Sign</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => saveTechnicianNotes(job.id)}
                    style={{
                      backgroundColor: '#eee',
                      padding: 8,
                      borderRadius: 8,
                      marginRight: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: '#111' }}>Save Notes</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setChatJobId(job.id)}
                    style={{
                      backgroundColor: '#eee',
                      padding: 8,
                      borderRadius: 8,
                      marginRight: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: '#111' }}>Chat</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => completeJob(job.id)}
                    style={{
                      backgroundColor: '#16a34a',
                      padding: 8,
                      borderRadius: 8,
                      marginRight: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Complete Job</Text>
                  </Pressable>
                </View>

                {showRejectBox && (
                  <View style={{ marginTop: 12 }}>
                    <TextInput
                      value={rejectionReason}
                      onChangeText={setRejectionReason}
                      placeholder="Reason for rejection"
                      placeholderTextColor="#888"
                      style={{
                        borderWidth: 1,
                        borderColor: '#ccc',
                        padding: 12,
                        marginBottom: 10,
                        borderRadius: 8,
                        backgroundColor: '#fff',
                        color: '#111',
                      }}
                    />

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      <Pressable
                        onPress={() => rejectJob(job.id)}
                        style={{
                          backgroundColor: '#dc2626',
                          padding: 10,
                          borderRadius: 8,
                          marginRight: 8,
                        }}
                      >
                        <Text style={{ color: '#fff', fontWeight: '600' }}>Confirm Reject</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          setRejectingJobId(null)
                          setRejectionReason('')
                        }}
                        style={{
                          backgroundColor: '#eee',
                          padding: 10,
                          borderRadius: 8,
                        }}
                      >
                        <Text style={{ color: '#111', fontWeight: '600' }}>Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </>
            )}

            {isCompleted && (
              <Pressable
                onPress={() => setChatJobId(job.id)}
                style={{
                  backgroundColor: '#eee',
                  padding: 8,
                  borderRadius: 8,
                  marginTop: 12,
                  alignSelf: 'flex-start',
                }}
              >
                <Text style={{ color: '#111' }}>Chat</Text>
              </Pressable>
            )}
          </View>
        )
      })}
    </ScrollView>
  )
}