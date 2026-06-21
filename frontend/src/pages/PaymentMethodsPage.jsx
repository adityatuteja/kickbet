// src/pages/PaymentMethodsPage.jsx — admin only
import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { useToast } from '../hooks/useToast.jsx';
import PaymentMethodCard from '../components/PaymentMethodCard.jsx';

const BLANK = {
  type:'CASH', label:'',
  upiId:'', qrCodeUrl:'',
  bankName:'', accountName:'', accountNo:'', ifsc:'', branch:'',
  cashAddress:'', cashContact:'',
  notes:''
};

const TYPES = [
  { value:'CASH', label:'💚 Love Bites (pay in person)' },
];

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
    if (!form.label) { toast('Enter a label'); return; }
    if (form.type === 'UPI'  && !form.upiId)     { toast('UPI handle required'); return; }
    if (form.type === 'QR'   && !form.qrCodeUrl) { toast('QR image URL required'); return; }
    if (form.type === 'BANK' && (!form.accountNo || !form.ifsc || !form.accountName)) {
      toast('Account name, number and IFSC required'); return;
    }
    if (form.type === 'CASH' && !form.cashAddress) { toast('Address required'); return; }

    try {
      if (editing) {
        await api.updatePaymentMethod(editing, form);
        toast('Updated');
      } else {
        await api.createPaymentMethod(form);
        toast('Created');
      }
      setForm({ ...BLANK }); setEditing(null); setShowForm(false);
      load();
    } catch(e) { toast(e.message); }
  }

  function editMethod(m) {
    setForm({ ...BLANK, ...m });
    setEditing(m.id); setShowForm(true);
  }

  async function toggleActive(id) {
    await api.togglePaymentMethod(id);
    load();
  }

  async function del(id) {
    if (!window.confirm('Delete this payment method? Users will no longer see it.')) return;
    try { await api.deletePaymentMethod(id); toast('Deleted'); load(); }
    catch(e) { toast(e.message); }
  }

  return (
    <div>
      <Toast />

      <div className="section-title"><i className="ti ti-heart" aria-hidden="true" />Love Bites</div>
      <div style={{fontSize:12,color:'#888',marginBottom:14}}>
        Add the place(s) where players can drop off their pool commitment in person ("Love Bites"). Active ones appear when players pledge.
      </div>

      {!showForm && (
        <button className="btn btn-green" style={{marginBottom:14}} onClick={() => { setForm({ ...BLANK }); setEditing(null); setShowForm(true); }}>
          + Add new payment method
        </button>
      )}

      {showForm && (
        <div className="card" style={{marginBottom:14}}>
          <div style={{fontSize:14,fontWeight:500,marginBottom:12}}>
            {editing ? 'Edit payment method' : 'New payment method'}
          </div>

          <div className="field">
            <label>Type</label>
            <select value={form.type} onChange={set('type')} disabled={!!editing}>
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Label (shown to players)</label>
            <input value={form.label} onChange={set('label')} placeholder='e.g. "Saturday meetup" or "Office drop-off"' />
          </div>

          {form.type === 'UPI' && (
            <div className="field">
              <label>UPI handle</label>
              <input value={form.upiId} onChange={set('upiId')} placeholder="e.g. admin@paytm or admin@ybl" />
            </div>
          )}

          {form.type === 'QR' && (
            <div className="field">
              <label>QR code image URL</label>
              <input value={form.qrCodeUrl} onChange={set('qrCodeUrl')} placeholder="https://imgur.com/your-qr.png" />
              <div style={{fontSize:11,color:'#888',marginTop:4}}>Upload your QR to Imgur, Cloudinary, or any image host and paste the direct URL.</div>
            </div>
          )}

          {form.type === 'BANK' && (
            <>
              <div className="field">
                <label>Bank name</label>
                <input value={form.bankName} onChange={set('bankName')} placeholder="e.g. HDFC Bank" />
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <div className="field">
                  <label>Account holder name</label>
                  <input value={form.accountName} onChange={set('accountName')} placeholder="Name on account" />
                </div>
                <div className="field">
                  <label>Account number</label>
                  <input value={form.accountNo} onChange={set('accountNo')} placeholder="e.g. 50100123456789" />
                </div>
                <div className="field">
                  <label>IFSC code</label>
                  <input value={form.ifsc} onChange={set('ifsc')} placeholder="e.g. HDFC0001234" />
                </div>
                <div className="field">
                  <label>Branch (optional)</label>
                  <input value={form.branch} onChange={set('branch')} placeholder="e.g. Andheri West, Mumbai" />
                </div>
              </div>
            </>
          )}

          {form.type === 'CASH' && (
            <>
              <div className="field">
                <label>Drop-off address</label>
                <input value={form.cashAddress} onChange={set('cashAddress')} placeholder="e.g. 12 MG Road, Bangalore 560001" />
              </div>
              <div className="field">
                <label>Contact number</label>
                <input value={form.cashContact} onChange={set('cashContact')} placeholder="e.g. +91 98765 43210" />
              </div>
            </>
          )}

          <div className="field">
            <label>Notes for players (optional)</label>
            <input value={form.notes} onChange={set('notes')} placeholder="e.g. Please include your alias in the transfer note" />
          </div>

          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-green" onClick={save}>{editing ? 'Save changes' : 'Add method'}</button>
            <button className="btn btn-ghost" onClick={() => { setShowForm(false); setEditing(null); setForm({ ...BLANK }); }}>Cancel</button>
          </div>
        </div>
      )}

      <div>
        {methods.length === 0 && (
          <div style={{fontSize:13,color:'#aaa',padding:20,textAlign:'center'}}>
            No payment methods yet. Add one so players can send their pool commitment.
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
              <button className="btn btn-ghost" style={{fontSize:11,padding:'4px 12px',color:'#c0392b'}} onClick={() => del(m.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
