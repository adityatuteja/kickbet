// src/components/PaymentMethodCard.jsx
// Reusable display + copy buttons for a single payment method.

const TYPE_META = {
  CASH: { icon:'♡', label:'Love Bites — pay in person' },
};

function copy(text, onCopied) {
  navigator.clipboard.writeText(text).then(() => onCopied?.(text));
}

export default function PaymentMethodCard({ method, selected, onSelect, onCopied, compact }) {
  const meta = TYPE_META[method.type] || { icon:'♡', label:method.label };

  return (
    <div
      onClick={onSelect}
      style={{
        background: selected ? '#e8f5ed' : '#fff',
        border: selected ? '2px solid #1a7a3c' : '1px solid #e0e0e0',
        borderRadius: 10, padding: compact ? '10px 12px' : '12px 14px',
        marginBottom: 8, cursor: onSelect ? 'pointer' : 'default',
        transition: 'all 0.15s'
      }}
    >
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:compact?4:8}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:18}}>{meta.icon}</span>
          <span style={{fontSize:13,fontWeight:500}}>{method.label}</span>
        </div>
        {selected && <span style={{fontSize:11,color:'#1a7a3c',fontWeight:500}}>✓ Selected</span>}
      </div>

      <div style={{fontSize:11,color:'#888',marginBottom:8}}>{meta.label}</div>

      {/* UPI */}
      {method.type === 'UPI' && method.upiId && (
        <div style={{background:'#f8f8f8',borderRadius:7,padding:'8px 10px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:10,color:'#888',marginBottom:2}}>UPI handle</div>
            <div style={{fontFamily:'monospace',fontSize:13,fontWeight:500,color:'#1a7a3c'}}>{method.upiId}</div>
          </div>
          <button onClick={(e)=>{e.stopPropagation();copy(method.upiId, onCopied);}}
            style={{padding:'4px 10px',fontSize:11,border:'1px solid #1a7a3c',borderRadius:6,background:'#fff',color:'#1a7a3c',cursor:'pointer'}}>
            Copy
          </button>
        </div>
      )}

      {/* QR */}
      {method.type === 'QR' && method.qrCodeUrl && (
        <div style={{background:'#f8f8f8',borderRadius:7,padding:10,textAlign:'center'}}>
          <img src={method.qrCodeUrl} alt="Payment QR" style={{maxWidth:160,maxHeight:160,borderRadius:6}} />
        </div>
      )}

      {/* BANK */}
      {method.type === 'BANK' && (
        <div style={{background:'#f8f8f8',borderRadius:7,padding:'8px 10px'}}>
          {[
            ['Bank',        method.bankName],
            ['Account name', method.accountName],
            ['Account #',   method.accountNo],
            ['IFSC',        method.ifsc],
            ['Branch',      method.branch],
          ].filter(([_,v]) => v).map(([k,v]) => (
            <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'3px 0',fontSize:12}}>
              <span style={{color:'#888'}}>{k}</span>
              <span style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontFamily:'monospace',fontWeight:500}}>{v}</span>
                <button onClick={(e)=>{e.stopPropagation();copy(v, onCopied);}}
                  style={{padding:'2px 8px',fontSize:10,border:'1px solid #ddd',borderRadius:5,background:'#fff',color:'#666',cursor:'pointer'}}>
                  Copy
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* CASH */}
      {method.type === 'CASH' && (
        <div style={{background:'#f8f8f8',borderRadius:7,padding:'8px 10px'}}>
          {method.cashAddress && (
            <div style={{marginBottom:method.cashContact?6:0}}>
              <div style={{fontSize:10,color:'#888',marginBottom:2}}>Drop-off address</div>
              <div style={{fontSize:12,lineHeight:1.4}}>{method.cashAddress}</div>
            </div>
          )}
          {method.cashContact && (
            <div>
              <div style={{fontSize:10,color:'#888',marginBottom:2}}>Contact</div>
              <div style={{fontSize:12,fontFamily:'monospace'}}>{method.cashContact}</div>
            </div>
          )}
        </div>
      )}

      {method.notes && (
        <div style={{fontSize:11,color:'#888',marginTop:8,fontStyle:'italic'}}>
          ℹ {method.notes}
        </div>
      )}
    </div>
  );
}
