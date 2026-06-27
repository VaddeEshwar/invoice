const router = require('express').Router();
const pool = require('../db/pool');
const { auth, superadminOnly } = require('../middleware/auth');
const { sendInvoiceEmail } = require('./mailer');

// Auto-generate invoice number
async function nextInvoiceNumber() {
  const { rows } = await pool.query(`SELECT COUNT(*) FROM invoices`);
  const n = parseInt(rows[0].count) + 1;
  return `INV-${new Date().getFullYear()}-${String(n).padStart(5, '0')}`;
}

// GET /api/invoices
router.get('/', auth, async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'superadmin') {
      query = `
        SELECT i.*, u.name AS user_name, u.email AS user_email,
               c.name AS created_by_name
        FROM invoices i
        JOIN users u ON i.user_id = u.id
        JOIN users c ON i.created_by = c.id
        ORDER BY i.created_at DESC`;
      params = [];
    } else {
      query = `
        SELECT i.*, u.name AS user_name, u.email AS user_email,
               c.name AS created_by_name
        FROM invoices i
        JOIN users u ON i.user_id = u.id
        JOIN users c ON i.created_by = c.id
        WHERE i.user_id = $1
        ORDER BY i.created_at DESC`;
      params = [req.user.id];
    }
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/invoices/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
              u.address AS user_address, u.company AS user_company,
              c.name AS created_by_name
       FROM invoices i
       JOIN users u ON i.user_id = u.id
       JOIN users c ON i.created_by = c.id
       WHERE i.id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Invoice not found' });
    const inv = rows[0];
    if (req.user.role !== 'superadmin' && inv.user_id !== req.user.id)
      return res.status(403).json({ error: 'Forbidden' });

    const items = await pool.query('SELECT * FROM invoice_items WHERE invoice_id=$1 ORDER BY created_at', [req.params.id]);
    inv.items = items.rows;
    res.json(inv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/invoices — superadmin creates
router.post('/', auth, superadminOnly, async (req, res) => {
  const { user_id, title, description, due_date, items = [], tax_rate = 18, discount = 0, notes, status = 'draft' } = req.body;
  if (!user_id || !title) return res.status(400).json({ error: 'user_id and title required' });
  if (!items.length) return res.status(400).json({ error: 'At least one item required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const invoice_number = await nextInvoiceNumber();
    const subtotal = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
    const tax_amount = ((subtotal - discount) * tax_rate) / 100;
    const total = subtotal - discount + tax_amount;

    const { rows: [inv] } = await client.query(
      `INSERT INTO invoices (invoice_number, user_id, created_by, title, description, due_date, status,
        subtotal, tax_rate, tax_amount, discount, total, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [invoice_number, user_id, req.user.id, title, description, due_date, status,
       subtotal, tax_rate, tax_amount, discount, total, notes]
    );

    for (const item of items) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price) VALUES ($1,$2,$3,$4)`,
        [inv.id, item.description, item.quantity, item.unit_price]
      );
    }
    await client.query('COMMIT');

    const itemsRes = await pool.query('SELECT * FROM invoice_items WHERE invoice_id=$1', [inv.id]);
    inv.items = itemsRes.rows;

    // Auto-send the invoice to the user's registered email.
    // Wrapped separately so a mail failure never breaks invoice creation itself.
    try {
      const { rows: [userRow] } = await pool.query('SELECT name, email FROM users WHERE id=$1', [inv.user_id]);
      if (userRow) {
        await sendInvoiceEmail(inv, userRow);
        inv.email_sent = true;
      }
    } catch (mailErr) {
      console.error(`Failed to email invoice ${inv.invoice_number}:`, mailErr.message);
      inv.email_sent = false;
      inv.email_error = mailErr.message;
    }

    res.status(201).json(inv);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// PUT /api/invoices/:id — superadmin updates
router.put('/:id', auth, superadminOnly, async (req, res) => {
  const { user_id, title, description, due_date, items = [], tax_rate = 18, discount = 0, notes, status } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const subtotal = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
    const tax_amount = ((subtotal - discount) * tax_rate) / 100;
    const total = subtotal - discount + tax_amount;

    const { rows } = await client.query(
      `UPDATE invoices SET user_id=$1, title=$2, description=$3, due_date=$4, status=$5,
        subtotal=$6, tax_rate=$7, tax_amount=$8, discount=$9, total=$10, notes=$11, updated_at=NOW()
       WHERE id=$12 RETURNING *`,
      [user_id, title, description, due_date, status, subtotal, tax_rate, tax_amount, discount, total, notes, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Invoice not found' });

    await client.query('DELETE FROM invoice_items WHERE invoice_id=$1', [req.params.id]);
    for (const item of items) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price) VALUES ($1,$2,$3,$4)`,
        [req.params.id, item.description, item.quantity, item.unit_price]
      );
    }
    await client.query('COMMIT');
    const itemsRes = await pool.query('SELECT * FROM invoice_items WHERE invoice_id=$1', [req.params.id]);
    rows[0].items = itemsRes.rows;
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// PATCH /api/invoices/:id/status
router.patch('/:id/status', auth, superadminOnly, async (req, res) => {
  const { status } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE invoices SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`, [status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/invoices/:id
router.delete('/:id', auth, superadminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM invoices WHERE id=$1', [req.params.id]);
    res.json({ message: 'Invoice deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/invoices/stats/summary — superadmin dashboard
router.get('/stats/summary', auth, superadminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) AS total_invoices,
        SUM(total) AS total_amount,
        SUM(CASE WHEN status='paid' THEN total ELSE 0 END) AS paid_amount,
        SUM(CASE WHEN status='overdue' THEN total ELSE 0 END) AS overdue_amount,
        SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) AS draft_count,
        SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) AS sent_count,
        SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) AS paid_count,
        SUM(CASE WHEN status='overdue' THEN 1 ELSE 0 END) AS overdue_count
      FROM invoices
    `);
    const users = await pool.query(`SELECT COUNT(*) AS total_users FROM users WHERE role='user'`);
    res.json({ ...rows[0], ...users.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;