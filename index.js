// KS1 EMPOWER PAY – COMPLETE WORKING VERSION
// Modern UI • Yellow Gold Branding • Supabase • Render-Ready

const express = require('express');
const { Pool } = require('pg');
const app = express();
app.use(express.json());

// Database setup
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("❌ DATABASE_URL missing in Render Environment");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }
});

// Initialize database
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS commissions (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL,
        gross_amount REAL NOT NULL,
        commission_amount REAL NOT NULL,
        net_to_merchant REAL NOT NULL,
        ks1egf_wallet TEXT NOT NULL DEFAULT '+233240254680',
        currency TEXT DEFAULT 'GHS',
        payment_method TEXT DEFAULT 'momo',
        status TEXT DEFAULT 'completed',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log("✅ Database ready");
  } catch (err) {
    console.error("❌ DB Error:", err.message);
  }
}

// API: Mock MoMo payment
app.post('/api/momo/request', async (req, res) => {
  const { amount = 100, phone } = req.body;
  if (!phone || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  setTimeout(async () => {
    const commissionAmount = parseFloat((amount * 0.003).toFixed(2));
    const netToMerchant = parseFloat((amount - commissionAmount).toFixed(2));
    const txId = 'tx_' + Date.now();
    const commissionId = 'c_' + Date.now();

    try {
      await pool.query(
        `INSERT INTO commissions (id, transaction_id, gross_amount, commission_amount, net_to_merchant, payment_method)
         VALUES ($1, $2, $3, $4, $5, 'momo')`,
        [commissionId, txId, amount, commissionAmount, netToMerchant]
      );
    } catch (err) {
      console.error("Save error:", err.message);
    }
  }, 3000);

  res.json({
    success: true,
    message: "Payment request sent",
    amount,
    phone
  });
});

// Health check
app.get('/api/test', (req, res) => {
  res.json({ status: '✅ LIVE', nonprofit: 'KS1 Empire Group & Foundation' });
});

// Admin stats
app.get('/api/commissions', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*)::int AS count, COALESCE(SUM(commission_amount),0)::float AS total FROM commissions');
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'DB unavailable' });
  }
});

// MAIN FRONTEND WITH YELLOW GOLD UI
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>KS1 Empower Pay</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: system-ui;
          background: #000;
          color: #fff;
          padding: 1.5rem;
          max-width: 600px;
          margin: 0 auto;
        }
        header { text-align: center; padding: 1.8rem 0; margin-bottom: 2rem; }
        h1 {
          font-size: 2.2rem;
          background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .subtitle {
          color: #FFD700; /* YELLOW GOLD */
          font-size: 1.05rem;
          font-weight: 600;
          text-shadow: 0 0 8px rgba(255, 215, 0, 0.3);
        }
        .card {
          background: rgba(20, 20, 25, 0.85);
          border-radius: 20px;
          padding: 1.8rem;
          margin-bottom: 1.8rem;
          box-shadow: 0 8px 20px rgba(0,0,0,0.5);
        }
        .card h2 {
          color: #FFD700; /* YELLOW GOLD */
          font-size: 1.4rem;
          margin-bottom: 1.2rem;
          font-weight: 700;
        }
        input, button {
          width: 100%;
          padding: 0.95rem;
          margin: 0.6rem 0;
          border: none;
          border-radius: 12px;
          font-size: 1.05rem;
        }
        input {
          background: #1a1a1f;
          color: white;
          border: 1px solid #333;
        }
        .btn-momo {
          background: linear-gradient(135deg, #FFD700, #D4AF37);
          color: #000;
          font-weight: 800;
          text-transform: uppercase;
          box-shadow: 0 6px 0 #B8860B, 0 8px 16px rgba(0,0,0,0.4);
        }
        .btn-momo:hover {
          background: linear-gradient(135deg, #FFE04D, #E6C24A);
          transform: translateY(2px);
          box-shadow: 0 4px 0 #B8860B, 0 6px 12px rgba(0,0,0,0.4);
        }
        .btn-momo:active {
          transform: translateY(6px);
          box-shadow: 0 0 0 #B8860B, 0 4px 8px rgba(0,0,0,0.3);
        }
        #result {
          margin-top: 1.2rem;
          padding: 1.2rem;
          border-radius: 12px;
          display: none;
          background: rgba(15, 23, 42, 0.7);
          border-left: 4px solid #3b82f6;
          color: #dbeafe;
        }
        .footer {
          text-align: center;
          color: #777;
          font-size: 0.85rem;
          padding-top: 2rem;
          border-top: 1px solid #222;
        }
      </style>
    </head>
    <body>
      <header>
        <h1>KS1 Empower Pay</h1>
        <p class="subtitle">Non-custodial • Africa-first • Nonprofit-powered</p>
      </header>

      <div class="card">
        <h2>Create Payment</h2>
        <input type="number" id="amount" placeholder="Amount in GHS" min="1" value="100"/>
        <input type="text" id="phone" placeholder="Customer MoMo number (e.g. +233...)" value="+233240000000"/>
        <button class="btn-momo" onclick="requestMomo()">Pay via Mobile Money</button>
        <div id="result"></div>
      </div>

      <div class="footer">
        © 2026 KS1 Empire Group & Foundation (KS1EGF)<br/>
        Built with love for every African entrepreneur.
      </div>

      <script>
        async function requestMomo() {
          const amount = parseFloat(document.getElementById('amount').value);
          const phone = document.getElementById('phone').value.trim();
          const r = document.getElementById('result');
          
          if (!amount || amount <= 0 || !phone.startsWith('+233')) {
            r.innerHTML = 'Enter valid GHS amount and +233 number';
            r.style.display = 'block';
            return;
          }

          r.innerHTML = 'Sending request to ' + phone + '...';
          r.style.display = 'block';

          try {
            const res = await fetch('/api/momo/request', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount, phone })
            });
            const data = await res.json();
            if (data.success) {
              r.innerHTML = '✅ Request sent! Waiting for approval...';
              setTimeout(() => {
                r.innerHTML = '<strong>🎉 Payment Completed!</strong><br/>Commission to KS1EGF: GHS ' + (amount * 0.003).toFixed(2);
              }, 4000);
            }
          } catch (e) {
            r.innerHTML = '❌ Network error';
            r.style.display = 'block';
          }
        }
      </script>
    </body>
    </html>
  `);
});

// Start server
initDB().then(() => {
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 KS1 Empower Pay running on port ${PORT}`);
  });
});
