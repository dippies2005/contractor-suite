import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type BootstrapBody = {
  companyName?: string
  tradingName?: string
  companyEmail?: string
  companyPhone?: string
  companyAddress?: string
  adminName?: string
  adminEmail?: string
  adminPassword?: string
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: 'Missing Supabase environment variables' },
        { status: 500 }
      )
    }

    const body = (await req.json()) as BootstrapBody

    const companyName = body.companyName?.trim()
    const tradingName = body.tradingName?.trim() || null
    const companyEmail = body.companyEmail?.trim().toLowerCase()
    const companyPhone = body.companyPhone?.trim()
    const companyAddress = body.companyAddress?.trim() || null
    const adminName = body.adminName?.trim()
    const adminEmail = body.adminEmail?.trim().toLowerCase()
    const adminPassword = body.adminPassword?.trim()

    if (
      !companyName ||
      !companyEmail ||
      !companyPhone ||
      !adminName ||
      !adminEmail ||
      !adminPassword
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const { data: existingCompany, error: existingCompanyError } = await anonClient
      .from('company_profile')
      .select('id')
      .limit(1)

    if (existingCompanyError) {
      return NextResponse.json(
        { error: existingCompanyError.message },
        { status: 400 }
      )
    }

    if (existingCompany && existingCompany.length > 0) {
      return NextResponse.json(
        { error: 'Company has already been set up' },
        { status: 400 }
      )
    }

    const { data: createdUserData, error: createUserError } =
      await serviceClient.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
      })

    if (createUserError || !createdUserData.user) {
      return NextResponse.json(
        { error: createUserError?.message || 'Failed to create admin user' },
        { status: 400 }
      )
    }

    const newAdminId = createdUserData.user.id

    const { error: companyError } = await serviceClient.from('company_profile').insert({
      company_name: companyName,
      trading_name: tradingName,
      email: companyEmail,
      phone: companyPhone,
      address: companyAddress,
      job_card_prefix: 'JC',
    })

    if (companyError) {
      await serviceClient.auth.admin.deleteUser(newAdminId)
      return NextResponse.json(
        { error: companyError.message },
        { status: 400 }
      )
    }

    const { error: profileError } = await serviceClient.from('profiles').insert({
      id: newAdminId,
      email: adminEmail,
      name: adminName,
      role: 'admin',
    })

    if (profileError) {
      await serviceClient.auth.admin.deleteUser(newAdminId)

      const { data: companyRow } = await serviceClient
        .from('company_profile')
        .select('id')
        .eq('email', companyEmail)
        .maybeSingle()

      if (companyRow?.id) {
        await serviceClient.from('company_profile').delete().eq('id', companyRow.id)
      }

      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Company and first admin created successfully',
    })
  } catch (err) {
    console.error('Bootstrap company error:', err)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}