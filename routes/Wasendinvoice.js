// ─────────────────────────────────────────────────────────────────────────────
// FRONTEND PATCH — replace your existing sendWhatsApp() function with this.
// Also adds sendWhatsAppInvoicePDF() for sending the invoice as a PDF.
// ─────────────────────────────────────────────────────────────────────────────

// ── Builds the full printable HTML page for an invoice ───────────────────────
function buildInvoicePrintPage(inv) {
  // Reuse your existing buildInvoiceHTML() for the body content
  const body = buildInvoiceHTML(inv);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"/>
    <style>
      *{box-sizing:border-box;margin:0;padding:0;}
      body{font-family:'Inter',sans-serif;padding:32px;max-width:820px;margin:0 auto;color:#1F2937;font-size:14px;}
      :root{--primary:#4F46E5;--success:#10B981;--warning:#F59E0B;--danger:#EF4444;--info:#3B82F6;
            --gray-50:#F9FAFB;--gray-100:#F3F4F6;--gray-400:#9CA3AF;--gray-500:#6B7280;--gray-900:#111827;}
      .inv-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;}
      .inv-title{font-size:32px;font-weight:800;color:#4F46E5;}
      .inv-number{font-size:13px;color:#6B7280;margin-top:4px;}
      .inv-company{font-size:20px;font-weight:700;}
      .inv-section{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px;}
      .inv-block small{font-size:11px;color:#9CA3AF;text-transform:uppercase;font-weight:600;letter-spacing:.5px;display:block;margin-bottom:4px;}
      .inv-block p{font-size:14px;line-height:1.7;}
      .inv-totals{margin-top:16px;margin-left:auto;width:280px;}
      .inv-totals table{width:100%;border-collapse:collapse;}
      .inv-totals td{padding:6px 10px;font-size:14px;}
      .inv-totals .grand{font-weight:700;font-size:16px;border-top:2px solid #111827;}
      .badge{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;background:#EFF6FF;color:#3B82F6;}
      .badge-paid{background:#ECFDF5;color:#10B981;}
      .badge-overdue{background:#FEF2F2;color:#EF4444;}
      .badge-draft{background:#F3F4F6;color:#4B5563;}
      .badge-sent{background:#EFF6FF;color:#3B82F6;}
      .badge-cancelled{background:#F3F4F6;color:#9CA3AF;}
      table{width:100%;border-collapse:collapse;}
    </style>
  </head><body>${body}</body></html>`;
}

// ── Send plain text WhatsApp message ─────────────────────────────────────────
async function sendWhatsApp(phone, message) {
  if (!phone) throw new Error('No phone number available for this user.');
  let cleanPhone = String(phone).replace(/[\s\-+()]/g, '');
  if (/^[6-9]\d{9}$/.test(cleanPhone)) cleanPhone = '91' + cleanPhone;

  const res = await fetch('/api/whatsapp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: cleanPhone, msg: message }),
  });

  let data;
  try { data = await res.json(); } catch { data = { status: res.ok ? 'success' : 'error', error: 'Unexpected server response' }; }
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
  if (String(data.status).toLowerCase() === 'error') throw new Error(data.error || 'CloudWhatsApp rejected the request');
  return data;
}

// ── Send invoice as PDF via WhatsApp ─────────────────────────────────────────
async function sendWhatsAppInvoicePDF(inv) {
  if (!inv.user_phone) throw new Error('No phone number for this user.');

  let cleanPhone = String(inv.user_phone).replace(/[\s\-+()]/g, '');
  if (/^[6-9]\d{9}$/.test(cleanPhone)) cleanPhone = '91' + cleanPhone;

  const invoiceHTML   = buildInvoicePrintPage(inv);
  const invoiceNumber = inv.invoice_number || 'Invoice';
  const caption       = buildWAMessage(inv); // your existing template message

  const res = await fetch('/api/whatsapp/send-invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: cleanPhone, invoiceHTML, invoiceNumber, caption }),
  });

  let data;
  try { data = await res.json(); } catch { data = { status: res.ok ? 'success' : 'error', error: 'Unexpected server response' }; }
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
  if (String(data.status).toLowerCase() === 'error') throw new Error(data.error || 'Send failed');
  return data;
}

// ── Updated sendWAFromView() — sends PDF instead of plain text ────────────────
// Replace your existing sendWAFromView() with this:
async function sendWAFromView() {
  if (!currentViewInvoice) return;
  const inv = currentViewInvoice;
  const cfg = getWAConfig();
  if (!cfg.apiKey) { showWAToast('API key not set — go to WA Settings', false); return; }
  if (!inv.user_phone) { showWAToast('No phone number on this user', false); return; }

  showWAToast('Generating PDF & sending WhatsApp…', true);
  try {
    const result = await sendWhatsAppInvoicePDF(inv);
    showWAToast(`✓ Invoice PDF sent (${result.sizeMB} MB)`, true);
  } catch(e) {
    // Fallback to plain text if PDF fails
    console.warn('[WA] PDF send failed, falling back to text:', e.message);
    try {
      await sendWhatsApp(inv.user_phone, buildWAMessage(inv));
      showWAToast(`✓ Sent as text (PDF failed: ${e.message})`, true);
    } catch(e2) {
      showWAToast('WA failed: ' + e2.message, false);
    }
  }
}

// ── Updated quickSendWA() ─────────────────────────────────────────────────────
// Replace your existing quickSendWA() with this:
async function quickSendWA(invId) {
  const cfg = getWAConfig();
  if (!cfg.apiKey) { showWAToast('Configure API key in WA Settings first', false); return; }
  try {
    const inv = await apiFetch(`/api/invoices/${invId}`);
    if (!inv.user_phone) { showWAToast('No phone number for this user', false); return; }
    showWAToast('Generating PDF & sending…', true);
    const result = await sendWhatsAppInvoicePDF(inv);
    showWAToast(`✓ Invoice PDF sent (${result.sizeMB} MB)`, true);
  } catch(e) {
    showWAToast('Failed: ' + e.message, false);
  }
}

// ── Updated saveInvoice() WA section ─────────────────────────────────────────
// Inside saveInvoice(), replace the "SEND WHATSAPP AFTER SAVE" block with:
/*
    if (sendWA) {
      const cfg = getWAConfig();
      if (!cfg.apiKey) {
        showWAToast('Invoice saved. WA not sent — no API key configured.', false);
      } else {
        try {
          const invId  = savedInv?.id || id;
          const fullInv = await apiFetch(`/api/invoices/${invId}`);
          if (!fullInv.user_phone) {
            showWAToast('Invoice saved. No phone number — WA skipped.', false);
          } else {
            showWAToast('Invoice saved. Generating PDF & sending WhatsApp…', true);
            const result = await sendWhatsAppInvoicePDF(fullInv);
            showWAToast(`✓ Invoice saved & PDF sent (${result.sizeMB} MB)`, true);
          }
        } catch(waErr) {
          showWAToast('Invoice saved. WA failed: ' + waErr.message, false);
        }
      }
    } else {
      showWAToast('Invoice saved (WhatsApp skipped).', true);
    }
*/