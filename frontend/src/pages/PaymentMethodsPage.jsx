// src/pages/PaymentMethodsPage.jsx — admin only
// Single fixed option: "Want to make love" (in-person). No other methods.
import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { useToast } from '../hooks/useToast.jsx';
import PaymentMethodCard from '../components/PaymentMethodCard.jsx';

const BLANK = {
  type:'CASH',
  label:'Want to make love',
  cashAddress:'', cashContact:'', notes:'',
};

export default function PaymentMethodsPage() {
  const { toast, Toast } = useToast();
  const [methods,  setMethods]  = useState([]);
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState({ ...BLANK });
  const [showForm, setShowForm] = useState(false);

  function load() { api.getAllPaymentMethods().then(setMethods); }
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (!form.cashAddress.trim()) { toast('Add where to meet'); return; }
    const payload = {
      type: 'CASH',
      label: form.label?.trim() || 'Want to make love',
      cashAddress: form.cashAddress,
      cashContact: form.cashContact,
      notes: form.notes,
    };
    try {
      if (editing) { await api.updatePaymentMethod(editing, payload); toast('Updated'); }
      else         { await api.createPaymentMethod(payload);          toast('Added'); }
      setForm({ ...BLANK }); setEditing(null); setShowForm(false);
      load();
    } catch(e) { toast(e.message); }
  }

  function editMethod(m) {
    setForm({ ...BLANK, ...m, label: m.label || 'Want to make love' });
    setEditing(m.id); setShowForm(true);
  }

  async function toggleActive(id) { await api.togglePaymentMethod(id); load(); }

  async function del(id) {
    if (!window.confirm('Remove this? Players will no longer see it.')) return;
    try { await api.deletePaymentMethod(id); toast('Removed'); load(); }
    catch(e) { toast(e.message); }
  }

  return (
    <div>
      <Toast />

      <div className="section-title"><i className="ti ti-heart" aria-hidden="true" />Want to make love</div>
      <div style={{fontSize:12,color:'#888',marginBottom:14}}>
        Set up where &amp; how players meet you in person to hand over their pool commitment. This is the only way to pay — add one or more places.
      </div>

      {!showForm && (
        <button className="btn btn-green" style={{marginBottom:14}} onClick={() => { setForm({ ...BLANK }); setEditing(null); setShowForm(true); }}>
          + Add a place
        </button>
      )}

      {showForm && (
        <div className="card" style={{marginBottom:14}}>
          <div style={{fontSize:14,fontWeight:500,marginBottom:12}}>
            {editing ? 'Edit' : 'New'} · Want to make love
          </div>

          <div className="field">
            <label>Label (shown to players)</label>
            <input value={form.label} onChange={set('label')} placeholder='e.g. "Saturday meetup"' />
          </div>
          <div className="field">
            <label>Where to meet</label>
            <input value={form.cashAddress} onChange={set('cashAddress')} placeholder="e.g. 12 MG Road, Bangalore 560001" />
          </div>
          <div className="field">
            <label>Contact number</label>
            <input value={form.cashContact} onChange={set('cashContact')} placeholder="e.g. +91 98765 43210" />
          </div>
          <div className="field">
            <label>Notes for players (optional)</label>
            <input value={form.notes} onChange={set('notes')} placeholder="e.g. Available weekends, please call first" />
          </div>

          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-green" onClick={save}>{editing ? 'Save changes' : 'Add'}</button>
            <button className="btn btn-ghost" onClick={() => { setShowForm(false); setEditing(null); setForm({ ...BLANK }); }}>Cancel</button>
          </div>
        </div>
      )}

      <div>
        {methods.length === 0 && (
          <div style={{fontSize:13,color:'#aaa',padding:20,textAlign:'center'}}>
            Nothing set up yet. Add a place so players know how to reach you.
          </div>
        )}
        {methods.map(m => (
          <div key={m.id} style={{opacity: m.isActive ? 1 : 0.5}}>
            <PaymentMethodCard method={m} onCopied={(v) => toast('Copied: ' + v)} />
            <div style={{display:'flex',gap:6,marginTop:-4,marginBottom:14,justifyContent:'flex-end'}}>
              <button className="btn btn-ghost" style={{fontSize:11,padding:'4px 12px'}} onClick={() => editMethod(m)}>Edit</button>
              <button className="btn btn-ghost" style={{fontSize:11,padding:'4px 12px'}} onClick={() => toggleActive(m.id)}>
                {m.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button className="btn btn-ghost" style={{fontSize:11,padding:'4px 12px',color:'var(--red)'}} onClick={() => del(m.id)}>Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
