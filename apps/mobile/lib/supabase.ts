import 'expo-sqlite/localStorage/install'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ikrdsdarvhbsitpqstgv.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcmRzZGFydmhic2l0cHFzdGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NTg4MTksImV4cCI6MjA5MTQzNDgxOX0.L--q2x5JczILvlll0-aAorCJLm-WHr7g9xdhoAxamAM'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})