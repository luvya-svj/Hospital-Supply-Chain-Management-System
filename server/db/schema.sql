-- Hospital Supply Chain Management System (HSCMS) Database Schema
-- All 10 tables defined in Section 4 of PROJECT_BRIEF.md

-- Drop existing tables in reverse dependency order
DROP TABLE IF EXISTS alert CASCADE;
DROP TABLE IF EXISTS supply_request CASCADE;
DROP TABLE IF EXISTS disposal_record CASCADE;
DROP TABLE IF EXISTS purchase_order_item CASCADE;
DROP TABLE IF EXISTS purchase_order CASCADE;
DROP TABLE IF EXISTS medical_supply CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS supplier CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS system_setting CASCADE;

-- 1. System Settings
CREATE TABLE system_setting (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL
);

-- 2. Inventory (Main Hospital Store)
CREATE TABLE inventory (
    inventory_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    min_stock_level INTEGER DEFAULT 20 NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. Supplier / Vendor
CREATE TABLE supplier (
    supplier_id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    contact VARCHAR(100),
    email VARCHAR(255),
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL
);

-- 4. Users (All roles: Hospital Administrator, Inventory Manager, Procurement Officer, Hospital Department Staff, Supplier / Vendor)
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    department VARCHAR(100),
    supplier_id INTEGER REFERENCES supplier(supplier_id) ON DELETE SET NULL,
    contact VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 5. Medical Supply
CREATE TABLE medical_supply (
    supply_id SERIAL PRIMARY KEY,
    inventory_id INTEGER NOT NULL REFERENCES inventory(inventory_id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,
    batch_no VARCHAR(100) NOT NULL,
    quantity INTEGER DEFAULT 0 NOT NULL CHECK (quantity >= 0),
    unit VARCHAR(50) NOT NULL,
    min_stock_level INTEGER DEFAULT 20 NOT NULL CHECK (min_stock_level >= 0),
    near_expiry_days INTEGER DEFAULT NULL,
    expiry_date DATE NOT NULL,
    supplier_id INTEGER REFERENCES supplier(supplier_id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'AVAILABLE' NOT NULL CHECK (status IN ('AVAILABLE', 'EXPIRED', 'DISPOSED')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_supply_name_batch UNIQUE (name, batch_no)
);

-- 6. Purchase Order
CREATE TABLE purchase_order (
    order_id SERIAL PRIMARY KEY,
    supplier_id INTEGER NOT NULL REFERENCES supplier(supplier_id) ON DELETE RESTRICT,
    created_by INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    order_date DATE DEFAULT CURRENT_DATE NOT NULL,
    status VARCHAR(30) DEFAULT 'ORDERED' NOT NULL CHECK (status IN ('ORDERED', 'DISPATCHED', 'RECEIVED', 'CANCELLED')),
    expected_date DATE,
    dispatch_date DATE,
    actual_date DATE,
    notes TEXT
);

-- 7. Purchase Order Item
CREATE TABLE purchase_order_item (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES purchase_order(order_id) ON DELETE CASCADE,
    supply_id INTEGER NOT NULL REFERENCES medical_supply(supply_id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0)
);

-- 8. Disposal Record
CREATE TABLE disposal_record (
    disposal_id SERIAL PRIMARY KEY,
    supply_id INTEGER NOT NULL REFERENCES medical_supply(supply_id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    disposal_date DATE DEFAULT CURRENT_DATE NOT NULL,
    reason TEXT NOT NULL,
    recorded_by INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT
);

-- 9. Supply Request
CREATE TABLE supply_request (
    request_id SERIAL PRIMARY KEY,
    supply_id INTEGER NOT NULL REFERENCES medical_supply(supply_id) ON DELETE RESTRICT,
    requested_by INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    department VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    status VARCHAR(20) DEFAULT 'PENDING' NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    request_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    decided_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    decided_at TIMESTAMP WITH TIME ZONE
);

-- 10. Alert
CREATE TABLE alert (
    alert_id SERIAL PRIMARY KEY,
    type VARCHAR(30) NOT NULL CHECK (type IN ('LOW_STOCK', 'NEAR_EXPIRY', 'EXPIRED', 'DELAYED_DELIVERY')),
    supply_id INTEGER REFERENCES medical_supply(supply_id) ON DELETE SET NULL,
    order_id INTEGER REFERENCES purchase_order(order_id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_resolved BOOLEAN DEFAULT FALSE NOT NULL
);
