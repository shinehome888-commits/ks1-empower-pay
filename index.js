// KS1 EMPOWER PAY – ALKEBULAN (AFRICA) EDITION • 1% NONPROFIT MODEL
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');

const app = express();
app.use(express.json());

const BUSINESS_PASSWORD = process.env.BUSINESS_PASSWORD || "ks1empower2026";
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ FATAL: MONGODB_URI not set in Render Environment");
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
    console.error("❌ MongoDB connection error:", err.message);
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
    res.json({ success: true, message: "Profile saved" });
  } catch (err) {
    console.error("Profile save error:", err.message);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

// === GET ALL MERCHANTS (for admin) ===
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

// === FLAG TRANSACTION AS DISPUTED ===
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

    res.json({ success: true, message: 'Dispute flagged' });
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

  // ✅ 1% solidarity contribution
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

    // Business context
    businessCategory: req.body.category || 'Other',
    businessLocation: req.body.location || '—',
    businessSince: req.body.since ? parseInt(req.body.since) : new Date().getFullYear(),
    contactPreference: req.body.contactPreference || 'whatsapp',
    optedIntoPromos: req.body.optedIntoPromos || false,

    // Admin tracking
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

// === GET TRANSACTIONS (ADMIN) ===
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
      { $group: { _id: null, totalVolume: { $sum: "$amount" } } }
    ]).toArray();
    const totalVolume = result[0]?.totalVolume || 0;

    res.json({
      totalTransactions: total,
      totalVolume: parseFloat(totalVolume.toFixed(2))
    });
  } catch (err) {
    res.status(500).json({ error: 'Stats unavailable' });
  }
});

// === LANDING PAGE ===
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>KS1 Empower Pay</title></head>
    <body style="background:#000;color:#fff;padding:20px;font-family:sans-serif;text-align:center;">
      <h1>KS1 Empower Pay</h1>
      <p>Secure Access For Authorized Merchants</p>
      
      <!-- Nonprofit Mission Note -->
      <div style="background:#1e3a8a;padding:12px;border-radius:8px;margin:15px 0;color:#dbeafe;font-size:14px;">
        💡 <strong>1% of every transaction funds our nonprofit mission</strong> to build open, non-custodial payment infrastructure for African SMEs.
        <br/>You transact. We grow. Together, we thrive.
      </div>

      <input type="password" id="pwd" placeholder="Business Password" style="padding:8px;width:80%;margin:10px 0;"/>
      <br/>
      <button onclick="login()" style="background:#FFD700;color:#000;border:none;padding:10px 20px;font-weight:bold;">Access Dashboard</button>
      <script>
        async function login() {
          const pwd = document.getElementById('pwd').value;
          if (pwd === '${BUSINESS_PASSWORD}') {
            localStorage.setItem('auth', 'true');
            window.location.href = '/app';
          } else {
            alert('Invalid password');
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
    <html>
    <head><title>Dashboard</title></head>
    <body style="background:#000;color:#fff;padding:20px;font-family:sans-serif;">
      <h1>Dashboard</h1>
      
      <!-- Mission Reminder -->
      <div style="background:#1e3a8a;padding:12px;border-radius:8px;margin-bottom:20px;color:#dbeafe;font-size:14px;">
        💡 <strong>1% solidarity contribution</strong> from each transaction supports KS1 Empower Pay’s growth.
        <br/><strong>Please remind customers to include Mobile Money network charges</strong> when sending funds.
        <br/>We do <em>not</em> cover transaction fees.
      </div>

      <h2>Create Mobile Money Payment</h2>
      <input id="bname" placeholder="Business Name" style="display:block;width:100%;padding:8px;margin:5px 0;"/><br/>
      <input id="cname" placeholder="Customer Name" style="display:block;width:100%;padding:8px;margin:5px 0;"/><br/>
      <input id="cnum" placeholder="Customer Number" style="display:block;width:100%;padding:8px;margin:5px 0;"/><br/>
      <input id="bphone" placeholder="Business Phone" style="display:block;width:100%;padding:8px;margin:5px 0;"/><br/>
      <select id="net" style="display:block;width:100%;padding:8px;margin:5px 0;">
        <option>MTN</option>
        <option>Telecel</option>
        <option>AirtelTogo</option>
      </select><br/>
      <input id="amt" type="number" placeholder="Amount" value="100" style="display:block;width:100%;padding:8px;margin:5px 0;"/><br/>
      <input id="cphone" placeholder="Customer MoMo" value="+233240000000" style="display:block;width:100%;padding:8px;margin:5px 0;"/><br/>
      <button onclick="pay()" style="background:#FFD700;color:#000;border:none;padding:10px 20px;font-weight:bold;">Pay & Empower Alkebulan (AFRICA)</button>
      <div id="res" style="margin-top:20px;"></div>

      <!-- Business Profile Section -->
      <div class="card" style="margin-top:30px;padding:15px;background:#111;border-radius:8px;">
        <h2>Business Profile (Optional but Recommended)</h2>
        <select id="category" style="width:100%;padding:8px;margin:5px 0;">
          <option value="Retail">Retail / Shop</option>
          <option value="Food">Food / Restaurant</option>
          <option value="Services">Services (Hair, Repair, etc.)</option>
          <option value="Agriculture">Agriculture / Farming</option>
          <option value="Other">Other</option>
        </select>
        <input type="text" id="location" placeholder="City, Country (e.g., Kumasi, Ghana)" style="width:100%;padding:8px;margin:5px 0;"/>
        <input type="number" id="since" placeholder="Year Started (e.g., 2020)" min="1900" max="2026" style="width:100%;padding:8px;margin:5px 0;"/>
        <button onclick="saveProfile()" style="background:#FFD700;color:#000;border:none;padding:10px 20px;font-weight:bold;margin-top:10px;">Save Profile</button>
      </div>

      <script>
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
          const r = document.getElementById('res');
          r.innerHTML = 'Processing...';
          try {
            const res = await fetch('/api/momo/request', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            const d = await res.json();
            if (d.success) {
              r.innerHTML = '<b>✅ Success!</b><br/>Check WhatsApp for receipts.';
            } else {
              r.innerHTML = '❌ Failed: ' + (d.error || 'Unknown');
            }
          } catch (e) {
            r.innerHTML = '❌ Network error';
          }
        }

        async function saveProfile() {
          const data = {
            businessName: document.getElementById('bname').value,
            businessPhone: document.getElementById('bphone').value,
            category: document.getElementById('category').value,
            location: document.getElementById('location').value,
            since: document.getElementById('since').value
          };

          if (!data.businessName || !data.businessPhone) {
            alert('Please fill Business Name and Phone first');
            return;
          }

          try {
            const res = await fetch('/api/profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            const d = await res.json();
            if (d.success) {
              alert('✅ Profile saved!');
            } else {
              alert('❌ ' + (d.error || 'Failed'));
            }
          } catch (e) {
            alert('Network error');
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
    <html>
    <head><title>Admin</title></head>
    <body style="background:#000;color:#fff;padding:20px;font-family:sans-serif;">
      <h1>KS1 Empower Pay Admin</h1>
      
      <!-- Mission Banner -->
      <div style="background:#1e3a8a;padding:12px;border-radius:8px;margin-bottom:20px;color:#dbeafe;font-size:14px;">
        🌍 <strong>Nonprofit-Powered Platform</strong><br/>
        1% of every transaction fuels our mission to empower African SMEs with sovereign digital tools.
      </div>
      
      <!-- Stats -->
      <div id="stats" style="margin:20px 0;"></div>

      <!-- Filters -->
      <div style="margin:20px 0;">
        <input type="text" id="search" placeholder="Search business/customer/phone" style="padding:8px;width:300px;"/>
        <select id="networkFilter" style="padding:8px;margin-left:10px;">
          <option value="">All Networks</option>
          <option value="MTN">MTN</option>
          <option value="Telecel">Telecel</option>
          <option value="AirtelTogo">AirtelTogo</option>
        </select>
        <button onclick="loadTransactions()" style="background:#FFD700;color:#000;padding:8px;margin-left:10px;">Apply</button>
      </div>

      <!-- Transactions Table -->
      <table border="1" style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#1e3a8a;color:#FFD700;">
            <th>Date</th>
            <th>Business (Category)</th>
            <th>Customer</th>
            <th>Network</th>
            <th>Amount (GHS)</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="txs"></tbody>
      </table>

      <script>
        let currentPassword = '';

        async function loadStats() {
          const s = await fetch('/api/stats');
          const stats = await s.json();
          document.getElementById('stats').innerHTML = 
            '<div><b>Active Businesses:</b> <span id="bizCount">—</span></div>' +
            '<div><b>Total Transactions:</b> ' + stats.totalTransactions + '</div>' +
            '<div><b>Total Volume:</b> GHS ' + stats.totalVolume + '</div>';
          
          const m = await fetch('/api/merchants?password=' + encodeURIComponent(currentPassword));
          const merchants = await m.json();
          document.getElementById('bizCount').textContent = merchants.length;
        }

        async function loadTransactions() {
          const search = document.getElementById('search').value;
          const network = document.getElementById('networkFilter').value;
          
          const t = await fetch('/api/transactions?password=' + encodeURIComponent(currentPassword));
          let txs = await t.json();
          
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

          document.getElementById('txs').innerHTML = txs.map(tx => 
            \`<tr style="border-bottom:1px solid #333;">
              <td>\${new Date(tx.timestamp).toLocaleString()}</td>
              <td>\${tx.businessName} (\${tx.businessCategory || '—'})<br/><small>\${tx.businessLocation}</small></td>
              <td>\${tx.customerName}<br/><small>\${tx.customerNumber}</small></td>
              <td>\${tx.network}</td>
              <td>GHS \${tx.amount}</td>
              <td>
                <button onclick="flagDispute('\${tx._id}')" style="background:red;color:white;padding:4px;font-size:12px;border:none;cursor:pointer;">Flag</button>
              </td>
            </tr>\`
          ).join('');
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
              alert('✅ Dispute flagged and saved!');
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
