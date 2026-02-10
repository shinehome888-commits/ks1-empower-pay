// KS1 EMPOWER PAY – ALKEBULAN (AFRICA) EDITION • FINAL BRAND
// Non-custodial • Alkebulan (AFRICA)-first • Nonprofit-powered

const express = require('express');
const { Pool } = require('pg');
const dns = require('dns');

// 🔑 FORCE IPv4 FOR RENDER + SUPABASE
dns.setDefaultResultOrder('ipv4first');

const app = express();
app.use(express.json());

// === CONFIGURATION ===
const BUSINESS_PASSWORD = process.env.BUSINESS_PASSWORD || "ks1empower";
const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  console.error("❌ FATAL: DATABASE_URL not set in Render Environment");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }
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
  } catch (err) {
    console.error("❌ Database error:", err.message);
  }
}

// === MOCK MOMO API ===
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

// Commission stats
app.get('/api/commissions', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*)::int AS count, COALESCE(SUM(commission_amount),0)::float AS total FROM commissions');
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'DB unavailable' });
  }
});

// === LOGIN PAGE ===
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
          max-width: 500px;
          margin: 0 auto;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .login-card {
          background: #0a0a0f;
          border-radius: 20px;
          padding: 2rem;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
          border: 1px solid #222;
        }
        h1 {
          font-size: 2.3rem;
          font-weight: 900;
          color: #1e3a8a;
          text-align: center;
          margin-bottom: 1.8rem;
          text-shadow: 
            0 4px 0 #1d4ed8,
            0 6px 12px rgba(0,0,0,0.5);
        }
        input {
          width: 100%;
          padding: 0.95rem;
          margin: 0.8rem 0;
          border: none;
          border-radius: 12px;
          background: #111;
          color: white;
          border: 1px solid #333;
          outline: none;
        }
        input:focus {
          border-color: #FFD700;
          box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.3);
        }
        .password-toggle {
          position: absolute;
          right: 1.2rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #aaa;
          cursor: pointer;
          font-size: 1.2rem;
        }
        .btn-login {
          background: linear-gradient(135deg, #FFD700, #D4AF37);
          color: #000;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-size: 1.1rem;
          padding: 0.95rem;
          border: none;
          border-radius: 12px;
          width: 100%;
          cursor: pointer;
          box-shadow: 
            0 5px 0 #B8860B,
            0 7px 14px rgba(0,0,0,0.4);
          transition: all 0.15s ease;
        }
        .btn-login:hover {
          background: linear-gradient(135deg, #FFE04D, #E6C24A);
          transform: translateY(2px);
          box-shadow: 
            0 3px 0 #B8860B,
            0 5px 12px rgba(0,0,0,0.4);
        }
        .btn-login:active {
          transform: translateY(5px);
          box-shadow: 
            0 0 0 #B8860B,
            0 3px 8px rgba(0,0,0,0.3);
        }
        .error {
          color: #ef4444;
          text-align: center;
          margin-top: 1rem;
          font-size: 0.9rem;
        }
      </style>
    </head>
    <body>
      <div class="login-card">
        <h1>KS1 Empower Pay</h1>
        <div style="position: relative;">
          <input type="password" id="password" placeholder="Enter Business Password" />
          <button class="password-toggle" onclick="togglePassword()">👁️</button>
        </div>
        <button class="btn-login" onclick="login()">Access Account</button>
        <div id="error" class="error"></div>
      </div>

      <script>
        function togglePassword() {
          const pwd = document.getElementById('password');
          pwd.type = pwd.type === 'password' ? 'text' : 'password';
        }

        function login() {
          const pwd = document.getElementById('password').value;
          if (pwd === '${BUSINESS_PASSWORD}') {
            localStorage.setItem('ks1_auth', 'true');
            window.location.href = '/app';
          } else {
            document.getElementById('error').textContent = 'Invalid password. Contact KS1EGF.';
          }
        }
      </script>
    </body>
    </html>
  `);
});

// === MAIN APP AFTER LOGIN ===
app.get('/app', (req, res) => {
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
          padding: 1.6rem 0;
          margin-bottom: 1.8rem;
        }
        h1 {
          font-size: 2.3rem;
          font-weight: 900;
          color: #1e3a8a;
          text-shadow: 
            0 4px 0 #1d4ed8,
            0 6px 12px rgba(0,0,0,0.5);
          letter-spacing: -0.5px;
        }
        .subtitle {
          color: #fff;
          font-size: 1.1rem;
          font-weight: 800;
          letter-spacing: 0.8px;
          margin-top: 0.5rem;
          text-shadow: 
            0 2px 0 #555,
            0 4px 8px rgba(0,0,0,0.6);
          text-transform: uppercase;
        }
        .card {
          background: #0f0f14;
          border-radius: 18px;
          padding: 1.7rem;
          margin-bottom: 1.7rem;
          box-shadow: 0 0 20px rgba(255, 215, 0, 0.15);
          border: 1px solid rgba(255, 215, 0, 0.1);
        }
        .card h2 {
          color: #FFD700;
          font-size: 1.35rem;
          margin-bottom: 1.1rem;
          font-weight: 700;
          text-shadow: 0 0 5px rgba(255, 215, 0, 0.25);
        }
        input, button {
          width: 100%;
          padding: 0.9rem;
          margin: 0.6rem 0;
          border: none;
          border-radius: 12px;
          font-size: 1.02rem;
        }
        input {
          background: #111;
          color: white;
          border: 1px solid #333;
          outline: none;
        }
        input:focus {
          border-color: #FFD700;
          box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.2);
        }
        .btn-momo {
          background: linear-gradient(135deg, #FFD700, #D4AF37);
          color: #000;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-size: 1.08rem;
          box-shadow: 
            0 5px 0 #B8860B,
            0 7px 14px rgba(0,0,0,0.4);
          transition: all 0.15s ease;
        }
        .btn-momo:hover {
          background: linear-gradient(135deg, #FFE04D, #E6C24A);
          transform: translateY(2px);
          box-shadow: 
            0 3px 0 #B8860B,
            0 5px 12px rgba(0,0,0,0.4);
        }
        .btn-momo:active {
          transform: translateY(5px);
          box-shadow: 
            0 0 0 #B8860B,
            0 3px 8px rgba(0,0,0,0.3);
        }
        .blue-heart {
          color: #3b82f6;
          text-shadow: 0 0 8px rgba(59, 130, 246, 0.8);
          font-weight: 900;
          margin-right: 6px;
        }
        #result {
          margin-top: 1.1rem;
          padding: 1.1rem;
          border-radius: 12px;
          display: none;
          background: #1e3a8a;
          border-left: 4px solid #3b82f6;
          color: #dbeafe;
          font-weight: 600;
        }
        .footer {
          text-align: center;
          color: #777;
          font-size: 0.85rem;
          padding-top: 1.8rem;
          border-top: 1px solid #222;
        }
      </style>
    </head>
    <body>
      <header>
        <h1>KS1 Empower Pay</h1>
        <p class="subtitle">Non-custodial • Alkebulan (AFRICA)-first • Nonprofit-powered</p>
      </header>

      <div class="card">
        <h2>Create Payment</h2>
        <input type="number" id="amount" placeholder="Amount in GHS" min="1" value="100"/>
        <input type="text" id="phone" placeholder="Customer MoMo number (e.g. +233...)" value="+233240000000"/>
        <button class="btn-momo" onclick="requestMomo()"><span class="blue-heart">💙</span> Pay & Empower Alkebulan (AFRICA)</button>
        <div id="result"></div>
      </div>

      <div class="footer">
        © 2026 KS1 Empire Group & Foundation (KS1EGF)<br/>
        A 0.3% solidarity contribution funds Alkebulan (AFRICA) digital freedom.
      </div>

      <script>
        // Auto-logout after 30 seconds of inactivity
        let inactivityTimer;
        function resetTimer() {
          clearTimeout(inactivityTimer);
          inactivityTimer = setTimeout(() => {
            localStorage.removeItem('ks1_auth');
            alert('Session expired for security. Please log in again.');
            window.location.href = '/';
          }, 30000); // 30 seconds
        }
        ['click','touchstart','keypress','scroll'].forEach(e => {
          document.addEventListener(e, resetTimer, true);
        });
        resetTimer();

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
              const receipt = \`
                <div style="font-family: monospace; font-size: 0.95rem;">
                  <strong>📄 TRANSACTION RECEIPT</strong><br/><br/>
                  Gross Amount: GHS \${data.amount}<br/>
                  Solidarity Contribution (0.3%): GHS \${(data.amount * 0.003).toFixed(2)}<br/>
                  You Receive: GHS \${(data.amount * 0.997).toFixed(2)}<br/>
                  Status: Completed<br/>
                  Timestamp: \${new Date().toLocaleString()}
                </div>
                <br/>
                You just empowered Alkebulan (AFRICA) digital freedom!
              \`;
              r.innerHTML = '<strong>🎉 Payment Completed!</strong><br/>' + receipt;
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

// === RENDER-COMPLIANT SERVER START ===
const PORT = parseInt(process.env.PORT, 10) || 10000;
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 KS1 Empower Pay running on port ${PORT}`);
  });
});
