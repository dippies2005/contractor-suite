import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type CreateUserBody = {
  email?: string
  password?: string
  name?: string
  role?: 'technician' | 'admin' | 'accounts'
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '').trim()

    if (!token) {
      return NextResponse.json({ error: 'Missing auth token' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: 'Missing Supabase environment variables' },
        { status: 500 }
      )
    }

    const requesterClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const {
      data: { user: requester },
      error: requesterError,
    } = await requesterClient.auth.getUser()

    if (requesterError || !requester) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: requesterProfile, error: profileError } = await requesterClient
      .from('profiles')
      .select('id, role')
      .eq('id', requester.id)
      .single()

    if (profileError || !requesterProfile || requesterProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = (await req.json()) as CreateUserBody
    const email = body.email?.trim().toLowerCase()
    const password = body.password?.trim()
    const name = body.name?.trim()
    const role = body.role || 'technician'

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      )
    }

    if (!['technician', 'admin', 'accounts'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const { data: createdUserData, error: createUserError } =
      await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

    if (createUserError || !createdUserData.user) {
      return NextResponse.json(
        { error: createUserError?.message || 'Failed to create auth user' },
        { status: 400 }
      )
    }

    const newUserId = createdUserData.user.id

    const { error: insertProfileError } = await serviceClient.from('profiles').upsert({
      id: newUserId,
      email,
      name,
      role,
    })

    if (insertProfileError) {
      await serviceClient.auth.admin.deleteUser(newUserId)
      return NextResponse.json(
        { error: insertProfileError.message || 'Failed to create profile' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUserId,
        email,
        name,
        role,
      },
    })
  } catch (err) {
    console.error('Admin create user error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}