// src/pages/UsersPage.jsx
import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  useEffect(() => { api.leaderboard().then(setUsers); }, []);

  const total      = users.reduce((s,u) => s+u.balance, 0);
  const totalEdu   = users.reduce((s,u) => s+u.girlsEduTotal, 0);
  const totalComm  = users.reduce((s,u) => s+u.committed, 0);

  return (
    <div>
      <div className="metrics">
        <div className="metric"><div className="metric-label">Total pool</div><div className="metric-val metric-green">₹{total.toFixed(0)}</div></div>
        <div className="metric"><div className="metric-label">Players</div><div className="metric-val">{users.length}</div></div>
        <div className="metric"><div className="metric-label">Committed</div><div className="metric-val">₹{totalComm.toFixed(0)}</div></div>
        <div className="metric"><div className="metric-label">Girls ed. fund</div><div className="metric-val metric-gold">₹{totalEdu.toFixed(0)}</div></div>
      </div>

      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Alias</th><th>Balance</th><th>Committed</th><th>Available</th><th>Girls Ed.</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td><span className="alias-badge">{u.alias}</span></td>
                  <td>₹{u.balance.toFixed(2)}</td>
                  <td style={{color:'#c0392b'}}>₹{u.committed.toFixed(2)}</td>
                  <td style={{color:'#1a7a3c',fontWeight:500}}>₹{(u.balance-u.committed).toFixed(2)}</td>
                  <td style={{color:'#BA7517',fontWeight:500}}>₹{u.girlsEduTotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
