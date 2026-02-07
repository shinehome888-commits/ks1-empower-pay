// KS1 EMPOWER PAY – PHASE 4 (ALL-IN-ONE)
// Nonprofit payment platform for African SMEs by KS1 Empire Group & Foundation (KS1EGF)

const express = require('express');
const { Pool } = require('pg');
const app = express();
app.use(express.json());

// ONLY use environment variable — never hardcode
const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  console.error("❌ FATAL: DATABASE_URL not set in Render Environment");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DB_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

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
    return true;
  } catch (err) {
    console.error("❌ Database error:", err.message);
    return false;
  }
}

// === MOCK MOMO ENDPOINT ===
app.post('/api/momo/request', async (req, res) => {
  const { amount = 100, phone } = req.body;
  if (!phone || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Invalid phone or amount' });
  }

  console.log(`📱 MoMo Request: GHS ${amount} to ${phone}`);

  setTimeout(async () => {
    const commissionRate = 0.003;
    const commissionAmount = parseFloat((amount * commissionRate).toFixed(2));
    const netToMerchant = parseFloat((amount - commissionAmount).toFixed(2));
    const txId = 'tx_' + Date.now();
    const commissionId = 'c_' + Date.now();

    try {
      await pool.query(
        `INSERT INTO commissions (id, transaction_id, gross_amount, commission_amount, net_to_merchant, payment_method)
         VALUES ($1, $2, $3, $4, $5, 'momo')`,
        [commissionId, txId, amount, commissionAmount, netToMerchant]
      );
      console.log("✅ Commission saved:", commissionId);
    } catch (err) {
      console.error("DB_SAVE_ERROR:", err.message);
    }
  }, 3000);

  res.json({
    success: true,
    message: "Payment request sent to customer's phone",
    transaction_id: 'mock_tx_' + Date.now(),
    amount,
    phone
  });
});

// Health check
app.get('/api/test', (req, res) => {
  res.json({
    status: '✅ LIVE',
    nonprofit: 'KS1 Empire Group & Foundation (KS1EGF)',
    mission: 'Empower African SMEs via micro-commissions'
  });
});

// View all commissions
app.get('/api/commissions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM commissions ORDER BY created_at DESC LIMIT 100');
    const total = result.rows.reduce((sum, c) => sum + c.commission_amount, 0);
    res.json({
      total_commissions_count: result.rows.length,
      total_commission_amount: parseFloat(total.toFixed(2)),
      list: result.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Database unavailable' });
  }
});

// === ADMIN DASHBOARD ===
app.get('/admin', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*)::int AS total_transactions, COALESCE(SUM(commission_amount), 0)::float AS total_commission FROM commissions');
    const stats = result.rows[0];
    
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>KS1EGF Admin Dashboard</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: system-ui;
            background: #000;
            color: #fff;
            line-height: 1.6;
            padding: 1.5rem;
            max-width: 600px;
            margin: 0 auto;
          }
          header {
            text-align: center;
            padding: 1.5rem 0;
            border-bottom: 1px solid #333;
            margin-bottom: 2rem;
          }
          h1 {
            font-size: 1.8rem;
            color: #3b82f6;
          }
          .card {
            background: #111;
            border-radius: 16px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          }
          .stat {
            font-size: 2.2rem;
            font-weight: bold;
            color: #3b82f6;
            margin: 0.5rem 0;
          }
          .label {
            color: #aaa;
            font-size: 0.95rem;
          }
          .mission {
            background: #1e3a8a;
            border-left: 4px solid #3b82f6;
            padding: 1.2rem;
            border-radius: 10px;
            margin-top: 1.5rem;
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
          <h1>KS1 Empire Group & Foundation</h1>
          <p>Admin Dashboard • Transparency Report</p>
        </header>

        <div class="card">
          <div class="label">Total Transactions</div>
          <div class="stat">${stats.total_transactions}</div>
        </div>

        <div class="card">
          <div class="label">Total Commissions Earned</div>
          <div class="stat">GHS ${parseFloat(stats.total_commission).toFixed(2)}</div>
        </div>

        <div class="mission">
          <strong>Funds used for:</strong><br/>
          Empowering African SMEs through digital financial inclusion,<br/>
          supporting education, innovation, and sustainable development<br/>
          across Ghana and beyond.
        </div>

        <div class="footer">
          © 2026 KS1 Empire Group & Foundation (KS1EGF)<br/>
          Every transaction fuels our mission.
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("Admin dashboard error:", err.message);
    res.status(500).send("Error loading dashboard");
  }
});

// === MAIN POS FRONTEND ===
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
          line-height: 1.6;
          padding: 1.5rem;
          max-width: 600px;
          margin: 0 auto;
        }
        header {
          text-align: center;
          padding: 1.5rem 0;
          border-bottom: 1px solid #333;
          margin-bottom: 1.5rem;
        }
        h1 {
          font-size: 1.8rem;
          background: linear-gradient(90deg, #3b82f6, #10b981);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .card {
          background: #111;
          border-radius: 16px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        input, button {
          width: 100%;
          padding: 0.85rem;
          margin: 0.5rem 0;
          border: none;
          border-radius: 10px;
          font-size: 1rem;
        }
        input {
          background: #222;
          color: white;
          border: 1px solid #333;
        }
        /* 🔵 BLUE 3D BUTTON */
        .btn-momo {
          background: #3b82f6;
          color: white;
          font-weight: bold;
          text-shadow: 0 -1px 0 rgba(0,0,0,0.2);
          box-shadow: 
            0 4px 0 #1d4ed8,
            0 6px 8px rgba(0,0,0,0.3);
          transition: all 0.1s ease;
        }
        .btn-momo:hover {
          background: #2563eb;
          transform: translateY(2px);
          box-shadow: 
            0 2px 0 #1d4ed8,
            0 4px 6px rgba(0,0,0,0.3);
        }
        .btn-momo:active {
          transform: translateY(4px);
          box-shadow: 
            0 0 0 #1d4ed8,
            0 2px 4px rgba(0,0,0,0.3);
        }
        /* 🔵 BLUE COMMISSION RESULT AREA */
        #result {
          margin-top: 1rem;
          padding: 1rem;
          border-radius: 10px;
          display: none;
          background: #1e3a8a;
          border-left: 4px solid #3b82f6;
          color: #dbeafe;
        }
        .footer {
          text-align: center;
          color: #777;
          font-size: 0.85rem;
          padding-top: 1.5rem;
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
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 KS1 Empower Pay running on port ${PORT}`);
  });
});
