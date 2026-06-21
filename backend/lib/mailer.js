// lib/mailer.js
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

export async function sendMatchNotification(email, alias, match) {
  if (!process.env.SMTP_USER) return; // skip if not configured
  const kickoff = new Date(match.kickoffAt).toUTCString();
  await transporter.sendMail({
    from: `"FriendLove" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `⚽ Loving opens: ${match.homeTeam} vs ${match.awayTeam}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1a7a3c">Hey ${alias}!</h2>
        <p>Loving is now open for <strong>${match.homeFlag} ${match.homeTeam} vs ${match.awayFlag} ${match.awayTeam}</strong>.</p>
        <p>Kickoff: <strong>${kickoff}</strong></p>
        <p>Loving closes 30 minutes before kickoff. Don't miss it!</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#1a7a3c;color:#fff;border-radius:8px;text-decoration:none;font-weight:500">Place your loves →</a>
        <p style="margin-top:24px;font-size:12px;color:#888">5% of every love you place goes to the Girls Education Fund. Thank you for playing responsibly.</p>
      </div>
    `
  });
}

export async function sendResultNotification(email, alias, match, result) {
  if (!process.env.SMTP_USER) return;
  const { won, lost, totalWon, totalLost, eduDonated, netWinnings, newBalance } = result;

  const statusColor = totalWon > 0 ? '#1a7a3c' : '#c0392b';
  const headline    = totalWon > 0
    ? `You won ♡ ${totalWon.toFixed(2)} LB! 🎉`
    : `Better luck next time.`;

  const picksHtml = [
    ...won.map(p  => `<tr><td style="padding:6px 0;color:#1a7a3c">✓ ${p.question}: ${p.pick}</td><td style="text-align:right;color:#1a7a3c;font-weight:500">+♡ ${p.won.toFixed(2)} LB</td></tr>`),
    ...lost.map(p => `<tr><td style="padding:6px 0;color:#c0392b">✗ ${p.question}: ${p.pick}</td><td style="text-align:right;color:#c0392b">-♡ ${p.staked.toFixed(2)} LB</td></tr>`),
  ].join('');

  await transporter.sendMail({
    from: `"FriendLove" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `⚽ Match result: ${match.homeTeam} vs ${match.awayTeam}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1a7a3c">Hey ${alias}!</h2>
        <p>Results are in for <strong>${match.homeFlag} ${match.homeTeam} vs ${match.awayFlag} ${match.awayTeam}</strong></p>
        <h3 style="color:${statusColor};margin:16px 0 8px">${headline}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px">
          ${picksHtml}
        </table>
        <table style="width:100%;font-size:13px;border-top:1px solid #eee;padding-top:12px">
          <tr><td style="padding:4px 0;color:#888">Total winnings</td><td style="text-align:right;font-weight:500">♡ ${totalWon.toFixed(2)} LB</td></tr>
          <tr><td style="padding:4px 0;color:#BA7517">🎓 Girls Ed. donation</td><td style="text-align:right;color:#BA7517;font-weight:500">♡ ${eduDonated.toFixed(2)} LB</td></tr>
          <tr><td style="padding:4px 0;color:#1a7a3c;font-weight:500">You received</td><td style="text-align:right;color:#1a7a3c;font-weight:500">♡ ${netWinnings.toFixed(2)} LB</td></tr>
          <tr style="border-top:1px solid #eee"><td style="padding:8px 0;font-weight:500">New balance</td><td style="text-align:right;font-weight:500;font-size:16px">♡ ${newBalance.toFixed(2)} LB</td></tr>
        </table>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#1a7a3c;color:#fff;border-radius:8px;text-decoration:none;font-weight:500">View your balance →</a>
      </div>
    `
  });
}

export async function sendAdminInvite(email, link, expiresAt) {
  if (!process.env.SMTP_USER) return;
  await transporter.sendMail({
    from: `"FriendLove" <${process.env.SMTP_USER}>`,
    to: email,
    subject: '⚽ You\'re invited to be a FriendLove admin',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1a7a3c">You've been invited as an admin</h2>
        <p>The FriendLove root admin has invited you (<strong>${email}</strong>) to join as an administrator.</p>
        <p>Click below to create your admin account. You must register using this exact email address.</p>
        <a href="${link}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#1a7a3c;color:#fff;border-radius:8px;text-decoration:none;font-weight:500">Accept invite & create account →</a>
        <p style="font-size:12px;color:#888">This invitation expires on ${new Date(expiresAt).toUTCString()}. If you weren't expecting this, you can ignore it.</p>
      </div>
    `
  });
}
