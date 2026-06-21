// src/pages/GirlsEduPage.jsx
import { useState, useEffect } from 'react';
import { Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip } from 'chart.js';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { useToast } from '../hooks/useToast.jsx';

ChartJS.register(ArcElement, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip);

const GOAL = 2000;
const PALETTE = ['#BA7517','#1D9E75','#534AB7','#D85A30','#185FA5','#993556','#639922','#888780'];

function initials(alias) { return alias.slice(0,2).toUpperCase(); }

export default function GirlsEduPage() {
  const { user, refreshMe } = useAuth();
  const { toast, Toast } = useToast();
  const [data, setData]   = useState(null);
  const [sort, setSort]   = useState('amount');
  const [donating, setDonating] = useState(false);
  const [donateAmt, setDonateAmt] = useState('');

  useEffect(() => { api.girlsEdu().then(setData).catch(console.error); }, []);

  async function donateDirect() {
    const amt = parseFloat(donateAmt);
    if (!amt || amt <= 0) { toast('Enter a valid amount'); return; }
    setDonating(true);
    try {
      await api.donate(amt);
      toast('Thank you! Your donation was received.');
      setDonateAmt('');
      refreshMe();
      api.girlsEdu().then(setData);
    } catch(e) { toast(e.message); }
    finally { setDonating(false); }
  }

  if (!data) return <div style={{padding:20,color:'#888'}}>Loading…</div>;

  const total = data.total;
  const pct   = Math.min(100, (total/GOAL*100)).toFixed(0);

  const sorted = [...data.users].sort((a,b) => {
    if (sort === 'alias')  return a.alias.localeCompare(b.alias);
    if (sort === 'pct')    return (b.girlsEduTotal/(b.balance||1)) - (a.girlsEduTotal/(a.balance||1));
    return b.girlsEduTotal - a.girlsEduTotal;
  });

  const MAX = Math.max(...data.users.map(u => u.girlsEduTotal), 1);

  // Build cumulative line from donations
  const cumulativeDates = [];
  const cumulativeAmts  = [];
  let running = 0;
  data.donations.forEach(d => {
    running += d.amount;
    cumulativeDates.push(new Date(d.createdAt).toLocaleDateString(undefined,{month:'short',day:'numeric'}));
    cumulativeAmts.push(parseFloat(running.toFixed(2)));
  });

  return (
    <div>
      <Toast />

      <div className="metrics">
        <div className="metric"><div className="metric-label">Total raised</div><div className="metric-val metric-gold">♡ {total.toFixed(0)} LB</div></div>
        <div className="metric"><div className="metric-label">Contributors</div><div className="metric-val">{data.users.filter(u=>u.girlsEduTotal>0).length}</div></div>
        <div className="metric"><div className="metric-label">Goal</div><div className="metric-val metric-green">♡ {GOAL.toLocaleString('en-IN')} LB</div></div>
        <div className="metric"><div className="metric-label">Progress</div><div className="metric-val metric-gold">{pct}%</div></div>
      </div>

      <div style={{background:'#f0e0a0',borderRadius:8,height:10,marginBottom:16,overflow:'hidden'}}>
        <div style={{height:10,background:'#BA7517',borderRadius:8,width:`♡ {pct} LB%`,transition:'width .5s'}} />
      </div>

      <div className="charts-grid" style={{marginBottom:16}}>
        <div className="card" style={{padding:12}}>
          <div style={{fontSize:12,color:'#888',marginBottom:8}}>Cumulative donations over time</div>
          {cumulativeAmts.length > 1 ? (
            <div style={{position:'relative',height:160}}>
              <Line data={{
                labels: cumulativeDates,
                datasets:[{ data:cumulativeAmts, borderColor:'#BA7517', backgroundColor:'rgba(186,117,23,.12)', fill:true, tension:.4, pointRadius:2, borderWidth:2 }]
              }} options={{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{ ticks:{callback:v=>'♡ '+v,font:{size:10}} }, x:{ ticks:{font:{size:10}}, grid:{display:false} } } }} />
            </div>
          ) : <div style={{fontSize:12,color:'#aaa',padding:'20px 0',textAlign:'center'}}>Not enough data yet.</div>}
        </div>

        <div className="card" style={{padding:12}}>
          <div style={{fontSize:12,color:'#888',marginBottom:8}}>Share by user</div>
          <div style={{position:'relative',height:140}}>
            <Doughnut data={{
              labels: sorted.map(u=>u.alias),
              datasets:[{ data:sorted.map(u=>u.girlsEduTotal||0.01), backgroundColor:PALETTE, borderWidth:2, borderColor:'#fff' }]
            }} options={{ responsive:true, maintainAspectRatio:false, cutout:'60%', plugins:{legend:{display:false}} }} />
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:8,fontSize:11,color:'#888'}}>
            {sorted.filter(u=>u.girlsEduTotal>0).map((u,i) => (
              <span key={u.id} style={{display:'flex',alignItems:'center',gap:3}}>
                <span style={{width:8,height:8,borderRadius:2,background:PALETTE[i%PALETTE.length]}} />
                {u.alias.slice(0,10)} ♡ {u.girlsEduTotal.toFixed(0)} LB
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="section-title"><i className="ti ti-heart" aria-hidden="true" style={{color:'#BA7517'}} />Contributions by user</div>

      <div className="sort-bar">
        <span style={{fontSize:12,color:'#888'}}>Sort:</span>
        {[['amount','Amount'],['alias','Alias'],['pct','% of balance']].map(([k,l]) => (
          <button key={k} className={`sort-btn${sort===k?' active':''}`} onClick={() => setSort(k)}>{l}</button>
        ))}
      </div>

      <div className="card">
        {sorted.map((u, i) => {
          const barPct = MAX > 0 ? (u.girlsEduTotal/MAX*100).toFixed(0) : 0;
          const sharePct = total > 0 ? (u.girlsEduTotal/total*100).toFixed(1) : '0.0';
          const color = PALETTE[i % PALETTE.length];
          const rankClass = i===0?'rank-1':i===1?'rank-2':i===2?'rank-3':'rank-other';
          return (
            <div key={u.id} className="edu-user-row">
              <span className={`rank-badge ${rankClass}`}>#{i+1}</span>
              <div className="avatar" style={{background:color+'22',color}}>{initials(u.alias)}</div>
              <div style={{flex:'1.4',minWidth:0}}>
                <div style={{fontSize:13,fontWeight:500}}>{u.alias}</div>
                <div style={{fontSize:11,color:'#888'}}>{u.id} · {sharePct}% of fund</div>
              </div>
              <div style={{flex:2,minWidth:0}}>
                <div className="bar-track"><div className="bar-fill" style={{width:`♡ {barPct} LB%`,background:color}} /></div>
                <div style={{fontSize:10,color:'#888'}}>
                  {u.balance > 0 ? ((u.girlsEduTotal/u.balance)*100).toFixed(1) : '0.0'}% of balance
                </div>
              </div>
              <div style={{fontSize:13,fontWeight:500,color:'#BA7517',minWidth:40,textAlign:'right'}}>♡ {u.girlsEduTotal.toFixed(0)} LB</div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{marginTop:12}}>
        <div style={{fontSize:14,fontWeight:500,marginBottom:12}}>Make a direct donation</div>
        <div style={{fontSize:13,color:'#888',marginBottom:12}}>Your available balance: <strong style={{color:'#1a7a3c'}}>♡ {((user?.balance||0)-(user?.committed||0)).toFixed(2)} LB</strong></div>
        <div className="inline-row" style={{gap:8}}>
          <input type="number" min="1" step="1" placeholder="Amount (LB)" value={donateAmt} onChange={e=>setDonateAmt(e.target.value)} style={{maxWidth:140}} />
          <button className="btn btn-gold" onClick={donateDirect} disabled={donating}>{donating ? 'Processing…' : 'Donate ✦'}</button>
        </div>
      </div>
    </div>
  );
}
