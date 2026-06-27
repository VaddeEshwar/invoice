require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // higher limit for invoiceHTML in body
app.use(express.static(path.join(__dirname, 'public')));

// Serve temp PDFs generated for WhatsApp sending
app.use('/tmp_invoices', express.static(path.join(__dirname, 'tmp_invoices')));

// API Routes
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/users',     require('./routes/users'));
app.use('/api/invoices',  require('./routes/invoices'));
app.use('/api/whatsapp',  require('./routes/whatsappRouter')); // handles /send AND /send-invoice

// SPA fallback
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Billing App running at http://localhost:${PORT}`);
  console.log(`📧 Login: admin@billing.com | 🔑 Password: password`);
});