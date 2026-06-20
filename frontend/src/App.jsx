// src/App.jsx
import { useState } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from './lib/AuthContext.jsx';
import AuthPage    from './pages/AuthPage.jsx';
import MatchesPage from './pages/MatchesPage.jsx';
import MyBetsPage  from './pages/MyBetsPage.jsx';
import UsersPage   from './pages/UsersPage.jsx';
import AdminPage   from './pages/AdminPage.jsx';
import GirlsEduPage from './pages/GirlsEduPage.jsx';
import PoolPage     from './pages/PoolPage.jsx';
import ResultsPage  from './pages/ResultsPage.jsx';
import PaymentMethodsPage from './pages/PaymentMethodsPage.jsx';
import RulesPage    from './pages/RulesPage.jsx';
import Sidebar      from './components/Sidebar.jsx';

const TABS = [
  { path:'/',           label:'Matches',  icon:'ti-calendar' },
  { path:'/my-bets',   label:'My bets',  icon:'ti-ticket' },
  { path:'/results',   label:'Results',  icon:'ti-trophy' },
  { path:'/pool',      label:'Pool',     icon:'ti-wallet' },
  { path:'/users',     label:'Players',  icon:'ti-users' },
  { path:'/girls-edu', label:'Girls ed.',icon:'ti-heart' },
  { path:'/rules',     label:'Rules',    icon:'ti-book' },
];

function Layout() {
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const available = (user?.balance||0) - (user?.committed||0);

  const tabs = [...TABS, ...(user?.isAdmin ? [
    { path:'/admin',           label:'Admin',    icon:'ti-shield' },
    { path:'/payment-methods', label:'Payments', icon:'ti-credit-card' },
  ] : [])];

  return (
    <div className="app">
      <div className="topbar">
        <h1>⚽ KickBet</h1>
        <div className="topbar-right">
          <span style={{fontSize:13,opacity:.85}}>{user?.alias}</span>
          <span className="balance-pill">Balance: $<span className="amt">{available.toFixed(2)}</span></span>
          <button style={{background:'rgba(255,255,255,.15)',border:'none',color:'#fff',padding:'4px 10px',borderRadius:6,fontSize:12,cursor:'pointer'}} onClick={logout}>Sign out</button>
        </div>
      </div>

      <div className="nav-tabs">
        {tabs.map(t => (
          <button key={t.path} className={`nav-tab${location.pathname===t.path?' active':''}`} onClick={() => navigate(t.path)}>{t.label}</button>
        ))}
      </div>

      <div className="main-layout">
        <div className="content-area body-pad">
          <Routes>
            <Route path="/"           element={<MatchesPage />} />
            <Route path="/my-bets"    element={<MyBetsPage />} />
            <Route path="/results"    element={<ResultsPage />} />
            <Route path="/pool"       element={<PoolPage />} />
            <Route path="/users"      element={<UsersPage />} />
            <Route path="/girls-edu"  element={<GirlsEduPage />} />
            <Route path="/rules"      element={<RulesPage />} />
            <Route path="/admin"      element={user?.isAdmin ? <AdminPage /> : <Navigate to="/" />} />
            <Route path="/payment-methods" element={user?.isAdmin ? <PaymentMethodsPage /> : <Navigate to="/" />} />
          </Routes>
        </div>
        {location.pathname !== '/girls-edu' && <Sidebar />}
      </div>

      {/* Mobile bottom nav */}
      <nav className="mobile-nav">
        <div className="mobile-nav-inner">
          {tabs.map(t => (
            <button key={t.path} className={`mobile-nav-item${location.pathname===t.path?' active':''}`} onClick={() => navigate(t.path)}>
              <i className={`ti ${t.icon}`} aria-hidden="true" />
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontSize:14,color:'#888'}}>Loading…</div>;
  if (!user)   return <AuthPage />;
  return <Layout />;
}
