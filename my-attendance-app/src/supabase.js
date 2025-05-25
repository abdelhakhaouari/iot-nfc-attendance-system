// src/supabase.js
import { createClient } from '@supabase/supabase-js'

// Use environment variables (BEST PRACTICE!)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Create and export the Supabase client instance
export const supabase = createClient(supabaseUrl, supabaseAnonKey)