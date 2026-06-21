// src/pages/ResultsPage.jsx
import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, ArcElement, BarElement,
  CategoryScale, LinearScale, Tooltip, Legend
} from 'chart.js';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

function fmtDate(d) {
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function statusPill(s) {
  const map = {
    WON:     { bg:'#e8f5ed', color:'#1a7a3c', label:'Won' },
    LOST:    { bg:'#fceaea', color:'#c0392b', label:'Lost' },
    PARTIAL: { bg:'#fffbe8', color:'#854F0B', label:'Partial' },
  };
  const m = map[s] || { bg:'#f0f0f0', color:'#888', label:s };
  return <span style={{background:m.bg,color:m.color,padding:'2px 10px',borderRadius:10,fontSize:11,fontWeight:500}}>{m.label}</span>;
}

export default function ResultsPage() {
  const { user }                  = useAuth();
  const [matches, setMatches]     = useState([]);
  const [expanded, setExpanded]   = useState(null);
  const [detail, setDetail]       = useState({});
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    api.getMatches()
      .then(ms => setMatches(ms.filter(m => m.status === 'COMPLETED')))
      .finally(() => setLoading(false));
  }, []);

  async function toggle(matchId) {
    if (expanded === matchId) { setExpanded(null); return; }
    setExpanded(matchId);
    if (!detail[matchId]) {
      const d = await api.getResults(matchId).catch(() => null);
      if (d) setDetail(p => ({ ...p, [matchId]: d }));
    }
  }

  if (loading) return <div style={{padding:20,color:'#888'}}>Loading results…</div>;
  if (!matches.length) return (
    <div style={{padding:20,color:'#888',fontSize:13}}>
      No completed matches yet. Come back after the first match is settled.
    </div>
  );

  return (
    <div>
      {matches.map(m => {
        const d = detail[m.id];
        return (
          <div key={m.id} className="card">
            <div className="match-header">
              <div className="match-teams">
                {m.homeFlag} {m.homeTeam}
                <span className="vs-pill">vs</span>
                {m.awayFlag} {m.awayTeam}
              </div>
              <span style={{background:'#f0f0f0',color:'#555',padding:'3px 10px',borderRadius:10,fontSize:11}}>
                Completed · {fmtDate(m.kickoffAt)}
              </span>
            </div>
            <div className="match-meta">{m.stage}</div>

            <button className="btn btn-ghost" style={{marginTop:8,fontSize:12}}
              onClick={() => toggle(m.id)}>
              <i className={`ti ti-chevron-${expanded===m.id?'up':'down'}`} aria-hidden="true" style={{marginRight:4}}/>
              {expanded === m.id ? 'Hide summary' : 'View full summary'}
            </button>

            {expanded === m.id && d && <MatchSummary match={d} currentUser={user} />}
          </div>
        );
      })}
    </div>
  );
}

function MatchSummary({ match, currentUser }) {
  const bets = match.bets || [];

  // ── aggregate totals ──────────────────────────────────────────────
  const totalStaked  = bets.reduce((s, b) => s + b.totalStake, 0);
  const totalWon     = bets.reduce((s, b) => {
    return s + b.picks.filter(p => p.isCorrect).reduce((x, p) => x + (p.actualWin ?? 0), 0);
  }, 0);
  const totalEdu     = bets.reduce((s, b) => {
    const won  = b.picks.filter(p => p.isCorrect).reduce((x, p) => x + (p.actualWin ?? 0), 0);
    const pct  = b.girlsEduPct ?? 5;
    return s + won * pct / 100;
  }, 0);
  const totalNet     = totalWon - totalEdu;
  const winners      = bets.filter(b => b.status === 'WON').length;
  const losers       = bets.filter(b => b.status === 'LOST').length;
  const partial      = bets.filter(b => b.status === 'PARTIAL').length;

  // ── correct answers map ───────────────────────────────────────────
  const correctMap = {}; // questionId → optionLabel
  match.questions?.forEach(q => {
    const correctOpt = q.options.find(o =>
      bets.some(b => b.picks.some(p => p.questionId === q.id && p.optionId === o.id && p.isCorrect))
    );
    if (correctOpt) correctMap[q.id] = correctOpt.label;
  });

  // ── per-bet stats ─────────────────────────────────────────────────
  const betRows = bets.map(b => {
    const wonPicks  = b.picks.filter(p => p.isCorrect);
    const lostPicks = b.picks.filter(p => !p.isCorrect);
    const won       = wonPicks.reduce((s, p) => s + (p.actualWin ?? 0), 0);
    const lost      = lostPicks.reduce((s, p) => s + p.stake, 0);
    const eduPct    = b.girlsEduPct ?? 5;
    const edu       = +(won * eduPct / 100).toFixed(2);
    const net       = +(won - edu).toFixed(2);
    const profit    = +(net - b.totalStake).toFixed(2); // realized profit/loss
    const isMe      = b.userId === currentUser?.id;
    return {
      ...b,
      wonTotal: won, lossTotal: lost, edu, net, profit,
      wonCount: wonPicks.length, lostCount: lostPicks.length,
      isMe
    };
  });

  // ── superlatives ──────────────────────────────────────────────────
  const sortedByProfit = [...betRows].sort((a, b) => b.profit - a.profit);
  const highestWinner  = sortedByProfit[0];
  const biggestLoser   = sortedByProfit[sortedByProfit.length - 1];

  const sortedByStake  = [...betRows].sort((a, b) => b.totalStake - a.totalStake);
  const highestStaker  = sortedByStake[0];
  const lowestStaker   = sortedByStake[sortedByStake.length - 1];

  const sortedByEdu    = [...betRows].filter(b => b.edu > 0).sort((a, b) => b.edu - a.edu);
  const biggestDonor   = sortedByEdu[0];

  // Display order (highest profit first)
  betRows.sort((a, b) => b.profit - a.profit);

  // ── chart data ────────────────────────────────────────────────────
  const barLabels   = betRows.map(b => b.user?.alias ?? '?');
  const stakedData  = betRows.map(b => +b.totalStake.toFixed(2));
  const wonData     = betRows.map(b => +b.wonTotal.toFixed(2));
  const eduData     = betRows.map(b => +b.edu.toFixed(2));

  return (
    <div style={{marginTop:16}}>

      {/* ── Match-level metrics ─────────────────────────────── */}
      <div className="metrics" style={{marginBottom:14}}>
        {[
          ['Total staked',   `♡ ${totalStaked.toFixed(2)} LB`,  '#c0392b'],
          ['Total won',      `♡ ${totalWon.toFixed(2)} LB`,     '#1a7a3c'],
          ['Girls Ed. fund', `♡ ${totalEdu.toFixed(2)} LB`,     '#BA7517'],
          ['Players paid',   `♡ ${totalNet.toFixed(2)} LB`,     '#1a56c4'],
          ['Winners',        winners,                        '#1a7a3c'],
          ['Losers',         losers,                         '#c0392b'],
          ['Partial',        partial,                        '#854F0B'],
          ['Total players',  bets.length,                   '#555'],
        ].map(([label, val, color]) => (
          <div key={label} className="metric">
            <div className="metric-label">{label}</div>
            <div className="metric-val" style={{color,fontSize:18}}>{val}</div>
          </div>
        ))}
      </div>

      {/* ── Highlights row: superlatives ────────────────────── */}
      {betRows.length > 0 && (
        <>
          <div className="section-title" style={{marginBottom:8}}>
            <i className="ti ti-trophy" aria-hidden="true" />Highlights
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,marginBottom:14}}>
            {highestWinner && highestWinner.profit > 0 && (
              <Highlight icon="🏆" label="Highest winner" alias={highestWinner.user?.alias}
                value={`+♡ ${highestWinner.profit.toFixed(2)} LB`}
                sub={`Won ${highestWinner.wonCount}/${highestWinner.picks.length} picks`}
                color="#1a7a3c" bg="#e8f5ed" />
            )}
            {biggestLoser && biggestLoser.profit < 0 && (
              <Highlight icon="😔" label="Biggest loss" alias={biggestLoser.user?.alias}
                value={`♡ ${biggestLoser.profit.toFixed(2)} LB`}
                sub={`Staked ♡ ${biggestLoser.totalStake.toFixed(2)} LB`}
                color="#c0392b" bg="#fceaea" />
            )}
            {highestStaker && (
              <Highlight icon="💪" label="Highest stake" alias={highestStaker.user?.alias}
                value={`♡ ${highestStaker.totalStake.toFixed(2)} LB`}
                sub={`${highestStaker.picks.length} picks placed`}
                color="#1a56c4" bg="#e8f0fe" />
            )}
            {lowestStaker && lowestStaker.id !== highestStaker?.id && (
              <Highlight icon="🪙" label="Lowest stake" alias={lowestStaker.user?.alias}
                value={`♡ ${lowestStaker.totalStake.toFixed(2)} LB`}
                sub={`${lowestStaker.picks.length} picks placed`}
                color="#555" bg="#f0f0f0" />
            )}
            {biggestDonor && biggestDonor.edu > 0 && (
              <Highlight icon="🎓" label="Biggest donor" alias={biggestDonor.user?.alias}
                value={`♡ ${biggestDonor.edu.toFixed(2)} LB`}
                sub={`${biggestDonor.girlsEduPct ?? 5}% of winnings → Girls Ed.`}
                color="#BA7517" bg="#fffbe8" />
            )}
          </div>
        </>
      )}

      {/* ── Per-user summary cards ──────────────────────────── */}
      <div className="section-title" style={{marginBottom:8}}>
        <i className="ti ti-user-circle" aria-hidden="true" />Per-player summary
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:10,marginBottom:14}}>
        {betRows.map((b, idx) => (
          <UserSummaryCard key={b.id} bet={b} rank={idx+1} totalPlayers={betRows.length} />
        ))}
      </div>

      {/* ── Correct answers ─────────────────────────────────── */}
      <div className="card-sm" style={{marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:500,marginBottom:8,color:'#1a7a3c'}}>
          <i className="ti ti-check" aria-hidden="true" style={{marginRight:4}}/>Correct answers
        </div>
        {match.questions?.map(q => (
          <div key={q.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderTop:'0.5px solid rgba(0,0,0,0.06)',fontSize:13}}>
            <span style={{color:'#888',flex:2}}>{q.text}</span>
            <span style={{fontWeight:500,color:'#1a7a3c',flex:1,textAlign:'right'}}>
              {correctMap[q.id] ?? '—'}
            </span>
          </div>
        ))}
      </div>

      {/* ── My result card ──────────────────────────────────── */}
      {betRows.filter(b => b.isMe).map(b => (
        <div key={b.id} style={{
          background: b.status==='WON'?'#e8f5ed': b.status==='LOST'?'#fceaea':'#fffbe8',
          border:`1px solid ${b.status==='WON'?'#b2dfca':b.status==='LOST'?'#f5c6c6':'#f5d960'}`,
          borderRadius:12, padding:'14px 16px', marginBottom:14
        }}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <span style={{fontSize:15,fontWeight:500}}>
              {b.status==='WON'?'🎉 You won!':b.status==='LOST'?'😔 Better luck next time':'🤝 Partial win'} — your result
            </span>
            {statusPill(b.status)}
          </div>

          {/* Per-question picks */}
          {b.picks.map(p => (
            <div key={p.id} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'4px 0',borderTop:'0.5px solid rgba(0,0,0,0.06)'}}>
              <span style={{color:'#888',flex:2}}>{p.question?.text}</span>
              <span style={{flex:1,fontWeight:500,color: p.isCorrect?'#1a7a3c':'#c0392b'}}>
                {p.isCorrect ? '✓' : '✗'} {p.option?.label}
              </span>
              <span style={{flex:1,textAlign:'right',fontWeight:500,color: p.isCorrect?'#1a7a3c':'#c0392b'}}>
                {p.isCorrect ? `+♡ ${(p.actualWin ?? 0).toFixed(2)} LB` : `-♡ ${p.stake.toFixed(2)} LB`}
              </span>
              <span style={{flex:1,textAlign:'right',fontSize:11,color:'#888'}}>
                Staked ♡ {p.stake.toFixed(2)} LB
              </span>
            </div>
          ))}

          {/* Breakdown tiles */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:8,marginTop:12}}>
            {[
              ['Staked',        `♡ ${b.totalStake.toFixed(2)} LB`,  '#c0392b'],
              ['Won',           `♡ ${b.wonTotal.toFixed(2)} LB`,     '#1a7a3c'],
              [`Girls Ed. (${b.girlsEduPct??5}%)`, `♡ ${b.edu.toFixed(2)} LB`, '#BA7517'],
              ['You received',  `♡ ${b.net.toFixed(2)} LB`,          '#1a56c4'],
            ].map(([l,v,c]) => (
              <div key={l} style={{background:'rgba(255,255,255,.7)',borderRadius:8,padding:'8px 10px',textAlign:'center'}}>
                <div style={{fontSize:10,color:'#888',marginBottom:2}}>{l}</div>
                <div style={{fontSize:15,fontWeight:500,color:c}}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* ── Charts ──────────────────────────────────────────── */}
      <div className="charts-grid" style={{marginBottom:14}}>
        <div className="card-sm">
          <div style={{fontSize:12,color:'#888',marginBottom:8}}>Staked vs won per player</div>
          <div style={{display:'flex',gap:12,marginBottom:6,fontSize:11,color:'#888',flexWrap:'wrap'}}>
            <span><span style={{display:'inline-block',width:10,height:10,borderRadius:2,background:'#c0392b',marginRight:3}}/> Staked</span>
            <span><span style={{display:'inline-block',width:10,height:10,borderRadius:2,background:'#1a7a3c',marginRight:3}}/> Won</span>
            <span><span style={{display:'inline-block',width:10,height:10,borderRadius:2,background:'#BA7517',marginRight:3}}/> Girls Ed.</span>
          </div>
          <div style={{position:'relative',height: Math.max(160, barLabels.length * 36 + 40)}}>
            <Bar
              data={{
                labels: barLabels,
                datasets:[
                  { label:'Staked',   data:stakedData, backgroundColor:'#c0392b', borderRadius:3 },
                  { label:'Won',      data:wonData,    backgroundColor:'#1a7a3c', borderRadius:3 },
                  { label:'Girls Ed.',data:eduData,    backgroundColor:'#BA7517', borderRadius:3 },
                ]
              }}
              options={{
                indexAxis:'y',
                responsive:true, maintainAspectRatio:false,
                plugins:{ legend:{ display:false } },
                scales:{
                  x:{ grid:{ display:false }, ticks:{ font:{size:10}, callback: v => '♡ '+v } },
                  y:{ grid:{ display:false }, ticks:{ font:{size:11} } }
                }
              }}
            />
          </div>
        </div>

        <div className="card-sm">
          <div style={{fontSize:12,color:'#888',marginBottom:8}}>Girls Ed. fund share</div>
          <div style={{position:'relative',height:160}}>
            <Doughnut
              data={{
                labels: betRows.filter(b=>b.edu>0).map(b=>b.user?.alias),
                datasets:[{
                  data:  betRows.filter(b=>b.edu>0).map(b=>b.edu),
                  backgroundColor:['#1a7a3c','#BA7517','#1a56c4','#c0392b','#534AB7','#D85A30','#639922','#888'],
                  borderWidth:2, borderColor:'#fff'
                }]
              }}
              options={{ responsive:true, maintainAspectRatio:false, cutout:'60%', plugins:{ legend:{ display:false } } }}
            />
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:8,fontSize:11,color:'#888'}}>
            {betRows.filter(b=>b.edu>0).map((b,i) => {
              const colors = ['#1a7a3c','#BA7517','#1a56c4','#c0392b','#534AB7','#D85A30','#639922','#888'];
              return (
                <span key={b.id} style={{display:'flex',alignItems:'center',gap:3}}>
                  <span style={{width:8,height:8,borderRadius:2,background:colors[i%colors.length],flexShrink:0}}/>
                  {b.user?.alias} ♡ {b.edu.toFixed(2)} LB
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Full player table ────────────────────────────────── */}
      <div style={{fontSize:13,fontWeight:500,marginBottom:8,color:'#888',display:'flex',alignItems:'center',gap:6}}>
        <i className="ti ti-users" aria-hidden="true"/>All players
      </div>
      <div style={{overflowX:'auto',background:'#fff',border:'0.5px solid rgba(0,0,0,0.08)',borderRadius:12}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead>
            <tr style={{background:'#f5f5f5'}}>
              <th style={{padding:'8px 12px',textAlign:'left',color:'#888',fontWeight:500}}>Player</th>
              <th style={{padding:'8px 12px',textAlign:'left',color:'#888',fontWeight:500}}>Result</th>
              {match.questions?.map(q => (
                <th key={q.id} style={{padding:'8px 10px',textAlign:'center',color:'#888',fontWeight:500,maxWidth:100,fontSize:11}}>
                  {q.text.length > 22 ? q.text.slice(0,22)+'…' : q.text}
                </th>
              ))}
              <th style={{padding:'8px 12px',textAlign:'right',color:'#888',fontWeight:500}}>Staked</th>
              <th style={{padding:'8px 12px',textAlign:'right',color:'#888',fontWeight:500}}>Won</th>
              <th style={{padding:'8px 12px',textAlign:'right',color:'#BA7517',fontWeight:500}}>Girls Ed.</th>
              <th style={{padding:'8px 12px',textAlign:'right',color:'#1a56c4',fontWeight:500}}>Received</th>
            </tr>
          </thead>
          <tbody>
            {betRows.map(b => (
              <tr key={b.id} style={{background: b.isMe ? '#f0f9f4' : 'transparent'}}>
                <td style={{padding:'9px 12px',borderTop:'0.5px solid rgba(0,0,0,0.06)'}}>
                  <span className="alias-badge">{b.user?.alias}</span>
                  {b.isMe && <span style={{fontSize:10,color:'#888',marginLeft:5}}>you</span>}
                </td>
                <td style={{padding:'9px 12px',borderTop:'0.5px solid rgba(0,0,0,0.06)'}}>
                  {statusPill(b.status)}
                </td>
                {match.questions?.map(q => {
                  const pick = b.picks.find(p => p.questionId === q.id);
                  return (
                    <td key={q.id} style={{padding:'9px 10px',borderTop:'0.5px solid rgba(0,0,0,0.06)',textAlign:'center'}}>
                      {pick ? (
                        <span style={{
                          color: pick.isCorrect ? '#1a7a3c' : '#c0392b',
                          fontWeight: pick.isCorrect ? 500 : 400,
                          fontSize:11
                        }}>
                          {pick.isCorrect ? '✓' : '✗'} {pick.option?.label}
                          <br/>
                          <span style={{fontSize:10,color:'#aaa'}}>♡ {pick.stake.toFixed(0)} LB</span>
                        </span>
                      ) : <span style={{color:'#ccc'}}>—</span>}
                    </td>
                  );
                })}
                <td style={{padding:'9px 12px',borderTop:'0.5px solid rgba(0,0,0,0.06)',textAlign:'right',color:'#c0392b'}}>
                  ♡ {b.totalStake.toFixed(2)} LB
                </td>
                <td style={{padding:'9px 12px',borderTop:'0.5px solid rgba(0,0,0,0.06)',textAlign:'right',color:'#1a7a3c',fontWeight:500}}>
                  ♡ {b.wonTotal.toFixed(2)} LB
                </td>
                <td style={{padding:'9px 12px',borderTop:'0.5px solid rgba(0,0,0,0.06)',textAlign:'right',color:'#BA7517'}}>
                  ♡ {b.edu.toFixed(2)} LB
                  <div style={{fontSize:10,color:'#aaa'}}>{b.girlsEduPct??5}%</div>
                </td>
                <td style={{padding:'9px 12px',borderTop:'0.5px solid rgba(0,0,0,0.06)',textAlign:'right',color:'#1a56c4',fontWeight:500}}>
                  ♡ {b.net.toFixed(2)} LB
                </td>
              </tr>
            ))}
            {/* Totals row */}
            <tr style={{background:'#f8f8f8',fontWeight:500,borderTop:'2px solid #e0e0e0'}}>
              <td style={{padding:'9px 12px'}} colSpan={2 + (match.questions?.length||0)}>
                <span style={{fontSize:12,color:'#888'}}>Totals ({bets.length} players)</span>
              </td>
              <td style={{padding:'9px 12px',textAlign:'right',color:'#c0392b'}}>♡ {totalStaked.toFixed(2)} LB</td>
              <td style={{padding:'9px 12px',textAlign:'right',color:'#1a7a3c'}}>♡ {totalWon.toFixed(2)} LB</td>
              <td style={{padding:'9px 12px',textAlign:'right',color:'#BA7517'}}>♡ {totalEdu.toFixed(2)} LB</td>
              <td style={{padding:'9px 12px',textAlign:'right',color:'#1a56c4'}}>♡ {totalNet.toFixed(2)} LB</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Per-bet breakdown ────────────────────────────────── */}
      <div style={{marginTop:16,fontSize:13,fontWeight:500,color:'#888',display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
        <i className="ti ti-receipt" aria-hidden="true"/>Per-bet breakdown
      </div>
      {betRows.map(b => (
        <div key={b.id} className="card-sm" style={{marginBottom:8,
          outline: b.isMe ? '2px solid #1a7a3c' : 'none',
          outlineOffset:2
        }}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span className="alias-badge">{b.user?.alias}</span>
              {b.isMe && <span style={{fontSize:10,color:'#888'}}>you</span>}
              {statusPill(b.status)}
            </div>
            <div style={{display:'flex',gap:12,fontSize:12}}>
              <span style={{color:'#c0392b'}}>Staked ♡ {b.totalStake.toFixed(2)} LB</span>
              <span style={{color:'#1a7a3c',fontWeight:500}}>Won ♡ {b.wonTotal.toFixed(2)} LB</span>
              <span style={{color:'#BA7517'}}>Girls Ed. ♡ {b.edu.toFixed(2)} LB</span>
              <span style={{color:'#1a56c4',fontWeight:500}}>Rcvd ♡ {b.net.toFixed(2)} LB</span>
            </div>
          </div>
          {b.picks.map(p => (
            <div key={p.id} style={{
              display:'flex',justifyContent:'space-between',alignItems:'center',
              fontSize:11,padding:'4px 0',borderTop:'0.5px solid rgba(0,0,0,0.05)',
              color: p.isCorrect ? '#1a7a3c' : '#c0392b'
            }}>
              <span style={{flex:3,color:'#888'}}>{p.question?.text}</span>
              <span style={{flex:1,fontWeight:500}}>{p.isCorrect?'✓':'✗'} {p.option?.label}</span>
              <span style={{flex:1,textAlign:'center',color:'#aaa'}}>Staked ♡ {p.stake.toFixed(2)} LB</span>
              <span style={{flex:1,textAlign:'right',fontWeight:500}}>
                {p.isCorrect ? `+♡ ${(p.actualWin ?? 0).toFixed(2)} LB` : `-♡ ${p.stake.toFixed(2)} LB`}
              </span>
            </div>
          ))}
        </div>
      ))}

    </div>
  );
}

function Highlight({ icon, label, alias, value, sub, color, bg }) {
  return (
    <div style={{background:bg,borderRadius:12,padding:'12px 14px',border:`1px solid ${color}30`}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
        <span style={{fontSize:18}}>{icon}</span>
        <span style={{fontSize:11,color,fontWeight:500,textTransform:'uppercase',letterSpacing:.5}}>{label}</span>
      </div>
      <div style={{fontSize:13,fontWeight:500,marginBottom:2,color:'#111'}}>{alias}</div>
      <div style={{fontSize:18,fontWeight:600,color,marginBottom:2}}>{value}</div>
      <div style={{fontSize:11,color:'#888'}}>{sub}</div>
    </div>
  );
}

function UserSummaryCard({ bet, rank, totalPlayers }) {
  const statusMap = {
    WON:     { color:'#1a7a3c', bg:'#e8f5ed', label:'Won', emoji:'🎉' },
    LOST:    { color:'#c0392b', bg:'#fceaea', label:'Lost', emoji:'😔' },
    PARTIAL: { color:'#854F0B', bg:'#fffbe8', label:'Partial', emoji:'🤝' },
  };
  const s = statusMap[bet.status] || { color:'#555', bg:'#f0f0f0', label:bet.status, emoji:'•' };
  const rankColor = rank === 1 ? '#BA7517' : rank === totalPlayers ? '#888' : '#999';
  const isProfit = bet.profit >= 0;

  return (
    <div style={{
      background:'#fff', border:`1px solid ${s.color}30`, borderLeft:`4px solid ${s.color}`,
      borderRadius:10, padding:'12px 14px',
      outline: bet.isMe ? '2px solid #1a7a3c' : 'none', outlineOffset: bet.isMe ? 2 : 0,
    }}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{
            fontSize:11,fontWeight:600,color:rankColor,
            background:'#f5f5f5',padding:'2px 7px',borderRadius:8
          }}>#{rank}</span>
          <span className="alias-badge">{bet.user?.alias}</span>
          {bet.isMe && <span style={{fontSize:10,color:'#888'}}>you</span>}
        </div>
        <span style={{
          fontSize:11,background:s.bg,color:s.color,
          padding:'2px 8px',borderRadius:8,fontWeight:500
        }}>{s.emoji} {s.label}</span>
      </div>

      {/* Profit/loss headline */}
      <div style={{
        background: isProfit ? '#e8f5ed' : '#fceaea',
        borderRadius:8, padding:'8px 10px', marginBottom:10
      }}>
        <div style={{fontSize:10,color:'#888',marginBottom:2}}>
          Net {isProfit ? 'profit' : 'loss'}
        </div>
        <div style={{fontSize:20,fontWeight:600,color:isProfit?'#1a7a3c':'#c0392b'}}>
          {isProfit ? '+' : ''}♡ {bet.profit.toFixed(2)} LB
        </div>
      </div>

      {/* Breakdown */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,fontSize:12}}>
        <div style={{background:'#f8f8f8',borderRadius:6,padding:'6px 8px'}}>
          <div style={{fontSize:10,color:'#888'}}>Staked</div>
          <div style={{color:'#c0392b',fontWeight:500}}>♡ {bet.totalStake.toFixed(2)} LB</div>
        </div>
        <div style={{background:'#f8f8f8',borderRadius:6,padding:'6px 8px'}}>
          <div style={{fontSize:10,color:'#888'}}>Gross won</div>
          <div style={{color:'#1a7a3c',fontWeight:500}}>♡ {bet.wonTotal.toFixed(2)} LB</div>
        </div>
        <div style={{background:'#fffbe8',borderRadius:6,padding:'6px 8px'}}>
          <div style={{fontSize:10,color:'#888'}}>🎓 Girls Ed.</div>
          <div style={{color:'#BA7517',fontWeight:500}}>♡ {bet.edu.toFixed(2)} LB</div>
        </div>
        <div style={{background:'#e8f0fe',borderRadius:6,padding:'6px 8px'}}>
          <div style={{fontSize:10,color:'#888'}}>Received</div>
          <div style={{color:'#1a56c4',fontWeight:500}}>♡ {bet.net.toFixed(2)} LB</div>
        </div>
      </div>

      {/* Pick summary */}
      <div style={{
        marginTop:8,fontSize:11,color:'#888',display:'flex',justifyContent:'space-between'
      }}>
        <span>
          <span style={{color:'#1a7a3c'}}>✓ {bet.wonCount}</span>
          {' · '}
          <span style={{color:'#c0392b'}}>✗ {bet.lostCount}</span>
          {' / '}
          {bet.picks.length} picks
        </span>
        <span>{bet.girlsEduPct ?? 5}% pledge</span>
      </div>
    </div>
  );
}
