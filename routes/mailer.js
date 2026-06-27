// const nodemailer = require('nodemailer');

// const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST,
//   port: parseInt(process.env.SMTP_PORT || '587', 10),
//   secure: process.env.SMTP_PORT === '465', // true for port 465, false for 587/others
//   auth: {
//     user: process.env.SMTP_USER,
//     pass: process.env.SMTP_PASS
//   }
// });

// const fmt = (n) => '₹' + parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// /**
//  * Sends a "new invoice" email to a user's registered email address.
//  * @param {object} invoice - the invoice row (with .items array attached)
//  * @param {object} user - { name, email } of the invoice's owner
//  */
// async function sendInvoiceEmail(invoice, user) {
//   if (!user?.email) throw new Error('User has no registered email address');

//   const itemsHtml = (invoice.items || []).map(it => `
//     <tr>
//       <td style="padding:8px 12px;border-bottom:1px solid #eee;">${it.description}</td>
//       <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${it.quantity}</td>
//       <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${fmt(it.unit_price)}</td>
//     </tr>`).join('');

//   const html = `
//     <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1F2937;">
//       <h2 style="color:#4F46E5;margin-bottom:4px;">New Invoice: ${invoice.invoice_number}</h2>
//       <p>Hi ${user.name},</p>
//       <p>A new invoice has been generated for you. Here are the details:</p>
//       <table style="width:100%;border-collapse:collapse;margin-top:12px;">
//         <thead>
//           <tr style="background:#F9FAFB;">
//             <th style="padding:8px 12px;text-align:left;">Description</th>
//             <th style="padding:8px 12px;text-align:right;">Qty</th>
//             <th style="padding:8px 12px;text-align:right;">Unit Price</th>
//           </tr>
//         </thead>
//         <tbody>${itemsHtml}</tbody>
//       </table>
//       <div style="margin-top:16px;text-align:right;">
//         <p style="margin:2px 0;">Subtotal: ${fmt(invoice.subtotal)}</p>
//         ${invoice.discount > 0 ? `<p style="margin:2px 0;">Discount: -${fmt(invoice.discount)}</p>` : ''}
//         <p style="margin:2px 0;">Tax (${invoice.tax_rate}%): ${fmt(invoice.tax_amount)}</p>
//         <p style="font-size:18px;font-weight:bold;color:#4F46E5;margin-top:8px;">Total: ${fmt(invoice.total)}</p>
//       </div>
//       <p style="margin-top:16px;">Due Date: <strong>${fmtDate(invoice.due_date)}</strong></p>
//       <p style="margin-top:24px;color:#6B7280;font-size:13px;">This is an automated email from BillFlow. Please do not reply directly to this message.</p>
//     </div>`;

//   await transporter.sendMail({
//     from: process.env.FROM_EMAIL || process.env.SMTP_USER,
//     to: user.email,
//     subject: `New Invoice ${invoice.invoice_number} — ${fmt(invoice.total)} due ${fmtDate(invoice.due_date)}`,
//     html
//   });
// }

// // module.exports = router;