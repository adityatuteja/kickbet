// src/components/BetStats.jsx
import { useEffect, useState } from 'react';
import { Pie, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { api } from '../lib/api.js';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const COLORS = ['#1a7a3c','#1a56c4','#c0392b','#BA7517','#534AB7','#D85A30'];

export default function BetStats({ matchId }) {
  const [stats, setStats] = useState([]);

  useEffect(() => { api.getStats(matchId).then(setStats).catch(console.error); }, [matchId]);

  if (!stats.length) return <div style={{fontSize:12,color:'#888',padding:'10px 0'}}>No bet data yet.</div>;

  return (
    <div style={{marginTop:14}}>
      <div className="section-title" style={{marginBottom:8}}><i className="ti ti-chart-bar" aria-hidden="true" />Bet distribution</div>
      <div className="charts-grid">
        {stats.map((q, qi) => {
          const labels  = q.options.map(o => o.label);
          const counts  = q.options.map(o => o.count);
          const staked  = q.options.map(o => o.totalStaked);
          const bgColors = COLORS.slice(0, q.options.length);
          const isPie = q.options.length <= 3;

          return (
            <div key={q.questionId} className="card-sm" style={{marginBottom:0}}>
              <div style={{fontSize:12,color:'#888',marginBottom:8}}>{q.text}</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:6,fontSize:11,color:'#888'}}>
                {q.options.map((o,i) => (
                  <span key={i} style={{display:'flex',alignItems:'center',gap:3}}>
                    <span style={{width:8,height:8,borderRadius:2,background:bgColors[i],flexShrink:0}} />
                    {o.label} ({o.count}) ♡ {o.totalStaked.toFixed(0)} LB
                  </span>
                ))}
              </div>
              <div style={{position:'relative',height:150}}>
                {isPie ? (
                  <Pie data={{ labels, datasets:[{ data:counts, backgroundColor:bgColors, borderWidth:1, borderColor:'#fff' }] }}
                    options={{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } } }} />
                ) : (
                  <Bar data={{ labels, datasets:[{ data:staked, backgroundColor:bgColors, borderRadius:4, borderWidth:0 }] }}
                    options={{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ y:{display:false}, x:{ grid:{display:false} } } }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
