// src/pages/RulesPage.jsx
function Section({ icon, title, children }) {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <span style={{ fontSize:20 }}>{icon}</span>
        <h3 style={{ margin:0, fontSize:15, fontWeight:600 }}>{title}</h3>
      </div>
      {/* No hardcoded text color — inherits theme (light: #111, dark: #eee) */}
      <div style={{ fontSize:13.5, lineHeight:1.65 }}>{children}</div>
    </div>
  );
}

function Rule({ children }) {
  return (
    <div style={{ display:'flex', gap:8, marginBottom:9, alignItems:'flex-start' }}>
      <span style={{ color:'var(--green)', fontWeight:700, lineHeight:1.5, flexShrink:0 }}>•</span>
      <span style={{ flex:1 }}>{children}</span>
    </div>
  );
}

export default function RulesPage() {
  return (
    <div>
      <div style={{ marginBottom:16 }}>
        <h2 style={{ margin:'0 0 4px', fontSize:20, fontWeight:600 }}>📖 How FriendLove Works</h2>
        <div style={{ fontSize:13, color:'#888' }}>
          The complete rulebook. FriendLove is a pool-based (parimutuel) betting game with a Girls Education fund.
        </div>
      </div>

      <Section icon="💚" title="Money & the Pool">
        <Rule>Join by committing money to a shared pool — <strong>minimum ♡ 2,000 LB</strong> for your first commitment.</Rule>
        <Rule>You can top up anytime, but only <strong>increase</strong> your commitment — there's no withdrawing back down.</Rule>
        <Rule>Pay the admin in person via <strong>Love Bites</strong> — the admin lists the drop-off place(s).</Rule>
        <Rule>The admin <strong>acknowledges receipt</strong> of each pledge — Received, Partial, or Not Received. Only confirmed money becomes your <strong>betting balance</strong>.</Rule>
        <Rule>Your balance has two parts: <strong>committed</strong> (locked in active bets) and <strong>available</strong> (balance minus committed). You can never bet more than your available balance.</Rule>
        <Rule>Transfers are <strong>admin-only</strong> — you can send money to an admin, but not to another player.</Rule>
      </Section>

      <Section icon="⚽" title="Betting — Parimutuel (Pool) Odds">
        <div style={{ background:'var(--green-light)', color:'var(--green)', borderRadius:8, padding:'10px 12px', marginBottom:12, fontSize:12.5, lineHeight:1.55 }}>
          <strong>The core rule:</strong> there are no fixed odds. Each question is its own pool, and winners split the entire pot in proportion to how much they staked. Every rupee is used — nothing is left over.
        </div>
        <Rule>The multiplier on any option = <strong>total pool ÷ money on that option</strong>. It's calculated from real betting, not set by anyone.</Rule>
        <Rule><strong>Odds move live</strong> — as people bet, the popular pick's payout shrinks and the lonely pick's payout grows. Watch the board shift in real time.</Rule>
        <Rule>Odds <strong>lock when betting closes</strong> (30 min before kickoff). What you see at lock-in is what you get.</Rule>
        <Rule>When a question settles, winners split the <strong>whole pool</strong> proportionally to their stake.</Rule>
        <Rule>If <strong>nobody</strong> picks the correct answer, that pot <strong>rolls over</strong> into the next match's pool — making it bigger.</Rule>
        <Rule>Betting opens ~12 hours before kickoff and locks 30 minutes before. Each question has a minimum stake.</Rule>
      </Section>

      <Section icon="🎓" title="Girls Education Fund">
        <Rule>On every bet, you choose a percentage (<strong>0–100%, default 5%</strong>) of your <strong>winnings</strong> to donate to the Girls Education fund.</Rule>
        <Rule>It comes out of what you <strong>win</strong>, not your stake — so it never costs you if you lose.</Rule>
        <Rule>Contributions are tracked per-player and shown on the Girls Ed. page.</Rule>
      </Section>

      <Section icon="🛡️" title="Admins">
        <Rule>The <strong>root admin</strong> (the first account) is the only one who can onboard other admins.</Rule>
        <Rule>New admins join by <strong>invitation only</strong> — a one-time, email-locked link that expires in 7 days.</Rule>
        <Rule>Regular admins <strong>cannot</strong> promote anyone, and the root admin <strong>cannot</strong> be demoted.</Rule>
        <Rule>Admins manage matches, set questions and minimum stakes, settle results, manage Love Bites drop-offs, and acknowledge pool commitments.</Rule>
      </Section>

      <Section icon="🏆" title="After the Match">
        <Rule>Results show per-player: <strong>wins, losses, net profit/loss</strong>, and money sent to Girls Education.</Rule>
        <Rule>Highlights call out the <strong>highest winner, biggest loss, highest and lowest stakes, and biggest donor</strong>.</Rule>
      </Section>

      <div style={{ fontSize:12, color:'#888', textAlign:'center', marginTop:8 }}>
        Play responsibly. The pool only works when everyone commits fairly. 💚
      </div>
    </div>
  );
}
