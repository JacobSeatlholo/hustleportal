export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body;

  if (body?.event === 'validate_code') {
    const code = (body?.data?.code || '').trim().toUpperCase();
    const envCodes = (process.env.PRO_CODES || 'BHP-2026,BHP-BETA,BHP-STAFF,BHP-LAUNCH')
      .split(',').map(c => c.trim().toUpperCase());

    if (envCodes.includes(code)) {
      const SHEET_URL = process.env.SHEET_URL ||
        'https://script.google.com/macros/s/AKfycbzPoV5NjnP0v6k68Ap-Shpxx64D5kYdzH8DZexhcS5OT3NlbUalgzoTIR1h_dTol-yYCw/exec';
      fetch(SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'leads', data: { name: body?.data?.business || 'Unknown', email: '', source: `Pro Code Redeemed (recurring) — ${code}` } }),
      }).catch(() => {});
      return res.status(200).json({ ok: true, valid: true, type: 'active-recurring', source: 'env' });
    }

    const SHEET_URL = process.env.SHEET_URL ||
      'https://script.google.com/macros/s/AKfycbzPoV5NjnP0v6k68Ap-Shpxx64D5kYdzH8DZexhcS5OT3NlbUalgzoTIR1h_dTol-yYCw/exec';
    try {
      const r = await fetch(SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      return res.status(200).json(data);
    } catch (e) {
      return res.status(200).json({ ok: true, valid: false, reason: 'not_found' });
    }
  }

  const { messages, system } = body;
  if (!messages) return res.status(400).json({ error: 'missing messages' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        ...(system ? { system } : {}),
        messages,
      }),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
