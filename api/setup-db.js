const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        class_size INTEGER NOT NULL DEFAULT 28,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        group_name TEXT NOT NULL DEFAULT 'General',
        presenter TEXT NOT NULL,
        product_type TEXT NOT NULL DEFAULT 'consumer',
        product_label TEXT NOT NULL DEFAULT 'product',
        class_size INTEGER NOT NULL DEFAULT 28,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS ratings (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        n1 INTEGER NOT NULL CHECK (n1 BETWEEN 1 AND 5),
        n2 INTEGER NOT NULL CHECK (n2 BETWEEN 1 AND 5),
        n3 INTEGER NOT NULL CHECK (n3 BETWEEN 1 AND 5),
        n4 INTEGER NOT NULL CHECK (n4 BETWEEN 1 AND 5),
        n5 INTEGER NOT NULL DEFAULT 3 CHECK (n5 BETWEEN 1 AND 5),
        f1 INTEGER NOT NULL CHECK (f1 BETWEEN 1 AND 5),
        f2 INTEGER NOT NULL CHECK (f2 BETWEEN 1 AND 5),
        f3 INTEGER NOT NULL CHECK (f3 BETWEEN 1 AND 5),
        f4 INTEGER NOT NULL CHECK (f4 BETWEEN 1 AND 5),
        f5 INTEGER NOT NULL DEFAULT 3 CHECK (f5 BETWEEN 1 AND 5),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Add columns for existing tables
    await sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS group_id TEXT`;
    await sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS group_name TEXT NOT NULL DEFAULT 'General'`;
    await sql`ALTER TABLE ratings ADD COLUMN IF NOT EXISTS n5 INTEGER NOT NULL DEFAULT 3`;
    await sql`ALTER TABLE ratings ADD COLUMN IF NOT EXISTS f5 INTEGER NOT NULL DEFAULT 3`;

    // Metaphoric Design Evaluation tables
    await sql`
      CREATE TABLE IF NOT EXISTS meta_sessions (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        group_name TEXT NOT NULL DEFAULT 'General',
        presenter TEXT NOT NULL,
        target_product TEXT NOT NULL DEFAULT 'product',
        num_ideas INTEGER NOT NULL DEFAULT 3,
        idea1 TEXT NOT NULL DEFAULT 'Idea 1',
        idea2 TEXT,
        idea3 TEXT,
        class_size INTEGER NOT NULL DEFAULT 28,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS meta_ratings (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        idea_number INTEGER NOT NULL CHECK (idea_number BETWEEN 1 AND 3),
        abstraction INTEGER NOT NULL CHECK (abstraction BETWEEN 1 AND 5),
        relevance INTEGER NOT NULL CHECK (relevance BETWEEN 1 AND 5),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // v2: one-QR class sessions (shared by both tools)
    await sql`
      CREATE TABLE IF NOT EXISTS class_sessions (
        id TEXT PRIMARY KEY,
        tool TEXT NOT NULL CHECK (tool IN ('maya', 'meta')),
        name TEXT NOT NULL,
        target_product TEXT NOT NULL DEFAULT 'product',
        ideas_per_presenter INTEGER NOT NULL DEFAULT 1 CHECK (ideas_per_presenter BETWEEN 1 AND 3),
        zone_cx REAL NOT NULL,
        zone_cy REAL NOT NULL,
        zone_rx REAL NOT NULL,
        zone_ry REAL NOT NULL,
        label_mode TEXT NOT NULL DEFAULT 'hidden',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS class_presenters (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS class_ratings (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
        presenter_id INTEGER NOT NULL REFERENCES class_presenters(id) ON DELETE CASCADE,
        idea_number INTEGER NOT NULL CHECK (idea_number BETWEEN 1 AND 3),
        rater_token TEXT NOT NULL,
        x INTEGER NOT NULL CHECK (x BETWEEN 1 AND 5),
        y INTEGER NOT NULL CHECK (y BETWEEN 1 AND 5),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (session_id, presenter_id, idea_number, rater_token)
      )
    `;

    res.status(200).json({ ok: true, message: 'All tables ready (MAYA + Metaphoric + class sessions).' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
