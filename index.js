// KS1 EMPOWER PAY – INTERNATIONAL NONPROFIT EDITION • FUTURISTIC UI
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');

const app = express();
app.use(express.json());

const BUSINESS_PASSWORD = process.env.BUSINESS_PASSWORD || "ks1empower2026";
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ FATAL: MONGODB_URI not set");
  process.exit(1);
}

let db;

async function initDB() {
  try {
    const client = new MongoClient(MONGODB_URI, {
      tls: true,
      tlsAllowInvalidCertificates: true,
      serverSelectionTimeoutMS: 5000,
    });
    await client.connect();
    db = client.db('ks1empowerpay');
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB error:", err.message);
    process.exit(1);
  }
}

// === HEALTH CHECK ===
app.get('/api/test', (req, res) => {
  res.json({ status: '✅ LIVE', nonprofit: 'KS1 Empire Group & Foundation' });
});

// === SAVE MERCHANT PROFILE ===
app.post('/api/profile', async (req, res) => {
  const { 
    businessName,
    businessPhone,
    category = 'Other',
    location = '—',
    since = new Date().getFullYear(),
    contactPreference = 'whatsapp',
    optedIntoPromos = false
  } = req.body;

  if (!businessName || !businessPhone) {
    return res.status(400).json({ error: 'Business name and phone required' });
  }

  try {
    await db.collection('merchants').updateOne(
      { businessPhone },
      {
        $set: {
          businessName,
          businessPhone,
          category,
          location,
          since: parseInt(since),
          contactPreference,
          optedIntoPromos,
          active: true,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Profile save error:", err.message);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

// === GET ALL MERCHANTS ===
app.get('/api/merchants', async (req, res) => {
  const { password } = req.query;
  if (!password || password !== BUSINESS_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const merchants = await db.collection('merchants')
      .find({ active: true })
      .sort({ businessName: 1 })
      .toArray();
    res.json(merchants);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch merchants' });
  }
});

// === FLAG DISPUTE ===
app.post('/api/dispute', async (req, res) => {
  const { password, transactionId, notes = '' } = req.body;
  
  if (!password || password !== BUSINESS_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  if (!transactionId) {
    return res.status(400).json({ error: 'Transaction ID required' });
  }

  try {
    const result = await db.collection('transactions').updateOne(
      { _id: new ObjectId(transactionId) },
      { 
        $set: { 
          disputeFlag: true,
          resolved: false,
          notes,
          updatedAt: new Date()
        } 
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Dispute error:", err.message);
    res.status(500).json({ error: 'Failed to flag dispute' });
  }
});

// === CREATE TRANSACTION ===
app.post('/api/momo/request', async (req, res) => {
  const { 
    amount = 100, 
    customerPhone,
    businessName = '—',
    customerName = '—',
    customerNumber = '—',
    businessPhone = '—',
    network = 'MTN'
  } = req.body;

  if (!customerPhone || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const commissionRate = 0.01; // 1%
  const commission = parseFloat((amount * commissionRate).toFixed(2));
  const netToMerchant = parseFloat((amount - commission).toFixed(2));

  const transaction = {
    businessName,
    customerName,
    customerNumber,
    businessPhone,
    network,
    amount: parseFloat(amount),
    commission,
    netToMerchant,
    status: 'completed',
    timestamp: new Date(),
    paymentMethod: 'momo',
    businessCategory: req.body.category || 'Other',
    businessLocation: req.body.location || '—',
    businessSince: req.body.since ? parseInt(req.body.since) : new Date().getFullYear(),
    contactPreference: req.body.contactPreference || 'whatsapp',
    optedIntoPromos: req.body.optedIntoPromos || false,
    disputeFlag: false,
    resolved: false,
    notes: '',
    updatedAt: new Date()
  };

  try {
    await db.collection('transactions').insertOne(transaction);
    res.json({ success: true });
  } catch (err) {
    console.error("Save error:", err.message);
    res.status(500).json({ error: 'Failed to save transaction' });
  }
});

// === GET TRANSACTIONS ===
app.get('/api/transactions', async (req, res) => {
  const { password } = req.query;
  if (!password || password !== BUSINESS_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const transactions = await db.collection('transactions')
      .find()
      .sort({ timestamp: -1 })
      .toArray();
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// === STATS API ===
app.get('/api/stats', async (req, res) => {
  try {
    const total = await db.collection('transactions').countDocuments();
    const result = await db.collection('transactions').aggregate([
      { $group: { _id: null, totalVolume: { $sum: "$amount" }, totalCommission: { $sum: "$commission" } } }
    ]).toArray();
    const totalVolume = result[0]?.totalVolume || 0;
    const totalCommission = result[0]?.totalCommission || 0;

    res.json({
      totalTransactions: total,
      totalVolume: parseFloat(totalVolume.toFixed(2)),
      totalCommission: parseFloat(totalCommission.toFixed(2))
    });
  } catch (err) {
    res.status(500).json({ error: 'Stats unavailable' });
  }
});

// === LANDING PAGE ===
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
          background: #fff;
          color: #1e3a8a;
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
          background: #fff;
          border-radius: 16px;
          padding: 1.8rem;
          box-shadow: 0 8px 24px rgba(212, 175, 55, 0.15);
          width: 100%;
          border: 1px solid #f0f0f0;
        }
        h1 {
          font-size: 2.1rem;
          font-weight: 900;
          color: #1e3a8a;
          text-align: center;
          margin-bottom: 1.2rem;
          letter-spacing: -0.5px;
          text-shadow: 2px 2px 4px rgba(212, 175, 55, 0.2);
          position: relative;
        }
        h1::after {
          content: "";
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          width: 60px;
          height: 3px;
          background: linear-gradient(90deg, #D4AF37, #FFD700);
          border-radius: 2px;
        }
        .subtitle {
          color: #D4AF37;
          font-size: 1.1rem;
          text-align: center;
          margin-bottom: 1.6rem;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .form-group {
          margin-bottom: 1.1rem;
          position: relative;
        }
        input {
          width: 100%;
          padding: 0.85rem 1rem;
          border: 1px solid #ddd;
          border-radius: 10px;
          background: #fff;
          color: #333;
          font-size: 0.95rem;
          transition: all 0.2s;
        }
        input:focus {
          border-color: #D4AF37;
          box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.2);
          outline: none;
        }
        .btn-login {
          background: linear-gradient(135deg, #D4AF37, #FFD700);
          color: #1e3a8a;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          font-size: 1rem;
          padding: 0.9rem;
          border: none;
          border-radius: 10px;
          width: 100%;
          cursor: pointer;
          box-shadow: 
            0 4px 0 #B8860B,
            0 6px 12px rgba(212, 175, 55, 0.3);
          transition: all 0.15s ease;
        }
        .btn-login:hover {
          background: linear-gradient(135deg, #E6C24A, #FFE04D);
          transform: translateY(2px);
          box-shadow: 
            0 2px 0 #B8860B,
            0 4px 10px rgba(212, 175, 55, 0.25);
        }
        .btn-login:active {
          transform: translateY(4px);
          box-shadow: 
            0 0 0 #B8860B,
            0 2px 8px rgba(212, 175, 55, 0.2);
        }
        .error {
          color: #ef4444;
          text-align: center;
          margin-top: 0.8rem;
          font-size: 0.85rem;
          min-height: 1.2rem;
        }
        .footer {
          text-align: center;
          color: #666;
          font-size: 0.8rem;
          padding-top: 1.4rem;
          margin-top: auto;
          border-top: 1px solid #eee;
          padding-top: 1.2rem;
        }
        .trademark {
          color: #555;
          font-size: 0.75rem;
          margin-top: 0.5rem;
          font-style: italic;
          line-height: 1.4;
        }
      </style>
    </head>
    <body>
      <div class="login-card">
        <h1>KS1 Empower Pay</h1>
        <p class="subtitle">Secure Access for Authorized Merchants</p>

        <div class="form-group">
          <input type="password" id="password" placeholder="Enter Business Password" autocomplete="off" />
        </div>
        <button class="btn-login" onclick="login()">Access Dashboard</button>
        <div id="error" class="error"></div>
      </div>

      <div class="footer">
        © 2026 KS1 Empower Pay – A nonprofit project by KS1 Empire Group & Foundation (KS1EGF)<br/>
        <span class="trademark">Built for Alkebulan (Africa) SMEs, Businesses And Entrepreneurs — united in digital sovereignty and shared prosperity.</span>
      </div>

      <script>
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

// === DASHBOARD ===
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
          background: #fff;
          color: #1e3a8a;
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
          background: #fff;
          border-radius: 16px;
          padding: 1.6rem;
          margin-bottom: 1.4rem;
          box-shadow: 0 8px 24px rgba(212, 175, 55, 0.15);
          border: 1px solid #f0f0f0;
          width: 100%;
        }
        header {
          text-align: center;
          padding: 0.9rem 0;
          margin-bottom: 1.4rem;
        }
        h1 {
          font-size: 2.0rem;
          font-weight: 900;
          color: #1e3a8a;
          letter-spacing: -0.5px;
          text-shadow: 2px 2px 4px rgba(212, 175, 55, 0.2);
          position: relative;
          text-align: center;
        }
        h1::after {
          content: "";
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          width: 50px;
          height: 3px;
          background: linear-gradient(90deg, #D4AF37, #FFD700);
          border-radius: 2px;
        }
        .subtitle {
          color: #555;
          font-size: 0.95rem;
          font-weight: 600;
          margin-top: 0.5rem;
          text-align: center;
        }
        .card {
          background: #fafafa;
          border-radius: 14px;
          padding: 1.4rem;
          margin-bottom: 1.4rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          border: 1px solid #eee;
        }
        .card h2 {
          color: #D4AF37;
          font-size: 1.3rem;
          margin-bottom: 1.1rem;
          font-weight: 800;
        }
        input, select, button {
          width: 100%;
          padding: 0.85rem;
          margin: 0.55rem 0;
          border: 1px solid #ddd;
          border-radius: 10px;
          font-size: 0.95rem;
        }
        input, select {
          background: #fff;
          color: #333;
          outline: none;
        }
        input:focus, select:focus {
          border-color: #D4AF37;
          box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.2);
        }
        .btn-momo {
          background: linear-gradient(135deg, #D4AF37, #FFD700);
          color: #1e3a8a;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          font-size: 1rem;
          box-shadow: 
            0 4px 0 #B8860B,
            0 6px 12px rgba(212, 175, 55, 0.3);
          transition: all 0.15s ease;
        }
        .btn-momo:hover {
          background: linear-gradient(135deg, #E6C24A, #FFE04D);
          transform: translateY(2px);
          box-shadow: 
            0 2px 0 #B8860B,
            0 4px 10px rgba(212, 175, 55, 0.25);
        }
        .btn-momo:active {
          transform: translateY(4px);
          box-shadow: 
            0 0 0 #B8860B,
            0 2px 8px rgba(212, 175, 55, 0.2);
        }
        #result {
          margin-top: 1rem;
          padding: 1rem;
          border-radius: 10px;
          display: none;
          background: #f0f9ff;
          border-left: 4px solid #3b82f6;
          color: #1e40af;
          font-weight: 600;
          font-size: 0.92rem;
          line-height: 1.5;
        }
        .footer {
          text-align: center;
          color: #666;
          font-size: 0.8rem;
          padding-top: 1.4rem;
          margin-top: auto;
          border-top: 1px solid #eee;
        }
        .trademark {
          color: #555;
          font-size: 0.75rem;
          margin-top: 0.5rem;
          font-style: italic;
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
          <input type="text" id="bname" placeholder="Business Name (e.g. Kwame Store)" />
          <input type="text" id="cname" placeholder="Customer Name (e.g. Ama Serwaa)" />
          <input type="text" id="cnum" placeholder="Customer Number (e.g. +233240000000)" />
          <input type="text" id="bphone" placeholder="Business Phone (e.g. +233240123456)" />
          <select id="net">
            <option value="MTN">MTN</option>
            <option value="Telecel">Telecel</option>
            <option value="AirtelTogo">AirtelTogo</option>
          </select>
          <input type="number" id="amt" placeholder="Amount in GHS" min="1" value="100"/>
          <input type="text" id="cphone" placeholder="Customer MoMo number (e.g. +233...)" value="+233240000000"/>
          <button class="btn-momo" onclick="pay()">
            Pay & Empower Alkebulan (AFRICA)
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

        async function pay() {
          const data = {
            businessName: document.getElementById('bname').value,
            customerName: document.getElementById('cname').value,
            customerNumber: document.getElementById('cnum').value,
            businessPhone: document.getElementById('bphone').value,
            network: document.getElementById('net').value,
            amount: parseFloat(document.getElementById('amt').value),
            customerPhone: document.getElementById('cphone').value
          };
          const r = document.getElementById('result');
          
          if (!data.amount || data.amount <= 0 || !data.customerPhone.startsWith('+233')) {
            r.innerHTML = 'Enter valid GHS amount and +233 customer number';
            r.style.display = 'block';
            return;
          }

          r.innerHTML = 'Processing...';
          r.style.display = 'block';

          try {
            const res = await fetch('/api/momo/request', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            const d = await res.json();
            if (d.success) {
              r.innerHTML = '<strong>🎉 Payment Completed!</strong><br/>Check WhatsApp for receipts.';
            } else {
              r.innerHTML = '❌ Failed: ' + (d.error || 'Unknown');
            }
          } catch (e) {
            r.innerHTML = '❌ Network error';
          }
        }
      </script>
    </body>
    </html>
  `);
});

// === ADMIN DASHBOARD ===
app.get('/admin', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>KS1 Empower Pay Admin</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #fff;
          color: #1e3a8a;
          line-height: 1.5;
          padding: 1rem;
          max-width: 900px;
          margin: 0 auto;
          min-height: 100vh;
        }
        .container {
          background: #fff;
          border-radius: 16px;
          padding: 1.8rem;
          margin-top: 1.5rem;
          box-shadow: 0 8px 24px rgba(212, 175, 55, 0.15);
          border: 1px solid #f0f0f0;
        }
        h1 {
          font-size: 2.2rem;
          font-weight: 900;
          color: #1e3a8a;
          letter-spacing: -0.5px;
          text-shadow: 2px 2px 4px rgba(212, 175, 55, 0.2);
          text-align: center;
          margin-bottom: 1.6rem;
          position: relative;
        }
        h1::after {
          content: "";
          position: absolute;
          bottom: -10px;
          left: 50%;
          transform: translateX(-50%);
          width: 70px;
          height: 4px;
          background: linear-gradient(90deg, #D4AF37, #FFD700);
          border-radius: 2px;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.2rem;
          margin-bottom: 1.6rem;
        }
        .stat-card {
          background: #fafafa;
          padding: 1.2rem;
          border-radius: 12px;
          text-align: center;
          border: 1px solid #eee;
          box-shadow: 0 3px 8px rgba(0,0,0,0.05);
        }
        .stat-label {
          color: #666;
          font-size: 0.95rem;
          margin-bottom: 0.4rem;
        }
        .stat-value {
          font-size: 1.5rem;
          font-weight: 800;
          color: #D4AF37;
        }
        .filters {
          display: flex;
          gap: 0.8rem;
          margin-bottom: 1.4rem;
          flex-wrap: wrap;
        }
        .filters input, .filters select, .filters button {
          padding: 0.7rem;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 0.95rem;
        }
        .filters input, .filters select {
          flex: 1;
          min-width: 150px;
        }
        .btn-filter {
          background: linear-gradient(135deg, #D4AF37, #FFD700);
          color: #1e3a8a;
          font-weight: 700;
          border: none;
          border-radius: 8px;
          padding: 0.7rem 1.2rem;
          cursor: pointer;
          box-shadow: 0 3px 0 #B8860B;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 1rem;
        }
        th, td {
          padding: 0.9rem 0.6rem;
          text-align: left;
          border-bottom: 1px solid #eee;
        }
        th {
          color: #D4AF37;
          font-weight: 800;
          font-size: 0.95rem;
        }
        tr:hover {
          background: #fdf6ee;
        }
        .btn-flag {
          background: #ef4444;
          color: white;
          border: none;
          padding: 0.3rem 0.6rem;
          border-radius: 6px;
          font-size: 0.85rem;
          cursor: pointer;
          box-shadow: 0 2px 0 #b91c1c;
        }
        .btn-flag:hover {
          background: #dc2626;
          transform: translateY(1px);
        }
        .footer {
          text-align: center;
          color: #666;
          font-size: 0.85rem;
          padding-top: 1.8rem;
          border-top: 1px solid #eee;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>KS1 Empower Pay Admin</h1>
        
        <div class="stats">
          <div class="stat-card">
            <div class="stat-label">Total Transactions</div>
            <div class="stat-value" id="totalTx">—</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Total Volume (GHS)</div>
            <div class="stat-value" id="totalVol">—</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Total Commission (GHS)</div>
            <div class="stat-value" id="totalComm">—</div>
          </div>
        </div>

        <div class="filters">
          <input type="text" id="search" placeholder="Search business/customer/phone" />
          <select id="networkFilter">
            <option value="">All Networks</option>
            <option value="MTN">MTN</option>
            <option value="Telecel">Telecel</option>
            <option value="AirtelTogo">AirtelTogo</option>
          </select>
          <button class="btn-filter" onclick="loadTransactions()">Apply</button>
        </div>

        <table id="txTable">
          <thead>
            <tr>
              <th>Date</th>
              <th>Business</th>
              <th>Customer</th>
              <th>Network</th>
              <th>Amount (GHS)</th>
              <th>Commission (GHS)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="txBody"></tbody>
        </table>
      </div>

      <div class="footer">
        © 2026 KS1 Empower Pay – A nonprofit project by KS1 Empire Group & Foundation (KS1EGF)
      </div>

      <script>
        let currentPassword = '';

        async function loadStats() {
          try {
            const res = await fetch('/api/stats');
            const data = await res.json();
            document.getElementById('totalTx').textContent = data.totalTransactions;
            document.getElementById('totalVol').textContent = data.totalVolume.toFixed(2);
            document.getElementById('totalComm').textContent = data.totalCommission.toFixed(2);
          } catch (err) {
            console.error("Stats load failed");
          }
        }

        async function loadTransactions() {
          try {
            const search = document.getElementById('search').value;
            const network = document.getElementById('networkFilter').value;
            
            const res = await fetch('/api/transactions?password=' + encodeURIComponent(currentPassword));
            let txs = await res.json();
            
            if (search) {
              const q = search.toLowerCase();
              txs = txs.filter(tx => 
                tx.businessName.toLowerCase().includes(q) ||
                tx.customerName.toLowerCase().includes(q) ||
                tx.customerNumber.includes(q) ||
                tx.businessPhone.includes(q)
              );
            }
            if (network) {
              txs = txs.filter(tx => tx.network === network);
            }

            document.getElementById('txBody').innerHTML = txs.map(tx => 
              \`<tr>
                <td>\${new Date(tx.timestamp).toLocaleString()}</td>
                <td>\${tx.businessName}<br/><small>\${tx.businessCategory}</small></td>
                <td>\${tx.customerName}<br/><small>\${tx.customerNumber}</small></td>
                <td>\${tx.network}</td>
                <td>\${tx.amount}</td>
                <td>\${tx.commission}</td>
                <td><button class="btn-flag" onclick="flagDispute('\${tx._id}')">Flag</button></td>
              </tr>\`
            ).join('');
          } catch (err) {
            alert('Failed to load transactions. Check password.');
            window.location.href = '/';
          }
        }

        async function flagDispute(id) {
          const notes = prompt("Add notes for this dispute (optional):");
          if (notes === null) return;

          try {
            const res = await fetch('/api/dispute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                password: currentPassword,
                transactionId: id,
                notes: notes || ''
              })
            });
            const data = await res.json();
            if (data.success) {
              alert('✅ Dispute flagged!');
              loadTransactions();
            } else {
              alert('❌ ' + (data.error || 'Failed'));
            }
          } catch (e) {
            alert('Network error');
          }
        }

        const pwd = prompt("Enter Business Password:");
        if (!pwd) window.location.href = '/';
        currentPassword = pwd;
        
        loadStats();
        loadTransactions();
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
