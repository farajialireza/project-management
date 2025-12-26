
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { User } from './types';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { usersApi } from './api/admin';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });
export const useAuth = () => useContext(AuthContext);

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string, email: string, displayName?: string) => {
    try {
      const profile = await usersApi.getProfile(uid);

      if (profile) {
        setUser(profile);
      } else {
        // Fallback if record doesn't exist yet (Trigger delay or first sign-in)
        setUser({
          id: uid,
          name: displayName || email.split('@')[0] || 'User',
          email: email,
          isAdmin: email === 'realovatsug@gmail.com'
        });
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await fetchProfile(
            session.user.id, 
            session.user.email!, 
            session.user.user_metadata?.full_name
          );
        }
      } catch (err) {
        console.error("Supabase Auth Initialization failed:", err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setLoading(true);
        await fetchProfile(
          session.user.id, 
          session.user.email!, 
          session.user.user_metadata?.full_name
        );
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm font-medium text-muted-foreground">Loading Product Canvas...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {!user ? <Auth /> : <Dashboard />}
    </AuthContext.Provider>
  );
};

export default App;
