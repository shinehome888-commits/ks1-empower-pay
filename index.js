// KS1 EMPOWER PAY – MINIMAL ADMIN VERSION
// Built for reliability on Render.com

const express = require('express');
const { Pool } = require('pg');
const app = express();
app.use(express.json());

// Get DB URL from environment
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("❌ DATABASE_URL missing");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }
});

// Simple health check
app.get('/api/test', (req, res) => {
  res.json({ status: '✅ LIVE', message: 'KS1 Empower Pay is running' });
});

// Admin dashboard
app.get('/admin', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*)::int AS tx, COALESCE(SUM(commission_amount), 0)::float AS total FROM commissions'
    );
    const { tx, total } = result.rows[0];
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width">
        <title>KS1EGF Admin</title>
        <style>
          body { background: #000; color: white; font-family: sans-serif; padding: 20px; }
          .card { background: #111; padding: 20px; margin: 15px 0; border-radius: 10px; }
          .stat { font-size: 2rem; color: #3b82f6; font-weight: bold; }
          .label { color: #aaa; }
          .mission { background: #1e3a8a; padding: 15px; border-radius: 8px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>KS1 Empire Group & Foundation</h1>
        <div class="card">
          <div class="label">Total Transactions</div>
          <div class="stat">${tx}</div>
        </div>
        <div class="card">
          <div class="label">Total Commissions</div>
          <div class="stat">GHS ${total.toFixed(2)}</div>
        </div>
        <div class="mission">
          <strong>Funds used for:</strong><br/>
          Empowering African SMEs through digital financial inclusion.
        </div>
        <p><a href="/">← Back to POS</a></p>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("Admin error:", err.message);
    res.status(500).send("Database error: " + err.message);
  }
});

// Basic homepage
app.get('/', (req, res) => {
  res.send(`
    <h2>KS1 Empower Pay</h2>
    <p>✅ System is LIVE</p>
    <p><a href="/admin">View Admin Dashboard</a></p>
    <p><a href="/api/test">Test API</a></p>
  `);
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log("🚀 KS1 Empower Pay started on port", PORT);
});
