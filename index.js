// KS1 EMPOWER PAY – ALKEBULAN (AFRICA) EDITION • INSPIRING UI UPGRADE
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');

const app = express();
app.use(express.json());

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

// === GENERATE TRANSACTION ID ===
function generateTransactionId() {
  return `KS1-${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}`;
}

// === REGISTER BUSINESS ===
app.post('/api/register', async (req, res) => {
  const { 
    businessName,
    ownerName,
    ownerDob, // YYYY-MM-DD
    businessSince,
    businessPhone,
    network = 'MTN'
  } = req.body;

  if (!businessName || !ownerName || !ownerDob || !businessSince || !businessPhone) {
    return res.status(400).json({ error: 'All fields required' });
  }

  try {
    const existing = await db.collection('merchants').findOne({ businessPhone });
    if (existing) {
      return res.status(409).json({ error: 'Business already registered' });
    }

    const merchant = {
      businessName,
      ownerName,
      ownerDob: new Date(ownerDob),
      businessSince: parseInt(businessSince),
      businessPhone,
      network,
      totalTransactions: 0,
      totalVolume: 0,
      active: true,
      createdAt: new Date()
    };

    await db.collection('merchants').insertOne(merchant);
    res.json({ success: true, message: "Business registered" });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ error: 'Failed to register' });
  }
});

// === CREATE TRANSACTION ===
app.post('/api/momo/request', async (req, res) => {
  const { 
    businessPhone,
    customerName = '—',
    customerNumber = '—',
    amount = 100
  } = req.body;

  if (!businessPhone || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const commissionRate = 0.01; // 1%
  const commission = parseFloat((amount * commissionRate).toFixed(2));
  const netToMerchant = parseFloat((amount - commission).toFixed(2));

  const transaction = {
    transactionId: generateTransactionId(),
    businessPhone,
    customerName,
    customerNumber,
    amount: parseFloat(amount),
    commission,
    netToMerchant,
    status: 'completed',
    timestamp: new Date(),
    paymentMethod: 'momo'
  };

  try {
    await db.collection('transactions').insertOne(transaction);
    res.json({ success: true, transactionId: transaction.transactionId });
  } catch (err) {
    console.error("Save error:", err.message);
    res.status(500).json({ error: 'Failed to save transaction' });
  }
});

// === GET MERCHANT BY PHONE ===
app.get('/api/merchant/:phone', async (req, res) => {
  try {
    const merchant = await db.collection('merchants').findOne({ businessPhone: req.params.phone });
    if (!merchant) return res.status(404).json({ error: 'Business not found' });
    res.json(merchant);
  } catch (err) {
    res.status(500).json({ error: 'Fetch failed' });
  }
});

// === GET TRANSACTIONS FOR MERCHANT ===
app.get('/api/transactions/:phone', async (req, res) => {
  try {
    const txs = await db.collection('transactions')
      .find({ businessPhone: req.params.phone })
      .sort({ timestamp: -1 })
      .toArray();
    res.json(txs);
  } catch (err) {
    res.status(500).json({ error: 'Fetch failed' });
  }
});

// === ADMIN: GET ALL TRANSACTIONS ===
app.get('/api/admin/transactions', async (req, res) => {
  const { password } = req.query;
  if (password !== process.env.BUSINESS_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const txs = await db.collection('transactions')
      .find()
      .sort({ timestamp: -1 })
      .toArray();
    res.json(txs);
  } catch (err) {
    res.status(500).json({ error: 'Fetch failed' });
  }
});

// === ADMIN: STATS ===
app.get('/api/admin/stats', async (req, res) => {
  const { password } = req.query;
  if (password !== process.env.BUSINESS_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

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
    res.status(500).json({ error: 'Stats failed' });
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
          background: #0c1a3a;
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
          position: relative;
          overflow: hidden;
        }
        body::before {
          content: "";
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(212, 175, 55, 0.3) 0%, transparent 70%);
          z-index: -1;
          animation: rotate 20s linear infinite;
        }
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .login-card {
          background: rgba(12, 26, 58, 0.85);
          border-radius: 16px;
          padding: 1.8rem;
          box-shadow: 0 8px 24px rgba(212, 175, 55, 0.25);
          width: 100%;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(212, 175, 55, 0.3);
        }
        h1 {
          font-size: 2.2rem;
          font-weight: 900;
          color: #FFD700;
          text-align: center;
          margin-bottom: 1.2rem;
          letter-spacing: -0.5px;
          text-shadow: 0 0 10px rgba(212, 175, 55, 0.7);
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
          color: #dbeafe;
          font-size: 1.1rem;
          text-align: center;
          margin-bottom: 1.6rem;
          font-weight: 700;
        }
        .form-group {
          margin-bottom: 1.1rem;
          position: relative;
        }
        input, select {
          width: 100%;
          padding: 0.85rem 1rem;
          border: 1px solid #444;
          border-radius: 10px;
          background: rgba(0,0,0,0.3);
          color: #fff;
          font-size: 0.95rem;
        }
        input:focus, select:focus {
          border-color: #D4AF37;
          box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.3);
          outline: none;
        }
        .btn-register {
          background: linear-gradient(135deg, #D4AF37, #FFD700);
          color: #0c1a3a;
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
            0 6px 12px rgba(212, 175, 55, 0.4);
          transition: all 0.15s ease;
        }
        .btn-register:hover {
          background: linear-gradient(135deg, #E6C24A, #FFE04D);
          transform: translateY(2px);
          box-shadow: 
            0 2px 0 #B8860B,
            0 4px 10px rgba(212, 175, 55, 0.35);
        }
        .btn-register:active {
          transform: translateY(4px);
          box-shadow: 
            0 0 0 #B8860B,
            0 2px 8px rgba(212, 175, 55, 0.3);
        }
        .error {
          color: #f87171;
          text-align: center;
          margin-top: 0.8rem;
          font-size: 0.85rem;
          min-height: 1.2rem;
        }
        .footer {
          text-align: center;
          color: #94a3b8;
          font-size: 0.8rem;
          padding-top: 1.4rem;
          margin-top: auto;
        }
        .trademark {
          color: #cbd5e1;
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
        <p class="subtitle">Register Your Business</p>

        <div class="form-group">
          <input type="text" id="bname" placeholder="Business Name" />
        </div>
        <div class="form-group">
          <input type="text" id="oname" placeholder="Owner Full Name" />
        </div>
        <div class="form-group">
          <input type="date" id="dob" placeholder="Owner Date of Birth" />
        </div>
        <div class="form-group">
          <input type="number" id="since" placeholder="Year Business Started (e.g., 2020)" min="1900" max="2026" />
        </div>
        <div class="form-group">
          <input type="text" id="phone" placeholder="Business Phone (+233...)" />
        </div>
        <div class="form-group">
          <select id="net">
            <option value="MTN">MTN</option>
            <option value="Telecel">Telecel</option>
            <option value="AirtelTogo">AirtelTogo</option>
          </select>
        </div>
        <button class="btn-register" onclick="register()">Register Business</button>
        <div id="error" class="error"></div>
      </div>

      <div class="footer">
        © 2026 KS1 Empower Pay – A nonprofit project by KS1 Empire Group & Foundation (KS1EGF)<br/>
        <span class="trademark">Built for Alkebulan (Africa) SMEs, Businesses And Entrepreneurs — united in digital sovereignty and shared prosperity.</span>
      </div>

      <script>
        async function register() {
          const data = {
            businessName: document.getElementById('bname').value,
            ownerName: document.getElementById('oname').value,
            ownerDob: document.getElementById('dob').value,
            businessSince: document.getElementById('since').value,
            businessPhone: document.getElementById('phone').value,
            network: document.getElementById('net').value
          };

          const errorEl = document.getElementById('error');
          if (!data.businessName || !data.ownerName || !data.ownerDob || !data.businessSince || !data.businessPhone) {
            errorEl.textContent = 'Please fill all fields';
            return;
          }

          if (!data.businessPhone.startsWith('+233')) {
            errorEl.textContent = 'Phone must start with +233';
            return;
          }

          try {
            const res = await fetch('/api/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            const d = await res.json();
            if (d.success) {
              localStorage.setItem('businessPhone', data.businessPhone);
              window.location.href = '/app';
            } else {
              errorEl.textContent = d.error || 'Registration failed';
            }
          } catch (e) {
            errorEl.textContent = 'Network error';
          }
        }
      </script>
    </body>
    </html>
  `);
});

// === USER DASHBOARD ===
app.get('/app', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Dashboard</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #0c1a3a;
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
          position: relative;
          overflow: hidden;
        }
        body::before {
          content: "";
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(212, 175, 55, 0.2) 0%, transparent 70%);
          z-index: -1;
          animation: rotate 25s linear infinite;
        }
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .container {
          background: #fff;
          border-radius: 16px;
          padding: 1.6rem;
          margin-bottom: 1.4rem;
          box-shadow: 0 8px 24px rgba(212, 175, 55, 0.15);
          border: 1px solid #f0f0f0;
          width: 100%;
          position: relative;
          z-index: 2;
        }
        header {
          text-align: center;
          padding: 0.9rem 0;
          margin-bottom: 1.4rem;
          position: relative;
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
          position: relative;
        }
        .card h2::after {
          content: "";
          position: absolute;
          bottom: -6px;
          left: 0;
          width: 40px;
          height: 2px;
          background: linear-gradient(90deg, #D4AF37, #FFD700);
          border-radius: 1px;
        }
        input, select {
          width: 100%;
          padding: 0.85rem;
          margin: 0.55rem 0;
          border: 1px solid #ddd;
          border-radius: 10px;
          font-size: 0.95rem;
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
        .btn-refresh {
          background: linear-gradient(135deg, #D4AF37, #FFD700);
          color: #1e3a8a;
          font-weight: 700;
          border: none;
          border-radius: 8px;
          padding: 0.6rem;
          margin-top: 1rem;
          cursor: pointer;
          box-shadow: 0 3px 0 #B8860B;
          width: 100%;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .btn-refresh:hover {
          background: linear-gradient(135deg, #E6C24A, #FFE04D);
          transform: translateY(1px);
          box-shadow: 0 2px 0 #B8860B;
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
        .mission-note {
          background: #eff6ff;
          padding: 12px;
          border-radius: 8px;
          margin: 15px 0;
          font-size: 14px;
          color: #1e3a8a;
        }
        .footer {
          text-align: center;
          color: #666;
          font-size: 0.8rem;
          padding-top: 1.4rem;
          margin-top: auto;
          z-index: 2;
          position: relative;
        }
        .trademark {
          color: #555;
          font-size: 0.75rem;
          margin-top: 0.5rem;
          font-style: italic;
        }
        .birthday-banner {
          background: linear-gradient(90deg, #ff6b6b, #ffd166);
          color: white;
          text-align: center;
          padding: 8px;
          border-radius: 8px;
          margin: 10px 0;
          font-weight: bold;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.8; }
          100% { opacity: 1; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <h1>Dashboard</h1>
          <p class="subtitle">Non-custodial • Alkebulan (AFRICA)-first • Nonprofit-powered</p>
        </header>

        <div class="mission-note">
          💡 <strong>1% solidarity contribution</strong> supports our mission.<br/>
          <strong>Please remind customers to include Mobile Money network charges</strong> when sending funds.
        </div>

        <div class="card">
          <h2>Create Mobile Money Payment</h2>
          <input type="text" id="cname" placeholder="Customer Name (e.g. Ama Serwaa)" />
          <input type="text" id="cnum" placeholder="Customer Number (e.g. +233240000000)" />
          <input type="number" id="amt" placeholder="Amount in GHS" min="1" value="100"/>
          <input type="text" id="cphone" placeholder="Customer MoMo number (e.g. +233...)" value="+233240000000"/>
          <button class="btn-momo" onclick="pay()">
            Pay & Empower Alkebulan (AFRICA)
          </button>
          <button class="btn-refresh" onclick="loadTransactions()">
            🔄 Refresh Data
          </button>
          <div id="result"></div>
        </div>
      </div>

      <div class="footer">
        © 2026 KS1 Empower Pay – A nonprofit project by KS1 Empire Group & Foundation (KS1EGF)<br/>
        <span class="trademark">Built for Alkebulan (Africa) SMEs, Businesses And Entrepreneurs — united in digital sovereignty and shared prosperity.</span>
      </div>

      <script>
        let businessPhone = localStorage.getItem('businessPhone');
        if (!businessPhone) {
          alert('Please register first');
          window.location.href = '/';
        }

        // Check for birthday
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayStr = \`\${today.getFullYear()}-\${month}-\${day}\`;

        async function checkBirthday() {
          try {
            const res = await fetch('/api/merchant/' + businessPhone);
            const merchant = await res.json();
            const dob = new Date(merchant.ownerDob);
            const dobStr = \`\${today.getFullYear()}-\${String(dob.getMonth()+1).padStart(2,'0')}-\${String(dob.getDate()).padStart(2,'0')}\`;
            
            if (dobStr === todayStr) {
              document.querySelector('.container').insertAdjacentHTML('afterbegin', 
                '<div class="birthday-banner">🎉 Happy Birthday, ' + merchant.ownerName + '! Thank you for building with us.</div>'
              );
            }
          } catch (e) {
            console.log('Birthday check skipped');
          }
        }

        async function pay() {
          const data = {
            businessPhone,
            customerName: document.getElementById('cname').value,
            customerNumber: document.getElementById('cnum').value,
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
              r.innerHTML = '<strong>🎉 Payment Completed!</strong><br/>Transaction ID: <b>' + d.transactionId + '</b><br/>Check WhatsApp for receipts.';
            } else {
              r.innerHTML = '❌ Failed: ' + (d.error || 'Unknown');
            }
          } catch (e) {
            r.innerHTML = '❌ Network error';
          }
        }

        async function loadTransactions() {
          try {
            const res = await fetch('/api/transactions/' + businessPhone);
            const txs = await res.json();
            console.log('Loaded', txs.length, 'transactions');
          } catch (e) {
            console.error('Refresh failed');
          }
        }

        checkBirthday();
        loadTransactions();
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
          background: #0c1a3a;
          color: #1e3a8a;
          line-height: 1.5;
          padding: 1rem;
          max-width: 900px;
          margin: 0 auto;
          min-height: 100vh;
          position: relative;
          overflow: hidden;
        }
        body::before {
          content: "";
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(212, 175, 55, 0.15) 0%, transparent 70%);
          z-index: -1;
          animation: rotate 30s linear infinite;
        }
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .container {
          background: #fff;
          border-radius: 16px;
          padding: 1.8rem;
          margin-top: 1.5rem;
          box-shadow: 0 8px 24px rgba(212, 175, 55, 0.2);
          border: 1px solid rgba(212, 175, 55, 0.2);
          position: relative;
          z-index: 2;
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
        .mission-banner {
          background: linear-gradient(90deg, #1e3a8a, #3b82f6);
          color: white;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 20px;
          text-align: center;
          font-weight: 600;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.2rem;
          margin-bottom: 1.6rem;
        }
        .stat-card {
          background: #f8fafc;
          padding: 1.2rem;
          border-radius: 12px;
          text-align: center;
          border: 1px solid #e2e8f0;
          box-shadow: 0 3px 8px rgba(0,0,0,0.05);
          position: relative;
          overflow: hidden;
        }
        .stat-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 4px;
          background: linear-gradient(90deg, #D4AF37, #FFD700);
        }
        .stat-label {
          color: #64748b;
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
        .filters input, .filters select {
          padding: 0.7rem;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 0.95rem;
          flex: 1;
          min-width: 150px;
        }
        .btn-filter, .btn-refresh {
          background: linear-gradient(135deg, #D4AF37, #FFD700);
          color: #1e3a8a;
          font-weight: 700;
          border: none;
          border-radius: 8px;
          padding: 0.7rem 1.2rem;
          cursor: pointer;
          box-shadow: 0 3px 0 #B8860B;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .btn-filter:hover, .btn-refresh:hover {
          background: linear-gradient(135deg, #E6C24A, #FFE04D);
          transform: translateY(1px);
          box-shadow: 0 2px 0 #B8860B;
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
        .footer {
          text-align: center;
          color: #666;
          font-size: 0.85rem;
          padding-top: 1.8rem;
          border-top: 1px solid #eee;
          margin-top: 2rem;
          position: relative;
          z-index: 2;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>KS1 Empower Pay Admin</h1>
        
        <div class="mission-banner">
          🌍 Every transaction fuels our mission to empower African SMEs with sovereign digital tools.
        </div>

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
          <button class="btn-filter" onclick="loadData()">Apply</button>
          <button class="btn-refresh" onclick="loadData()">🔄 Refresh</button>
        </div>

        <table id="txTable">
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Business</th>
              <th>Customer</th>
              <th>Amount (GHS)</th>
              <th>Commission (GHS)</th>
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

        async function loadData() {
          try {
            const statsRes = await fetch('/api/admin/stats?password=' + encodeURIComponent(currentPassword));
            const stats = await statsRes.json();
            document.getElementById('totalTx').textContent = stats.totalTransactions;
            document.getElementById('totalVol').textContent = stats.totalVolume.toFixed(2);
            document.getElementById('totalComm').textContent = stats.totalCommission.toFixed(2);

            const txRes = await fetch('/api/admin/transactions?password=' + encodeURIComponent(currentPassword));
            const txs = await txRes.json();

            document.getElementById('txBody').innerHTML = txs.map(tx => 
              \`<tr>
                <td>\${tx.transactionId}</td>
                <td>\${new Date(tx.timestamp).toLocaleString()}</td>
                <td>\${tx.businessPhone}</td>
                <td>\${tx.customerName} (\${tx.customerNumber})</td>
                <td>\${tx.amount}</td>
                <td>\${tx.commission}</td>
              </tr>\`
            ).join('');
          } catch (err) {
            alert('Failed to load data. Check password.');
            window.location.href = '/';
          }
        }

        const pwd = prompt("Enter Admin Password:");
        if (!pwd) window.location.href = '/';
        currentPassword = pwd;
        loadData();
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
