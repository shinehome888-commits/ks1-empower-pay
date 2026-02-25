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
    network = 'MTN',
    password // ✅ NEW
  } = req.body;

  if (!businessName || !ownerName || !ownerDob || !businessSince || !businessPhone || !password) {
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
      password, // ✅ STORE PASSWORD
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

// === GET USER TRANSACTIONS ===
app.post('/api/my-transactions', async (req, res) => {
  const { businessPhone } = req.body;
  if (!businessPhone) {
    return res.status(400).json([]);
  }
  try {
    const transactions = await db.collection('transactions')
      .find({ businessPhone })
      .sort({ timestamp: -1 })
      .toArray();
    res.json(transactions);
  } catch (err) {
    res.status(500).json([]);
  }
});

// === DELETE BUSINESS ===
app.delete('/api/admin/business/:phone', async (req, res) => {
  if (req.query.password !== BUSINESS_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await db.collection('merchants').deleteOne({ businessPhone: req.params.phone });
    await db.collection('transactions').deleteMany({ businessPhone: req.params.phone });
    await db.collection('support').deleteMany({ businessPhone: req.params.phone });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// === DELETE TRANSACTION ===
app.delete('/api/admin/transaction/:id', async (req, res) => {
  if (req.query.password !== BUSINESS_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await db.collection('transactions').deleteOne({ transactionId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// === DELETE SUPPORT TICKET ===
app.delete('/api/admin/support/:id', async (req, res) => {
  if (req.query.password !== BUSINESS_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await db.collection('support').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});
