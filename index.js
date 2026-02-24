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
          background: radial-gradient(circle, rgba(212, 175, 55, 0.08) 0%, transparent 70%); /* 🔸 Reduced glow */
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
        <button class="btn-view-all" onclick="viewAllBusinesses()">View All Businesses</button>

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
