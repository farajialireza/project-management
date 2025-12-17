import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User } from './types';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';

// Auth Context
interface AuthContextType {
  user: User | null;
  loading: boolean;
}
const AuthContext = createContext<AuthContextType>({ user: null, loading: true });
export const useAuth = () => useContext(AuthContext);

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch extended user profile from Firestore
        const docRef = doc(db, "users", firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setUser(docSnap.data() as User);
        } else {
            // Fallback if doc creation failed or pending
            setUser({
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: firebaseUser.displayName || 'User',
                isAdmin: false
            });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
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