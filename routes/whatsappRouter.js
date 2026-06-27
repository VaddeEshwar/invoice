// whatsappRouter.js
const express = require('express');
const axios   = require('axios');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const router  = express.Router();

const WA_API_KEY = process.env.WA_API_KEY || 'c342ec789f7d441e8da6161264e76b5b';
const WA_API_URL = process.env.WA_API_URL || 'https://web.cloudwhatsapp.com/wapp/api/send';
const WA_SENDER  = process.env.WA_SENDER  || '';
const PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:3000';

const TMP_DIR = path.join(__dirname, '..', 'tmp_invoices');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// ── Sanitise phone ────────────────────────────────────────────────────────────
// web.cloudwhatsapp.com works WITHOUT country code (e.g. 8500424039)
// Strip +, spaces, dashes, brackets — but keep the number as-is otherwise
function sanitisePhone(phone) {
  let p = String(phone).replace(/[\s\-+()]/g, '').trim();
  // If user stored it with country code (e.g. 918500424039), strip leading 91
  // only if the result is a valid 10-digit Indian number
  if (/^91[6-9]\d{9}$/.test(p)) p = p.slice(2);
  return p;
}

// ── Core API caller ───────────────────────────────────────────────────────────
async function callWA(params) {
  const queryParams = { apikey: WA_API_KEY, ...params };
  if (WA_SENDER && !queryParams.sender) queryParams.sender = WA_SENDER;

  console.log('[WhatsApp] Calling:', WA_API_URL, {
    ...queryParams,
    apikey: queryParams.apikey.slice(0, 8) + '…',
    msg: String(queryParams.msg || '').slice(0, 50) + '…',
  });

  const resp = await axios({
    method: 'GET',
    url: WA_API_URL,
    params: queryParams,
    timeout: 20000,
    responseType: 'text',
    validateStatus: () => true,
  });

  let parsed;
  try { parsed = typeof resp.data === 'object' ? resp.data : JSON.parse(resp.data); }
  catch (_) {
    const s = String(resp.data || '').trim().toLowerCase();
    parsed = (s === 'success' || s.includes('sent')) ? { status: 'success' } : { status: 'unknown', message: resp.data };
  }

  console.log(`[WhatsApp] HTTP ${resp.status}:`, JSON.stringify(parsed).slice(0, 300));

  const apiStatus = String(parsed.status || '').toLowerCase();
  if (apiStatus === 'error') {
    const raw = parsed.errormsg || parsed.message || parsed.error || 'CloudWhatsApp error';
    let friendly = raw;
    if (/insuff|balance|credit/i.test(raw))
      friendly = 'Insufficient balance — please recharge at web.cloudwhatsapp.com';
    else if (/sender|device|not connected/i.test(raw))
      friendly = 'Sender number not connected — check your device in CloudWhatsApp dashboard';
    else if (/invalid.*key|apikey|auth/i.test(raw))
      friendly = 'Invalid API key — update WA_API_KEY in .env';
    throw Object.assign(new Error(friendly), { wa_response: parsed });
  }
  if (resp.status >= 400) throw new Error(`CloudWhatsApp HTTP ${resp.status}`);
  return parsed;
}

// ── Serve temp PDFs ───────────────────────────────────────────────────────────
router.get('/invoice-pdf/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(TMP_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found or expired' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.sendFile(filePath);
});

// ── POST /api/whatsapp/send — plain text ─────────────────────────────────────
router.post('/send', async (req, res) => {
  let { mobile, msg } = req.body;
  if (!mobile || !msg) return res.status(400).json({ error: 'mobile and msg are required' });

  mobile = sanitisePhone(mobile);
  console.log(`[WhatsApp] Sending text to ${mobile}`);

  try {
    const result = await callWA({ mobile, msg });
    return res.json({ status: 'success', message: 'WhatsApp sent', wa_response: result });
  } catch (e) {
    return res.status(502).json({ error: e.message, wa_response: e.wa_response });
  }
});

// ── POST /api/whatsapp/send-invoice — PDF attachment ─────────────────────────
router.post('/send-invoice', async (req, res) => {
  let { mobile, invoiceHTML, invoiceNumber, caption } = req.body;
  if (!mobile || !invoiceHTML) return res.status(400).json({ error: 'mobile and invoiceHTML are required' });

  mobile = sanitisePhone(mobile);

  const safeNum  = String(invoiceNumber || 'invoice').replace(/[^a-zA-Z0-9\-_]/g, '_');
  const uid      = crypto.randomBytes(6).toString('hex');
  const filename = `${safeNum}_${uid}.pdf`;
  const pdfPath  = path.join(TMP_DIR, filename);

  // Generate PDF with Puppeteer
  let puppeteer;
  try { try { puppeteer = require('puppeteer'); } catch { puppeteer = require('puppeteer-core'); } }
  catch (e) { return res.status(500).json({ error: 'puppeteer not installed. Run: npm install puppeteer' }); }

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setContent(invoiceHTML, { waitUntil: 'networkidle0' });
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true,
      margin: { top: '15mm', right: '12mm', bottom: '15mm', left: '12mm' } });
    await browser.close();
  } catch (e) {
    return res.status(500).json({ error: 'PDF generation failed: ' + e.message });
  }

  const sizeMB = (fs.statSync(pdfPath).size / 1024 / 1024).toFixed(2);
  console.log(`[WhatsApp] PDF: ${filename} (${sizeMB} MB)`);

  if (parseFloat(sizeMB) > 1) {
    fs.unlinkSync(pdfPath);
    return res.status(413).json({ error: `PDF is ${sizeMB} MB — exceeds 1 MB limit.` });
  }

  const mediaUrl   = `${PUBLIC_URL}/api/whatsapp/invoice-pdf/${filename}`;
  const msgCaption = caption || `Please find your invoice ${invoiceNumber} attached.`;

  try {
    const result = await callWA({ mobile, msg: msgCaption, type: 'media', media_url: mediaUrl, filename: `${safeNum}.pdf` });
    setTimeout(() => { try { fs.unlinkSync(pdfPath); } catch (_) {} }, 120_000);
    return res.json({ status: 'success', message: 'Invoice PDF sent', sizeMB, wa_response: result });
  } catch (e) {
    try { fs.unlinkSync(pdfPath); } catch (_) {}
    return res.status(502).json({ error: e.message, wa_response: e.wa_response });
  }
});

module.exports = router;