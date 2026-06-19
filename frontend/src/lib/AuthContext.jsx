// src/lib/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('kb_token');
    if (t) {
      api.me().then(setUser).catch(() => localStorage.removeItem('kb_token')).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(username, password) {
    const data = await api.login({ username, password });
    localStorage.setItem('kb_token', data.token);
    setUser(data.user);
    return data.user;
  }

  async function register(form) {
    const data = await api.register(form);
    localStorage.setItem('kb_token', data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem('kb_token');
    setUser(null);
  }

  function refreshMe() {
    api.me().then(setUser).catch(console.error);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
