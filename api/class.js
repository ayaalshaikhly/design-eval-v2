const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

// One-QR class sessions: the instructor uploads the class list once,
// students scan one QR code, pick the presenter from a list, and rate.
// x/y are the two dimensions of the chosen tool:
//   meta: x = Metaphorical Abstraction, y = Source Relevance
//   maya: x = Familiarity,              y = Novelty

// Set in Vercel as the INSTRUCTOR_PASSCODE environment variable (never in the code).
const PASSCODE = process.env.INSTRUCTOR_PASSCODE;
const TOOLS = ['maya', 'meta'];
const LABEL_MODES = ['names', 'hidden'];

function clampZone(z) {
  const num = (v, lo, hi, d) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : d;
  };
  z = z || {};
  return {
    cx: num(z.cx, 1, 5, 3.5),
    cy: num(z.cy, 1, 5, 3.5),
    rx: num(z.rx, 0.2, 2, 0.7),
    ry: num(z.ry, 0.2, 2, 0.6)
  };
}

function cleanNames(names) {
  if (!Array.isArray(names)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of names) {
    const n = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!n || seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    out.push(n);
  }
  return out.slice(0, 200);
}

function sessionOut(s) {
  return {
    id: s.id,
    tool: s.tool,
    name: s.name,
    targetProduct: s.target_product,
    ideasPerPresenter: s.ideas_per_presenter,
    zone: { cx: s.zone_cx, cy: s.zone_cy, rx: s.zone_rx, ry: s.zone_ry },
    labelMode: s.label_mode,
    createdAt: s.created_at
  };
}

async function loadSession(sql, id) {
  const rows = await sql`SELECT * FROM class_sessions WHERE id = ${id}`;
  return rows[0] || null;
}

async function loadPresenters(sql, id) {
  return sql`
    SELECT id, name, position FROM class_presenters
    WHERE session_id = ${id} AND active = TRUE
    ORDER BY position ASC, id ASC
  `;
}

module.exports = async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  const action = (req.query && req.query.action) || '';
  const body = req.body || {};

  try {
    // ---------- Public: session + class list (students need the names) ----------
    if (action === 'get' && req.method === 'GET') {
      const s = await loadSession(sql, req.query.id);
      if (!s) return res.status(404).json({ error: 'Session not found' });
      const presenters = await loadPresenters(sql, s.id);
      return res.status(200).json({ ...sessionOut(s), presenters });
    }

    // ---------- Public: submit (or update) one rating ----------
    if (action === 'rate' && req.method === 'POST') {
      const { id, presenterId, token, ratings } = body;
      if (!id || !presenterId || !token || !Array.isArray(ratings) || ratings.length === 0) {
        return res.status(400).json({ error: 'id, presenterId, token and ratings are required' });
      }
      const s = await loadSession(sql, id);
      if (!s) return res.status(404).json({ error: 'Session not found' });
      const p = await sql`SELECT id FROM class_presenters WHERE id = ${presenterId} AND session_id = ${id} AND active = TRUE`;
      if (p.length === 0) return res.status(404).json({ error: 'Presenter not found' });

      for (const r of ratings) {
        const idea = parseInt(r.idea), x = parseInt(r.x), y = parseInt(r.y);
        if (!(idea >= 1 && idea <= s.ideas_per_presenter) || !(x >= 1 && x <= 5) || !(y >= 1 && y <= 5)) {
          return res.status(400).json({ error: 'Each rating needs an idea number and two scores from 1 to 5' });
        }
      }
      const tok = String(token).slice(0, 64);
      // Rating the same presenter again from the same phone replaces the earlier answer.
      for (const r of ratings) {
        await sql`
          INSERT INTO class_ratings (session_id, presenter_id, idea_number, rater_token, x, y)
          VALUES (${id}, ${presenterId}, ${parseInt(r.idea)}, ${tok}, ${parseInt(r.x)}, ${parseInt(r.y)})
          ON CONFLICT (session_id, presenter_id, idea_number, rater_token)
          DO UPDATE SET x = EXCLUDED.x, y = EXCLUDED.y, created_at = NOW()
        `;
      }
      return res.status(200).json({ ok: true });
    }

    // ---------- Public: anonymous results (scores only, never who rated) ----------
    if (action === 'results' && req.method === 'GET') {
      const s = await loadSession(sql, req.query.id);
      if (!s) return res.status(404).json({ error: 'Session not found' });
      const presenters = await loadPresenters(sql, s.id);
      const ratings = await sql`
        SELECT presenter_id, idea_number, x, y FROM class_ratings
        WHERE session_id = ${s.id} ORDER BY created_at ASC
      `;
      return res.status(200).json({ ...sessionOut(s), presenters, ratings });
    }

    // ---------- Everything below is instructor-only ----------
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!PASSCODE || body.passcode !== PASSCODE) return res.status(403).json({ error: 'Invalid passcode' });

    if (action === 'create') {
      const tool = TOOLS.includes(body.tool) ? body.tool : null;
      const name = String(body.name || '').trim().slice(0, 120);
      const names = cleanNames(body.names);
      if (!tool || !name) return res.status(400).json({ error: 'tool and name are required' });
      if (names.length === 0) return res.status(400).json({ error: 'The class list is empty' });

      const id = crypto.randomBytes(4).toString('hex');
      const z = clampZone(body.zone);
      const ideas = Math.min(Math.max(parseInt(body.ideasPerPresenter) || 1, 1), 3);
      const product = String(body.targetProduct || '').trim().slice(0, 80) || 'product';

      await sql`
        INSERT INTO class_sessions (id, tool, name, target_product, ideas_per_presenter, zone_cx, zone_cy, zone_rx, zone_ry, label_mode)
        VALUES (${id}, ${tool}, ${name}, ${product}, ${ideas}, ${z.cx}, ${z.cy}, ${z.rx}, ${z.ry}, 'hidden')
      `;
      for (let i = 0; i < names.length; i++) {
        await sql`INSERT INTO class_presenters (session_id, name, position) VALUES (${id}, ${names[i]}, ${i})`;
      }
      return res.status(201).json({ id });
    }

    if (action === 'update') {
      const s = await loadSession(sql, body.id);
      if (!s) return res.status(404).json({ error: 'Session not found' });

      if (body.zone) {
        const z = clampZone(body.zone);
        await sql`UPDATE class_sessions SET zone_cx = ${z.cx}, zone_cy = ${z.cy}, zone_rx = ${z.rx}, zone_ry = ${z.ry} WHERE id = ${s.id}`;
      }
      if (LABEL_MODES.includes(body.labelMode)) {
        await sql`UPDATE class_sessions SET label_mode = ${body.labelMode} WHERE id = ${s.id}`;
      }
      if (Array.isArray(body.addNames)) {
        const existing = await loadPresenters(sql, s.id);
        const have = new Set(existing.map(p => p.name.toLowerCase()));
        let pos = existing.length ? Math.max(...existing.map(p => p.position)) + 1 : 0;
        for (const n of cleanNames(body.addNames)) {
          if (have.has(n.toLowerCase())) continue;
          await sql`INSERT INTO class_presenters (session_id, name, position) VALUES (${s.id}, ${n}, ${pos++})`;
        }
      }
      if (body.removePresenterId) {
        // Hidden, not deleted, so ratings already given are kept for the review page.
        await sql`UPDATE class_presenters SET active = FALSE WHERE id = ${body.removePresenterId} AND session_id = ${s.id}`;
      }
      const fresh = await loadSession(sql, s.id);
      const presenters = await loadPresenters(sql, s.id);
      return res.status(200).json({ ...sessionOut(fresh), presenters });
    }

    if (action === 'delete') {
      // Removes the session with its class list and ratings (ON DELETE CASCADE).
      await sql`DELETE FROM class_sessions WHERE id = ${body.id}`;
      return res.status(200).json({ ok: true });
    }

    if (action === 'eraseAll') {
      // Everything: sessions, class lists and ratings (ON DELETE CASCADE).
      await sql`DELETE FROM class_sessions`;
      return res.status(200).json({ ok: true });
    }

    if (action === 'list') {
      const rows = await sql`
        SELECT s.*,
          (SELECT COUNT(*)::int FROM class_presenters p WHERE p.session_id = s.id AND p.active) AS presenter_count,
          (SELECT COUNT(DISTINCT r.rater_token)::int FROM class_ratings r WHERE r.session_id = s.id) AS rater_count
        FROM class_sessions s ORDER BY s.created_at DESC LIMIT 100
      `;
      return res.status(200).json(rows.map(s => ({
        ...sessionOut(s), presenterCount: s.presenter_count, raterCount: s.rater_count
      })));
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
