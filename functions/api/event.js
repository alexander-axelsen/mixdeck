// Mixdeck usage counter — POST /api/event { event: "upload" }
// Stores ONLY an integer counter per (event, day) in Cloudflare KV.
// No IPs, no user agents, no identifiers. Aggregate counts only.
//
// Requires a KV binding named STATS configured in the Pages project settings.

const ALLOWED_EVENTS = new Set([
  'upload',          // any file dropped or chosen
  'samples',         // "Try with samples" button
  'pptx_imported',   // .pptx file successfully converted
  'export',          // deck exported as standalone HTML
  'present',         // entered present/fullscreen mode
  'restore',         // session restored from autosave
]);

export async function onRequestPost({ request, env }) {
  if (!env.STATS) {
    // Binding not wired up yet — silently 204 so the client never breaks
    return new Response(null, { status: 204 });
  }

  let body;
  try { body = await request.json(); } catch { return new Response(null, { status: 204 }); }

  const event = typeof body?.event === 'string' ? body.event : null;
  if (!event || !ALLOWED_EVENTS.has(event)) {
    return new Response(null, { status: 204 });
  }

  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const key = `${event}:${day}`;

  try {
    const prev = parseInt((await env.STATS.get(key)) || '0', 10);
    await env.STATS.put(key, String(prev + 1));
  } catch {
    // KV unavailable, transient — drop quietly
  }

  // Also write to Analytics Engine if bound. AE is the source for the Cloudflare
  // dashboard view (time-series charts, SQL queries). KV remains the source for
  // the simple JSON /api/stats endpoint. Both are kept in sync per event.
  try {
    env.ANALYTICS?.writeDataPoint({
      blobs: [event],
      doubles: [1],
      indexes: [event],
    });
  } catch {
    // AE unavailable, transient — drop quietly
  }

  return new Response(null, { status: 204 });
}
