import { createClient } from '@supabase/supabase-js'

// Vite প্রোজেক্টের জন্য Environment Variables কল করার নিয়ম
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
