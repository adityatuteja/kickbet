// src/components/LowBalanceModal.jsx
import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import PaymentMethodCard from './PaymentMethodCard.jsx';
import { useNavigate } from 'react-router-dom';

export default function LowBalanceModal({ open, onClose, reason = 'low_balance', available = 0, needed = 0, isFirstTime = false }) {
  const [methods, setMethods] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    api.getPaymentMethods().then(setMethods).catch(() => {});
  }, [open]);

  if (!open) return null;

  const title = isFirstTime
    ? '👋 Welcome! Join the pool to start loving'
    : 'Not enough balance to place this love';

  const subtitle = isFirstTime
    ? 'You need to commit a minimum of ♡ 2,000 LB to the pool first. Meet the admin below and hand over the amount — admin will confirm and credit your love balance.'
    : `You have ♡ ${available.toLocaleString('en-IN')} LB available but this love needs ♡ ${needed.toLocaleString('en-IN')} LB. Top up your pool commitment by meeting the admin below.`;

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.55)',
      display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:1000, padding:16, backdropFilter:'blur(2px)'
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background:'#fff', borderRadius:14, padding:'22px 22px 16px',
        maxWidth:520, width:'100%', maxHeight:'90vh', overflowY:'auto',
        boxShadow:'0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
          <div style={{fontSize:17,fontWeight:500,color:'#1a7a3c',flex:1}}>{title}</div>
          <button onClick={onClose} style={{
            background:'transparent',border:'none',fontSize:22,cursor:'pointer',
            color:'#888',padding:'0 4px',lineHeight:1
          }}>×</button>
        </div>
        <div style={{fontSize:13,color:'#666',marginBottom:18,lineHeight:1.5}}>{subtitle}</div>

        {/* Balance recap (only if not first time) */}
        {!isFirstTime && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:18}}>
            <div style={{background:'#fceaea',borderRadius:8,padding:'10px 12px'}}>
              <div style={{fontSize:11,color:'#888',marginBottom:2}}>Your available</div>
              <div style={{fontSize:18,fontWeight:500,color:'#c0392b'}}>♡ {available.toLocaleString('en-IN')} LB</div>
            </div>
            <div style={{background:'#e8f5ed',borderRadius:8,padding:'10px 12px'}}>
              <div style={{fontSize:11,color:'#888',marginBottom:2}}>Love needs</div>
              <div style={{fontSize:18,fontWeight:500,color:'#1a7a3c'}}>♡ {needed.toLocaleString('en-IN')} LB</div>
            </div>
          </div>
        )}

        {/* Meeting places */}
        <div style={{fontSize:12,fontWeight:500,color:'#888',textTransform:'uppercase',letterSpacing:.5,marginBottom:8}}>
          Want to make love (pay in person)
        </div>

        {methods.length === 0 ? (
          <div style={{fontSize:13,color:'#888',background:'#fffbe8',padding:'10px 12px',borderRadius:8,border:'1px solid #f5d960',marginBottom:14}}>
            ⚠ No meeting place set up yet. Please contact the admin.
          </div>
        ) : (
          <div style={{marginBottom:14}}>
            {methods.map(m => (
              <PaymentMethodCard key={m.id} method={m} compact onCopied={(v) => {/* silent */}} />
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{display:'flex',gap:8,flexWrap:'wrap',borderTop:'1px solid #eee',paddingTop:14}}>
          <button className="btn btn-green" style={{flex:1,minWidth:160}}
            onClick={() => { onClose(); navigate('/pool'); }}>
            Go to Pool page →
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
        <div style={{fontSize:11,color:'#888',marginTop:10,textAlign:'center'}}>
          After transferring, log your pledge on the Pool page. Admin will acknowledge receipt and credit your balance.
        </div>
      </div>
    </div>
  );
}
