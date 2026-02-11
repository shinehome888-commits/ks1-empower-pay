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
const BUSINESS_PASSWORD = process.env.BUSINESS_PASSWORD || "ks1empower2026";

// === DATABASE SETUP ===
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

// === LANDING PAGE WITH HARMONIZED MISSION SECTION ===
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
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #000;
          color: #fff;
          line-height: 1.5;
          padding: 0 1rem;
          max-width: 460px;
          margin: 0 auto;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding-top: 2vh;
          padding-bottom: 2vh;
        }
        .login-card {
          background: rgba(12, 12, 18, 0.95);
          border-radius: 16px;
          padding: 1.4rem;
          box-shadow: 
            0 6px 16px rgba(255, 215, 0, 0.16),
            inset 0 0 10px rgba(255, 215, 0, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.1);
          width: 100%;
        }
        h1 {
          font-size: 1.7rem;
          font-weight: 800;
          color: #1e3a8a;
          text-align: center;
          margin-bottom: 1.2rem;
          letter-spacing: -0.4px;
          text-shadow: 0 2px 3px rgba(0,0,0,0.3);
        }
        .subtitle {
          color: #FFD700;
          font-size: 0.9rem;
          text-align: center;
          margin-bottom: 1.4rem;
          letter-spacing: 0.4px;
          font-weight: 600;
        }
        .form-group {
          margin-bottom: 0.9rem;
          position: relative;
        }
        input {
          width: 100%;
          padding: 0.7rem 0.85rem;
          border: none;
          border-radius: 9px;
          background: #111;
          color: white;
          border: 1px solid #333;
          font-size: 0.92rem;
        }
        input:focus {
          border-color: #FFD700;
          box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.25);
          outline: none;
        }
        .password-toggle {
          position: absolute;
          right: 0.85rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #aaa;
          cursor: pointer;
          font-size: 1rem;
        }
        .btn-login {
          background: linear-gradient(135deg, #FFD700, #D4AF37);
          color: #000;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          font-size: 0.93rem;
          padding: 0.75rem;
          border: none;
          border-radius: 9px;
          width: 100%;
          cursor: pointer;
          box-shadow: 
            0 3px 0 #B8860B,
            0 5px 9px rgba(0,0,0,0.3);
          transition: all 0.15s ease;
        }
        .btn-login:hover {
          background: linear-gradient(135deg, #FFE04D, #E6C24A);
          transform: translateY(2px);
          box-shadow: 
            0 1px 0 #B8860B,
            0 3px 7px rgba(0,0,0,0.25);
        }
        .btn-login:active {
          transform: translateY(3px);
          box-shadow: 
            0 0 0 #B8860B,
            0 2px 5px rgba(0,0,0,0.2);
        }
        .error {
          color: #ef4444;
          text-align: center;
          margin-top: 0.8rem;
          font-size: 0.83rem;
          min-height: 1.2rem;
        }
        .footer {
          text-align: center;
          color: #777;
          font-size: 0.73rem;
          padding-top: 1.1rem;
          margin-top: auto;
        }
        .trademark {
          color: #aaa;
          font-size: 0.71rem;
          margin-top: 0.4rem;
          font-style: italic;
          line-height: 1.4;
        }

        /* ✅ HARMONIZED VALUES SECTION */
        .values-section {
          margin-top: 2rem;
          padding: 1.5rem;
          background: rgba(15, 15, 25, 0.8);
          border-radius: 16px;
          border: 1px solid rgba(255, 215, 0, 0.15);
          /* Yellow gold glow */
          box-shadow: 
            0 0 12px rgba(255, 215, 0, 0.15),
            inset 0 0 8px rgba(255, 215, 0, 0.08);
        }
        .values-section h3 {
          color: #1e3a8a; /* Deep royal blue */
          text-align: center;
          margin-bottom: 1.4rem;
          font-weight: 900;
          letter-spacing: -0.5px;
          text-shadow: 0 2px 4px rgba(255, 215, 0, 0.2);
        }
        .value-card {
          background: rgba(30, 58, 138, 0.2); /* Uniform deep blue */
          padding: 1rem;
          border-radius: 12px;
          margin-bottom: 1.2rem;
          border-left: 3px solid #FFD700; /* Gold accent */
        }
        .value-card strong {
          color: #FFD700; /* Yellow gold */
          display: block;
          margin-bottom: 0.5rem;
          font-size: 0.98rem;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .value-card p {
          font-size: 0.92rem;
          color: #dbeafe;
          line-height: 1.55;
        }
      </style>
    </head>
    <body>
      <div class="login-card">
        <h1>KS1 Empower Pay</h1>
        <p class="subtitle">Secure Access for Authorized Merchants</p>

        <div class="form-group">
          <input type="password" id="password" placeholder="Enter Business Password" autocomplete="off" />
          <button class="password-toggle" onclick="togglePassword()">👁️</button>
        </div>
        <button class="btn-login" onclick="login()">Access Dashboard</button>
        <div id="error" class="error"></div>
      </div>

      <!-- ✅ HARMONIZED MISSION / VISION / WHO WE ARE -->
      <div class="values-section">
        <h3>Our Heartbeat</h3>
        <div class="value-card">
          <strong>MISSION</strong>
          <p>To restore digital freedom for African SMEs, informal traders, and nonprofits by building open, non-custodial payment infrastructure that puts power back in the hands of the people — not platforms.</p>
        </div>
        <div class="value-card">
          <strong>VISION</strong>
          <p>An Alkebulan (AFRICA) where every street vendor, artisan, and community enterprise thrives in a digital economy they own, shape, and trust.</p>
        </div>
        <div class="value-card">
          <strong>WHO WE ARE</strong>
          <p>We are builders, dreamers, and stewards of a more just digital world — united under the banner of KS1 Empire Group & Foundation (KS1EGF). We are not a corporation. We are a nonprofit-powered collective who believe: “This is for the people.”</p>
        </div>
      </div>

      <div class="footer">
        © 2026 KS1 Empower Pay – A nonprofit project by KS1 Empire Group & Foundation (KS1EGF)<br/>
        <span class="trademark">Built for Alkebulan (Africa) SMEs, Businesses And Entrepreneurs — united in digital sovereignty and shared prosperity.</span>
      </div>

      <script>
        function togglePassword() {
          const pwd = document.getElementById('password');
          const btn = pwd.nextElementSibling;
          if (pwd.type === 'password') {
            pwd.type = 'text';
            btn.textContent = '🔒';
          } else {
            pwd.type = 'password';
            btn.textContent = '👁️';
          }
        }

        async function login() {
          const password = document.getElementById('password').value;
          const errorEl = document.getElementById('error');

          if (!password.trim()) {
            errorEl.textContent = 'Please enter the business password';
            return;
          }

          if (password === '${BUSINESS_PASSWORD}') {
            localStorage.setItem('ks1_auth', 'true');
            window.location.href = '/app';
          } else {
            errorEl.textContent = 'Invalid business password';
          }
        }
      </script>
    </body>
    </html>
  `);
});

// === MAIN APP (DASHBOARD) ===
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
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #000;
          color: #fff;
          line-height: 1.5;
          padding: 0 1rem;
          max-width: 480px;
          margin: 0 auto;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding-top: 2vh;
          padding-bottom: 2vh;
        }
        .container {
          background: rgba(12, 12, 18, 0.95);
          border-radius: 16px;
          padding: 1.4rem;
          margin-bottom: 1.3rem;
          box-shadow: 
            0 6px 16px rgba(255, 215, 0, 0.16),
            inset 0 0 10px rgba(255, 215, 0, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.1);
          width: 100%;
        }
        header {
          text-align: center;
          padding: 0.9rem 0;
          margin-bottom: 1.2rem;
        }
        h1 {
          font-size: 1.7rem;
          font-weight: 800;
          color: #1e3a8a; /* Deep royal blue */
          letter-spacing: -0.4px;
          text-shadow: 0 2px 3px rgba(0,0,0,0.3); /* 3D effect */
        }
        .subtitle {
          color: #fff;
          font-size: 0.9rem;
          font-weight: 700;
          letter-spacing: 0.6px;
          margin-top: 0.4rem;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
          text-transform: uppercase;
        }
        .card {
          background: #0f0f14;
          border-radius: 14px;
          padding: 1.2rem;
          margin-bottom: 1.2rem;
          box-shadow: 0 3px 10px rgba(0,0,0,0.2);
          border: 1px solid rgba(255, 215, 0, 0.07);
        }
        .card h2 {
          color: #FFD700;
          font-size: 1.15rem;
          margin-bottom: 0.8rem;
          font-weight: 700;
        }
        .card input[type="text"]:nth-of-type(1),
        .card input[type="text"]:nth-of-type(2),
        .card input[type="text"]:nth-of-type(3),
        .card input[type="text"]:nth-of-type(4) {
          font-weight: 600;
          background: #15151a;
        }
        input, select, button {
          width: 100%;
          padding: 0.7rem;
          margin: 0.45rem 0;
          border: none;
          border-radius: 9px;
          font-size: 0.92rem;
        }
        input, select {
          background: #111;
          color: white;
          border: 1px solid #333;
          outline: none;
        }
        input:focus, select:focus {
          border-color: #FFD700;
          box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.2);
        }
        .btn-momo {
          background: linear-gradient(135deg, #FFD700, #D4AF37);
          color: #000;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          font-size: 0.93rem;
          box-shadow: 
            0 3px 0 #B8860B,
            0 5px 9px rgba(0,0,0,0.3);
          transition: all 0.15s ease;
        }
        .btn-momo:hover {
          background: linear-gradient(135deg, #FFE04D, #E6C24A);
          transform: translateY(2px);
          box-shadow: 
            0 1px 0 #B8860B,
            0 3px 7px rgba(0,0,0,0.25);
        }
        .btn-momo:active {
          transform: translateY(3px);
          box-shadow: 
            0 0 0 #B8860B,
            0 2px 5px rgba(0,0,0,0.2);
        }
        .blue-heart {
          color: #3b82f6;
          text-shadow: 0 0 5px rgba(59, 130, 246, 0.7);
          font-weight: 800;
          margin-right: 6px;
        }
        #result {
          margin-top: 0.8rem;
          padding: 0.8rem;
          border-radius: 9px;
          display: none;
          background: #1e3a8a;
          border-left: 3px solid #3b82f6;
          color: #dbeafe;
          font-weight: 600;
          font-size: 0.89rem;
          line-height: 1.5;
        }
        .whatsapp-btn {
          display: inline-block;
          background: linear-gradient(135deg, #FFD700, #D4AF37);
          color: #000;
          text-decoration: none;
          font-weight: 700;
          padding: 0.4rem 0.8rem;
          border-radius: 6px;
          font-size: 0.85rem;
          box-shadow: 0 3px 0 #B8860B, 0 5px 9px rgba(0,0,0,0.3);
          margin-top: 0.5rem;
        }
        .whatsapp-btn:hover {
          background: linear-gradient(135deg, #FFE04D, #E6C24A);
          transform: translateY(1px);
        }
        .footer {
          text-align: center;
          color: #777;
          font-size: 0.73rem;
          padding-top: 1.1rem;
          margin-top: auto;
        }
        .trademark {
          color: #aaa;
          font-size: 0.71rem;
          margin-top: 0.4rem;
          font-style: italic;
          line-height: 1.4;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <h1>Dashboard</h1>
          <p class="subtitle">Non-custodial • Alkebulan (AFRICA)-first • Nonprofit-powered</p>
        </header>

        <div class="card">
          <h2>Create Mobile Money Payment</h2>
          <input type="text" id="business-name" placeholder="Business Name (e.g. Kwame Store)" />
          <input type="text" id="customer-name" placeholder="Customer Name (e.g. Ama Serwaa)" />
          <input type="text" id="customer-number" placeholder="Customer Number (e.g. +233240000000)" />
          <input type="text" id="business-phone" placeholder="Business Phone (e.g. +233240123456)" />
          <select id="network">
            <option value="MTN">MTN</option>
            <option value="Telecel">Telecel</option>
            <option value="AirtelTogo">AirtelTogo</option>
          </select>
          <input type="number" id="amount" placeholder="Amount in GHS" min="1" value="100"/>
          <input type="text" id="customer-phone" placeholder="Customer MoMo number (e.g. +233...)" value="+233240000000"/>
          <button class="btn-momo" onclick="requestMomo()">
            <span class="blue-heart">💙</span> Pay & Empower Alkebulan (AFRICA)
          </button>
          <div id="result"></div>
        </div>
      </div>

      <div class="footer">
        © 2026 KS1 Empower Pay – A nonprofit project by KS1 Empire Group & Foundation (KS1EGF)<br/>
        <span class="trademark">Built for Alkebulan (Africa) SMEs, Businesses And Entrepreneurs — united in digital sovereignty and shared prosperity.</span>
      </div>

      <script>
        let inactivityTimer;
        function resetTimer() {
          clearTimeout(inactivityTimer);
          inactivityTimer = setTimeout(() => {
            localStorage.removeItem('ks1_auth');
            alert('Session expired for security.');
            window.location.href = '/';
          }, 30000);
        }
        ['click','touchstart','keypress','scroll'].forEach(e => {
          document.addEventListener(e, resetTimer, true);
        });
        resetTimer();

        async function requestMomo() {
          const businessName = document.getElementById('business-name').value.trim() || '—';
          const customerName = document.getElementById('customer-name').value.trim() || '—';
          const customerNumber = document.getElementById('customer-number').value.trim() || '—';
          const businessPhone = document.getElementById('business-phone').value.trim() || '—';
          const network = document.getElementById('network').value;
          const amount = parseFloat(document.getElementById('amount').value);
          const customerPhone = document.getElementById('customer-phone').value.trim();
          const r = document.getElementById('result');
          
          if (!amount || amount <= 0 || !customerPhone.startsWith('+233')) {
            r.innerHTML = 'Enter valid GHS amount and +233 customer number';
            r.style.display = 'block';
            return;
          }

          r.innerHTML = 'Sending request to ' + customerPhone + '...';
          r.style.display = 'block';

          try {
            const res = await fetch('/api/momo/request', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount, phone: customerPhone })
            });
            const data = await res.json();
            if (data.success) {
              const receiptText = 
                \`KS1 EMPOWER PAY\\n\` +
                \`────────────────────\\n\` +
                \`Business Name: \${businessName}\\n\` +
                \`Customer Name: \${customerName}\\n\` +
                \`Customer Number: \${customerNumber}\\n\` +
                \`Business Phone: \${businessPhone}\\n\` +
                \`Network: \${network}\\n\\n\` +
                \`📄 TRANSACTION RECEIPT\\n\\n\` +
                \`Gross Amount: GHS \${data.amount}\\n\` +
                \`Solidarity Contribution (0.3%): GHS \${(data.amount * 0.003).toFixed(2)}\\n\` +
                \`You Receive: GHS \${(data.amount * 0.997).toFixed(2)}\\n\` +
                \`Status: Completed\\n\` +
                \`Timestamp: \${new Date().toLocaleString()}\\n\\n\` +
                \`You just empowered Alkebulan (AFRICA) digital freedom!\`;

              const encodedText = encodeURIComponent(receiptText);
              const whatsappUrl = \`https://wa.me/?text=\${encodedText}\`;

              const receiptHtml = 
                '<div style="font-family: monospace; font-size: 0.89rem; line-height: 1.5;">' +
                  '<strong>KS1 EMPOWER PAY</strong><br/>' +
                  '<hr style="border: 0; border-top: 1px solid #FFD700; margin: 0.4rem 0;" />' +
                  '<strong>Business Name:</strong> ' + businessName + '<br/>' +
                  '<strong>Customer Name:</strong> ' + customerName + '<br/>' +
                  '<strong>Customer Number:</strong> ' + customerNumber + '<br/>' +
                  '<strong>Business Phone:</strong> ' + businessPhone + '<br/>' +
                  '<strong>Network:</strong> ' + network + '<br/><br/>' +
                  '<strong>📄 TRANSACTION RECEIPT</strong><br/><br/>' +
                  'Gross Amount: GHS ' + data.amount + '<br/>' +
                  'Solidarity Contribution (0.3%): GHS ' + (data.amount * 0.003).toFixed(2) + '<br/>' +
                  'You Receive: GHS ' + (data.amount * 0.997).toFixed(2) + '<br/>' +
                  'Status: Completed<br/>' +
                  'Timestamp: ' + new Date().toLocaleString() +
                '</div>' +
                '<br/>' +
                '<a href="' + whatsappUrl + '" target="_blank" class="whatsapp-btn">' +
                '📱 Share to WhatsApp' +
                '</a>' +
                '<br/><br/>' +
                'You just empowered Alkebulan (AFRICA) digital freedom!';

              r.innerHTML = '<strong>🎉 Payment Completed!</strong><br/>' + receiptHtml;
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

// === START SERVER ===
const PORT = parseInt(process.env.PORT, 10) || 10000;
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 KS1 Empower Pay running on port ${PORT}`);
  });
});
