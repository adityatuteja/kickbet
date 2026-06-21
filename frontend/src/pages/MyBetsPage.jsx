// src/pages/MyBetsPage.jsx
import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';

function fmtDate(d) { return new Date(d).toLocaleString(undefined, { dateStyle:'medium', timeStyle:'short' }); }

export default function MyBetsPage() {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.myBets().then(setBets).finally(() => setLoading(false)); }, []);

  if (loading) return <div style={{padding:20,color:'#888'}}>Loading…</div>;
  if (!bets.length) return (
    <div style={{padding:20,color:'#888',fontSize:13}}>
      No bets placed yet. Head to Matches to start betting.
    </div>
  );

  return (
    <div>
      {bets.map(bet => {
        const totalStake = bet.picks.reduce((s,p) => s+p.stake, 0);
        const isSettled  = bet.status !== 'PENDING';
        const totalWin   = bet.picks.reduce((s,p) => s + (isSettled ? (p.actualWin ?? 0) : (p.potentialWin ?? 0)), 0);
        return (
          <div key={bet.id} className="mybets-row">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <span style={{fontSize:13,fontWeight:500}}>{bet.match.homeFlag} {bet.match.homeTeam} vs {bet.match.awayFlag} {bet.match.awayTeam}</span>
              <span style={{fontSize:11,background:'#e8f5ed',color:'#1a7a3c',padding:'2px 8px',borderRadius:10}}>{bet.status}</span>
            </div>

            {bet.picks.map((p,i) => (
              <div key={i} className="bet-pick-row">
                <span className="pick-label">{p.question.text}: <strong>{p.option.label}</strong></span>
                <span>
                  <span className="pick-stake">-♡ {p.stake.toFixed(2)} LB</span>
                  {isSettled && (
                    <>
                      <span style={{color:'#aaa',margin:'0 4px'}}>→</span>
                      <span className="pick-win" style={{color: p.isCorrect ? '#1a7a3c' : '#c0392b'}}>
                        {p.isCorrect ? `+♡ ${(p.actualWin ?? 0).toFixed(2)} LB` : '♡ 0 LB'}
                      </span>
                    </>
                  )}
                </span>
              </div>
            ))}

            <div style={{display:'flex',justifyContent:'space-between',fontSize:13,fontWeight:500,paddingTop:8,marginTop:4,borderTop:'0.5px solid rgba(0,0,0,0.08)'}}>
              <span>Total at stake</span>
              <span style={{color:'#c0392b'}}>♡ {totalStake.toFixed(2)} LB</span>
            </div>
            {isSettled ? (
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#888',paddingTop:4}}>
                <span>Won (parimutuel payout):</span>
                <span style={{color:'#1a7a3c',fontWeight:500}}>+♡ {totalWin.toFixed(2)} LB</span>
              </div>
            ) : (
              <div style={{fontSize:12,color:'#888',paddingTop:6,background:'#f8f8f8',borderRadius:6,padding:'8px 10px',marginTop:6}}>
                💡 Payout is <strong>parimutuel</strong> — your share of the pool is locked when betting closes and depends on how many others picked the same answer. Check the live odds on the Matches tab.
              </div>
            )}
            {isSettled && (
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,paddingTop:4}}>
                <span style={{color:'#888'}}>Girls Ed. donated ({bet.girlsEduPct ?? 5}%)</span>
                <span style={{color:'#BA7517',fontWeight:500}}>
                  🎓 ♡ {(totalWin * ((bet.girlsEduPct ?? 5) / 100)).toFixed(2)} LB
                </span>
              </div>
            )}
            {bet.match.status === 'BETTING_OPEN' && (
              <div style={{fontSize:11,color:'#888',marginTop:6}}>You can edit your picks until 30 min before kickoff.</div>
            )}
            <div style={{fontSize:11,color:'#aaa',marginTop:4}}>Placed {fmtDate(bet.createdAt)}</div>
          </div>
        );
      })}
    </div>
  );
}
