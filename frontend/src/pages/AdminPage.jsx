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
      toast('Settled! ' + res.settled + ' bets processed.');
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

  useEffect(() => {
    api.getAdmins().then(setAdmins);
    api.getMatches().then(ms => { setMatches(ms); if(ms.length) setSelMatch(ms[0].id); });
    api.getAllUsers().then(setAllUsers);
    if (user?.isRootAdmin) api.listInvites().then(setInvites).catch(() => {});
  }, [user?.isRootAdmin]);

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

      {/* Bet questions */}
      <div className="admin-section">
        <div style={{fontSize:14,fontWeight:500,marginBottom:4}}>Set bet questions</div>
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

        {questions.map((q,qi) => (
          <div key={qi} style={{background:'#f8f8f8',borderRadius:8,padding:10,marginBottom:8}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
              <span style={{fontSize:12,fontWeight:500}}>Q{qi+1}</span>
              <button style={{fontSize:11,color:'#c0392b',background:'none',border:'none',cursor:'pointer'}} onClick={() => removeQ(qi)}>Remove</button>
            </div>
            <input placeholder="Question text" value={q.text} onChange={e => setQ(qi,'text',e.target.value)}
              style={{width:'100%',padding:'7px 9px',border:'0.5px solid #ddd',borderRadius:6,fontSize:13,marginBottom:8,background:'#fff'}} />
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <label style={{fontSize:12,color:'#888'}}>Minimum stake ₹</label>
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
                  <td>₹{u.balance.toFixed(2)}</td>
                  <td style={{color:'#c0392b'}}>₹{u.committed.toFixed(2)}</td>
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
