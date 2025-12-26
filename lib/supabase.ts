
import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string): string | undefined => {
  try {
    // Check for Vite/Modern ESM
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      return (import.meta as any).env[key];
    }
  } catch (e) {}

  try {
    // Check for Node/Process global
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }
  } catch (e) {}

  try {
    // Check for window context (rare but possible)
    if (typeof window !== 'undefined' && (window as any)._env_) {
      return (window as any)._env_[key];
    }
  } catch (e) {}

  return undefined;
};

const supabaseUrl = 
  getEnv('VITE_SUPABASE_URL') || 
  'https://zoirocdfhggqvbwasgqz.supabase.co';

const supabaseAnonKey = 
  getEnv('VITE_SUPABASE_ANON_KEY') || 
  'sb_publishable_nXBIPIxoZ8Stl-ARcFZU3A_Y0q0IzxO';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
