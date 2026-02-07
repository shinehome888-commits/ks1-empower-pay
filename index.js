// KS1 EMPOWER PAY – PHASE 1 (GITHUB + REPLIT READY)
const express = require('express');
const app = express();
app.use(express.json());

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    message: "KS1 Empower Pay is LIVE!",
    nonprofit: "KS1 Empire Group & Foundation (KS1EGF)",
    mission: "Empower African SMEs + fund nonprofit via micro-commissions"
  });
});

// Simulate transaction with auto-commission
app.post('/api/payment/transaction', (req, res) => {
  const { amount = 100, currency = 'GHS' } = req.body;
  const commissionRate = 0.003; // 0.3% → configurable later
  const commissionAmount = parseFloat((amount * commissionRate).toFixed(2));
  const netToMerchant = parseFloat((amount - commissionAmount).toFixed(2));
  
  res.json({
    success: true,
    gross_amount: amount,
    commission_amount: commissionAmount,
    commission_rate_percent: "0.30",
    net_to_merchant: netToMerchant,
    ks1egf_wallet: "+233240254680",
    message: "Commission auto-donated to KS1EGF ❤️"
  });
});

// Simple commission log (in-memory)
let commissions = [];
app.get('/api/commissions', (req, res) => {
  res.json(commissions);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 KS1 Empower Pay running on port ${port}`);
});
