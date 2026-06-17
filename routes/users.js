const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { auth, superadminOnly } = require('../middleware/auth');

// GET /api/users — superadmin sees all, user sees self
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role === 'superadmin') {
      const { rows } = await pool.query(
        `SELECT id, name, email, role, phone, address, company, is_active, created_at FROM users ORDER BY created_at DESC`
      );
      return res.json(rows);
    }
    const { rows } = await pool.query(
      `SELECT id, name, email, role, phone, address, company FROM users WHERE id=$1`, [req.user.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/users — superadmin creates user
router.post('/', auth, superadminOnly, async (req, res) => {
  const { name, email, password, phone, address, company, role = 'user' } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password, phone, address, company, role)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, name, email, role, phone, address, company, is_active, created_at`,
      [name, email, hash, phone, address, company, role]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id
router.put('/:id', auth, async (req, res) => {
  if (req.user.role !== 'superadmin' && req.user.id !== req.params.id)
    return res.status(403).json({ error: 'Forbidden' });

  const { name, phone, address, company, is_active } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE users SET name=$1, phone=$2, address=$3, company=$4, is_active=$5, updated_at=NOW()
       WHERE id=$6 RETURNING id, name, email, role, phone, address, company, is_active`,
      [name, phone, address, company, is_active, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/users/:id — superadmin only
router.delete('/:id', auth, superadminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/users/:id/password
router.patch('/:id/password', auth, superadminOnly, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password=$1, updated_at=NOW() WHERE id=$2', [hash, req.params.id]);
    res.json({ message: 'Password updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
