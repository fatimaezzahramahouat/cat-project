export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const pathname = url.pathname;
        const method = request.method;

        // CORS headers for frontend access
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        };

        // Handle preflight requests
        if (method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        // ========== HELPER FUNCTIONS ==========

        // Helper function for JSON responses
        const json = (data, status = 200) => {
            return new Response(JSON.stringify(data), {
                status,
                headers: {
                    "Content-Type": "application/json",
                    ...corsHeaders
                }
            });
        };

        // Hash password using SHA-256
        async function hashPassword(password) {
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hash = await crypto.subtle.digest("SHA-256", data);
            return Array.from(new Uint8Array(hash))
                .map(b => b.toString(16).padStart(2, "0"))
                .join("");
        }

        // Generate JWT token (simplified)
        function generateToken(payload) {
            const header = {
                alg: "HS256",
                typ: "JWT"
            };

            const encodedHeader = btoa(JSON.stringify(header));
            const encodedPayload = btoa(JSON.stringify({
                ...payload,
                exp: Date.now() + 86400000 // 24 hours from now
            }));

            return `${encodedHeader}.${encodedPayload}`;
        }

        // Verify token
        function verifyToken(token) {
            try {
                const parts = token.split('.');
                if (parts.length !== 2) return null;

                const payload = JSON.parse(atob(parts[1]));

                // Check if token is expired
                if (payload.exp && payload.exp < Date.now()) {
                    return null;
                }

                return payload;
            } catch (error) {
                console.error("Token verification error:", error);
                return null;
            }
        }

        // Authentication middleware
        async function authenticate(request) {
            const authHeader = request.headers.get('Authorization');
            if (!authHeader) return null;

            const token = authHeader.replace('Bearer ', '');
            const user = verifyToken(token);
            return user;
        }

        // ========== DATABASE SETUP ==========

        // Initialize database tables if they don't exist
        async function initDatabase() {
            try {
                // Create users table
                await env.DB.exec(`
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        email TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        avatar TEXT DEFAULT '😺',
                        role TEXT DEFAULT 'user',
                        bio TEXT DEFAULT '',
                        location TEXT DEFAULT '',
                        cats_posted INTEGER DEFAULT 0,
                        total_likes INTEGER DEFAULT 0,
                        profile_views INTEGER DEFAULT 0,
                        status TEXT DEFAULT 'active',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        last_login DATETIME
                    )
                `);

                // Create cats table
                await env.DB.exec(`
                    CREATE TABLE IF NOT EXISTS cats (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        tag TEXT,
                        description TEXT,
                        img TEXT,
                        likes INTEGER DEFAULT 0,
                        views INTEGER DEFAULT 0,
                        approved BOOLEAN DEFAULT 1,
                        owner_id INTEGER,
                        owner_name TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (owner_id) REFERENCES users(id)
                    )
                `);

                // Create activities table
                await env.DB.exec(`
                    CREATE TABLE IF NOT EXISTS activities (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER,
                        action TEXT NOT NULL,
                        type TEXT,
                        details TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id)
                    )
                `);

                // Create default admin if not exists
                const adminExists = await env.DB.prepare(
                    "SELECT * FROM users WHERE email = ?"
                ).bind('admin@cattey.com').first();

                if (!adminExists) {
                    const adminPassword = await hashPassword('admin123');
                    await env.DB.prepare(`
                        INSERT INTO users (username, email, password_hash, role, avatar)
                        VALUES (?, ?, ?, ?, ?)
                    `).bind('admin', 'admin@cattey.com', adminPassword, 'admin', '👑').run();
                    console.log('Default admin user created');
                }

                console.log('Database initialized successfully');
            } catch (error) {
                console.error('Database initialization error:', error);
            }
        }

        // Initialize database on first request
        await initDatabase();

        // ========== API ROUTES ==========

        // ===== PUBLIC ROUTES =====

        // GET /cats - Get all cats
        if (pathname === "/cats" && method === "GET") {
            try {
                const { results } = await env.DB.prepare(`
                    SELECT c.*, u.username, u.avatar as owner_avatar 
                    FROM cats c 
                    LEFT JOIN users u ON c.owner_id = u.id 
                    WHERE c.approved = 1 
                    ORDER BY c.created_at DESC
                `).all();
                return json(results);
            } catch (error) {
                console.error("Database error:", error);
                return json({ error: "Database query error" }, 500);
            }
        }

        // GET /tags - Get all unique tags
        if (pathname === "/tags" && method === "GET") {
            try {
                const { results } = await env.DB.prepare(`
                    SELECT DISTINCT TRIM(tag) as tag 
                    FROM cats 
                    WHERE tag IS NOT NULL 
                    AND tag != '' 
                    ORDER BY tag ASC
                `).all();

                const tags = results.map(r => r.tag).filter(tag => tag);
                return json(tags);
            } catch (error) {
                console.error("Database error:", error);
                return json({ error: "Failed to get tags" }, 500);
            }
        }

        // POST /auth/register - Register new user
        if (pathname === "/auth/register" && method === "POST") {
            try {
                const data = await request.json();
                const { username, email, password } = data;

                console.log("📝 Register attempt:", { username, email });

                // Validation
                if (!username || !email || !password) {
                    return json({ error: "All fields are required" }, 400);
                }

                if (password.length < 6) {
                    return json({ error: "Password must be at least 6 characters" }, 400);
                }

                // Hash the password
                const password_hash = await hashPassword(password);

                try {
                    // Insert user into database
                    const result = await env.DB.prepare(`
                        INSERT INTO users (username, email, password_hash, role, avatar)
                        VALUES (?, ?, ?, ?, ?)
                    `).bind(username, email, password_hash, 'user', '😺').run();

                    console.log("✅ User inserted with ID:", result.meta.last_row_id);

                    // Get the newly created user (without password)
                    const user = await env.DB.prepare(`
                        SELECT id, username, email, role, avatar, created_at 
                        FROM users WHERE id = ?
                    `).bind(result.meta.last_row_id).first();

                    // Generate JWT token
                    const token = generateToken({
                        id: user.id,
                        username: user.username,
                        role: user.role
                    });

                    // Log activity
                    await env.DB.prepare(`
                        INSERT INTO activities (user_id, action, type)
                        VALUES (?, ?, ?)
                    `).bind(user.id, 'New user registration', 'signup').run();

                    return json({
                        message: "Account created successfully",
                        token,
                        user
                    }, 201);

                } catch (error) {
                    console.error("Database error:", error.message);

                    // Check for duplicate username/email
                    if (error.message.includes("UNIQUE constraint failed")) {
                        if (error.message.includes("username")) {
                            return json({ error: "Username already exists" }, 409);
                        }
                        if (error.message.includes("email")) {
                            return json({ error: "Email already exists" }, 409);
                        }
                    }

                    return json({ error: "Registration failed" }, 500);
                }
            } catch (error) {
                console.error("Register error:", error);
                return json({ error: "Registration failed" }, 500);
            }
        }

        // POST /auth/login - Login user
        if (pathname === "/auth/login" && method === "POST") {
            try {
                const data = await request.json();
                const { email, password } = data;

                console.log("🔐 Login attempt for email:", email);

                if (!email || !password) {
                    return json({ error: "Email and password required" }, 400);
                }

                // Find user by email
                const user = await env.DB.prepare(`
                    SELECT id, username, email, role, avatar, password_hash, created_at
                    FROM users WHERE email = ? AND status = 'active'
                `).bind(email).first();

                if (!user) {
                    console.log("❌ User not found for email:", email);
                    return json({ error: "Invalid credentials" }, 401);
                }

                // Verify password by comparing hashes
                const inputHash = await hashPassword(password);
                if (inputHash !== user.password_hash) {
                    console.log("❌ Password mismatch for user:", user.username);
                    return json({ error: "Invalid credentials" }, 401);
                }

                console.log("✅ Login successful for user:", user.username);

                // Update last login
                await env.DB.prepare(`
                    UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?
                `).bind(user.id).run();

                // Remove password hash from response
                const { password_hash: _, ...userWithoutPassword } = user;

                // Generate JWT token
                const token = generateToken({
                    id: user.id,
                    username: user.username,
                    role: user.role
                });

                // Log activity
                await env.DB.prepare(`
                    INSERT INTO activities (user_id, action, type)
                    VALUES (?, ?, ?)
                `).bind(user.id, 'User login', 'login').run();

                return json({
                    message: "Login successful",
                    token,
                    user: userWithoutPassword
                });

            } catch (error) {
                console.error("Login error:", error);
                return json({ error: "Login failed" }, 500);
            }
        }

        // ===== AUTHENTICATED ROUTES =====
        const user = await authenticate(request);

        // GET /auth/verify - Verify token
        if (pathname === "/auth/verify" && method === "GET") {
            if (!user) {
                return json({ error: "Invalid token" }, 401);
            }

            const userData = await env.DB.prepare(`
                SELECT id, username, email, role, avatar, bio, location, 
                       cats_posted, total_likes, profile_views, created_at, last_login
                FROM users WHERE id = ?
            `).bind(user.id).first();

            if (!userData) {
                return json({ error: "User not found" }, 404);
            }

            return json({ user: userData });
        }

        // GET /users/me - Get user profile
        if (pathname === "/users/me" && method === "GET") {
            if (!user) {
                return json({ error: "Authentication required" }, 401);
            }

            try {
                // Get user data
                const userData = await env.DB.prepare(`
                    SELECT id, username, email, role, avatar, bio, location, 
                           cats_posted, total_likes, profile_views, created_at, last_login
                    FROM users WHERE id = ?
                `).bind(user.id).first();

                if (!userData) {
                    return json({ error: "User not found" }, 404);
                }

                // Get user's cats
                const { results: userCats } = await env.DB.prepare(`
                    SELECT * FROM cats WHERE owner_id = ? ORDER BY created_at DESC LIMIT 10
                `).bind(user.id).all();

                // Get user's activities
                const { results: activities } = await env.DB.prepare(`
                    SELECT * FROM activities 
                    WHERE user_id = ? 
                    ORDER BY created_at DESC 
                    LIMIT 10
                `).bind(user.id).all();

                // Calculate stats
                const stats = {
                    totalCats: userData.cats_posted || 0,
                    totalLikes: userData.total_likes || 0,
                    profileViews: userData.profile_views || 0,
                    averageLikes: userData.cats_posted > 0 ?
                        ((userData.total_likes || 0) / userData.cats_posted).toFixed(1) : 0
                };

                return json({
                    user: userData,
                    stats,
                    recentCats: userCats,
                    activities
                });

            } catch (error) {
                console.error("Get profile error:", error);
                return json({ error: "Failed to get profile" }, 500);
            }
        }

        // PUT /users/me - Update user profile
        if (pathname === "/users/me" && method === "PUT") {
            if (!user) {
                return json({ error: "Authentication required" }, 401);
            }

            try {
                const data = await request.json();
                const { bio, location, avatar } = data;

                const updates = {};
                const params = [];

                if (bio !== undefined) {
                    updates.bio = bio;
                    params.push(`bio = ?`);
                }
                if (location !== undefined) {
                    updates.location = location;
                    params.push(`location = ?`);
                }
                if (avatar !== undefined) {
                    updates.avatar = avatar;
                    params.push(`avatar = ?`);
                }

                if (params.length === 0) {
                    return json({ error: "No fields to update" }, 400);
                }

                const values = [bio, location, avatar].filter(v => v !== undefined);
                values.push(user.id);

                await env.DB.prepare(`
                    UPDATE users 
                    SET ${params.join(', ')} 
                    WHERE id = ?
                `).bind(...values).run();

                // Get updated user
                const updatedUser = await env.DB.prepare(`
                    SELECT id, username, email, role, avatar, bio, location, 
                           cats_posted, total_likes, profile_views
                    FROM users WHERE id = ?
                `).bind(user.id).first();

                return json({
                    message: "Profile updated successfully",
                    user: updatedUser
                });

            } catch (error) {
                console.error("Update profile error:", error);
                return json({ error: "Failed to update profile" }, 500);
            }
        }

        // POST /cats - Add new cat (authenticated)
        if (pathname === "/cats" && method === "POST") {
            if (!user) {
                return json({ error: "Authentication required" }, 401);
            }

            try {
                const body = await request.json();
                if (!body.name) {
                    return json({ error: "Name is required" }, 400);
                }

                // Add cat
                const result = await env.DB
                    .prepare(`
                        INSERT INTO cats (name, tag, description, img, owner_id, owner_name)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `)
                    .bind(
                        body.name,
                        body.tag || null,
                        body.description || null,
                        body.img || null,
                        user.id,
                        user.username
                    )
                    .run();

                // Update user's cat count
                await env.DB.prepare(`
                    UPDATE users 
                    SET cats_posted = cats_posted + 1 
                    WHERE id = ?
                `).bind(user.id).run();

                // Log activity
                await env.DB.prepare(`
                    INSERT INTO activities (user_id, action, type, details)
                    VALUES (?, ?, ?, ?)
                `).bind(user.id, `Added new cat: ${body.name}`, 'cat_added',
                    JSON.stringify({ catId: result.meta.last_row_id })).run();

                return json({
                    message: "Cat added successfully",
                    id: result.meta.last_row_id
                }, 201);

            } catch (error) {
                console.error("Database error:", error);
                return json({ error: "Failed to add cat" }, 500);
            }
        }

        // ===== ADMIN ROUTES =====
        if (user && user.role === 'admin') {

            // GET /admin/users - Get all users
            if (pathname === "/admin/users" && method === "GET") {
                try {
                    const { results: users } = await env.DB.prepare(`
                        SELECT id, username, email, role, avatar, status, 
                               cats_posted, total_likes, profile_views, created_at, last_login
                        FROM users
                        ORDER BY created_at DESC
                    `).all();

                    const { results: stats } = await env.DB.prepare(`
                        SELECT 
                            COUNT(*) as total_users,
                            SUM(CASE WHEN DATE(created_at) = DATE('now') THEN 1 ELSE 0 END) as new_users_today,
                            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_users
                        FROM users
                    `).all();

                    return json({
                        users,
                        stats: stats[0]
                    });

                } catch (error) {
                    console.error("Admin users error:", error);
                    return json({ error: "Failed to get users" }, 500);
                }
            }

            // GET /admin/stats - Get admin statistics
            if (pathname === "/admin/stats" && method === "GET") {
                try {
                    // Basic stats
                    const { results: stats } = await env.DB.prepare(`
                        SELECT 
                            (SELECT COUNT(*) FROM users) as total_users,
                            (SELECT COUNT(*) FROM cats) as total_cats,
                            (SELECT SUM(likes) FROM cats) as total_likes,
                            (SELECT COUNT(*) FROM users WHERE DATE(created_at) >= DATE('now', '-7 days')) as new_users_week,
                            (SELECT COUNT(*) FROM cats WHERE DATE(created_at) >= DATE('now', '-7 days')) as new_cats_week,
                            (SELECT COUNT(DISTINCT user_id) FROM activities WHERE DATE(created_at) >= DATE('now', '-1 day')) as active_users_day
                    `).all();

                    // User growth data (last 7 days)
                    const { results: userGrowth } = await env.DB.prepare(`
                        SELECT 
                            DATE(created_at) as date,
                            COUNT(*) as count
                        FROM users
                        WHERE DATE(created_at) >= DATE('now', '-7 days')
                        GROUP BY DATE(created_at)
                        ORDER BY date ASC
                    `).all();

                    // Cat uploads data (last 7 days)
                    const { results: catUploads } = await env.DB.prepare(`
                        SELECT 
                            DATE(created_at) as date,
                            COUNT(*) as count
                        FROM cats
                        WHERE DATE(created_at) >= DATE('now', '-7 days')
                        GROUP BY DATE(created_at)
                        ORDER BY date ASC
                    `).all();

                    return json({
                        stats: stats[0],
                        charts: {
                            userGrowth,
                            catUploads
                        }
                    });

                } catch (error) {
                    console.error("Admin stats error:", error);
                    return json({ error: "Failed to get stats" }, 500);
                }
            }

            // PUT /admin/users/:id - Update user
            if (pathname.startsWith("/admin/users/") && method === "PUT") {
                try {
                    const userId = pathname.split("/")[3];
                    const data = await request.json();
                    const { role, status } = data;

                    if (!userId || isNaN(userId)) {
                        return json({ error: "Invalid user ID" }, 400);
                    }

                    const updates = [];
                    const values = [];

                    if (role) {
                        updates.push("role = ?");
                        values.push(role);
                    }
                    if (status) {
                        updates.push("status = ?");
                        values.push(status);
                    }

                    if (updates.length === 0) {
                        return json({ error: "No fields to update" }, 400);
                    }

                    values.push(parseInt(userId));

                    await env.DB.prepare(`
                        UPDATE users 
                        SET ${updates.join(', ')} 
                        WHERE id = ?
                    `).bind(...values).run();

                    // Log admin action
                    await env.DB.prepare(`
                        INSERT INTO activities (user_id, action, type, details)
                        VALUES (?, ?, ?, ?)
                    `).bind(user.id, `Admin updated user`, 'admin_action',
                        JSON.stringify({ targetUserId: userId, changes: { role, status } })).run();

                    return json({ message: "User updated successfully" });

                } catch (error) {
                    console.error("Admin update user error:", error);
                    return json({ error: "Failed to update user" }, 500);
                }
            }
        } else if (pathname.startsWith("/admin/")) {
            // If trying to access admin routes without admin role
            return json({ error: "Admin access required" }, 403);
        }

        // ========== OTHER CAT ROUTES (authenticated) ==========

        // GET /cats/:id - Get specific cat
        if (pathname.startsWith("/cats/") && method === "GET") {
            try {
                const id = pathname.split("/")[2];
                if (!id || isNaN(id)) {
                    return json({ error: "Invalid ID" }, 400);
                }

                const cat = await env.DB
                    .prepare(`
                        SELECT c.*, u.username, u.avatar as owner_avatar 
                        FROM cats c 
                        LEFT JOIN users u ON c.owner_id = u.id 
                        WHERE c.id = ?
                    `)
                    .bind(id)
                    .first();

                if (!cat) {
                    return json({ error: "Not found" }, 404);
                }

                // Increment views
                await env.DB.prepare(`
                    UPDATE cats SET views = views + 1 WHERE id = ?
                `).bind(id).run();

                return json(cat);

            } catch (error) {
                console.error("Database error:", error);
                return json({ error: "Database error" }, 500);
            }
        }

        // PUT /cats/:id - Update cat
        if (pathname.startsWith("/cats/") && method === "PUT") {
            if (!user) {
                return json({ error: "Authentication required" }, 401);
            }

            try {
                const id = pathname.split("/")[2];
                const body = await request.json();

                // Check if user owns the cat
                const cat = await env.DB
                    .prepare("SELECT owner_id FROM cats WHERE id = ?")
                    .bind(id)
                    .first();

                if (!cat) {
                    return json({ error: "Cat not found" }, 404);
                }

                if (cat.owner_id !== user.id && user.role !== 'admin') {
                    return json({ error: "Not authorized" }, 403);
                }

                await env.DB
                    .prepare("UPDATE cats SET name = ?, tag = ?, description = ?, img = ? WHERE id = ?")
                    .bind(body.name, body.tag, body.description, body.img, id)
                    .run();

                return json({ message: "Cat updated successfully" });

            } catch (error) {
                console.error("Database error:", error);
                return json({ error: "Failed to update cat" }, 500);
            }
        }

        // DELETE /cats/:id - Delete cat
        if (pathname.startsWith("/cats/") && method === "DELETE") {
            if (!user) {
                return json({ error: "Authentication required" }, 401);
            }

            try {
                const id = pathname.split("/")[2];

                // Check if user owns the cat
                const cat = await env.DB
                    .prepare("SELECT owner_id, owner_name FROM cats WHERE id = ?")
                    .bind(id)
                    .first();

                if (!cat) {
                    return json({ error: "Cat not found" }, 404);
                }

                if (cat.owner_id !== user.id && user.role !== 'admin') {
                    return json({ error: "Not authorized" }, 403);
                }

                await env.DB.prepare("DELETE FROM cats WHERE id = ?").bind(id).run();

                // Update user's cat count if not admin
                if (cat.owner_id === user.id) {
                    await env.DB.prepare(`
                        UPDATE users 
                        SET cats_posted = cats_posted - 1 
                        WHERE id = ?
                    `).bind(user.id).run();
                }

                return json({ message: "Cat deleted successfully" });

            } catch (error) {
                console.error("Database error:", error);
                return json({ error: "Failed to delete cat" }, 500);
            }
        }

        // ========== DEFAULT ROUTE ==========
        // If no route matches, return 404 or serve static files
        return new Response("Not Found", { status: 404 });
    }
};