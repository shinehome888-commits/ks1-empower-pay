// KS1 EMPOWER PAY – PHASE 1 (FULL APP)
// Nonprofit payment router for African SMEs by KS1 Empire Group & Foundation (KS1EGF)
// Works on Render.com free tier • Logs every commission • Zero cost • Mobile-first

const express = require('express');
const app = express();
app.use(express.json());

let commissions = []; // In-memory storage (Phase 1)

// Health check endpoint
app.get('/api/test', (req, res) => {
  res.json({
    status: '✅ LIVE',
    nonprofit: 'KS1 Empire Group & Foundation (KS1EGF)',
    mission: 'Empower African SMEs via micro-commissions',
    host: 'Render.com (Free Tier)',
    updated_at: new Date().toISOString()
  });
});

// Process payment → auto-donate micro-commission to KS1EGF
app.post('/api/payment/transaction', (req, res) => {
  const { amount = 100, currency = 'GHS', payment_method = 'momo' } = req.body;
  
  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // ⭐ CORE: MICRO-COMMISSION ENGINE (NON-EXPLOITATIVE, TRANSPARENT)
  const commissionRate = 0.003; // 0.3%
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

  commissions.push({
    transaction_id: txId,
    commission_amount: commissionAmount,
    ks1egf_wallet: '+233240254680', // ← UPDATE IF NEEDED
    currency,
    timestamp: tx.timestamp
  });

  // 🔍 LOG TO CONSOLE (visible in Render logs forever!)
  console.log("COMMISSION_LOG:", JSON.stringify({
    type: "micro-commission",
    gross_amount: amount,
    commission_amount: commissionAmount,
    net_to_merchant: netToMerchant,
    ks1egf_wallet: '+233240254680',
    timestamp: tx.timestamp
  }));

  res.json({
    success: true,
    ...tx,
    commission_rate_percent: '0.30',
    message: 'Commission auto-donated to KS1EGF ❤️'
  });
});

// View all commissions (for admin transparency)
app.get('/api/commissions', (req, res) => {
  const total = commissions.reduce((sum, c) => sum + c.commission_amount, 0);
  res.json({
    total_commissions_count: commissions.length,
    total_commission_amount: parseFloat(total.toFixed(2)),
    list: commissions
  });
});

// Serve mobile-friendly POS frontend
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
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
          background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 0.5rem;
        }
        .subtitle {
          color: #aaa;
          font-size: 0.95rem;
        }
        .card {
          background: #111;
          border-radius: 16px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .card h2 {
          margin-bottom: 1rem;
          font-size: 1.3rem;
          color: #3b82f6;
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
        button {
          background: linear-gradient(90deg, #3b82f6, #2563eb);
          color: white;
          font-weight: bold;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        button:hover {
          opacity: 0.9;
        }
        #result {
          margin-top: 1rem;
          padding: 1rem;
          border-radius: 10px;
          display: none;
        }
        .success { background: #064e3b; border-left: 4px solid #10b981; display: block; }
        .error { background: #450a0a; border-left: 4px solid #ef4444; display: block; }
        .footer {
          text-align: center;
          color: #777;
          font-size: 0.85rem;
          padding-top: 1.5rem;
          border-top: 1px solid #222;
        }
        .highlight {
          color: #3b82f6;
          font-weight: bold;
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
        <input type="number" id="amount" placeholder="Enter amount in GHS" min="1" value="100"/>
        <button onclick="createTransaction()">Process Payment</button>
        <div id="result"></div>
      </div>

      <div class="card">
        <h2>How It Works</h2>
        <p>Every transaction supports <span class="highlight">KS1 Empire Group & Foundation (KS1EGF)</span> with a tiny <span class="highlight">0.3% micro-commission</span>.</p>
        <p>You keep <span class="highlight">99.7%</span>. We empower millions of African SMEs.</p>
        <p><small>Example: GHS 100 → GHS 0.30 to KS1EGF, GHS 99.70 to you.</small></p>
      </div>

      <div class="footer">
        © 2026 KS1 Empire Group & Foundation (KS1EGF)<br/>
        Built with love for every African entrepreneur.
      </div>

      <script>
        async function createTransaction() {
          const input = document.getElementById('amount');
          const amount = parseFloat(input.value);
          const resultDiv = document.getElementById('result');
          
          if (!amount || amount <= 0) {
            resultDiv.className = 'error';
            resultDiv.innerHTML = 'Please enter a valid amount';
            resultDiv.style.display = 'block';
            return;
          }

          try {
            const res = await fetch('/api/payment/transaction', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount })
            });
            
            const data = await res.json();
            const result = document.getElementById('result');
            
            if (data.success) {
              result.className = 'success';
              result.innerHTML = \`
                <strong>✅ Payment Processed!</strong><br/><br/>
                Gross Amount: <span class="highlight">GHS \${data.amount}</span><br/>
                KS1EGF Commission: <span class="highlight">GHS \${data.commission_amount}</span><br/>
                You Receive: <span class="highlight">GHS \${data.net_to_merchant}</span>
              \`;
            } else {
              result.className = 'error';
              result.innerHTML = '❌ Error: ' + (data.error || 'Unknown');
            }
            result.style.display = 'block';
          } catch (err) {
            const result = document.getElementById('result');
            result.className = 'error';
            result.innerHTML = '❌ Network error. Please try again.';
            result.style.display = 'block';
          }
        }

        document.getElementById('amount').addEventListener('keypress', (e) => {
          if (e.key === 'Enter') createTransaction();
        });
      </script>
    </body>
    </html>
  `);
});

// Start server (Render uses dynamic PORT)
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(\`🚀 KS1 Empower Pay running on port \${PORT}\`);
});
