// TempMail server — own backend for the user's TempMail app.
// Proxies the public mail.tm API server-side (mail.tm sends no CORS header,
// so a browser page cannot call it directly). No database, no stored
// passwords or tokens: the frontend keeps the account token in localStorage
// and passes it back on every request; this server only forwards it.
// No API keys or secrets are used anywhere.

const crypto = require('crypto');
const express = require('express');
const path = require('path');

const MAILTM = 'https://api.mail.tm';
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Never cache the app page itself, so updates (like a new logo) show up
// immediately instead of the phone showing an old saved copy.
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// ---- helpers -------------------------------------------------------------

// Strip dots and anything that is not a letter or digit; lowercase.
// mail.tm creates dotted usernames but then refuses to sign them in,
// so we normalise before creating.
function cleanUsername(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function randomUsername() {
  return 'user' + crypto.randomBytes(5).toString('hex'); // user + 10 hex chars
}

function randomPassword() {
  return crypto.randomBytes(12).toString('base64').replace(/[^A-Za-z0-9]/g, 'x') + 'A1!';
}

async function mailtm(pathname, options) {
  const res = await fetch(MAILTM + pathname, options);
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch (_) { /* keep raw text */ }
  return { status: res.status, ok: res.ok, data, text };
}

function bearerToken(req) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

// ---- API -----------------------------------------------------------------

// GET /api/domains -> ["fldubai.com", ...] (live from mail.tm)
app.get('/api/domains', async (req, res) => {
  try {
    const r = await mailtm('/domains');
    if (!r.ok) return res.status(502).json({ error: 'mail.tm មិនឆ្លើយតប' });
    const domains = (r.data['hydra:member'] || [])
      .filter(d => d.isActive)
      .map(d => d.domain);
    res.json({ domains });
  } catch (e) {
    res.status(502).json({ error: 'មិនអាចភ្ជាប់ទៅ mail.tm បានទេ' });
  }
});

// POST /api/address { username?, domain? }
// Creates a mail.tm account + token. If username is omitted, one is
// auto-generated. Returns { address, accountId, token }.
app.post('/api/address', async (req, res) => {
  try {
    const domain = String(req.body.domain || 'fldubai.com');
    let username = cleanUsername(req.body.username);
    if (!username) username = randomUsername();
    const address = username + '@' + domain;
    const password = randomPassword();

    const created = await mailtm('/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, password }),
    });
    if (!created.ok) {
      const detail = (created.data && created.data.detail) || '';
      const msg = detail.includes('already used')
        ? 'អាសយដ្ឋាននេះមានគេប្រើហើយ — សាកឈ្មោះផ្សេង'
        : 'បង្កើតអាសយដ្ឋានមិនបាន — សាកម្ដងទៀត';
      return res.status(400).json({ error: msg });
    }

    const tok = await mailtm('/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, password }),
    });
    if (!tok.ok || !tok.data || !tok.data.token) {
      return res.status(502).json({ error: 'យក token មិនបាន' });
    }

    res.json({ address, accountId: created.data.id, token: tok.data.token });
  } catch (e) {
    res.status(502).json({ error: 'មិនអាចភ្ជាប់ទៅ mail.tm បានទេ' });
  }
});

// GET /api/messages — inbox list for the account in Authorization: Bearer <token>
app.get('/api/messages', async (req, res) => {
  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'ខ្វះ token' });
  try {
    const r = await mailtm('/messages', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!r.ok) return res.status(r.status).json({ error: 'យកសំបុត្រមិនបាន' });
    const messages = (r.data['hydra:member'] || []).map(m => ({
      id: m.id,
      from: m.from || {},
      subject: m.subject || '',
      intro: m.intro || '',
      date: m.createdAt || '',
      seen: !!m.seen,
    }));
    res.json({ messages });
  } catch (e) {
    res.status(502).json({ error: 'មិនអាចភ្ជាប់ទៅ mail.tm បានទេ' });
  }
});

// GET /api/message/:id — full message (text + html) for the account token
app.get('/api/message/:id', async (req, res) => {
  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'ខ្វះ token' });
  const id = encodeURIComponent(req.params.id);
  try {
    const r = await mailtm('/messages/' + id, {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!r.ok) return res.status(r.status).json({ error: 'បើកសំបុត្រមិនបាន' });
    const m = r.data || {};
    res.json({
      id: m.id,
      from: m.from || {},
      to: m.to || [],
      subject: m.subject || '',
      date: m.createdAt || '',
      text: m.text || '',
      html: (m.html || []).join('') || '',
    });
  } catch (e) {
    res.status(502).json({ error: 'មិនអាចភ្ជាប់ទៅ mail.tm បានទេ' });
  }
});

// DELETE /api/address/:id — delete the mail.tm account (token in header)
app.delete('/api/address/:id', async (req, res) => {
  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'ខ្វះ token' });
  const id = encodeURIComponent(req.params.id);
  try {
    const r = await mailtm('/accounts/' + id, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!r.ok && r.status !== 204) {
      return res.status(r.status).json({ error: 'លុបអាសយដ្ឋានមិនបាន' });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: 'មិនអាចភ្ជាប់ទៅ mail.tm បានទេ' });
  }
});

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// SPA fallback: anything else serves the app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('TempMail server listening on port ' + PORT);
});
