// KS1 EMPOWER PAY – ALKEBULAN (AFRICA) EDITION • FINAL MONGODB BACKEND
const express = require('express');
const { MongoClient } = require('mongodb');
const dns = require('dns');

// 🔑 Force IPv4 for Render + MongoDB Atlas
dns.setDefaultResultOrder('ipv4first');

const app = express();
app.use(express.json());

// === CONFIGURATION ===
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
      tlsAllowInvalidCertificates: true, // ✅ Required for Node.js 22 + Atlas on Render
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

  const transaction = {
    businessName,
    customerName,
    customerNumber,
    businessPhone,
    network,
    amount: parseFloat(amount),
    commission: parseFloat((amount * 0.003).toFixed(2)),
    netToMerchant: parseFloat((amount * 0.997).toFixed(2)),
    status: 'completed',
    timestamp: new Date(),
    paymentMethod: 'momo'
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
      <div id="stats" style="margin:20px 0;"></div>
      <table border="1" style="width:100%;border-collapse:collapse;margin-top:20px;">
        <thead>
          <tr style="background:#1e3a8a;color:#FFD700;">
            <th>Date</th>
            <th>Business</th>
            <th>Customer</th>
            <th>Network</th>
            <th>Amount (GHS)</th>
          </tr>
        </thead>
        <tbody id="txs"></tbody>
      </table>
      <script>
        const pwd = prompt("Enter Business Password:");
        if (!pwd) window.location.href = '/';

        async function load() {
          try {
            const s = await fetch('/api/stats');
            const stats = await s.json();
            document.getElementById('stats').innerHTML = 
              '<div><b>Total Transactions:</b> ' + stats.totalTransactions + '</div>' +
              '<div><b>Total Volume:</b> GHS ' + stats.totalVolume + '</div>';
          
            const t = await fetch('/api/transactions?password=' + encodeURIComponent(pwd));
            const txs = await t.json();
            document.getElementById('txs').innerHTML = txs.map(tx => 
              '<tr style="border-bottom:1px solid #333;">' +
                '<td>' + new Date(tx.timestamp).toLocaleString() + '</td>' +
                '<td>' + tx.businessName + '</td>' +
                '<td>' + tx.customerName + ' (' + tx.customerNumber + ')</td>' +
                '<td>' + tx.network + '</td>' +
                '<td>GHS ' + tx.amount + '</td>' +
              '</tr>'
            ).join('');
          } catch (err) {
            alert('Failed to load. Check password or network.');
            window.location.href = '/';
          }
        }
        load();
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
