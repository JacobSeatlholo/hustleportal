export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body;

  // Route code validation to Apps Script server-side (no CORS issues)
  if (body?.event === 'validate_code') {
    const SHEET_URL = process.env.SHEET_URL ||
      'https://script.google.com/macros/s/AKfycbwN5YhdUJHkSMFNiLRfSxXdJG4hYU6mfFi0h0ak_F0gz5KiOI95tZP29qWNORG15aricw/exec';
    try {
      const r = await fetch(SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ ok: false, valid: false, reason: 'server_error', error: e.message });
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
