// Mixdeck stats reader — GET /api/stats
// Returns the last 30 days of per-event counts as JSON.
// Public endpoint — anyone can see aggregate numbers. There's nothing
// sensitive here; if you want to make it private, add an auth check.

const EVENTS = ['upload', 'samples', 'pptx_imported', 'export', 'present', 'restore'];
const DAYS = 30;

export async function onRequestGet({ env }) {
  if (!env.STATS) {
    return new Response(JSON.stringify({ error: 'STATS binding not configured' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }

  const today = new Date();
  const days = [];
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const out = {};
  for (const event of EVENTS) {
    out[event] = {};
    for (const day of days) {
      const val = await env.STATS.get(`${event}:${day}`);
      if (val) out[event][day] = parseInt(val, 10);
    }
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=300',
    },
  });
}
