const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database.js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const SECRET_KEY = "supersecretkey"; // In production, use environment variable

const app = express();
const HTTP_PORT = 3000;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Admin Middleware - Verify user is admin
function requireAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(500).json({ error: "Failed to authenticate token" });
        }

        if (!decoded.is_admin) {
            return res.status(403).json({ error: "Access denied. Admin privileges required." });
        }

        req.user = decoded;
        next();
    });
}

// --- Auth Endpoints ---

// Register
app.post("/api/register", (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ error: "Missing fields" });
    }

    const saltRounds = 10;
    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) return res.status(500).json({ error: "Error hashing password" });

        const sql = "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
        const params = [username, email, hash];
        db.run(sql, params, function (err, result) {
            if (err) {
                return res.status(400).json({ error: err.message });
            }
            res.json({
                message: "success",
                data: { id: this.lastID, username, email }
            });
        });
    });
});

// Login
app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    const sql = "SELECT * FROM users WHERE email = ?";
    db.get(sql, [email], (err, user) => {
        if (err) return res.status(400).json({ error: err.message });
        if (!user) return res.status(400).json({ error: "User not found" });

        bcrypt.compare(password, user.password, (err, result) => {
            if (result) {
                // Passwords match - include is_admin in JWT
                const token = jwt.sign({
                    id: user.id,
                    username: user.username,
                    is_admin: user.is_admin || 0
                }, SECRET_KEY, { expiresIn: '1h' });
                res.json({
                    message: "success",
                    token: token,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        is_admin: user.is_admin || 0
                    }
                });
            } else {
                res.status(401).json({ error: "Invalid password" });
            }
        });
    });
});

// Forgot Password
app.post("/api/forgot-password", (req, res) => {
    const { email } = req.body;
    const sql = "SELECT * FROM users WHERE email = ?";
    db.get(sql, [email], (err, user) => {
        if (err) return res.status(400).json({ error: err.message });
        if (!user) return res.status(404).json({ error: "User not found" });

        // Generate a random token
        const token = require('crypto').randomBytes(20).toString('hex');
        const expires = Date.now() + 3600000; // 1 hour

        const updateSql = "UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?";
        db.run(updateSql, [token, expires, email], function (err) {
            if (err) return res.status(400).json({ error: err.message });

            // SIMULATE EMAIL SENDING
            console.log(`[EMAIL SIMULATION] Password reset token for ${email}: ${token}`);

            res.json({ message: "Password reset link sent (check console)", token: token });
        });
    });
});

// Reset Password
app.post("/api/reset-password", (req, res) => {
    const { token, newPassword } = req.body;
    const sql = "SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > ?";
    db.get(sql, [token, Date.now()], (err, user) => {
        if (err) return res.status(400).json({ error: err.message });
        if (!user) return res.status(400).json({ error: "Invalid or expired token" });

        bcrypt.hash(newPassword, 10, (err, hash) => {
            if (err) return res.status(500).json({ error: "Error hashing password" });

            const updateSql = "UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?";
            db.run(updateSql, [hash, user.id], function (err) {
                if (err) return res.status(400).json({ error: err.message });
                res.json({ message: "Password updated successfully" });
            });
        });
    });
});

// GET all products
app.get("/api/products", (req, res) => {
    const sql = "SELECT * FROM products";
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": rows
        });
    });
});

// GET single product
app.get("/api/products/:id", (req, res) => {
    const sql = "SELECT * FROM products WHERE id = ?";
    const params = [req.params.id];
    db.get(sql, params, (err, row) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": row
        });
    });
});

// POST new product
app.post("/api/products", (req, res) => {
    const errors = [];
    if (!req.body.name) errors.push("No name specified");
    if (!req.body.price) errors.push("No price specified");
    if (!req.body.category) errors.push("No category specified");
    if (errors.length) {
        res.status(400).json({ "error": errors.join(",") });
        return;
    }
    const data = {
        name: req.body.name,
        price: req.body.price,
        category: req.body.category,
        image: req.body.image,
        description: req.body.description,
        specs: req.body.specs,
        stock_quantity: req.body.stock_quantity || 100
    };
    const sql = 'INSERT INTO products (name, price, category, image, description, specs, stock_quantity) VALUES (?,?,?,?,?,?,?)';
    const params = [data.name, data.price, data.category, data.image, data.description, data.specs, data.stock_quantity];
    db.run(sql, params, function (err, result) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": data,
            "id": this.lastID
        });
    });
});

// PUT update product
app.put("/api/products/:id", (req, res) => {
    const data = {
        name: req.body.name,
        price: req.body.price,
        category: req.body.category,
        image: req.body.image,
        description: req.body.description,
        specs: req.body.specs,
        stock_quantity: req.body.stock_quantity
    };
    db.run(
        `UPDATE products set 
           name = COALESCE(?,name), 
           price = COALESCE(?,price), 
           category = COALESCE(?,category), 
           image = COALESCE(?,image), 
           description = COALESCE(?,description), 
           specs = COALESCE(?,specs),
           stock_quantity = COALESCE(?,stock_quantity) 
           WHERE id = ?`,
        [data.name, data.price, data.category, data.image, data.description, data.specs, data.stock_quantity, req.params.id],
        function (err, result) {
            if (err) {
                res.status(400).json({ "error": res.message });
                return;
            }
            res.json({
                "message": "success",
                "data": data,
                "changes": this.changes
            });
        });
});

// DELETE product
app.delete("/api/products/:id", (req, res) => {
    db.run(
        'DELETE FROM products WHERE id = ?',
        req.params.id,
        function (err, result) {
            if (err) {
                res.status(400).json({ "error": res.message });
                return;
            }
            res.json({ "message": "deleted", changes: this.changes });
        });
});
// --- User Profile Endpoints ---

app.get("/api/profile", (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: "No token provided" });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Malformed token" });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(500).json({ error: "Failed to authenticate token" });

        db.get("SELECT id, username, email, full_name, phone, address FROM users WHERE id = ?", [decoded.id], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: "User not found" });
            res.json({ message: "success", data: row });
        });
    });
});

app.put("/api/profile", (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: "No token provided" });

    const token = authHeader.split(' ')[1];
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(500).json({ error: "Failed to authenticate token" });

        const { full_name, phone, address } = req.body;
        const sql = "UPDATE users SET full_name = ?, phone = ?, address = ? WHERE id = ?";
        db.run(sql, [full_name, phone, address, decoded.id], function (err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ message: "Profile updated successfully" });
        });
    });
});

// --- Cart Endpoints ---

app.get("/api/cart", (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: "No token provided" });
    const token = authHeader.split(' ')[1];

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(500).json({ error: "Failed to authenticate" });

        // Join with products table to get details
        const sql = `
            SELECT cart.id, cart.product_id, cart.quantity, products.name, products.price, products.image
            FROM cart
            JOIN products ON cart.product_id = products.id
            WHERE cart.user_id = ?
        `;
        db.all(sql, [decoded.id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });

            // Format to match frontend structure check
            // Frontend expects product objects. 
            // We should map this to an array of product-like objects
            const cartItems = rows.map(row => ({
                id: row.product_id, // Use product_id as the main ID for frontend logic
                cart_item_id: row.id,
                name: row.name,
                price: row.price,
                image: row.image,
                quantity: row.quantity
            }));

            res.json({ message: "success", cart: cartItems });
        });
    });
});

app.post("/api/cart", (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: "No token provided" });
    const token = authHeader.split(' ')[1];

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(500).json({ error: "Failed to authenticate" });

        const { product_id, quantity } = req.body;
        // Check if item exists
        db.get("SELECT * FROM cart WHERE user_id = ? AND product_id = ?", [decoded.id, product_id], (err, row) => {
            if (row) {
                // Update quantity instead of ignoring
                db.run("UPDATE cart SET quantity = ? WHERE user_id = ? AND product_id = ?",
                    [quantity, decoded.id, product_id],
                    (err) => {
                        if (err) return res.status(400).json({ error: err.message });
                        res.json({ message: "Cart updated" });
                    });
            } else {
                db.run("INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)", [decoded.id, product_id, quantity || 1], function (err) {
                    if (err) return res.status(400).json({ error: err.message });
                    res.json({ message: "Item added to cart", id: this.lastID });
                });
            }
        });
    });
});

app.delete("/api/cart/:productId", (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: "No token provided" });
    const token = authHeader.split(' ')[1];
    const productId = req.params.productId;

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(500).json({ error: "Failed to authenticate" });

        db.run("DELETE FROM cart WHERE user_id = ? AND product_id = ?", [decoded.id, productId], function (err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ message: "Item removed from cart" });
        });
    });
});

// --- Checkout & Orders Endpoints ---

app.post("/api/checkout", (req, res) => {
    console.log('Checkout request received');
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        console.log('No authorization header');
        return res.status(401).json({ error: "No token provided" });
    }
    const token = authHeader.split(' ')[1];

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            console.log('JWT verification failed:', err);
            return res.status(500).json({ error: "Failed to authenticate" });
        }

        console.log('User authenticated:', decoded.id);
        const { shipping_address, payment_method } = req.body;
        console.log('Shipping address:', shipping_address);
        console.log('Payment method:', payment_method);

        // Validate payment (simulated - just check format)
        if (!payment_method || !payment_method.card_number || !payment_method.expiry || !payment_method.cvv) {
            console.log('Invalid payment details');
            return res.status(400).json({ error: "Invalid payment details" });
        }

        // Get cart items with stock information
        const cartSql = `
            SELECT cart.id, cart.product_id, cart.quantity, products.price, products.stock_quantity, products.name
            FROM cart
            JOIN products ON cart.product_id = products.id
            WHERE cart.user_id = ?
        `;

        db.all(cartSql, [decoded.id], (err, cartItems) => {
            if (err) {
                console.error('Error fetching cart:', err);
                return res.status(500).json({ error: err.message });
            }
            console.log('Cart items:', cartItems);
            if (!cartItems || cartItems.length === 0) {
                console.log('Cart is empty');
                return res.status(400).json({ error: "Cart is empty" });
            }

            // Validate stock availability for all items
            const insufficientStock = [];
            for (const item of cartItems) {
                if (item.stock_quantity < item.quantity) {
                    insufficientStock.push({
                        name: item.name,
                        requested: item.quantity,
                        available: item.stock_quantity
                    });
                }
            }

            if (insufficientStock.length > 0) {
                console.log('Insufficient stock:', insufficientStock);
                return res.status(400).json({
                    error: "Insufficient stock",
                    details: insufficientStock
                });
            }

            // Calculate total
            const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            console.log('Order total:', total);

            // Create order
            const orderSql = "INSERT INTO orders (user_id, total, status, shipping_address, created_at) VALUES (?, ?, ?, ?, ?)";
            db.run(orderSql, [decoded.id, total, 'pending', shipping_address, Date.now()], function (err) {
                if (err) {
                    console.error('Error creating order:', err);
                    return res.status(400).json({ error: err.message });
                }

                const orderId = this.lastID;
                console.log('Order created with ID:', orderId);

                // Insert order items and decrease stock
                const orderItemSql = "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)";
                const updateStockSql = "UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?";
                let itemsProcessed = 0;

                cartItems.forEach(item => {
                    // Insert order item
                    db.run(orderItemSql, [orderId, item.product_id, item.quantity, item.price], (err) => {
                        if (err) {
                            console.error("Error inserting order item:", err);
                            return;
                        }

                        // Decrease stock
                        db.run(updateStockSql, [item.quantity, item.product_id], (err) => {
                            if (err) {
                                console.error("Error updating stock:", err);
                            } else {
                                console.log(`Stock decreased for product ${item.product_id}: -${item.quantity}`);
                            }

                            itemsProcessed++;

                            if (itemsProcessed === cartItems.length) {
                                // Clear cart
                                db.run("DELETE FROM cart WHERE user_id = ?", [decoded.id], (err) => {
                                    if (err) console.error("Error clearing cart:", err);
                                    console.log('Order placed successfully');
                                    res.json({
                                        message: "Order placed successfully",
                                        order_id: orderId,
                                        total: total
                                    });
                                });
                            }
                        });
                    });
                });
            });
        });
    });
});

app.get("/api/orders", (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: "No token provided" });
    const token = authHeader.split(' ')[1];

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(500).json({ error: "Failed to authenticate" });

        const sql = "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC";
        db.all(sql, [decoded.id], (err, orders) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "success", orders: orders });
        });
    });
});

app.get("/api/orders/:id", (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: "No token provided" });
    const token = authHeader.split(' ')[1];

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(500).json({ error: "Failed to authenticate" });

        const orderId = req.params.id;

        // Get order details
        db.get("SELECT * FROM orders WHERE id = ? AND user_id = ?", [orderId, decoded.id], (err, order) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!order) return res.status(404).json({ error: "Order not found" });

            // Get order items
            const itemsSql = `
                SELECT order_items.*, products.name, products.image
                FROM order_items
                JOIN products ON order_items.product_id = products.id
                WHERE order_items.order_id = ?
            `;

            db.all(itemsSql, [orderId], (err, items) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: "success", order: order, items: items });
            });
        });
    });
});

// --- Admin Endpoints ---

// Verify Admin Status - Used by admin panel to confirm user has admin privileges
app.get("/api/admin/verify", requireAdmin, (req, res) => {
    // If we reach here, requireAdmin middleware has already verified admin status
    res.json({
        message: "success",
        is_admin: true,
        user: {
            id: req.user.id,
            username: req.user.username
        }
    });
});


// Admin Analytics - Dashboard Statistics
app.get("/api/admin/analytics", requireAdmin, (req, res) => {
    // Get total revenue from DELIVERED orders only
    db.get("SELECT SUM(total) as total_revenue, COUNT(*) as total_orders FROM orders WHERE status = 'delivered'", (err, deliveredRevenue) => {
        if (err) return res.status(500).json({ error: err.message });

        // Get all orders count
        db.get("SELECT COUNT(*) as all_orders FROM orders", (err, allOrders) => {
            if (err) return res.status(500).json({ error: err.message });

            // Get orders by status with revenue breakdown
            db.all(`
                SELECT 
                    status, 
                    COUNT(*) as count,
                    SUM(total) as revenue
                FROM orders 
                GROUP BY status
            `, (err, statusCounts) => {
                if (err) return res.status(500).json({ error: err.message });

                // Get total products
                db.get("SELECT COUNT(*) as total_products FROM products", (err, productCount) => {
                    if (err) return res.status(500).json({ error: err.message });

                    // Get low stock products (< 10)
                    db.get("SELECT COUNT(*) as low_stock_count FROM products WHERE stock_quantity < 10", (err, lowStock) => {
                        if (err) return res.status(500).json({ error: err.message });

                        // Get total customers
                        db.get("SELECT COUNT(*) as total_customers FROM users", (err, customerCount) => {
                            if (err) return res.status(500).json({ error: err.message });

                            // Get revenue by category (only from delivered orders)
                            const categorySql = `
                                SELECT p.category, SUM(oi.price * oi.quantity) as revenue
                                FROM order_items oi
                                JOIN products p ON oi.product_id = p.id
                                JOIN orders o ON oi.order_id = o.id
                                WHERE o.status = 'delivered'
                                GROUP BY p.category
                            `;
                            db.all(categorySql, (err, categoryRevenue) => {
                                if (err) return res.status(500).json({ error: err.message });

                                res.json({
                                    message: "success",
                                    analytics: {
                                        total_revenue: deliveredRevenue.total_revenue || 0,
                                        delivered_orders: deliveredRevenue.total_orders || 0,
                                        total_orders: allOrders.all_orders || 0,
                                        total_products: productCount.total_products || 0,
                                        low_stock_count: lowStock.low_stock_count || 0,
                                        total_customers: customerCount.total_customers || 0,
                                        orders_by_status: statusCounts,
                                        revenue_by_category: categoryRevenue
                                    }
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

// Admin Inventory Overview
app.get("/api/admin/inventory", requireAdmin, (req, res) => {
    // Get low stock products
    db.all("SELECT * FROM products WHERE stock_quantity < 10 ORDER BY stock_quantity ASC", (err, lowStock) => {
        if (err) return res.status(500).json({ error: err.message });

        // Get out of stock products
        db.all("SELECT * FROM products WHERE stock_quantity = 0", (err, outOfStock) => {
            if (err) return res.status(500).json({ error: err.message });

            // Calculate total inventory value
            db.get("SELECT SUM(price * stock_quantity) as inventory_value FROM products", (err, value) => {
                if (err) return res.status(500).json({ error: err.message });

                res.json({
                    message: "success",
                    inventory: {
                        low_stock: lowStock,
                        out_of_stock: outOfStock,
                        total_value: value.inventory_value || 0
                    }
                });
            });
        });
    });
});

// Update Product Stock
app.put("/api/products/:id/stock", (req, res) => {
    const { stock_quantity } = req.body;
    const productId = req.params.id;

    if (stock_quantity === undefined) {
        return res.status(400).json({ error: "stock_quantity is required" });
    }

    db.run("UPDATE products SET stock_quantity = ? WHERE id = ?", [stock_quantity, productId], function (err) {
        if (err) return res.status(400).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: "Product not found" });
        res.json({ message: "Stock updated successfully", changes: this.changes });
    });
});

// Get All Orders (Admin)
app.get("/api/admin/orders", requireAdmin, (req, res) => {
    const { status, search } = req.query;
    let sql = `
        SELECT orders.*, users.username, users.email
        FROM orders
        JOIN users ON orders.user_id = users.id
    `;
    const params = [];

    if (status && status !== 'all') {
        sql += " WHERE orders.status = ?";
        params.push(status);
    }

    sql += " ORDER BY orders.created_at DESC";

    db.all(sql, params, (err, orders) => {
        if (err) return res.status(500).json({ error: err.message });

        // If search term provided, filter by username or email
        let filteredOrders = orders;
        if (search) {
            const searchLower = search.toLowerCase();
            filteredOrders = orders.filter(order =>
                order.username.toLowerCase().includes(searchLower) ||
                order.email.toLowerCase().includes(searchLower)
            );
        }

        res.json({ message: "success", orders: filteredOrders });
    });
});

// Get Order Details (Admin)
app.get("/api/admin/orders/:id", requireAdmin, (req, res) => {
    const orderId = req.params.id;

    // Get order with user details
    const orderSql = `
        SELECT orders.*, users.username, users.email, users.phone, users.full_name
        FROM orders
        JOIN users ON orders.user_id = users.id
        WHERE orders.id = ?
    `;

    db.get(orderSql, [orderId], (err, order) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!order) return res.status(404).json({ error: "Order not found" });

        // Get order items
        const itemsSql = `
            SELECT order_items.*, products.name, products.image
            FROM order_items
            JOIN products ON order_items.product_id = products.id
            WHERE order_items.order_id = ?
        `;

        db.all(itemsSql, [orderId], (err, items) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "success", order: order, items: items });
        });
    });
});

// Update Order Status (Admin)
app.put("/api/admin/orders/:id/status", requireAdmin, (req, res) => {
    const { status } = req.body;
    const orderId = req.params.id;

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
    }

    // Get current order status before updating
    db.get("SELECT status FROM orders WHERE id = ?", [orderId], (err, currentOrder) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!currentOrder) return res.status(404).json({ error: "Order not found" });

        const oldStatus = currentOrder.status;

        // Update order status
        db.run("UPDATE orders SET status = ? WHERE id = ?", [status, orderId], function (err) {
            if (err) return res.status(400).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: "Order not found" });

            console.log(`Order ${orderId} status changed from ${oldStatus} to ${status}`);

            // If order is being cancelled, restore stock
            if (status === 'cancelled' && oldStatus !== 'cancelled') {
                console.log(`Restoring stock for cancelled order ${orderId}`);

                // Get all items in the order
                const itemsSql = "SELECT product_id, quantity FROM order_items WHERE order_id = ?";
                db.all(itemsSql, [orderId], (err, items) => {
                    if (err) {
                        console.error("Error fetching order items:", err);
                        return res.json({ message: "Order status updated but stock restoration failed" });
                    }

                    if (items.length === 0) {
                        return res.json({ message: "Order status updated successfully" });
                    }

                    // Restore stock for each item
                    const updateStockSql = "UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?";
                    let itemsRestored = 0;

                    items.forEach(item => {
                        db.run(updateStockSql, [item.quantity, item.product_id], (err) => {
                            if (err) {
                                console.error(`Error restoring stock for product ${item.product_id}:`, err);
                            } else {
                                console.log(`Stock restored for product ${item.product_id}: +${item.quantity}`);
                            }

                            itemsRestored++;

                            if (itemsRestored === items.length) {
                                res.json({ message: "Order status updated and stock restored successfully" });
                            }
                        });
                    });
                });
            } else {
                res.json({ message: "Order status updated successfully" });
            }
        });
    });
});

// Get All Customers (Admin)
app.get("/api/admin/customers", requireAdmin, (req, res) => {
    const sql = `
        SELECT 
            users.id,
            users.username,
            users.email,
            users.phone,
            users.full_name,
            users.address,
            COUNT(orders.id) as order_count,
            COALESCE(SUM(orders.total), 0) as total_spent
        FROM users
        LEFT JOIN orders ON users.id = orders.user_id
        GROUP BY users.id
        ORDER BY total_spent DESC
    `;

    db.all(sql, [], (err, customers) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "success", customers: customers });
    });
});

// Get Customer Details (Admin)
app.get("/api/admin/customers/:id", requireAdmin, (req, res) => {
    const customerId = req.params.id;

    // Get customer info
    db.get("SELECT id, username, email, phone, full_name, address FROM users WHERE id = ?", [customerId], (err, customer) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!customer) return res.status(404).json({ error: "Customer not found" });

        // Get customer orders
        db.all("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC", [customerId], (err, orders) => {
            if (err) return res.status(500).json({ error: err.message });

            // Get customer stats
            db.get("SELECT COUNT(*) as order_count, COALESCE(SUM(total), 0) as total_spent FROM orders WHERE user_id = ?", [customerId], (err, stats) => {
                if (err) return res.status(500).json({ error: err.message });

                // Get active cart items
                const cartSql = `
                    SELECT cart.*, products.name, products.price, products.image 
                    FROM cart 
                    JOIN products ON cart.product_id = products.id 
                    WHERE cart.user_id = ?
                `;
                db.all(cartSql, [customerId], (err, cartItems) => {
                    if (err) {
                        console.error(`Error fetching cart for user ${customerId}:`, err);
                        return res.status(500).json({ error: err.message });
                    }
                    if (!cartItems) {
                        cartItems = [];
                    }

                    res.json({
                        message: "success",
                        customer: customer,
                        orders: orders,
                        stats: stats,
                        cart: cartItems
                    });
                });
            });
        });
    });
});

// Get Recent Orders (Admin Dashboard)
app.get("/api/admin/recent-orders", requireAdmin, (req, res) => {
    const limit = req.query.limit || 10;
    const sql = `
        SELECT orders.*, users.username, users.email
        FROM orders
        JOIN users ON orders.user_id = users.id
        ORDER BY orders.created_at DESC
        LIMIT ?
    `;

    db.all(sql, [limit], (err, orders) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "success", orders: orders });
    });
});

// Start server
app.listen(HTTP_PORT, () => {
    console.log(`Server running on port ${HTTP_PORT}`);
    console.log("DEBUG: Server v1.1 - Values Updated");
});
