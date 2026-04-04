export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body;

  // Route code validation — try Sheet first, fall back to env var codes
  if (body?.event === 'validate_code') {
    const code = (body?.data?.code || '').trim().toUpperCase();

    // Fallback: validate against codes stored in Vercel env var
    // Set PRO_CODES in Vercel as comma-separated list e.g. "BHP-2026,BHP-BETA,BHP-STAFF"
    const envCodes = (process.env.PRO_CODES || 'BHP-2026,BHP-BETA,BHP-STAFF,BHP-LAUNCH')
      .split(',').map(c => c.trim().toUpperCase());

    if (envCodes.includes(code)) {
      return res.status(200).json({ ok: true, valid: true, type: 'active-recurring', source: 'env' });
    }

    // Also try the Sheet for one-time codes
    const SHEET_URL = process.env.SHEET_URL ||
      'https://script.google.com/macros/s/AKfycbzgSeTR5mHyUubtu9iGnV0CD0EnWv7kQdDCw-Oqki-jnNXq4nh3IVP5O9hno-0YGYMKCA/exec';
    try {
      const r = await fetch(SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      return res.status(200).json(data);
    } catch (e) {
      // Sheet unreachable — code wasn't in env fallback either
      return res.status(200).json({ ok: true, valid: false, reason: 'not_found' });
    }
  }

  // Default: proxy to Anthropic
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
