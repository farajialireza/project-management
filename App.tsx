
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
  const [isInitialAuthChecked, setIsInitialAuthChecked] = useState(false);

  const fetchProfile = async (uid: string, email: string, displayName?: string) => {
    try {
      const profile = await usersApi.getProfile(uid);
      if (profile) {
        setUser(profile);
      } else {
        // Fallback user if profile not yet created in the database
        setUser({
          id: uid,
          name: displayName || email.split('@')[0] || 'User',
          email: email,
          isAdmin: email === 'realovatsug@gmail.com'
        });
      }
    } catch (error: any) {
      // Improved logging to avoid [object Object] output
      console.error("Error fetching user profile:", error.message || error);
      
      // Fallback on error to ensure the user can at least enter the app
      setUser({
        id: uid,
        name: displayName || email.split('@')[0] || 'User',
        email: email,
        isAdmin: email === 'realovatsug@gmail.com'
      });
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
      } catch (err: any) {
        console.error("Supabase Auth Initialization failed:", err.message || err);
      } finally {
        setLoading(false);
        setIsInitialAuthChecked(true);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Background sync for session changes, don't trigger global loading
        fetchProfile(
          session.user.id, 
          session.user.email!, 
          session.user.user_metadata?.full_name
        );
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Full page loader only during real initial load
  if (loading && !isInitialAuthChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm font-medium text-muted-foreground">axis is loading...</p>
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
