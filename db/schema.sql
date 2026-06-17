-- ============================================
-- BILLING APP DATABASE SCHEMA
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('superadmin', 'user')),
  phone VARCHAR(20),
  address TEXT,
  company VARCHAR(150),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- INVOICES TABLE
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  issue_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  subtotal NUMERIC(12,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 18.00,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  discount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- INVOICE ITEMS TABLE
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description VARCHAR(300) NOT NULL,
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMP DEFAULT NOW()
);

-- SEED: Default SuperAdmin
INSERT INTO users (name, email, password, role)
VALUES (
  'Super Admin',
  'admin@billing.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: password
  'superadmin'
) ON CONFLICT (email) DO NOTHING;
