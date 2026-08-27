// One-off migration: adds note_chat_messages (per-note AI chat thread - "continue
// chatting to enhance this idea"). Safe to re-run (IF NOT EXISTS throughout).
// Run with: npx tsx scripts/migrate_note_chat_messages.ts
import { db } from '../lib/db.server';

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS note_chat_messages (
      id SERIAL PRIMARY KEY,
      frontend_id VARCHAR(255) UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      note_id VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_note_chat_messages_user_id ON note_chat_messages(user_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_note_chat_messages_note_id ON note_chat_messages(note_id)`);

  console.log('Migration completed successfully.');
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
