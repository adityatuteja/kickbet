// src/pages/MatchesPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { useToast } from '../hooks/useToast.jsx';
import BetStats from '../components/BetStats.jsx';
import LowBalanceModal from '../components/LowBalanceModal.jsx';

function statusLabel(s) {
  if (s === 'BETTING_OPEN')   return <span className="status-badge status-open">Betting open</span>;
  if (s === 'BETTING_CLOSED') return <span className="status-badge status-locked">Betting locked</span>;
  if (s === 'LIVE')           return <span className="status-badge status-locked">Live</span>;
  if (s === 'COMPLETED')      return <span className="status-badge status-locked">Completed</span>;
  return <span className="status-badge status-upcoming">Upcoming</span>;
}

function fmtDate(d) {
  return new Date(d).toLocaleString(undefined, { dateStyle:'medium', timeStyle:'short', timeZone:'UTC' }) + ' UTC';
}

const DEFAULT_EDU_PCT = 5; // default 5%

export default function MatchesPage() {
  const { user, refreshMe } = useAuth();
  const { toast, Toast }    = useToast();
  const navigate            = useNavigate();
  const [matches, setMatches] = useState([]);
  const [picks, setPicks]     = useState({});   // { matchId: { questionId: { optionId, label, multiplier } } }
  const [amounts, setAmounts] = useState({});   // { matchId: { questionId: string } }
  const [eduPct, setEduPct]   = useState({});   // { matchId: number 0-100 }
  const [statsFor, setStatsFor] = useState(null);
  const [loading, setLoading]   = useState(true);

  // Low-balance / first-time modal
  const [modalOpen, setModalOpen]       = useState(false);
  const [modalReason, setModalReason]   = useState('low_balance');
  const [modalNeeded, setModalNeeded]   = useState(0);
  const [hasCommitted, setHasCommitted] = useState(true);

  // Live parimutuel odds per match: { matchId: [{ questionId, text, options:[{optionId,label,staked,share,multiplier}], totalPool }] }
  const [liveOdds, setLiveOdds] = useState({});

  // Poll live odds for all open matches every 5s (the "moving market")
  useEffect(() => {
    const openIds = matches.filter(m => m.status === 'BETTING_OPEN').map(m => m.id);
    if (!openIds.length) return;
    let active = true;
    const fetchOdds = () => {
      openIds.forEach(id => {
        api.getStats(id).then(stats => {
          if (active) setLiveOdds(prev => ({ ...prev, [id]: stats }));
        }).catch(() => {});
      });
    };
    fetchOdds();
    const t = setInterval(fetchOdds, 5000);
    return () => { active = false; clearInterval(t); };
  }, [matches]);

  // Helper: get live odds for a specific option
  function optionOdds(matchId, questionId, optionId) {
    const q = liveOdds[matchId]?.find(s => s.questionId === questionId);
    if (!q) return null;
    return q.options.find(o => o.optionId === optionId) || null;
  }
  function questionPool(matchId, questionId) {
    const q = liveOdds[matchId]?.find(s => s.questionId === questionId);
    return q?.totalPool ?? 0;
  }

  useEffect(() => {
    api.getMatches().then(setMatches).finally(() => setLoading(false));
    const t = setInterval(() => api.getMatches().then(setMatches), 60000);
    return () => clearInterval(t);
  }, []);

  // Check if user has committed to the pool on mount
  useEffect(() => {
    if (!user) return;
    api.getPool().then(d => {
      const mine = d.commitments.find(c => c.userId === user.id);
      const committed = !!mine && mine.totalCommitted > 0;
      setHasCommitted(committed);
      // Only auto-show modal if user has zero balance AND never committed
      // (so we don't bug them every page load)
      const seenKey = 'kb_welcome_shown_' + user.id;
      if (!committed && (user.balance || 0) === 0 && !sessionStorage.getItem(seenKey)) {
        setModalReason('first_time');
        setModalOpen(true);
        sessionStorage.setItem(seenKey, '1');
      }
    }).catch(() => {});
  }, [user?.id]);

  const available = (user?.balance || 0) - (user?.committed || 0);

  function getEduPct(matchId) {
    return eduPct[matchId] ?? DEFAULT_EDU_PCT;
  }

  function selectOpt(matchId, questionId, opt) {
    setPicks(p => {
      const mp = { ...(p[matchId] || {}) };
      if (mp[questionId]?.optionId === opt.id) {
        delete mp[questionId];
        setAmounts(a => {
          const ma = { ...(a[matchId] || {}) };
          delete ma[questionId];
          return { ...a, [matchId]: ma };
        });
      } else {
        mp[questionId] = { optionId: opt.id, label: opt.label };
        // default the stake box to this question's minimum
        const match = matches.find(x => x.id === matchId);
        const q = match?.questions.find(x => x.id === questionId);
        const minStake = q?.minStake ?? 10;
        setAmounts(a => ({
          ...a,
          [matchId]: { ...(a[matchId] || {}), [questionId]: String(minStake) }
        }));
      }
      return { ...p, [matchId]: mp };
    });
  }

  function setAmount(matchId, questionId, val) {
    if (val !== '' && (isNaN(val) || Number(val) < 0)) return;
    setAmounts(a => ({ ...a, [matchId]: { ...(a[matchId] || {}), [questionId]: val } }));
  }

  function getAmount(matchId, questionId) {
    return parseFloat(amounts[matchId]?.[questionId] || 0) || 0;
  }

  function getTotalStake(matchId) {
    return Object.keys(picks[matchId] || {}).reduce((s, qId) => s + getAmount(matchId, qId), 0);
  }

  function getTotalWin(matchId) {
    return Object.keys(picks[matchId] || {}).reduce((s, qId) => {
      const amt = getAmount(matchId, qId);
      const optionId = picks[matchId][qId].optionId;
      const od = optionOdds(matchId, qId, optionId);
      const pool = questionPool(matchId, qId);
      // project multiplier including this stake
      if (od) {
        const newOptStaked = (od.staked || 0) + amt;
        const newPool      = (pool || 0) + amt;
        const mult = newOptStaked > 0 ? newPool / newOptStaked : 1;
        return s + amt * mult;
      }
      return s + amt; // no pool data yet → assume break-even
    }, 0);
  }

  // winnings after edu donation
  function getNetWin(matchId) {
    const win = getTotalWin(matchId);
    const pct = getEduPct(matchId);
    return win * (1 - pct / 100);
  }

  function getEduAmount(matchId) {
    return getTotalWin(matchId) * (getEduPct(matchId) / 100);
  }

  async function placeBet(matchId) {
    const mp = picks[matchId] || {};
    if (!Object.keys(mp).length) { toast('Select at least one option first.'); return; }

    for (const [qId, pick] of Object.entries(mp)) {
      const amt = getAmount(matchId, qId);
      if (!amt || amt <= 0) { toast(`Enter a valid amount for "${pick.label}"`); return; }
    }

    const totalStake = getTotalStake(matchId);

    // Insufficient balance → show modal instead of just a toast
    if (totalStake > available) {
      setModalReason(hasCommitted ? 'low_balance' : 'first_time');
      setModalNeeded(totalStake);
      setModalOpen(true);
      return;
    }

    const betPicks = Object.entries(mp).map(([questionId, pick]) => ({
      questionId,
      optionId: pick.optionId,
      amount:   getAmount(matchId, questionId),
    }));

    const pct = getEduPct(matchId);

    try {
      const res = await api.placeBet({ matchId, picks: betPicks, girlsEduPct: pct });
      const eduAmt = res.girlsEduContribution;
      toast(`Bets confirmed! ✓  ${pct}% of winnings (up to ♡ ${eduAmt} LB) → Girls Ed. fund`);
      setPicks(p  => { const n = {...p};  delete n[matchId]; return n; });
      setAmounts(a => { const n = {...a}; delete n[matchId]; return n; });
      refreshMe();
    } catch (e) {
      // backend rejected — if it's a balance error, show the modal
      if (/insufficient|balance/i.test(e.message)) {
        setModalReason(hasCommitted ? 'low_balance' : 'first_time');
        setModalNeeded(totalStake);
        setModalOpen(true);
      } else {
        toast(e.message);
      }
    }
  }

  if (loading) return <div style={{padding:20,color:'#888'}}>Loading matches…</div>;

  return (
    <div>
      <Toast />

      {/* Persistent zero-balance banner at top */}
      {available <= 0 && matches.some(m => m.status === 'BETTING_OPEN') && (
        <div style={{
          background:'linear-gradient(90deg,#fffbe8,#fff5e0)',
          border:'1px solid #BA751740',borderRadius:10,
          padding:'12px 14px',marginBottom:14,
          display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'
        }}>
          <span style={{fontSize:22}}>💚</span>
          <div style={{flex:1,minWidth:200}}>
            <div style={{fontSize:13,fontWeight:500,color:'#854F0B',marginBottom:2}}>
              {hasCommitted ? 'Your available balance is ♡ 0 LB' : 'Welcome! You need a betting balance to place bets'}
            </div>
            <div style={{fontSize:12,color:'#888'}}>
              {hasCommitted
                ? 'Top up your pool commitment to keep betting.'
                : `Commit at least ♡ 2,000 LB to the pool — admin acknowledges and your balance is credited.`}
            </div>
          </div>
          <button onClick={() => navigate('/pool')} style={{
            background:'#BA7517',color:'#fff',border:'none',borderRadius:8,
            padding:'8px 16px',fontSize:13,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap'
          }}>
            Go to Pool →
          </button>
        </div>
      )}

      {matches.map(m => {
        const isOpen     = m.status === 'BETTING_OPEN';
        const mp         = picks[m.id] || {};
        const totalStake = getTotalStake(m.id);
        const totalWin   = getTotalWin(m.id);
        const netWin     = getNetWin(m.id);
        const eduAmt     = getEduAmount(m.id);
        const pct        = getEduPct(m.id);
        const overBudget = totalStake > available;
        const hasPicks   = Object.keys(mp).length > 0;

        return (
          <div key={m.id} className="card">
            <div className="match-header">
              <div className="match-teams">
                {m.homeFlag} {m.homeTeam} <span className="vs-pill">vs</span> {m.awayFlag} {m.awayTeam}
              </div>
              <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                {statusLabel(m.status)}
                {isOpen && <span className="countdown">Closes {fmtDate(m.bettingClosesAt)}</span>}
              </div>
            </div>
            <div className="match-meta">📅 {fmtDate(m.kickoffAt)} · {m.stage}</div>

            {isOpen && m.questions.length > 0 && (
              <>
                {/* Questions */}
                {m.questions.map(q => {
                  const selected = mp[q.id];
                  const amt      = amounts[m.id]?.[q.id] || '';
                  const pool     = questionPool(m.id, q.id);

                  // Live projected win for the selected option, including this stake
                  let projWin = 0, projMult = null;
                  if (selected) {
                    const od = optionOdds(m.id, q.id, selected.optionId);
                    const stakeNum = parseFloat(amt) || 0;
                    // recompute multiplier as if this stake were added to the pool
                    if (od) {
                      const newOptStaked = (od.staked || 0) + stakeNum;
                      const newPool      = (pool || 0) + stakeNum;
                      projMult = newOptStaked > 0 ? newPool / newOptStaked : null;
                      projWin  = projMult ? stakeNum * projMult : 0;
                    }
                  }

                  return (
                    <div key={q.id} className="bet-q">
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                        <div className="bet-q-label" style={{marginBottom:0}}>{q.text}</div>
                        <span style={{fontSize:11,color:'#888'}}>
                          Pool: <strong style={{color:'#1a7a3c'}}>♡ {pool.toFixed(0)} LB</strong>
                        </span>
                      </div>
                      <div className="bet-opts">
                        {q.options.map(o => {
                          const od   = optionOdds(m.id, q.id, o.id);
                          const mult = od?.multiplier;       // null if no money yet
                          const share = od?.share ?? 0;
                          const staked = od?.staked ?? 0;
                          const isSel = selected?.optionId === o.id;
                          return (
                            <button key={o.id}
                              className={`bet-opt${isSel ? ' selected' : ''}`}
                              onClick={() => selectOpt(m.id, q.id, o)}
                              style={{minWidth:96,alignItems:'stretch',textAlign:'center'}}>
                              <span className="opt-label">{o.label}</span>
                              <span className="opt-price" style={{color:isSel?'#a8f0c0':'#1a7a3c',fontWeight:600,fontSize:13}}>
                                {mult ? `${mult.toFixed(2)}×` : '—'}
                              </span>
                              <span className="opt-return" style={{fontSize:10}}>
                                ♡ {staked.toFixed(0)} LB · {share.toFixed(0)}%
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <div style={{fontSize:10,color:'#aaa',marginTop:4}}>
                        Min ♡ {(q.minStake ?? 10)} LB · odds move as people bet, locked when betting closes
                      </div>

                      {selected && (
                        <div style={{display:'flex',alignItems:'center',gap:10,marginTop:8,flexWrap:'wrap'}}>
                          <label style={{fontSize:12,color:'#888',whiteSpace:'nowrap'}}>Your stake:</label>
                          <div style={{display:'flex',alignItems:'center',gap:4}}>
                            <span style={{fontSize:13,color:'#888'}}>♡ </span>
                            <input
                              type="number" min="0" step="1" placeholder="0"
                              value={amt}
                              onChange={e => setAmount(m.id, q.id, e.target.value)}
                              style={{width:90,padding:'5px 8px',border:'1px solid #ddd',borderRadius:6,fontSize:14,fontWeight:500,background:'#fff',color:'#111'}}
                            />
                          </div>
                          {projWin > 0 && (
                            <span style={{fontSize:12,color:'#1a7a3c',fontWeight:500}}>
                              → ~♡ {projWin.toFixed(2)} LB {projMult ? `(${projMult.toFixed(2)}×)` : ''}
                            </span>
                          )}
                          {parseFloat(amt) > available && (
                            <span style={{fontSize:11,color:'#c0392b'}}>exceeds balance</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Girls Education slider — shown once any pick is made */}
                {hasPicks && (
                  <div style={{
                    background:'#fffbe8',border:'1px solid #f5d96060',borderRadius:10,
                    padding:'12px 14px',marginTop:10
                  }}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                      <span style={{fontSize:13,fontWeight:500,color:'#854F0B'}}>
                        🎓 Girls Education donation
                      </span>
                      <span style={{fontSize:13,fontWeight:500,color:'#BA7517'}}>
                        {pct}% of winnings
                      </span>
                    </div>

                    <input
                      type="range" min="0" max="100" step="1"
                      value={pct}
                      onChange={e => setEduPct(ep => ({ ...ep, [m.id]: Number(e.target.value) }))}
                      style={{width:'100%',accentColor:'#BA7517',marginBottom:8}}
                    />

                    <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#888',marginBottom:6}}>
                      <span>0% (keep all winnings)</span>
                      <span>100% (donate all winnings)</span>
                    </div>

                    {/* Quick preset buttons */}
                    <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
                      {[0, 5, 10, 25, 50, 100].map(v => (
                        <button key={v}
                          onClick={() => setEduPct(ep => ({ ...ep, [m.id]: v }))}
                          style={{
                            padding:'3px 10px',fontSize:11,border:'1px solid #e0c860',borderRadius:12,
                            background: pct === v ? '#BA7517' : '#fffbe8',
                            color:      pct === v ? '#fff'    : '#854F0B',
                            cursor:'pointer'
                          }}>
                          {v}%
                        </button>
                      ))}
                    </div>

                    {/* Winnings breakdown */}
                    {totalWin > 0 && (
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
                        {[
                          ['Potential win',       `♡ ${totalWin.toFixed(2)} LB`, '#1a7a3c'],
                          ['Girls Ed. donation',  `♡ ${eduAmt.toFixed(2)} LB`,   '#BA7517'],
                          ['You keep',            `♡ ${netWin.toFixed(2)} LB`,   '#1a56c4'],
                        ].map(([label, val, color]) => (
                          <div key={label} style={{background:'#fff8e0',borderRadius:7,padding:'7px 10px',textAlign:'center'}}>
                            <div style={{fontSize:10,color:'#888',marginBottom:2}}>{label}</div>
                            <div style={{fontSize:14,fontWeight:500,color}}>{val}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {pct === 0 && (
                      <div style={{fontSize:11,color:'#888',marginTop:6}}>
                        No donation — you keep 100% of winnings.
                      </div>
                    )}
                    {pct === 100 && (
                      <div style={{fontSize:11,color:'#BA7517',marginTop:6,fontWeight:500}}>
                        ✦ All winnings go to girls' education. Thank you!
                      </div>
                    )}
                  </div>
                )}

                {/* Summary row */}
                <div className="stake-row" style={{marginTop:10}}>
                  <span className="stake-label">Total stake</span>
                  <span className="stake-val">♡ {totalStake.toFixed(2)} LB</span>
                  <div className="stake-info">
                    <span>Available: <strong>♡ {available.toFixed(2)} LB</strong></span>
                    {totalWin > 0 && <span>You keep: <strong>♡ {netWin.toFixed(2)} LB</strong></span>}
                  </div>
                </div>
                {overBudget && (
                  <div style={{
                    background:'#fff5f5',border:'1px solid #f5c0c0',borderRadius:8,
                    padding:'10px 12px',marginTop:10,
                    display:'flex',gap:10,alignItems:'flex-start'
                  }}>
                    <span style={{fontSize:18,lineHeight:1}}>💡</span>
                    <div style={{flex:1,fontSize:12}}>
                      <div style={{color:'#c0392b',fontWeight:500,marginBottom:3}}>
                        Not enough balance for this bet
                      </div>
                      <div style={{color:'#666',marginBottom:6}}>
                        You need <strong>♡ {totalStake.toFixed(2)} LB</strong> but only have <strong>♡ {available.toFixed(2)} LB</strong> available.{' '}
                        Top up your pool commitment to keep betting.
                      </div>
                      <button
                        onClick={() => navigate('/pool')}
                        style={{
                          background:'#c0392b',color:'#fff',border:'none',
                          borderRadius:6,padding:'5px 12px',fontSize:12,fontWeight:500,
                          cursor:'pointer',display:'inline-flex',alignItems:'center',gap:4
                        }}>
                        Go to Pool tab → top up
                      </button>
                    </div>
                  </div>
                )}

                <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap',alignItems:'center'}}>
                  {/* Smart button: changes based on balance state */}
                  {available <= 0 ? (
                    /* Zero balance — direct pool CTA */
                    <button className="btn btn-gold"
                      style={{background:'#BA7517',color:'#fff'}}
                      onClick={() => navigate('/pool')}>
                      💚 Top up your balance to bet → Pool
                    </button>
                  ) : overBudget ? (
                    /* Has some balance but not enough */
                    <button className="btn"
                      style={{background:'#c0392b',color:'#fff'}}
                      onClick={() => navigate('/pool')}>
                      ⚠ Insufficient — top up in Pool tab →
                    </button>
                  ) : (
                    /* Normal flow */
                    <button className="btn btn-green"
                      onClick={() => placeBet(m.id)}
                      disabled={!hasPicks}>
                      Confirm bets
                      {pct > 0 && totalWin > 0 && (
                        <span style={{fontSize:11,opacity:.85,marginLeft:6}}>
                          · ♡ {eduAmt.toFixed(2)} LB → 🎓
                        </span>
                      )}
                    </button>
                  )}

                  <button className="btn btn-ghost"
                    onClick={() => setStatsFor(statsFor === m.id ? null : m.id)}>
                    <i className="ti ti-chart-pie" aria-hidden="true" style={{marginRight:4}} />View stats
                  </button>

                  {/* Inline balance hint */}
                  {available <= 0 && (
                    <span style={{fontSize:11,color:'#888',marginLeft:'auto'}}>
                      💡 Your betting balance is ♡ 0 LB — commit to the pool first
                    </span>
                  )}
                </div>
              </>
            )}

            {m.status === 'UPCOMING' && (
              <div className="email-pill">
                <i className="ti ti-mail" aria-hidden="true" style={{marginRight:4}} />
                You'll get an email 12h before betting opens
              </div>
            )}
            {(m.status === 'BETTING_CLOSED' || m.status === 'LIVE') && (
              <div style={{fontSize:12,color:'#888',marginTop:8}}>
                Betting is closed. {m.status === 'LIVE' ? 'Match in progress.' : 'Awaiting results.'}
              </div>
            )}

            {statsFor === m.id && <BetStats matchId={m.id} />}
          </div>
        );
      })}

      <LowBalanceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        reason={modalReason}
        available={available}
        needed={modalNeeded}
        isFirstTime={modalReason === 'first_time'}
      />
    </div>
  );
}
