// src/hooks/useToast.jsx
import { useState, useCallback } from 'react';

export function useToast() {
  const [msg, setMsg] = useState('');
  const [visible, setVisible] = useState(false);

  const toast = useCallback((m) => {
    setMsg(m); setVisible(true);
    setTimeout(() => setVisible(false), 2800);
  }, []);

  const Toast = () => <div className={`toast${visible ? ' show' : ''}`}>{msg}</div>;

  return { toast, Toast };
}
