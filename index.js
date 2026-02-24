// KS1 EMPOWER PAY – ALKEBULAN (AFRICA) EDITION • FINAL PRODUCTION VERSION
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');

const app = express();
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI;
const BUSINESS_PASSWORD = process.env.BUSINESS_PASSWORD || "ks1empower2026";

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

function generateId(prefix = 'KS1') {
  return `${prefix}-${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}`;
}

// === REGISTER BUSINESS ===
app.post('/api/register', async (req, res) => {
  const { 
    businessName,
    ownerName,
    ownerDob,
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
      password: null,
      totalTransactions: 0,
      totalVolume: 0,
      active: true,
      createdAt: new Date(),
      lastSeen: new Date()
    };

    await db.collection('merchants').insertOne(merchant);
    res.json({ success: true, message: "Business registered" });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ error: 'Failed to register' });
  }
});

// === LOGIN EXISTING BUSINESS ===
app.post('/api/login', async (req, res) => {
  const { businessPhone, password } = req.body;
  if (!businessPhone || !password) {
    return res.status(400).json({ error: 'Phone and password required' });
  }

  try {
    const merchant = await db.collection('merchants').findOne({ businessPhone });
    if (!merchant) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const expectedPass = merchant.password || BUSINESS_PASSWORD;
    if (password !== expectedPass) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    res.json({ success: true, businessPhone });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// === RESET PASSWORD (USER) ===
app.post('/api/reset-password', async (req, res) => {
  const { businessPhone, resetCode, newPassword } = req.body;
  if (!businessPhone || !resetCode || !newPassword) {
    return res.status(400).json({ error: 'All fields required' });
  }

  try {
    const merchant = await db.collection('merchants').findOne({ 
      businessPhone,
      resetCode,
      resetExpiry: { $gt: new Date() }
    });

    if (!merchant) {
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }

    await db.collection('merchants').updateOne(
      { businessPhone },
      { 
        $set: { password: newPassword },
        $unset: { resetCode: "", resetExpiry: "" }
      }
    );

    res.json({ success: true, message: "Password updated" });
  } catch (err) {
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// === GENERATE RESET CODE (ADMIN) ===
app.post('/api/admin/generate-reset', async (req, res) => {
  const { password, businessPhone } = req.body;
  if (password !== BUSINESS_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const merchant = await db.collection('merchants').findOne({ businessPhone });
    if (!merchant) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const resetCode = generateId('KS1');
    await db.collection('merchants').updateOne(
      { businessPhone },
      { $set: { resetCode, resetExpiry: new Date(Date.now() + 30 * 60000) } }
    );

    res.json({ success: true, resetCode, businessName: merchant.businessName });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate reset code' });
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

  const commissionRate = 0.01;
  const commission = parseFloat((amount * commissionRate).toFixed(2));
  const netToMerchant = parseFloat((amount - commission).toFixed(2));

  const merchant = await db.collection('merchants').findOne({ businessPhone });
  if (!merchant) {
    return res.status(404).json({ error: 'Business not found' });
  }

  const transaction = {
    transactionId: generateId('KS1'),
    businessName: merchant.businessName,
    businessPhone,
    customerName,
    customerNumber,
    amount: parseFloat(amount),
    commission,
    netToMerchant,
    status: 'completed',
    timestamp: new Date(),
    paymentMethod: 'momo',
    disputeFlag: false,
    resolved: false,
    notes: '',
    updatedAt: new Date()
  };

  try {
    await db.collection('transactions').insertOne(transaction);
    await db.collection('merchants').updateOne(
      { businessPhone },
      { 
        $inc: { totalTransactions: 1, totalVolume: amount },
        $set: { lastSeen: new Date() }
      }
    );
    res.json({ 
      success: true, 
      transactionId: transaction.transactionId,
      businessName: merchant.businessName
    });
  } catch (err) {
    console.error("Save error:", err.message);
    res.status(500).json({ error: 'Failed to save transaction' });
  }
});

// === REPORT TECHNICAL ISSUE ===
app.post('/api/support', async (req, res) => {
  const { 
    businessPhone, 
    issue, 
    ownerName = '—', 
    businessName = '—' 
  } = req.body;
  
  if (!businessPhone || !issue) {
    return res.status(400).json({ error: 'Business phone and issue required' });
  }

  try {
    const report = {
      businessPhone,
      ownerName,
      businessName,
      issue,
      reportedAt: new Date(),
      resolved: false
    };
    await db.collection('support').insertOne(report);
    res.json({ success: true, message: "Support ticket created." });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit support request' });
  }
});

// === ADMIN DATA ===
app.get('/api/admin/data', async (req, res) => {
  const { password } = req.query;
  if (password !== BUSINESS_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const merchants = await db.collection('merchants')
      .find({ active: true })
      .sort({ createdAt: -1 })
      .toArray();

    const transactions = await db.collection('transactions')
      .find()
      .sort({ timestamp: -1 })
      .toArray();

    const supportTickets = await db.collection('support')
      .find({ resolved: false })
      .sort({ reportedAt: -1 })
      .toArray();

    const stats = await db.collection('transactions').aggregate([
      { $group: { _id: null, totalVolume: { $sum: "$amount" }, totalCommission: { $sum: "$commission" } } }
    ]).toArray();

    res.json({
      merchants,
      transactions,
      supportTickets,
      stats: {
        totalMerchants: merchants.length,
        totalTransactions: transactions.length,
        totalVolume: stats[0]?.totalVolume || 0,
        totalCommission: stats[0]?.totalCommission || 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Admin data fetch failed' });
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
          justify-content: flex-start;
          padding-top: 2vh;
          padding-bottom: 2vh;
          position: relative;
          overflow-x: hidden;
          overflow-y: auto;
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
          margin-bottom: 2rem;
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
        .password-toggle {
          position: absolute;
          right: 1rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #aaa;
          cursor: pointer;
          font-size: 1.2rem;
        }
        .btn-action {
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
          margin-top: 0.5rem;
        }
        .btn-action:hover {
          background: linear-gradient(135deg, #E6C24A, #FFE04D);
          transform: translateY(2px);
          box-shadow: 
            0 2px 0 #B8860B,
            0 4px 10px rgba(212, 175, 55, 0.35);
        }
        .btn-action:active {
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
        .section {
          margin: 1.5rem 0;
          padding-top: 1.5rem;
          border-top: 1px solid rgba(212, 175, 55, 0.2);
        }
        .footer {
          text-align: center;
          color: #94a3b8;
          font-size: 0.8rem;
          padding: 1.4rem 0;
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
        
        <!-- Register -->
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
        <button class="btn-action" onclick="register()">Register Business</button>

        <!-- Login -->
        <div class="section">
          <p class="subtitle">Already Registered? Login</p>
          <div class="form-group">
            <input type="text" id="loginPhone" placeholder="Business Phone (+233...)" />
          </div>
          <div class="form-group">
            <input type="password" id="loginPass" placeholder="Password" />
            <button class="password-toggle" onclick="togglePassword('loginPass')">👁️</button>
          </div>
          <button class="btn-action" onclick="login()">Login</button>
        </div>

        <!-- Forgot Password -->
        <div class="section">
          <p class="subtitle">Forgot Password?</p>
          <div class="form-group">
            <input type="text" id="resetPhone" placeholder="Business Phone (+233...)" />
          </div>
          <div class="form-group">
            <input type="text" id="resetCode" placeholder="Reset Code (KS1-888-999)" />
          </div>
          <div class="form-group">
            <input type="password" id="newPass" placeholder="New Password" />
            <button class="password-toggle" onclick="togglePassword('newPass')">👁️</button>
          </div>
          <button class="btn-action" onclick="resetPassword()">Reset Password</button>
        </div>

        <!-- Support -->
        <div class="section">
          <button class="btn-action" onclick="reportIssue()">🛠️ Contact Support</button>
        </div>

        <div id="error" class="error"></div>
      </div>

      <div class="footer">
        © 2026 KS1 Empower Pay – A nonprofit project by KS1 Empire Group & Foundation (KS1EGF)<br/>
        <span class="trademark">Built for Alkebulan (Africa) SMEs, Businesses And Entrepreneurs — united in digital sovereignty and shared prosperity.</span>
      </div>

      <script>
        function togglePassword(id) {
          const input = document.getElementById(id);
          const btn = input.nextElementSibling;
          if (input.type === 'password') {
            input.type = 'text';
            btn.textContent = '🔒';
          } else {
            input.type = 'password';
            btn.textContent = '👁️';
          }
        }

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
              localStorage.setItem('ownerName', data.ownerName);
              localStorage.setItem('businessName', data.businessName);
              window.location.href = '/app';
            } else {
              errorEl.textContent = d.error || 'Registration failed';
            }
          } catch (e) {
            errorEl.textContent = 'Network error';
          }
        }

        async function login() {
          const phone = document.getElementById('loginPhone').value;
          const pass = document.getElementById('loginPass').value;
          const errorEl = document.getElementById('error');

          if (!phone || !pass) {
            errorEl.textContent = 'Enter phone and password';
            return;
          }

          try {
            const res = await fetch('/api/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ businessPhone: phone, password: pass })
            });
            const d = await res.json();
            if (d.success) {
              localStorage.setItem('businessPhone', phone);
              window.location.href = '/app';
            } else {
              errorEl.textContent = d.error || 'Login failed';
            }
          } catch (e) {
            errorEl.textContent = 'Network error';
          }
        }

        async function resetPassword() {
          const phone = document.getElementById('resetPhone').value;
          const code = document.getElementById('resetCode').value;
          const newPass = document.getElementById('newPass').value;
          const errorEl = document.getElementById('error');

          if (!phone || !code || !newPass) {
            errorEl.textContent = 'Fill all reset fields';
            return;
          }

          try {
            const res = await fetch('/api/reset-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ businessPhone: phone, resetCode: code, newPassword: newPass })
            });
            const d = await res.json();
            if (d.success) {
              alert('Password updated! Logging in...');
              localStorage.setItem('businessPhone', phone);
              window.location.href = '/app';
            } else {
              errorEl.textContent = d.error || 'Reset failed';
            }
          } catch (e) {
            errorEl.textContent = 'Network error';
          }
        }

        async function reportIssue() {
          const issue = prompt("Describe your technical issue:");
          if (!issue) return;

          let businessPhone = localStorage.getItem('businessPhone') || prompt("Your Business Phone (+233...):");
          let ownerName = localStorage.getItem('ownerName') || prompt("Your Full Name:");
          let businessName = localStorage.getItem('businessName') || prompt("Your Business Name:");

          if (!businessPhone || !ownerName || !businessName) {
            alert('Please provide all details.');
            return;
          }

          try {
            const res = await fetch('/api/support', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ businessPhone, ownerName, businessName, issue })
            });
            const d = await res.json();
            alert(d.message || 'Support request sent!');
          } catch (e) {
            alert('Failed to send support request');
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
          justify-content: flex-start;
          padding-top: 2vh;
          padding-bottom: 2vh;
          position: relative;
          overflow-x: hidden;
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
          background: #1e3a8a;
          color: white;
          padding: 12px;
          border-radius: 8px;
          margin: 15px 0;
          font-size: 14px;
          text-align: center;
        }
        .theme-toggle {
          background: linear-gradient(135deg, #D4AF37, #FFD700);
          color: #1e3a8a;
          font-weight: 700;
          border: none;
          border-radius: 20px;
          padding: 6px 12px;
          font-size: 0.85rem;
          cursor: pointer;
          box-shadow: 0 2px 0 #B8860B;
          display: block;
          margin: 15px auto;
          width: auto;
        }
        .theme-toggle:hover {
          transform: translateY(-1px);
          box-shadow: 0 3px 0 #B8860B, 0 4px 8px rgba(212, 175, 55, 0.3);
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

        <div class="mission-note">
          💡 1% solidarity contribution supports our mission.<br/>
          Please remind customers to include Mobile Money network charges when sending funds.
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
          <div id="result"></div>
        </div>

        <button class="theme-toggle" onclick="toggleTheme()">🌓 Light/Dark</button>
      </div>

      <div class="footer">
        © 2026 KS1 Empower Pay – A nonprofit project by KS1 Empire Group & Foundation (KS1EGF)<br/>
        <span class="trademark">Built for Alkebulan (Africa) SMEs, Businesses And Entrepreneurs — united in digital sovereignty and shared prosperity.</span>
      </div>

      <script>
        let businessPhone = localStorage.getItem('businessPhone');
        if (!businessPhone) {
          alert('Please log in first');
          window.location.href = '/';
        }

        // Auto-logout after 45s
        let inactivityTimer;
        function resetTimer() {
          clearTimeout(inactivityTimer);
          inactivityTimer = setTimeout(() => {
            localStorage.removeItem('businessPhone');
            alert('Session expired for security.');
            window.location.href = '/';
          }, 45000);
        }
        ['click','touchstart','keypress','scroll'].forEach(e => {
          document.addEventListener(e, resetTimer, true);
        });
        resetTimer();

        function toggleTheme() {
          const isDark = document.body.classList.contains('dark-mode');
          if (isDark) {
            document.body.classList.remove('dark-mode');
            document.querySelector('.container').style.background = '#fff';
            document.querySelector('.card').style.background = '#fafafa';
          } else {
            document.body.classList.add('dark-mode');
            document.querySelector('.container').style.background = '#1e293b';
            document.querySelector('.card').style.background = '#334155';
            document.body.style.color = '#e2e8f0';
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
              const receiptText = 
                \`KS1 EMPOWER PAY\\n\` +
                \`────────────────────\\n\` +
                \`Business: \${d.businessName}\\n\` +
                \`Customer: \${data.customerName}\\n\` +
                \`Amount: GHS \${data.amount}\\n\` +
                \`Status: Completed\\n\` +
                \`ID: \${d.transactionId}\\n\` +
                \`Timestamp: \${new Date().toLocaleString()}\\n\\n\` +
                \`Thank You! You just empowered Alkebulan (AFRICA) digital freedom.\`;

              const waUrl = \`https://wa.me/?text=\${encodeURIComponent(receiptText)}\`;
              r.innerHTML = '<strong>✅ Payment Completed!</strong><br/>Transaction ID: <b>' + d.transactionId + '</b><br/><a href="' + waUrl + '" target="_blank" style="color:#3b82f6;">📱 View Receipt on WhatsApp</a>';
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
          background: #0c1a3a;
          color: #fff;
          line-height: 1.5;
          padding: 1rem;
          max-width: 900px;
          margin: 0 auto;
          min-height: 100vh;
          position: relative;
          overflow-x: hidden;
          overflow-y: auto;
        }
        body::before {
          content: "";
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(212, 175, 55, 0.08) 0%, transparent 70%);
          z-index: -1;
          animation: rotate 25s linear infinite;
        }
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .container {
          background: rgba(12, 26, 58, 0.9);
          border-radius: 16px;
          padding: 1.8rem;
          margin-top: 1.5rem;
          margin-bottom: 2rem;
          box-shadow: 0 8px 24px rgba(212, 175, 55, 0.2);
          border: 1px solid rgba(212, 175, 55, 0.3);
          position: relative;
          z-index: 2;
        }
        h1 {
          font-size: 2.2rem;
          font-weight: 900;
          color: #FFD700;
          letter-spacing: -0.5px;
          text-shadow: 0 0 10px rgba(212, 175, 55, 0.7);
          text-align: center;
          margin-bottom: 0.4rem;
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
        .dashboard-title {
          font-size: 1.4rem;
          font-weight: 800;
          color: #FFD700;
          text-align: center;
          margin-bottom: 1.6rem;
          text-shadow: 2px 2px 4px rgba(212, 175, 55, 0.3);
          position: relative;
        }
        .dashboard-title::after {
          content: "";
          position: absolute;
          bottom: -6px;
          left: 50%;
          transform: translateX(-50%);
          width: 50px;
          height: 3px;
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
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1.2rem;
          margin-bottom: 1.6rem;
        }
        .stat-card {
          background: rgba(0,0,0,0.2);
          padding: 1.2rem;
          border-radius: 12px;
          text-align: center;
          border: 1px solid rgba(212, 175, 55, 0.2);
        }
        .stat-label {
          color: #cbd5e1;
          font-size: 0.95rem;
          margin-bottom: 0.4rem;
        }
        .stat-value {
          font-size: 1.5rem;
          font-weight: 800;
          color: #FFD700;
        }
        .filters {
          display: flex;
          gap: 0.8rem;
          margin-bottom: 1.4rem;
          flex-wrap: wrap;
        }
        .filters input, .filters select {
          padding: 0.7rem;
          border: 1px solid #444;
          border-radius: 8px;
          font-size: 0.95rem;
          background: rgba(0,0,0,0.3);
          color: white;
          flex: 1;
          min-width: 150px;
        }
        .btn-filter, .btn-generate, .btn-view-all, .theme-toggle {
          background: linear-gradient(135deg, #D4AF37, #FFD700);
          color: #0c1a3a;
          font-weight: 700;
          border: none;
          border-radius: 8px;
          padding: 0.7rem 1.2rem;
          cursor: pointer;
          box-shadow: 0 3px 0 #B8860B;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          min-width: 100px;
          transition: all 0.2s ease;
        }
        .btn-filter:hover, .btn-generate:hover, .btn-view-all:hover, .theme-toggle:hover {
          background: linear-gradient(135deg, #E6C24A, #FFE04D);
          transform: translateY(-2px);
          box-shadow: 0 5px 0 #B8860B, 0 8px 16px rgba(212, 175, 55, 0.3);
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 1rem;
        }
        th, td {
          padding: 0.9rem 0.6rem;
          text-align: left;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        th {
          color: #FFD700;
          font-weight: 800;
          font-size: 0.95rem;
        }
        tr:hover {
          background: rgba(212, 175, 55, 0.1);
        }
        .section-title {
          color: #FFD700;
          margin: 1.5rem 0 0.8rem;
          font-size: 1.3rem;
          font-weight: 800;
          text-shadow: 2px 2px 4px rgba(212, 175, 55, 0.3);
          position: relative;
        }
        .section-title::after {
          content: "";
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 40px;
          height: 2px;
          background: linear-gradient(90deg, #D4AF37, #FFD700);
          border-radius: 1px;
        }
        #resetResult {
          background: rgba(212, 175, 55, 0.1);
          padding: 12px;
          border-radius: 8px;
          color: #FFD700;
          font-weight: bold;
          display: none;
          margin-top: 10px;
        }

        /* Modal */
        .modal {
          display: none;
          position: fixed;
          z-index: 1000;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0,0,0,0.85);
        }
        .modal-content {
          background: rgba(12, 26, 58, 0.95);
          margin: 2rem auto;
          padding: 2rem;
          border-radius: 16px;
          width: 90%;
          max-width: 800px;
          max-height: 80vh;
          overflow-y: auto;
          border: 1px solid rgba(212, 175, 55, 0.3);
        }
        .close {
          color: #FFD700;
          float: right;
          font-size: 1.5rem;
          font-weight: bold;
          cursor: pointer;
        }
        .footer {
          text-align: center;
          color: #94a3b8;
          font-size: 0.85rem;
          padding: 1.8rem 0;
          border-top: 1px solid rgba(255,255,255,0.1);
          margin-top: 1rem;
          position: relative;
          z-index: 2;
        }
        @media (max-width: 600px) {
          .filters { flex-direction: column; }
          .filters input, .filters select, .btn-filter, .btn-generate, .btn-view-all {
            width: 100%;
            min-width: auto;
          }
          table { font-size: 0.85rem; }
          th, td { padding: 0.6rem 0.3rem; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>KS1 Empower Pay Admin</h1>
        <div class="dashboard-title">Dashboard</div>
        
        <div class="mission-banner">
          🌍 Every transaction fuels our mission to empower African SMEs with sovereign digital tools.
        </div>

        <div class="stats">
          <div class="stat-card">
            <div class="stat-label">Total Businesses</div>
            <div class="stat-value" id="totalBiz">—</div>
          </div>
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
          <input type="text" id="search" placeholder="Search by ID, business, customer, or phone" />
          <select id="networkFilter">
            <option value="">All Networks</option>
            <option value="MTN">MTN</option>
            <option value="Telecel">Telecel</option>
            <option value="AirtelTogo">AirtelTogo</option>
          </select>
          <button class="btn-filter" onclick="loadData()">Apply</button>
          <button class="theme-toggle" onclick="toggleTheme()">🌓 Theme</button>
        </div>

        <!-- Password Reset Section -->
        <div class="section-title">🔑 Generate Password Reset Code</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;">
          <input type="text" id="resetPhoneAdmin" placeholder="Business Phone (+233...)" style="padding:0.7rem;border:1px solid #444;border-radius:8px;background:rgba(0,0,0,0.3);color:white;flex:1;min-width:200px;"/>
          <button class="btn-generate" onclick="generateResetCode()">Generate Code</button>
        </div>

        <!-- View All Businesses Button -->
        <button class="btn-view-all" onclick="viewAllBusinesses()" style="margin-bottom:20px;">View All Businesses</button>

        <div id="resetResult"></div>

        <div class="section-title">🆕 New Businesses</div>
        <table id="bizTable">
          <thead>
            <tr>
              <th>Name</th>
              <th>Owner (DOB)</th>
              <th>Phone</th>
              <th>Since</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody id="bizBody"></tbody>
        </table>

        <div class="section-title">💸 Recent Transactions</div>
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

        <div class="section-title">🛠️ Open Support Tickets</div>
        <table id="supportTable">
          <thead>
            <tr>
              <th>Business</th>
              <th>Issue</th>
              <th>Reported</th>
            </tr>
          </thead>
          <tbody id="supportBody"></tbody>
        </table>
      </div>

      <!-- Modal for All Businesses -->
      <div id="businessModal" class="modal">
        <div class="modal-content">
          <span class="close" onclick="closeModal()">&times;</span>
          <h2 style="color:#FFD700;text-align:center;margin-bottom:1.5rem;">All Registered Businesses</h2>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr>
                <th>Name</th>
                <th>Owner</th>
                <th>DOB</th>
                <th>Phone</th>
                <th>Since</th>
                <th>Joined</th>
                <th>Transactions</th>
                <th>Volume (GHS)</th>
              </tr>
            </thead>
            <tbody id="allBizBody"></tbody>
          </table>
        </div>
      </div>

      <div class="footer">
        © 2026 KS1 Empower Pay – A nonprofit project by KS1 Empire Group & Foundation (KS1EGF)
      </div>

      <script>
        let currentPassword = '';

        // Auto-logout after 45s
        let inactivityTimer;
        function resetTimer() {
          clearTimeout(inactivityTimer);
          inactivityTimer = setTimeout(() => {
            localStorage.removeItem('adminAuth');
            alert('Session expired for security.');
            window.location.href = '/';
          }, 45000);
        }
        ['click','touchstart','keypress','scroll'].forEach(e => {
          document.addEventListener(e, resetTimer, true);
        });
        resetTimer();

        // Theme toggle
        function toggleTheme() {
          const isBlue = document.body.style.background.includes('#0c1a3a');
          if (isBlue) {
            document.body.style.background = '#fff';
            document.body.style.color = '#1e3a8a';
            document.querySelector('.container').style.background = 'rgba(255,255,255,0.9)';
          } else {
            document.body.style.background = '#0c1a3a';
            document.body.style.color = '#fff';
            document.querySelector('.container').style.background = 'rgba(12, 26, 58, 0.9)';
          }
        }

        async function loadData() {
          try {
            const query = document.getElementById('search').value.toLowerCase();
            const network = document.getElementById('networkFilter').value;

            const res = await fetch('/api/admin/data?password=' + encodeURIComponent(currentPassword));
            const data = await res.json();

            document.getElementById('totalBiz').textContent = data.stats.totalMerchants;
            document.getElementById('totalTx').textContent = data.stats.totalTransactions;
            document.getElementById('totalVol').textContent = data.stats.totalVolume.toFixed(2);
            document.getElementById('totalComm').textContent = data.stats.totalCommission.toFixed(2);

            const filteredBiz = data.merchants.filter(b => 
              !query || 
              b.businessName.toLowerCase().includes(query) ||
              b.ownerName.toLowerCase().includes(query) ||
              b.businessPhone.includes(query)
            );
            document.getElementById('bizBody').innerHTML = filteredBiz.slice(0, 5).map(b => {
              const dob = new Date(b.ownerDob);
              const dobStr = \`\${dob.getDate()}/\${dob.getMonth()+1}/\${dob.getFullYear()}\`;
              return \`<tr>
                <td>\${b.businessName}</td>
                <td>\${b.ownerName} (\${dobStr})</td>
                <td>\${b.businessPhone}</td>
                <td>\${b.businessSince}</td>
                <td>\${new Date(b.createdAt).toLocaleDateString()}</td>
              </tr>\`;
            }).join('');

            let txs = data.transactions;
            if (query) {
              txs = txs.filter(tx => 
                tx.transactionId.toLowerCase().includes(query) ||
                tx.businessName.toLowerCase().includes(query) ||
                tx.customerName.toLowerCase().includes(query) ||
                tx.businessPhone.includes(query) ||
                tx.customerNumber.includes(query)
              );
            }
            document.getElementById('txBody').innerHTML = txs.slice(0, 10).map(tx => 
              \`<tr>
                <td>\${tx.transactionId}</td>
                <td>\${new Date(tx.timestamp).toLocaleString()}</td>
                <td>\${tx.businessName} (\${tx.businessPhone})</td>
                <td>\${tx.customerName}</td>
                <td>\${tx.amount}</td>
                <td>\${tx.commission}</td>
              </tr>\`
            ).join('');

            document.getElementById('supportBody').innerHTML = data.supportTickets.map(t => 
              \`<tr>
                <td>\${t.businessName} (\${t.ownerName})<br/><small>\${t.businessPhone}</small></td>
                <td>\${t.issue}</td>
                <td>\${new Date(t.reportedAt).toLocaleString()}</td>
              </tr>\`
            ).join('');
          } catch (err) {
            alert('Failed to load admin data. Check password.');
            window.location.href = '/';
          }
        }

        async function viewAllBusinesses() {
          try {
            const res = await fetch('/api/admin/data?password=' + encodeURIComponent(currentPassword));
            const data = await res.json();
            
            document.getElementById('allBizBody').innerHTML = data.merchants.map(b => {
              const dob = new Date(b.ownerDob);
              const dobStr = \`\${dob.getDate()}/\${dob.getMonth()+1}/\${dob.getFullYear()}\`;
              return \`<tr>
                <td>\${b.businessName}</td>
                <td>\${b.ownerName}</td>
                <td>\${dobStr}</td>
                <td>\${b.businessPhone}</td>
                <td>\${b.businessSince}</td>
                <td>\${new Date(b.createdAt).toLocaleDateString()}</td>
                <td>\${b.totalTransactions || 0}</td>
                <td>\${(b.totalVolume || 0).toFixed(2)}</td>
              </tr>\`;
            }).join('');
            
            document.getElementById('businessModal').style.display = 'block';
          } catch (err) {
            alert('Failed to load businesses.');
          }
        }

        function closeModal() {
          document.getElementById('businessModal').style.display = 'none';
        }

        async function generateResetCode() {
          const phone = document.getElementById('resetPhoneAdmin').value;
          const resultDiv = document.getElementById('resetResult');
          
          if (!phone || !phone.startsWith('+233')) {
            alert('Please enter a valid +233 business phone number');
            return;
          }

          try {
            const res = await fetch('/api/admin/generate-reset', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                password: currentPassword,
                businessPhone: phone 
              })
            });
            const data = await res.json();
            
            if (data.success) {
              resultDiv.innerHTML = \`✅ Reset code for <b>\${data.businessName}</b>:<br/><b style="font-size:1.2em;">\${data.resetCode}</b><br/><small>Valid for 30 minutes</small>\`;
              resultDiv.style.display = 'block';
            } else {
              resultDiv.innerHTML = \`❌ \${data.error}\`;
              resultDiv.style.display = 'block';
            }
          } catch (e) {
            resultDiv.innerHTML = '❌ Network error';
            resultDiv.style.display = 'block';
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
