const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Could not connect to database', err);
    } else {
        console.log('Connected to database');
    }
});

function initDatabase() {
    db.serialize(() => {
        db.run('DROP TABLE IF EXISTS coupon_usage');
        db.run('DROP TABLE IF EXISTS coupons');
        db.run('DROP TABLE IF EXISTS users');
        db.run('DROP TABLE IF EXISTS products');
        db.run('DROP TABLE IF EXISTS categories');
        db.run('DROP TABLE IF EXISTS orders');

        // Create Categories Table
        db.run(`CREATE TABLE categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT
        )`);

        // Create Coupons Table
        db.run(`CREATE TABLE coupons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE,
            type TEXT DEFAULT 'percent',
            discount_value INTEGER,
            min_order_amount INTEGER DEFAULT 0,
            expired_at DATETIME,
            is_active INTEGER DEFAULT 1,
            max_uses_per_user INTEGER DEFAULT 1
        )`);

        // Create Coupon Usage Table
        db.run(`CREATE TABLE coupon_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            coupon_id INTEGER,
            user_id INTEGER,
            used_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create Users Table
        // Added columns for Phase 2 & 3: login_attempts, locked_until, reset_token, shipping_address, phone
        db.run(`CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT,
            password TEXT,
            role TEXT DEFAULT 'user',
            login_attempts INTEGER DEFAULT 0,
            locked_until DATETIME,
            reset_token TEXT,
            shipping_address TEXT,
            phone TEXT
        )`);

        // Create Products Table
        db.run(`CREATE TABLE products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            price INTEGER,
            description TEXT,
            imageUrl TEXT,
            category_id INTEGER
        )`);

        // Create Orders Table
        db.run(`CREATE TABLE orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            total_amount INTEGER,
            status TEXT DEFAULT 'pending',
            shipping_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Seed Categories
        const insertCategory = db.prepare('INSERT INTO categories (name) VALUES (?)');
        insertCategory.run('Điện thoại');
        insertCategory.run('Laptop');
        insertCategory.run('Phụ kiện');
        insertCategory.finalize();

        // Seed Users
        const insertUser = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
        insertUser.run('Admin User', 'admin@eshop.com', 'Admin123!', 'admin');
        insertUser.run('Test User', 'test@eshop.com', 'Test1234!', 'user');
        insertUser.finalize();

        // Seed Products
        const insertProduct = db.prepare('INSERT INTO products (name, price, description, imageUrl, category_id) VALUES (?, ?, ?, ?, ?)');
        insertProduct.run('iPhone 15 Pro Max', 30000000, 'Điện thoại cao cấp của Apple', 'https://placehold.co/300x300/png?text=iPhone+15', 1);
        insertProduct.run('Samsung Galaxy S24 Ultra', 28000000, 'Màn hình hiển thị xuất sắc, camera siêu zoom', 'https://placehold.co/300x300/png?text=Samsung+S24', 1);
        insertProduct.run('MacBook Pro M3', 45000000, 'Laptop chuyên nghiệp mạnh mẽ', 'https://placehold.co/300x300/png?text=Macbook+Pro', 2);
        insertProduct.run('Tai nghe AirPods Pro 2', 6000000, 'Chống ồn chủ động xuất sắc', 'https://placehold.co/300x300/png?text=AirPods+Pro', 3);
        insertProduct.run('Bàn phím cơ Keychron Q1', 4000000, 'Gõ cực sướng, thiết kế kim loại', 'https://placehold.co/300x300/png?text=Keychron+Q1', 3);
        insertProduct.finalize();

        // Seed Coupons
        const insertCoupon = db.prepare('INSERT INTO coupons (code, type, discount_value, min_order_amount, expired_at, is_active, max_uses_per_user) VALUES (?, ?, ?, ?, ?, ?, ?)');
        insertCoupon.run('SAVE10', 'percent', 10, 300000, '2099-12-31', 1, 1);   // 10% off, min 300k, valid
        insertCoupon.run('BIGBUY', 'fixed', 50000, 500000, '2099-12-31', 1, 1);  // 50k off, min 500k, valid
        insertCoupon.run('VIP100', 'fixed', 100000, 300000, '2099-12-31', 1, 2); // 100k off, min 300k, max 2 uses
        insertCoupon.run('EXPIRED', 'percent', 20, 100000, '2020-01-01', 1, 1);  // 20% off, EXPIRED
        insertCoupon.finalize();

        console.log('Database initialized and seeded (Phase 2).');
    });
}

initDatabase();

module.exports = db;
