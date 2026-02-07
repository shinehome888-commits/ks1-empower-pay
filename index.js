const express = require('express');
const app = express();
app.use(express.json());

// In-memory storage (Phase 1 prototype)
let commissions = [];
let transactions = [];

// Health check
app.get('/api/test', (req, res) => {
  res.json({
    status: '✅ LIVE',
    nonprofit: 'KS1 Empire Group & Foundation (KS1EGF)',
    mission: 'Empower African SMEs + fund nonprofit via micro-commissions',
    host: 'Fly.io (Free Forever)',
    updated_at: new Date().toISOString()
  });
});

// Create payment transaction → auto-donate to KS1EGF
app.post('/api/payment/transaction', (req, res) => {
  const { amount = 100, currency = 'GHS', payment_method = 'momo' } = req.body;
  
  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // ⭐ MICRO-COMMISSION ENGINE (CORE)
  const commissionRate = 0.003; // 0.3% → non-exploitative
  const commissionAmount = parseFloat((amount * commissionRate).toFixed(2));
  const netToMerchant = parseFloat((amount - commissionAmount).toFixed(2));

  const txId = 'tx_' + Date.now();
  const tx = {
    id: txId,
    amount,
    currency,
    payment_method,
    commission_amount: commissionAmount,
    net_to_merchant: netToMerchant,
    status: 'success',
    timestamp: new Date().toISOString()
  };

  transactions.push(tx);
  commissions.push({
    transaction_id: txId,
    commission_amount: commissionAmount,
    ks1egf_wallet: '+233240254680', // ← UPDATE IF NEEDED
    currency,
    timestamp: tx.timestamp
  });

  res.json({
    success: true,
    ...tx,
    commission_rate_percent: '0.30',
    message: 'Commission auto-donated to KS1EGF ❤️'
  });
});

// Admin: View all commissions (for transparency)
app.get('/api/commissions', (req, res) => {
  const total = commissions.reduce((sum, c) => sum + c.commission_amount, 0);
  res.json({
    total_commissions_count: commissions.length,
    total_commission_amount: parseFloat(total.toFixed(2)),
    list: commissions
  });
});

// Serve POS frontend
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>KS1 Empower Pay</title>
      <style>
        body { font-family: system-ui; background: #000; color: #fff; padding: 2rem; text-align: center; }
        .card { background: #111; border-radius: 12px; padding: 1.5rem; margin: 1rem auto; max-width: 500px; }
        input, button { width: 100%; padding: 0.75rem; margin: 0.5rem 0; border: none; border-radius: 8px; }
        button { background: #3b82f6; color: white; font-weight: bold; cursor: pointer; }
        button:hover { background: #2563eb; }
        .footer { margin-top: 2rem; font-size: 0.85rem; color: #aaa; }
      </style>
    </head>
    <body>
      <h1>KS1 Empower Pay</h1>
      <p>Non-custodial payment router for African SMEs</p>
      
      <div class="card">
        <h3>Create Payment</h3>
        <input type="number" id="amount" placeholder="Amount (GHS)" min="1" value="100"/>
        <button onclick="createTransaction()">Process Payment</button>
        <div id="result"></div>
      </div>

      <div class="card">
        <h3>How It Works</h3>
        <p>Every transaction funds KS1EGF with a 0.3% micro-commission.</p>
        <p>You keep 99.7%. We empower millions.</p>
      </div>

      <div class="footer">
        © 2026 KS1 Empire Group & Foundation (KS1EGF)<br/>
        Built with love for every African entrepreneur.
      </div>

      <script>
        async function createTransaction() {
          const amount = parseFloat(document.getElementById('amount').value);
          if (!amount || amount <= 0) return alert('Enter valid amount');
          
          const res = await fetch('/api/payment/transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount })
          });
          const data = await res.json();
          
          const result = document.getElementById('result');
          if (data.success) {
            result.innerHTML = \`
              <p style="color:#4ade80">✅ Success!</p>
              <p>Gross: GHS \${data.amount}</p>
              <p>KS1EGF Commission: GHS \${data.commission_amount}</p>
              <p>You Receive: GHS \${data.net_to_merchant}</p>
            \`;
          } else {
            result.innerHTML = '<p style="color:#ef4444">❌ Error</p>';
          }
        }
      </script>
    </body>
    </html>
  `);
});

// Start server (Fly.io uses PORT 8080)
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(\`🚀 KS1 Empower Pay running on port \${PORT}\`);
});
