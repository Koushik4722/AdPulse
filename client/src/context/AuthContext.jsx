import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth as useClerkAuth } from '@clerk/react';
import { api, setClerkTokenGetter } from '../api';

const Auth = createContext(null);
export const useAuth = () => useContext(Auth);

export function AuthProvider({ children }) {
  const { isLoaded, isSignedIn, getToken, signOut } = useClerkAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileRequired, setProfileRequired] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    setClerkTokenGetter(getToken);
    return () => setClerkTokenGetter(null);
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return undefined;
    let active = true;
    setLoading(true);
    setAuthError('');
    if (!isSignedIn) {
      setUser(null);
      setProfileRequired(false);
      setLoading(false);
      return () => { active = false; };
    }
    api.get('/auth/me')
      .then(({ data }) => { if (active) { setUser(data); setProfileRequired(false); } })
      .catch((error) => {
        if (!active) return;
        if (error.response?.status === 404 && error.response?.data?.profileRequired) {
          setUser(null);
          setProfileRequired(true);
        } else {
          setAuthError(error.response?.data?.message || 'Could not load your AdPulse profile.');
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isLoaded, isSignedIn, getToken]);

  const createProfile = async (profile) => {
    const { data } = await api.post('/auth/profile', profile);
    setUser(data);
    setProfileRequired(false);
    return data;
  };
  const logout = () => signOut();

  return <Auth.Provider value={{ user, loading, isSignedIn: Boolean(isSignedIn), profileRequired, authError, createProfile, logout, getToken }}>{children}</Auth.Provider>;
}
