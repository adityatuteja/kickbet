// src/lib/api.js
// On Railway, set VITE_API_URL to your backend's public URL (e.g. https://kickbet-api.up.railway.app)
// Locally with docker-compose it stays as '/api' and nginx proxies to the backend container.
const BASE = (import.meta.env.VITE_API_URL || '') + '/api';

function token() { return localStorage.getItem('kb_token'); }

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}`, ...opts.headers }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // Auth
  login:    (body) => req('/auth/login',    { method:'POST', body: JSON.stringify(body) }),
  register: (body) => req('/auth/register', { method:'POST', body: JSON.stringify(body) }),
  me:       ()     => req('/auth/me'),

  // Matches
  getMatches: ()   => req('/matches'),
  getStats:   (id) => req(`/matches/${id}/stats`),

  // Bets
  placeBet: (body) => req('/bets',     { method:'POST', body: JSON.stringify(body) }),
  myBets:   ()     => req('/bets/my'),

  // Users
  leaderboard: ()  => req('/users/leaderboard'),
  girlsEdu:    ()  => req('/users/girls-edu'),

  // Donations
  donate: (amount) => req('/donations', { method:'POST', body: JSON.stringify({ amount }) }),

  // Pool
  getPool:      ()                       => req('/pool'),
  pledge:       (amount, note, paymentMethodId)   => req('/pool/pledge', { method:'POST', body: JSON.stringify({ amount, note, paymentMethodId }) }),
  confirmPool:  (userId, amount, note)   => req('/pool/confirm',      { method:'POST', body: JSON.stringify({ userId, amount, note }) }),
  acknowledge:  (transactionId, status, amountReceived, adminNote) => req('/pool/acknowledge', { method:'POST', body: JSON.stringify({ transactionId, status, amountReceived, adminNote }) }),
  transfer:     (toUserId, amount, note) => req('/pool/transfer',     { method:'POST', body: JSON.stringify({ toUserId, amount, note }) }),

  // Admin invites (root admin only)
  createInvite:   (email)  => req('/invites',          { method:'POST', body: JSON.stringify({ email }) }),
  listInvites:    ()       => req('/invites'),
  revokeInvite:   (id)     => req(`/invites/${id}/revoke`, { method:'POST' }),
  validateInvite: (token)  => req(`/invites/validate/${token}`),

  // Tournament-wide bets
  getTournamentQuestions: ()                         => req('/tournament/questions'),
  tournamentBet:    (questionId, optionId, amount, girlsEduPct) => req('/tournament/bet', { method:'POST', body: JSON.stringify({ questionId, optionId, amount, girlsEduPct }) }),
  getMyTournamentBets: ()                            => req('/tournament/my'),
  getTournamentPresets: ()                           => req('/tournament/presets'),
  createTournamentQuestion: (body)                   => req('/tournament/questions', { method:'POST', body: JSON.stringify(body) }),
  deleteTournamentQuestion: (id)                     => req(`/tournament/questions/${id}`, { method:'DELETE' }),
  settleTournamentQuestion: (id, winningOptionId)    => req(`/tournament/questions/${id}/settle`, { method:'POST', body: JSON.stringify({ winningOptionId }) }),
  getMatchPresets:  (matchId)                        => req(`/admin/matches/${matchId}/presets`),

  // Payment methods
  getPaymentMethods:    ()        => req('/payment-methods'),
  getAllPaymentMethods: ()        => req('/payment-methods/all'),
  createPaymentMethod:  (body)    => req('/payment-methods', { method:'POST', body: JSON.stringify(body) }),
  updatePaymentMethod:  (id, body)=> req(`/payment-methods/${id}`, { method:'PATCH', body: JSON.stringify(body) }),
  togglePaymentMethod:  (id)      => req(`/payment-methods/${id}/toggle`, { method:'PATCH' }),
  deletePaymentMethod:  (id)      => req(`/payment-methods/${id}`, { method:'DELETE' }),

  // Admin
  settleMatch:    (id, correctOptions) => req(`/admin/matches/${id}/settle`, { method:'POST', body: JSON.stringify({ correctOptions }) }),
  getResults:     (id)               => req(`/admin/matches/${id}/results`),
  updateStatus:   (id, status)   => req(`/admin/matches/${id}/status`,  { method:'PATCH', body: JSON.stringify({ status }) }),
  setQuestions:   (id, questions)=> req(`/admin/matches/${id}/questions`,{ method:'PUT',  body: JSON.stringify({ questions }) }),
  promote:        (username)     => req('/admin/promote', { method:'POST', body: JSON.stringify({ username }) }),
  demote:         (username)     => req('/admin/demote',  { method:'POST', body: JSON.stringify({ username }) }),
  getAdmins:      ()             => req('/admin/admins'),
  getAllUsers:     ()             => req('/admin/users'),
};
