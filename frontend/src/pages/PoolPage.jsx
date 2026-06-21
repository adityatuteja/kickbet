// src/pages/PoolPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { useToast } from '../hooks/useToast.jsx';
import PaymentMethodCard from '../components/PaymentMethodCard.jsx';

const MIN = 2000;

function fmtINR(n) {
  return '♡ ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' LB';
}
function fmtDate(d) {
  return new Date(d).toLocaleString('en-IN', { dateStyle:'short', timeStyle:'short' });
}

function ReceiptBadge({ status }) {
  const map = {
    PENDING:      { bg:'#f0f0f0', color:'#888',    label:'Pending' },
    RECEIVED:     { bg:'#e8f5ed', color:'#1a7a3c', label:'✓ Received' },
    PARTIAL:      { bg:'#fffbe8', color:'#854F0B', label:'⚡ Partial' },
    NOT_RECEIVED: { bg:'#fceaea', color:'#c0392b', label:'✗ Not received' },
  };
  const s = map[status] || map.PENDING;
  return (
    <span style={{fontSize:11,background:s.bg,color:s.color,padding:'2px 9px',borderRadius:8,fontWeight:500,whiteSpace:'nowrap'}}>
      {s.label}
    </span>
  );
}

function AcknowledgeRow({ txn, onDone, toast }) {
  const [open,     setOpen]     = useState(false);
  const [status,   setStatus]   = useState(txn.receiptStatus || 'PENDING');
  const [amt,      setAmt]      = useState(txn.amountReceived || txn.amount);
  const [note,     setNote]     = useState(txn.adminNote || '');
  const [saving,   setSaving]   = useState(false);

  // only pledge transactions need acknowledgement
  if (txn.type !== 'USER_PLEDGE') return null;

  async function save() {
    if ((status === 'RECEIVED' || status === 'PARTIAL') && (!amt || parseFloat(amt) <= 0)) {
      toast('Enter amount received'); return;
    }
    setSaving(true);
    try {
      await api.acknowledge(txn.id, status, parseFloat(amt) || 0, note);
      toast('Acknowledged ' + txn.commitmentId);
      setOpen(false);
      onDone();
    } catch(e) { toast(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{borderTop:'0.5px solid rgba(0,0,0,0.06)',paddingTop:8,marginTop:4}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <span style={{fontSize:12,color:'#888'}}>{fmtDate(txn.createdAt)}</span>
          <span style={{fontSize:13,fontWeight:500}}>{fmtINR(txn.amount)}</span>
          {txn.note && <span style={{fontSize:12,color:'#aaa'}}>"{txn.note}"</span>}
          <ReceiptBadge status={txn.receiptStatus} />
          {txn.amountReceived != null && txn.amountReceived !== txn.amount && (
            <span style={{fontSize:11,color:'#888'}}>Received {fmtINR(txn.amountReceived)}</span>
          )}
          {txn.adminNote && <span style={{fontSize:11,color:'#888',fontStyle:'italic'}}>— {txn.adminNote}</span>}
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          style={{fontSize:11,padding:'3px 10px',border:'0.5px solid #ddd',borderRadius:8,background:'transparent',cursor:'pointer',color:'#555'}}>
          {open ? 'Cancel' : txn.receiptStatus==='PENDING' ? 'Acknowledge' : 'Update'}
        </button>
      </div>

      {open && (
        <div style={{marginTop:10,background:'#f8f8f8',borderRadius:8,padding:'10px 12px'}}>
          <div style={{fontSize:12,color:'#888',marginBottom:8}}>
            User pledged <strong>{fmtINR(txn.amount)}</strong> — mark receipt status:
          </div>

          {/* Status selector */}
          <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap'}}>
            {[
              ['RECEIVED',     '✓ Received in full', '#e8f5ed', '#1a7a3c'],
              ['PARTIAL',      '⚡ Partial',          '#fffbe8', '#854F0B'],
              ['NOT_RECEIVED', '✗ Not received',     '#fceaea', '#c0392b'],
            ].map(([val, label, bg, color]) => (
              <button key={val} onClick={() => setStatus(val)} style={{
                padding:'6px 14px', fontSize:12, borderRadius:16, cursor:'pointer',
                border: `1px solid ${color}40`,
                background: status === val ? bg : '#fff',
                color: status === val ? color : '#888',
                fontWeight: status === val ? 500 : 400,
              }}>{label}</button>
            ))}
          </div>

          {/* Amount received — shown for RECEIVED and PARTIAL */}
          {(status === 'RECEIVED' || status === 'PARTIAL') && (
            <div style={{display:'flex',gap:8,marginBottom:8,alignItems:'center'}}>
              <label style={{fontSize:12,color:'#888',whiteSpace:'nowrap'}}>Amount received:</label>
              <div style={{display:'flex',alignItems:'center',gap:4,background:'#fff',border:'1px solid #ddd',borderRadius:7,padding:'0 8px',flex:1,maxWidth:180}}>
                <span style={{color:'#888'}}>♡ </span>
                <input type="number" min="0" step="100"
                  value={amt} onChange={e => setAmt(e.target.value)}
                  style={{border:'none',background:'transparent',padding:'6px 4px',fontSize:13,fontWeight:500,outline:'none',width:'100%',color:'#111'}} />
              </div>
              {status === 'PARTIAL' && parseFloat(amt) > 0 && (
                <span style={{fontSize:12,color:'#854F0B'}}>
                  Still owed: {fmtINR(txn.amount - parseFloat(amt))}
                </span>
              )}
            </div>
          )}

          {/* Admin note */}
          <div style={{display:'flex',gap:8,marginBottom:10,alignItems:'center'}}>
            <label style={{fontSize:12,color:'#888',whiteSpace:'nowrap'}}>Note:</label>
            <input placeholder="e.g. Received in cash on Saturday"
              value={note} onChange={e => setNote(e.target.value)}
              style={{flex:1,padding:'6px 10px',border:'1px solid #ddd',borderRadius:7,fontSize:12,background:'#fff',color:'#111'}} />
          </div>

          <button className="btn btn-green" onClick={save} disabled={saving} style={{fontSize:12,padding:'6px 16px'}}>
            {saving ? 'Saving…' : 'Save acknowledgement'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function PoolPage() {
  const { user, refreshMe } = useAuth();
  const { toast, Toast }    = useToast();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  // pledge form
  const [pledgeAmt,  setPledgeAmt]  = useState('');
  const [pledgeNote, setPledgeNote] = useState('');
  const [pledging,   setPledging]   = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);

  useEffect(() => { api.getPaymentMethods().then(setPaymentMethods).catch(() => {}); }, []);

  // transfer form
  const [toUserId, setToUserId] = useState('');
  const [txAmt,    setTxAmt]    = useState('');
  const [txNote,   setTxNote]   = useState('');
  const [sending,  setSending]  = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getPool().then(d => { setData(d); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const myCommitment = data?.commitments.find(c => c.userId === user?.id);
  const myCommitted  = myCommitment?.totalCommitted  || 0;
  const myConfirmed  = myCommitment?.totalConfirmed  || 0;
  const myPending    = myCommitted - myConfirmed;
  const isFirstTime  = !myCommitment;
  const available    = (user?.balance || 0) - (user?.committed || 0);

  async function doPledge() {
    const amt = parseFloat(pledgeAmt);
    if (!amt || amt <= 0)         { toast('Enter a valid amount'); return; }
    if (isFirstTime && amt < MIN) { toast('Minimum first commitment is ♡ 2,000 LB'); return; }
    if (!selectedPaymentMethod)   { toast('Select a drop-off'); return; }
    setPledging(true);
    try {
      await api.pledge(amt, pledgeNote, selectedPaymentMethod);
      toast(isFirstTime
        ? 'Welcome to the pool! ♡ ' + amt.toLocaleString('en-IN') + ' committed.'
        : 'Top-up committed: ♡ ' + amt.toLocaleString('en-IN'));
      setPledgeAmt(''); setPledgeNote(''); setSelectedPaymentMethod(null);
      load(); refreshMe();
    } catch(e) { toast(e.message); }
    finally { setPledging(false); }
  }

  async function doTransfer() {
    const amt = parseFloat(txAmt);
    if (!toUserId)        { toast('Select a recipient'); return; }
    if (!amt || amt <= 0) { toast('Enter a valid amount'); return; }
    setSending(true);
    try {
      const res = await api.transfer(toUserId, amt, txNote);
      toast('Sent ' + fmtINR(amt) + ' to ' + res.to);
      setTxAmt(''); setTxNote(''); setToUserId('');
      load(); refreshMe();
    } catch(e) { toast(e.message); }
    finally { setSending(false); }
  }

  if (loading) return <div style={{padding:20,color:'#888'}}>Loading pool…</div>;

  const otherUsers = data.allUsers.filter(u => u.id !== user?.id);
  const adminRecipients = data.admins || [];

  return (
    <div>
      <Toast />

      {/* ── Pool totals ─────────────────────────────────────────── */}
      <div className="metrics">
        {[
          ['Total committed',       fmtINR(data.totalCommitted),      '#1a7a3c'],
          ['Admin confirmed',       fmtINR(data.totalConfirmed),       '#1a56c4'],
          ['Pending confirmation',  fmtINR(data.pendingConfirmation),  '#854F0B'],
          ['Members',               data.commitments.length,           '#555'],
        ].map(([l,v,c]) => (
          <div key={l} className="metric">
            <div className="metric-label">{l}</div>
            <div className="metric-val" style={{color:c}}>{v}</div>
          </div>
        ))}
      </div>

      {/* ── My commitment card ───────────────────────────────────── */}
      <div className="card" style={{marginBottom:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div style={{fontSize:14,fontWeight:500}}>My pool commitment</div>
          <ReceiptBadge status={
            myCommitted === 0         ? 'PENDING'
            : myPending <= 0          ? 'RECEIVED'
            : myConfirmed > 0         ? 'PARTIAL'
            :                           'PENDING'
          } />
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:8,marginBottom:14}}>
          {[
            ['I committed',     fmtINR(myCommitted),       '#1a7a3c'],
            ['Admin confirmed', fmtINR(myConfirmed),        '#1a56c4'],
            ['Pending',         fmtINR(myPending),          '#854F0B'],
            ['Betting balance', fmtINR(user?.balance||0),   '#111'],
            ['Available',       fmtINR(available),           '#1a7a3c'],
          ].map(([l,v,c]) => (
            <div key={l} style={{background:'#f8f8f8',borderRadius:8,padding:'10px 12px'}}>
              <div style={{fontSize:11,color:'#888',marginBottom:3}}>{l}</div>
              <div style={{fontSize:16,fontWeight:500,color:c}}>{v}</div>
            </div>
          ))}
        </div>

        {/* Pledge form */}
        <div style={{borderTop:'0.5px solid rgba(0,0,0,0.08)',paddingTop:12}}>
          <div style={{fontSize:13,fontWeight:500,marginBottom:6}}>
            {isFirstTime ? 'Join the pool' : 'Top up my commitment'}
          </div>
          {isFirstTime && (
            <div style={{fontSize:12,color:'#854F0B',marginBottom:10,background:'#fffbe8',padding:'8px 10px',borderRadius:7,border:'1px solid #f5d960'}}>
              Minimum first commitment is <strong>♡ 2,000 LB</strong>. Pay the admin in person ("Love Bites") — then they confirm receipt and credits your betting balance.
            </div>
          )}

          {/* Step 1: amount */}
          <div style={{fontSize:11,color:'#888',fontWeight:500,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Step 1 · Amount</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:6}}>
            <div style={{display:'flex',alignItems:'center',gap:4,background:'#f8f8f8',border:'1px solid #ddd',borderRadius:8,padding:'0 10px',flex:1,minWidth:150}}>
              <span style={{color:'#888'}}>♡ </span>
              <input type="number" min={isFirstTime ? MIN : 1} step="1000"
                placeholder={isFirstTime ? '2,000 minimum' : 'Amount to add'}
                value={pledgeAmt} onChange={e => setPledgeAmt(e.target.value)}
                style={{flex:1,border:'none',background:'transparent',padding:'9px 4px',fontSize:14,fontWeight:500,outline:'none',color:'#111'}} />
            </div>
            <input placeholder="Reference / transaction note"
              value={pledgeNote} onChange={e => setPledgeNote(e.target.value)}
              style={{flex:1,minWidth:130,padding:'9px 10px',border:'1px solid #ddd',borderRadius:8,fontSize:13,background:'#fff',color:'#111'}} />
          </div>
          {!isFirstTime && parseFloat(pledgeAmt) > 0 && (
            <div style={{fontSize:12,color:'#888',marginBottom:6}}>
              Total after top-up: <strong style={{color:'#1a7a3c'}}>{fmtINR(myCommitted + parseFloat(pledgeAmt))}</strong>
            </div>
          )}

          {/* Step 2: pick payment method */}
          {parseFloat(pledgeAmt) > 0 && (
            <>
              <div style={{fontSize:11,color:'#888',fontWeight:500,textTransform:'uppercase',letterSpacing:.5,margin:'14px 0 6px'}}>Step 2 · Where to pay (Love Bites)</div>
              {paymentMethods.length === 0 && (
                <div style={{fontSize:12,color:'#888',background:'#fffbe8',padding:'8px 10px',borderRadius:7,border:'1px solid #f5d960',marginBottom:8}}>
                  ⚠ No Love Bites drop-off set up yet. Ask the admin to add one first.
                </div>
              )}
              {paymentMethods.map(m => (
                <PaymentMethodCard
                  key={m.id}
                  method={m}
                  selected={selectedPaymentMethod === m.id}
                  onSelect={() => setSelectedPaymentMethod(m.id)}
                  onCopied={(v) => toast('Copied: ' + v)}
                  compact
                />
              ))}
            </>
          )}

          {/* Step 3: confirm */}
          {parseFloat(pledgeAmt) > 0 && (
            <button className="btn btn-green"
              style={{marginTop:10,width:'100%'}}
              onClick={doPledge}
              disabled={pledging || !selectedPaymentMethod || (isFirstTime && parseFloat(pledgeAmt) < MIN)}>
              {pledging ? 'Saving…' :
                !selectedPaymentMethod  ? 'Select a drop-off ↑' :
                isFirstTime             ? `Commit ♡ ${parseFloat(pledgeAmt).toLocaleString('en-IN')} LB` :
                                          `Top up ♡ ${parseFloat(pledgeAmt).toLocaleString('en-IN')} LB`}
            </button>
          )}
          {parseFloat(pledgeAmt) > 0 && selectedPaymentMethod && (
            <div style={{fontSize:11,color:'#888',marginTop:6,textAlign:'center'}}>
              After you transfer, admin will acknowledge receipt and credit your balance.
            </div>
          )}
        </div>

        {/* My pledge history */}
        {myCommitment?.transactions?.filter(t => t.type==='USER_PLEDGE').length > 0 && (
          <div style={{marginTop:14,borderTop:'0.5px solid rgba(0,0,0,0.08)',paddingTop:12}}>
            <div style={{fontSize:12,fontWeight:500,color:'#888',marginBottom:8}}>My pledge history</div>
            {myCommitment.transactions.filter(t => t.type==='USER_PLEDGE').map(t => (
              <div key={t.id} style={{padding:'7px 0',borderTop:'0.5px solid rgba(0,0,0,0.05)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:6}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                    <span style={{color:'#aaa',fontSize:11}}>{fmtDate(t.createdAt)}</span>
                    <strong style={{fontSize:13}}>{fmtINR(t.amount)}</strong>
                    {t.paymentMethod && (
                      <span style={{fontSize:11,color:'#1a56c4',background:'#e8f0fe',padding:'2px 8px',borderRadius:8}}>
                        via {t.paymentMethod.label}
                      </span>
                    )}
                    {t.note && <span style={{color:'#888',fontSize:12}}>"{t.note}"</span>}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <ReceiptBadge status={t.receiptStatus} />
                  </div>
                </div>
                {t.receiptStatus==='PARTIAL' && t.amountReceived != null && (
                  <div style={{fontSize:11,color:'#854F0B',marginTop:4,marginLeft:0}}>
                    Admin received {fmtINR(t.amountReceived)} · still pending {fmtINR(t.amount - t.amountReceived)}
                  </div>
                )}
                {t.adminNote && <div style={{fontSize:11,color:'#888',fontStyle:'italic',marginTop:2}}>Admin note: {t.adminNote}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Transfer money to admin ──────────────────────────────── */}
      <div className="card" style={{marginBottom:12}}>
        <div style={{fontSize:14,fontWeight:500,marginBottom:4}}>Send money to admin</div>
        <div style={{fontSize:12,color:'#888',marginBottom:10}}>
          Transfers can only go to an admin. Available to send: <strong style={{color:'#1a7a3c'}}>{fmtINR(available)}</strong>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
          <div className="field" style={{marginBottom:0}}>
            <label>Admin recipient</label>
            <select value={toUserId} onChange={e => setToUserId(e.target.value)}>
              <option value="">Select admin…</option>
              {adminRecipients.map(a => <option key={a.id} value={a.id}>{a.alias}</option>)}
            </select>
          </div>
          <div className="field" style={{marginBottom:0}}>
            <label>Amount (♡ )</label>
            <input type="number" min="1" step="1" placeholder="0"
              value={txAmt} onChange={e => setTxAmt(e.target.value)} />
          </div>
        </div>
        <div className="field" style={{marginBottom:10}}>
          <label>Note (optional)</label>
          <input placeholder="e.g. Settling my pool dues"
            value={txNote} onChange={e => setTxNote(e.target.value)} />
        </div>
        {adminRecipients.length === 0 && (
          <div style={{fontSize:12,color:'#854F0B',background:'#fffbe8',padding:'8px 10px',borderRadius:7,border:'1px solid #f5d960',marginBottom:8}}>
            No admins available to receive transfers.
          </div>
        )}
        <button className="btn btn-green" onClick={doTransfer} disabled={sending || !adminRecipients.length}>
          {sending ? 'Sending…' : 'Send to admin'}
        </button>
      </div>


      {/* ── All members table ────────────────────────────────────── */}
      <div className="section-title"><i className="ti ti-users" aria-hidden="true" />All members</div>
      <div className="card" style={{padding:0,overflow:'hidden',marginBottom:12}}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th style={{textAlign:'right'}}>Committed</th>
                <th style={{textAlign:'right'}}>Confirmed</th>
                <th style={{textAlign:'right'}}>Pending</th>
                <th style={{textAlign:'right'}}>Balance</th>
                <th style={{textAlign:'right'}}>Available</th>
                <th style={{textAlign:'right',color:'#BA7517'}}>🎓 Girls Ed.</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.allUsers.map(u => {
                const c     = data.commitments.find(c => c.userId === u.id);
                const comm  = c?.totalCommitted || 0;
                const conf  = c?.totalConfirmed || 0;
                const pend  = comm - conf;
                const avail = u.balance - u.committed;
                const edu   = u.girlsEduTotal || 0;
                const receiptStatus = comm === 0 ? 'PENDING'
                                    : pend <= 0  ? 'RECEIVED'
                                    : conf > 0   ? 'PARTIAL'
                                    :              'PENDING';
                return (
                  <tr key={u.id} style={{background: u.id===user?.id?'#f0f9f4':'transparent'}}>
                    <td>
                      <span className="alias-badge">{u.alias}</span>
                      {u.id===user?.id && <span style={{fontSize:10,color:'#888',marginLeft:5}}>you</span>}
                    </td>
                    <td style={{textAlign:'right',color:'#1a7a3c',fontWeight:500}}>{comm>0?fmtINR(comm):'—'}</td>
                    <td style={{textAlign:'right',color:'#1a56c4'}}>{conf>0?fmtINR(conf):'—'}</td>
                    <td style={{textAlign:'right',color:pend>0?'#854F0B':'#aaa'}}>{pend>0?fmtINR(pend):'—'}</td>
                    <td style={{textAlign:'right',fontWeight:500}}>{fmtINR(u.balance)}</td>
                    <td style={{textAlign:'right',color:'#1a7a3c'}}>{fmtINR(avail)}</td>
                    <td style={{textAlign:'right',color:'#BA7517',fontWeight:500}}>{edu>0?fmtINR(edu):'—'}</td>
                    <td><ReceiptBadge status={receiptStatus} /></td>
                  </tr>
                );
              })}
              <tr style={{fontWeight:500,borderTop:'2px solid #e0e0e0',background:'#f8f8f8'}}>
                <td style={{fontSize:12,color:'#888'}}>Totals</td>
                <td style={{textAlign:'right',color:'#1a7a3c'}}>{fmtINR(data.totalCommitted)}</td>
                <td style={{textAlign:'right',color:'#1a56c4'}}>{fmtINR(data.totalConfirmed)}</td>
                <td style={{textAlign:'right',color:'#854F0B'}}>{fmtINR(data.pendingConfirmation)}</td>
                <td style={{textAlign:'right'}}>{fmtINR(data.allUsers.reduce((s,u)=>s+u.balance,0))}</td>
                <td style={{textAlign:'right',color:'#1a7a3c'}}>{fmtINR(data.allUsers.reduce((s,u)=>s+(u.balance-u.committed),0))}</td>
                <td style={{textAlign:'right',color:'#BA7517'}}>{fmtINR(data.allUsers.reduce((s,u)=>s+(u.girlsEduTotal||0),0))}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Admin: acknowledge each pledge ───────────────────────── */}
      {user?.isAdmin && (
        <>
          <div className="section-title"><i className="ti ti-shield" aria-hidden="true" />Admin — acknowledge commitments</div>
          <div style={{fontSize:12,color:'#888',marginBottom:12}}>
            For each pledge, mark whether you received the money, received it partially, or have not received it yet. Confirmed amounts are credited to the player's betting balance immediately.
          </div>
          {data.commitments.length === 0 && (
            <div style={{fontSize:13,color:'#aaa',padding:'12px 0'}}>No commitments yet.</div>
          )}
          {data.commitments.map(c => {
            const pledges = c.transactions.filter(t => t.type === 'USER_PLEDGE');
            if (!pledges.length) return null;
            const allReceived = pledges.every(t => t.receiptStatus === 'RECEIVED');
            const anyPending  = pledges.some(t  => t.receiptStatus === 'PENDING');
            return (
              <div key={c.id} className="card" style={{marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,flexWrap:'wrap',gap:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <span className="alias-badge">{c.user.alias}</span>
                    <span style={{fontSize:12,color:'#888'}}>
                      Committed {fmtINR(c.totalCommitted)} · Confirmed {fmtINR(c.totalConfirmed)}
                    </span>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    {anyPending && <span style={{fontSize:11,background:'#fffbe8',color:'#854F0B',padding:'2px 8px',borderRadius:8}}>Needs attention</span>}
                    {allReceived && <span style={{fontSize:11,background:'#e8f5ed',color:'#1a7a3c',padding:'2px 8px',borderRadius:8}}>All confirmed</span>}
                  </div>
                </div>
                {pledges.map(t => (
                  <AcknowledgeRow key={t.id} txn={t} onDone={load} toast={toast} />
                ))}
              </div>
            );
          })}
        </>
      )}

      {/* ── Recent transfers ─────────────────────────────────────── */}
      {data.transfers.length > 0 && (
        <>
          <div className="section-title" style={{marginTop:8}}><i className="ti ti-arrow-right" aria-hidden="true" />Recent transfers</div>
          <div className="card" style={{padding:0,overflow:'hidden'}}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>From</th><th>To</th><th style={{textAlign:'right'}}>Amount</th><th>Note</th><th>When</th></tr></thead>
                <tbody>
                  {data.transfers.map(t => (
                    <tr key={t.id}>
                      <td><span className="alias-badge">{t.fromUser.alias}</span></td>
                      <td><span className="alias-badge">{t.toUser.alias}</span></td>
                      <td style={{textAlign:'right',color:'#1a7a3c',fontWeight:500}}>{fmtINR(t.amount)}</td>
                      <td style={{fontSize:12,color:'#888'}}>{t.note||'—'}</td>
                      <td style={{fontSize:11,color:'#aaa'}}>{fmtDate(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
