// src/pages/TournamentPage.jsx — tournament-wide parimutuel bets
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { useToast } from '../hooks/useToast.jsx';

const fmt = (n) => '♡ ' + Number(n||0).toLocaleString('en-IN', { maximumFractionDigits:2 }) + ' LB';

export default function TournamentPage() {
  const { user, refreshMe } = useAuth();
  const { toast, Toast }    = useToast();
  const navigate            = useNavigate();

  const [questions, setQuestions] = useState([]);
  const [myBets,    setMyBets]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [picks,     setPicks]     = useState({});   // questionId -> optionId
  const [amounts,   setAmounts]   = useState({});   // questionId -> amount
  const [eduPct,    setEduPct]    = useState({});   // questionId -> %
  const [saving,    setSaving]    = useState({});

  const available = (user?.balance || 0) - (user?.committed || 0);

  const load = useCallback(() => {
    Promise.all([api.getTournamentQuestions(), api.getMyTournamentBets()])
      .then(([qs, mine]) => { setQuestions(qs); setMyBets(mine); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => api.getTournamentQuestions().then(setQuestions).catch(()=>{}), 5000);
    return () => clearInterval(t);
  }, [load]);

  const myBetForQ = (qId) => myBets.find(b => b.tournamentQuestionId === qId);

  function projWin(q, optionId, stake) {
    const o = q.options.find(x => x.optionId === optionId);
    if (!o) return 0;
    const newStaked = (o.staked || 0) + stake;
    const newPool   = (q.totalPool || 0) + stake;
    const mult = newStaked > 0 ? newPool / newStaked : 1;
    return stake * mult;
  }

  async function place(q) {
    const optionId = picks[q.questionId];
    const amt = parseFloat(amounts[q.questionId]);
    if (!optionId) { toast('Pick an option first'); return; }
    if (!amt || amt <= 0) { toast('Enter a stake'); return; }
    if (amt < q.minStake) { toast(`Minimum is ${fmt(q.minStake)}`); return; }
    if (amt > available) {
      toast('Not enough balance — top up in Pool');
      return;
    }
    setSaving(s => ({ ...s, [q.questionId]: true }));
    try {
      await api.tournamentBet(q.questionId, optionId, amt, eduPct[q.questionId] ?? 5);
      toast('Tournament love placed!');
      setPicks(p => { const n={...p}; delete n[q.questionId]; return n; });
      setAmounts(a => { const n={...a}; delete n[q.questionId]; return n; });
      load(); refreshMe();
    } catch (e) {
      if (/balance/i.test(e.message)) { toast('Not enough balance — top up in Pool'); }
      else toast(e.message);
    } finally {
      setSaving(s => ({ ...s, [q.questionId]: false }));
    }
  }

  if (loading) return <div style={{padding:20,color:'#888'}}>Loading tournament loves…</div>;

  return (
    <div>
      <Toast />
      <div style={{ marginBottom:16 }}>
        <h2 style={{ margin:'0 0 4px', fontSize:20, fontWeight:600 }}>🏆 Tournament Loves</h2>
        <div style={{ fontSize:13, color:'#888' }}>
          Long-run loves that settle when the tournament ends — winner, top scorer, and more. Same parimutuel rules: the pool is split among winners.
        </div>
      </div>

      {available <= 0 && (
        <div style={{ background:'var(--gold-light)', border:'1px solid #f5d960', borderRadius:10, padding:'10px 14px', marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <span style={{ fontSize:13, color:'#854F0B' }}>💚 Your balance is ♡ 0 LB — commit to the pool to love.</span>
          <button className="btn btn-gold" style={{background:'var(--gold)',color:'#fff'}} onClick={() => navigate('/pool')}>Go to Pool →</button>
        </div>
      )}

      {questions.length === 0 && (
        <div className="card" style={{ textAlign:'center', color:'#888', padding:'30px 20px' }}>
          No tournament loves are open yet. Check back once the admin adds them.
        </div>
      )}

      {questions.map(q => {
        const mine = myBetForQ(q.questionId);
        const selected = picks[q.questionId];
        const amt = amounts[q.questionId] || '';
        const closed = q.settled || (q.closesAt && new Date() > new Date(q.closesAt));
        const pw = selected && amt ? projWin(q, selected, parseFloat(amt)||0) : 0;

        return (
          <div key={q.questionId} className="card" style={{ marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, flexWrap:'wrap', gap:6 }}>
              <div style={{ fontSize:15, fontWeight:600 }}>{q.text}</div>
              <span style={{ fontSize:11, color:'#888' }}>Pool: <strong style={{color:'var(--green)'}}>{fmt(q.totalPool)}</strong></span>
            </div>

            {mine && (
              <div style={{ fontSize:12, background:'var(--green-light)', color:'var(--green)', padding:'6px 10px', borderRadius:7, marginBottom:10 }}>
                ✓ Your love: <strong>{mine.picks[0]?.option?.label}</strong> · {fmt(mine.totalStake)} {q.settled ? '(settled)' : '— you can change it until it closes'}
              </div>
            )}

            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
              {q.options.map(o => {
                const isSel = selected === o.optionId;
                return (
                  <button key={o.optionId}
                    disabled={closed}
                    onClick={() => setPicks(p => ({ ...p, [q.questionId]: o.optionId }))}
                    className={`bet-opt${isSel ? ' selected' : ''}`}
                    style={{ minWidth:110, opacity: closed ? 0.5 : 1, textAlign:'center' }}>
                    <span className="opt-label">{o.label}</span>
                    <span className="opt-price" style={{ color:isSel?'#a8f0c0':'var(--green)', fontWeight:600, fontSize:13 }}>
                      {o.multiplier ? `${o.multiplier.toFixed(2)}×` : '—'}
                    </span>
                    <span className="opt-return" style={{ fontSize:10 }}>{fmt(o.staked)} · {(o.share||0).toFixed(0)}%</span>
                  </button>
                );
              })}
            </div>

            {q.settled ? (
              <div style={{ fontSize:12, color:'#888' }}>This question has been settled.</div>
            ) : closed ? (
              <div style={{ fontSize:12, color:'var(--red)' }}>Loving closed for this question.</div>
            ) : selected && (
              <div>
                <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', marginBottom:8 }}>
                  <label style={{ fontSize:12, color:'#888' }}>Stake:</label>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ color:'#888' }}>♡ </span>
                    <input type="number" min={q.minStake} step="10" placeholder={q.minStake}
                      value={amt} onChange={e => setAmounts(a => ({ ...a, [q.questionId]: e.target.value }))}
                      style={{ width:100, padding:'6px 8px', border:'1px solid #ddd', borderRadius:6, fontSize:14, fontWeight:500, background:'#fff', color:'#111' }} />
                  </div>
                  {pw > 0 && <span style={{ fontSize:12, color:'var(--green)', fontWeight:500 }}>→ ~{fmt(pw)}</span>}
                  <span style={{ fontSize:11, color:'#aaa' }}>min {fmt(q.minStake)}</span>
                </div>

                <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:10, flexWrap:'wrap' }}>
                  <label style={{ fontSize:12, color:'#888' }}>🎓 Donate {eduPct[q.questionId] ?? 5}% of winnings</label>
                  <input type="range" min="0" max="100" step="5"
                    value={eduPct[q.questionId] ?? 5}
                    onChange={e => setEduPct(ep => ({ ...ep, [q.questionId]: Number(e.target.value) }))}
                    style={{ flex:1, maxWidth:180 }} />
                </div>

                <button className="btn btn-green" disabled={saving[q.questionId]} onClick={() => place(q)}>
                  {saving[q.questionId] ? 'Placing…' : mine ? 'Update love' : 'Place tournament love'}
                </button>
              </div>
            )}

            <div style={{ fontSize:10, color:'#aaa', marginTop:8 }}>
              Odds move live as people love · locked &amp; split when the tournament settles
              {q.closesAt && ` · closes ${new Date(q.closesAt).toLocaleDateString('en-IN')}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}
