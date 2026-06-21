// src/components/Sidebar.jsx
import { useAuth } from '../lib/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const FACTS = [
  'Educating girls is one of the highest-return investments for any community.',
  'Last week: 12 girls in Rajasthan received school supplies.',
  'Girls with secondary education earn up to 25% more.',
  '5% of every bet you place feeds this fund automatically.',
];

export default function Sidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const myEdu = user?.girlsEduTotal || 0;
  const GOAL = 2000;
  const pct = Math.min(100, (myEdu / GOAL * 100)).toFixed(0);
  const fact = FACTS[Math.floor(Date.now() / 60000) % FACTS.length];

  return (
    <div className="sidebar">
      <div className="sidebar-title">Girls Education</div>

      <div className="donation-card">
        <div style={{fontSize:22,marginBottom:4}}>🎓</div>
        <div style={{fontSize:13,fontWeight:500,marginBottom:4}}>Fund a future</div>
        <div className="donation-text">
          5% of every bet goes to girls' education. You've donated <strong style={{color:'#BA7517'}}>♡ {myEdu.toFixed(0)} LB</strong> so far.
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{width:`♡ {pct} LB%`}} />
        </div>
        <div style={{fontSize:11,color:'#888',marginBottom:10}}>Goal: ♡ 2,000 LB</div>
        <button className="btn btn-gold btn-full" onClick={() => navigate('/girls-edu')}>View full breakdown →</button>
      </div>

      <div className="girls-banner">✦ <strong style={{color:'#BA7517'}}>Did you know?</strong> {fact}</div>
      <div style={{fontSize:11,color:'#888',lineHeight:1.6,paddingTop:2}}>
        Your alias hides your identity. Other players only see your alias, never your username or email.
      </div>
    </div>
  );
}
