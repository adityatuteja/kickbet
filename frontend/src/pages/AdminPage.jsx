// src/pages/AdminPage.jsx
import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { useToast } from '../hooks/useToast.jsx';
import { useAuth } from '../lib/AuthContext.jsx';

const BLANK_Q = { text:'', order:1, minStake:10, options:[{label:''},{label:''}] };

function SettleMatchPanel({ matches, onSettled, toast }) {
  const [selMatch,    setSelMatch]    = useState('');
  const [questions,   setQuestions]   = useState([]);
  const [correctOpts, setCorrectOpts] = useState({});
  const [settling,    setSettling]    = useState(false);

  async function loadMatch(id) {
    setSelMatch(id);
    setCorrectOpts({});
    if (!id) { setQuestions([]); return; }
    const res = await api.getResults(id).catch(() => null);
    setQuestions(res?.questions || []);
  }

  async function settle() {
    if (!selMatch) { toast('Select a match'); return; }
    const unanswered = questions.filter(q => !correctOpts[q.id]);
    if (unanswered.length) { toast('Select correct answer for: ' + unanswered[0].text); return; }
    if (!window.confirm('Settle this match? Balances will be updated and emails sent.')) return;
    setSettling(true);
    try {
      const res = await api.settleMatch(selMatch, correctOpts);
      toast('Settled! ' + res.settled + ' loves processed.');
      onSettled?.();
    } catch(e) { toast(e.message); }
    finally { setSettling(false); }
  }

  return (
    <div className="admin-section" style={{borderTop:'2px solid #e8f5ed'}}>
      <div style={{fontSize:14,fontWeight:500,marginBottom:12,color:'#1a7a3c'}}>
        ⚽ Settle match results
      </div>
      <div style={{fontSize:12,color:'#888',marginBottom:12}}>
        Select the correct answer for each question. Balances update instantly and each user gets a result email.
      </div>
      <div className="field" style={{marginBottom:12}}>
        <label>Match to settle</label>
        <select value={selMatch} onChange={e => loadMatch(e.target.value)}>
          <option value="">Select match…</option>
          {matches.filter(m => m.status !== 'COMPLETED').map(m => (
            <option key={m.id} value={m.id}>{m.homeFlag} {m.homeTeam} vs {m.awayFlag} {m.awayTeam}</option>
          ))}
        </select>
      </div>

      {questions.map(q => (
        <div key={q.id} style={{background:'#f8f8f8',borderRadius:8,padding:'10px 12px',marginBottom:8}}>
          <div style={{fontSize:12,fontWeight:500,marginBottom:8}}>{q.text}</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {q.options.map(o => (
              <button key={o.id}
                onClick={() => setCorrectOpts(c => ({ ...c, [q.id]: o.id }))}
                style={{
                  padding:'5px 14px',fontSize:12,borderRadius:16,border:'1px solid #ddd',cursor:'pointer',
                  background: correctOpts[q.id]===o.id ? '#1a7a3c' : '#fff',
                  color:      correctOpts[q.id]===o.id ? '#fff'    : '#333',
                  fontWeight: correctOpts[q.id]===o.id ? 500       : 400,
                }}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {questions.length > 0 && (
        <button className="btn btn-green" onClick={settle} disabled={settling} style={{marginTop:4}}>
          {settling ? 'Settling…' : 'Settle & notify all players'}
        </button>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { toast, Toast } = useToast();
  const { user } = useAuth();
  const [admins,    setAdmins]    = useState([]);
  const [matches,   setMatches]   = useState([]);
  const [allUsers,  setAllUsers]  = useState([]);
  const [newAdmin,  setNewAdmin]  = useState('');
  const [selMatch,  setSelMatch]  = useState('');
  const [questions, setQuestions] = useState([{ ...BLANK_Q }]);
  const [newMatch,  setNewMatch]  = useState({ homeTeam:'',awayTeam:'',homeFlag:'',awayFlag:'',kickoffAt:'',stage:'Group Stage' });

  // Invites (root admin only)
  const [invites,    setInvites]    = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const isRoot = !!user?.isRootAdmin;

  // Match presets + tournament questions
  const [matchPresets, setMatchPresets] = useState([]);
  const [tournQs,   setTournQs]   = useState([]);
  const [tPresets,  setTPresets]  = useState([]);
  const [newTQ,     setNewTQ]     = useState({ text:'', minStake:100, options:['',''], closesAt:'' });

  useEffect(() => {
    api.getAdmins().then(setAdmins);
    api.getMatches().then(ms => { setMatches(ms); if(ms.length) setSelMatch(ms[0].id); });
    api.getAllUsers().then(setAllUsers);
    api.getTournamentQuestions().then(setTournQs).catch(()=>{});
    api.getTournamentPresets().then(d => setTPresets(d.tournament || [])).catch(()=>{});
    if (user?.isRootAdmin) api.listInvites().then(setInvites).catch(() => {});
  }, [user?.isRootAdmin]);

  // Load match presets when selected match changes
  useEffect(() => {
    if (selMatch) api.getMatchPresets(selMatch).then(setMatchPresets).catch(()=>setMatchPresets([]));
  }, [selMatch]);

  // Add a preset to the current match-question builder
  function addPresetToBuilder(preset) {
    setQuestions(qs => [
      ...qs.filter(q => q.text.trim() || q.options.some(o => o.label.trim())), // keep filled ones
      { text: preset.text, order: qs.length+1, minStake: preset.minStake, options: preset.options.map(label => ({ label })) }
    ]);
    toast('Added: ' + preset.text);
  }

  // Tournament question CRUD
  function tPresetToForm(p) {
    setNewTQ({
      text: p.text, minStake: p.minStake,
      options: p.options.length ? [...p.options] : ['',''],
      closesAt: ''
    });
    toast('Loaded preset — fill in options if needed, then add');
  }
  async function createTournQ() {
    const opts = newTQ.options.map(o => o.trim()).filter(Boolean);
    if (!newTQ.text.trim() || opts.length < 2) { toast('Need a question and 2+ options'); return; }
    try {
      await api.createTournamentQuestion({ text:newTQ.text, minStake:newTQ.minStake, options:opts, closesAt:newTQ.closesAt||null });
      toast('Tournament question added');
      setNewTQ({ text:'', minStake:100, options:['',''], closesAt:'' });
      api.getTournamentQuestions().then(setTournQs);
    } catch(e) { toast(e.message); }
  }
  async function deleteTournQ(id) {
    if (!window.confirm('Delete this tournament question?')) return;
    try { await api.deleteTournamentQuestion(id); toast('Deleted'); api.getTournamentQuestions().then(setTournQs); }
    catch(e) { toast(e.message); }
  }
  async function settleTournQ(q) {
    const optId = window.prompt(`Settle "${q.text}"\n\nEnter the WINNING option label exactly, or leave blank to void:\n\n${q.options.map(o=>o.label).join('\n')}`);
    if (optId === null) return;
    const winner = q.options.find(o => o.label.toLowerCase() === optId.trim().toLowerCase());
    if (optId.trim() && !winner) { toast('No option matches that label'); return; }
    try {
      await api.settleTournamentQuestion(q.questionId, winner ? winner.optionId : null);
      toast('Settled');
      api.getTournamentQuestions().then(setTournQs);
    } catch(e) { toast(e.message); }
  }

  async function sendInvite() {
    const email = inviteEmail.trim();
    if (!email) { toast('Enter an email'); return; }
    try {
      const res = await api.createInvite(email);
      toast('Invite created for ' + email);
      setInviteEmail('');
      api.listInvites().then(setInvites);
      // copy link to clipboard for convenience
      if (res.invite?.link) {
        navigator.clipboard?.writeText(res.invite.link).catch(() => {});
        toast('Invite link copied to clipboard');
      }
    } catch(e) { toast(e.message); }
  }

  async function revokeInvite(id) {
    try { await api.revokeInvite(id); toast('Invite revoked'); api.listInvites().then(setInvites); }
    catch(e) { toast(e.message); }
  }

  async function promote() {
    if (!newAdmin.trim()) return;
    try { await api.promote(newAdmin.trim()); toast('Promoted ' + newAdmin); setNewAdmin(''); api.getAdmins().then(setAdmins); }
    catch(e) { toast(e.message); }
  }
  async function demote(username) {
    try { await api.demote(username); toast('Demoted ' + username); api.getAdmins().then(setAdmins); }
    catch(e) { toast(e.message); }
  }

  function setQ(i, field, val) {
    setQuestions(qs => qs.map((q,qi) => qi===i ? {...q,[field]:val} : q));
  }
  function setOpt(qi, oi, field, val) {
    setQuestions(qs => qs.map((q,i) => i===qi ? {...q, options:q.options.map((o,j) => j===oi ? {...o,[field]:val} : o)} : q));
  }
  function addOpt(qi) {
    setQuestions(qs => qs.map((q,i) => i===qi ? {...q, options:[...q.options,{label:''}]} : q));
  }
  function addQ() {
    if (questions.length >= 10) { toast('Max 10 questions per match'); return; }
    setQuestions(qs => [...qs, {...BLANK_Q, order: qs.length+1}]);
  }
  function removeQ(i) { setQuestions(qs => qs.filter((_,qi) => qi!==i)); }

  async function saveQuestions() {
    if (!selMatch) { toast('Select a match first'); return; }
    try {
      const res = await api.setQuestions(selMatch, questions.map((q,i) => ({...q, order:i+1, options:q.options.filter(o=>o.label)})));
      toast('Saved & notified ' + res.notified + ' users');
    } catch(e) { toast(e.message); }
  }

  async function createMatch() {
    try {
      const m = await api.createMatch(newMatch);
      toast('Match created: ' + m.homeTeam + ' vs ' + m.awayTeam);
      api.getMatches().then(setMatches);
    } catch(e) { toast(e.message); }
  }

  async function changeStatus(id, status) {
    try { await api.updateStatus(id, status); toast('Status updated'); api.getMatches().then(setMatches); }
    catch(e) { toast(e.message); }
  }

  return (
    <div>
      <Toast />

      {/* Admin users */}
      <div className="admin-section">
        <div style={{fontSize:14,fontWeight:500,marginBottom:12}}>Admin users</div>
        <div style={{marginBottom:12,flexWrap:'wrap',display:'flex',gap:6}}>
          {admins.map(a => (
            <span key={a.id} className="admin-tag">
              {a.isRootAdmin && <span title="Root admin" style={{marginRight:2}}>👑</span>}
              {a.alias} ({a.username})
              {isRoot && !a.isRootAdmin && (
                <span style={{cursor:'pointer',opacity:.7,marginLeft:4}} title="Demote" onClick={() => demote(a.username)}>×</span>
              )}
            </span>
          ))}
        </div>

        {isRoot ? (
          <>
            <div style={{fontSize:13,fontWeight:500,marginBottom:6,color:'#1a7a3c'}}>
              🛡️ Invite a new admin
            </div>
            <div style={{fontSize:12,color:'#888',marginBottom:10}}>
              Only you (the root admin) can onboard admins. Enter their email — they'll get a one-time invite link to create an admin account. The link is also copied to your clipboard so you can share it directly.
            </div>
            <div className="inline-row" style={{marginBottom:14}}>
              <input type="email" placeholder="new-admin@email.com" value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)} />
              <button className="btn btn-green" onClick={sendInvite}>Send invite</button>
            </div>

            {invites.length > 0 && (
              <>
                <div style={{fontSize:12,fontWeight:500,color:'#888',marginBottom:6}}>Invitations</div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {invites.map(inv => {
                    const badge = {
                      PENDING:  { bg:'#fffbe8', color:'#854F0B', label:'Pending' },
                      ACCEPTED: { bg:'#e8f5ed', color:'#1a7a3c', label:'✓ Accepted' },
                      REVOKED:  { bg:'#fceaea', color:'#c0392b', label:'Revoked' },
                      EXPIRED:  { bg:'#f0f0f0', color:'#888',    label:'Expired' },
                    }[inv.status] || { bg:'#f0f0f0', color:'#888', label:inv.status };
                    return (
                      <div key={inv.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#f8f8f8',borderRadius:8,padding:'8px 10px',flexWrap:'wrap',gap:8}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                          <span style={{fontSize:13,fontWeight:500}}>{inv.email}</span>
                          <span style={{fontSize:11,background:badge.bg,color:badge.color,padding:'2px 8px',borderRadius:8,fontWeight:500}}>{badge.label}</span>
                          <span style={{fontSize:11,color:'#aaa'}}>by {inv.createdBy?.alias}</span>
                        </div>
                        <div style={{display:'flex',gap:6}}>
                          {inv.status === 'PENDING' && (
                            <>
                              <button onClick={() => { navigator.clipboard?.writeText(inv.link); toast('Link copied'); }}
                                style={{fontSize:11,padding:'4px 10px',border:'1px solid #1a7a3c',borderRadius:6,background:'#fff',color:'#1a7a3c',cursor:'pointer'}}>
                                Copy link
                              </button>
                              <button onClick={() => revokeInvite(inv.id)}
                                style={{fontSize:11,padding:'4px 10px',border:'1px solid #ddd',borderRadius:6,background:'#fff',color:'#c0392b',cursor:'pointer'}}>
                                Revoke
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        ) : (
          <div style={{fontSize:12,color:'#888',background:'#f8f8f8',borderRadius:8,padding:'10px 12px'}}>
            Only the root admin (👑) can invite or remove admins.
          </div>
        )}
      </div>

      {/* Create match */}
      <div className="admin-section">
        <div style={{fontSize:14,fontWeight:500,marginBottom:12}}>Create new match</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
          {[['homeTeam','Home team'],['awayTeam','Away team'],['homeFlag','Home flag 🇧🇷'],['awayFlag','Away flag 🇩🇪']].map(([k,l]) => (
            <div className="field" key={k} style={{marginBottom:0}}>
              <label>{l}</label>
              <input value={newMatch[k]} onChange={e => setNewMatch(m => ({...m,[k]:e.target.value}))} />
            </div>
          ))}
        </div>
        <div className="field">
          <label>Kickoff date &amp; time</label>
          <input type="datetime-local" value={newMatch.kickoffAt} onChange={e => setNewMatch(m => ({...m,kickoffAt:e.target.value}))} />
        </div>
        <div className="field"><label>Stage</label>
          <input value={newMatch.stage} onChange={e => setNewMatch(m => ({...m,stage:e.target.value}))} />
        </div>
        <button className="btn btn-green" onClick={createMatch}>Create match</button>
      </div>

      {/* Love questions */}
      <div className="admin-section">
        <div style={{fontSize:14,fontWeight:500,marginBottom:4}}>Set love questions</div>
        <div style={{fontSize:12,color:'#888',marginBottom:12,background:'#e8f5ed',padding:'8px 10px',borderRadius:7}}>
          💡 Odds are <strong>parimutuel</strong> — you don't set multipliers. Winners split the whole pool in proportion to their stake. Just set the question, the options, and a minimum stake per question.
        </div>
        <div className="field">
          <label>Match</label>
          <select value={selMatch} onChange={e => setSelMatch(e.target.value)}>
            {matches.map(m => (
              <option key={m.id} value={m.id}>{m.homeFlag} {m.homeTeam} vs {m.awayFlag} {m.awayTeam}</option>
            ))}
          </select>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <div style={{fontSize:12,color:'#888'}}>Match status</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {['UPCOMING','BETTING_OPEN','BETTING_CLOSED','COMPLETED'].map(s => (
              <button key={s} className="btn btn-ghost" style={{fontSize:11,padding:'4px 10px'}}
                onClick={() => changeStatus(selMatch, s)}>{s}</button>
            ))}
          </div>
        </div>

        {matchPresets.length > 0 && (
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, color:'#888', marginBottom:6 }}>⚡ Quick-add preset questions:</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {matchPresets.map(p => (
                <button key={p.key} onClick={() => addPresetToBuilder(p)}
                  style={{ fontSize:11, padding:'5px 10px', border:'1px solid var(--green)', borderRadius:14, background:'var(--green-light)', color:'var(--green)', cursor:'pointer' }}>
                  + {p.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {questions.map((q,qi) => (
          <div key={qi} style={{background:'#f8f8f8',borderRadius:8,padding:10,marginBottom:8}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
              <span style={{fontSize:12,fontWeight:500}}>Q{qi+1}</span>
              <button style={{fontSize:11,color:'#c0392b',background:'none',border:'none',cursor:'pointer'}} onClick={() => removeQ(qi)}>Remove</button>
            </div>
            <input placeholder="Question text" value={q.text} onChange={e => setQ(qi,'text',e.target.value)}
              style={{width:'100%',padding:'7px 9px',border:'0.5px solid #ddd',borderRadius:6,fontSize:13,marginBottom:8,background:'#fff'}} />
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <label style={{fontSize:12,color:'#888'}}>Minimum stake ♡ </label>
              <input placeholder="10" type="number" value={q.minStake ?? ''} onChange={e => setQ(qi,'minStake',e.target.value)}
                style={{width:90,padding:'6px 8px',border:'0.5px solid #ddd',borderRadius:6,fontSize:12,background:'#fff'}} />
            </div>
            {q.options.map((o,oi) => (
              <div key={oi} style={{display:'flex',gap:6,marginBottom:6}}>
                <input placeholder="Option label (e.g. Brazil)" value={o.label} onChange={e => setOpt(qi,oi,'label',e.target.value)}
                  style={{flex:1,padding:'6px 8px',border:'0.5px solid #ddd',borderRadius:6,fontSize:12,background:'#fff'}} />
              </div>
            ))}
            <button style={{fontSize:11,color:'#1a56c4',background:'none',border:'none',cursor:'pointer'}} onClick={() => addOpt(qi)}>+ Add option</button>
          </div>
        ))}
        <div style={{display:'flex',gap:8,marginTop:8}}>
          <button className="btn btn-ghost" onClick={addQ} disabled={questions.length>=10}>+ Add question</button>
          <button className="btn btn-green" onClick={saveQuestions}>Save &amp; notify users</button>
        </div>
      </div>

      {/* Settle results */}
      <SettleMatchPanel
        matches={matches}
        onSettled={() => api.getMatches().then(setMatches)}
        toast={toast}
      />

      {/* Tournament-wide loves */}
      <div className="admin-section">
        <div style={{fontSize:14,fontWeight:500,marginBottom:4}}>🏆 Tournament loves</div>
        <div style={{fontSize:12,color:'#888',marginBottom:12,background:'var(--green-light)',padding:'8px 10px',borderRadius:7}}>
          Long-run loves that span the whole tournament (winner, top scorer, etc.). Same parimutuel rules. Settle each when the tournament ends.
        </div>

        {/* Presets */}
        {tPresets.length > 0 && (
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, color:'#888', marginBottom:6 }}>⚡ Start from a preset:</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {tPresets.map(p => (
                <button key={p.key} onClick={() => tPresetToForm(p)}
                  style={{ fontSize:11, padding:'5px 10px', border:'1px solid var(--gold)', borderRadius:14, background:'var(--gold-light)', color:'var(--gold)', cursor:'pointer' }}>
                  + {p.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* New tournament question form */}
        <div style={{ background:'#f8f8f8', borderRadius:8, padding:12, marginBottom:12 }}>
          <input placeholder="Question (e.g. Who will win the World Cup?)" value={newTQ.text}
            onChange={e => setNewTQ(t => ({ ...t, text:e.target.value }))}
            style={{ width:'100%', padding:'8px 10px', border:'0.5px solid #ddd', borderRadius:6, fontSize:13, marginBottom:8, background:'#fff' }} />
          <div style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center', flexWrap:'wrap' }}>
            <label style={{ fontSize:12, color:'#888' }}>Min stake ♡ </label>
            <input type="number" value={newTQ.minStake} onChange={e => setNewTQ(t => ({ ...t, minStake:e.target.value }))}
              style={{ width:90, padding:'6px 8px', border:'0.5px solid #ddd', borderRadius:6, fontSize:12, background:'#fff' }} />
            <label style={{ fontSize:12, color:'#888' }}>Closes (optional)</label>
            <input type="datetime-local" value={newTQ.closesAt} onChange={e => setNewTQ(t => ({ ...t, closesAt:e.target.value }))}
              style={{ padding:'6px 8px', border:'0.5px solid #ddd', borderRadius:6, fontSize:12, background:'#fff' }} />
          </div>
          {newTQ.options.map((o,i) => (
            <div key={i} style={{ display:'flex', gap:6, marginBottom:6 }}>
              <input placeholder={`Option ${i+1} (team or player name)`} value={o}
                onChange={e => setNewTQ(t => ({ ...t, options: t.options.map((x,j)=>j===i?e.target.value:x) }))}
                style={{ flex:1, padding:'6px 8px', border:'0.5px solid #ddd', borderRadius:6, fontSize:12, background:'#fff' }} />
              {newTQ.options.length > 2 && (
                <button onClick={() => setNewTQ(t => ({ ...t, options: t.options.filter((_,j)=>j!==i) }))}
                  style={{ fontSize:11, color:'var(--red)', background:'none', border:'none', cursor:'pointer' }}>×</button>
              )}
            </div>
          ))}
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <button className="btn btn-ghost" onClick={() => setNewTQ(t => ({ ...t, options:[...t.options,''] }))}>+ Add option</button>
            <button className="btn btn-green" onClick={createTournQ}>Add tournament question</button>
          </div>
        </div>

        {/* Existing tournament questions */}
        {tournQs.map(q => (
          <div key={q.questionId} style={{ border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:8, padding:10, marginBottom:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:500 }}>{q.text}</div>
                <div style={{ fontSize:11, color:'#888', marginTop:2 }}>
                  {q.options.map(o => `${o.label} (${q.totalPool ? ((o.staked/q.totalPool*100)||0).toFixed(0) : 0}%)`).join(' · ')}
                </div>
                <div style={{ fontSize:11, color:'#888', marginTop:2 }}>Pool: ♡ {(q.totalPool||0).toLocaleString('en-IN')} LB · {q.settled ? '✓ settled' : 'open'}</div>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                {!q.settled && <button className="btn btn-green" style={{fontSize:11,padding:'4px 10px'}} onClick={() => settleTournQ(q)}>Settle</button>}
                <button className="btn btn-ghost" style={{fontSize:11,padding:'4px 10px',color:'var(--red)'}} onClick={() => deleteTournQ(q.questionId)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
        {tournQs.length === 0 && <div style={{ fontSize:12, color:'#aaa' }}>No tournament questions yet.</div>}
      </div>

      {/* All users */}
      <div className="admin-section">
        <div style={{fontSize:14,fontWeight:500,marginBottom:12}}>All users</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Username</th><th>Alias</th><th>Email</th><th>Balance</th><th>Committed</th><th>Admin</th></tr>
            </thead>
            <tbody>
              {allUsers.map(u => (
                <tr key={u.id}>
                  <td style={{fontFamily:'monospace',fontSize:12}}>{u.username}</td>
                  <td><span className="alias-badge">{u.alias}</span></td>
                  <td style={{fontSize:12,color:'#888'}}>{u.email}</td>
                  <td>♡ {u.balance.toFixed(2)} LB</td>
                  <td style={{color:'#c0392b'}}>♡ {u.committed.toFixed(2)} LB</td>
                  <td>{u.isAdmin ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
