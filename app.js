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

        // ========== API ROUTES ==========

        // GET /cats - Get all cats
        if (pathname === "/cats" && method === "GET") {
            try {
                const { results } = await env.DB.prepare("SELECT * FROM cats").all();
                return Response.json(results, { headers: corsHeaders });
            } catch (error) {
                console.error("Database error:", error);
                return Response.json(
                    { error: "Database query error" },
                    { status: 500, headers: corsHeaders }
                );
            }
        }

        // GET /cats/:id - Get specific cat
        if (pathname.startsWith("/cats/") && method === "GET") {
            try {
                const id = pathname.split("/")[2];
                if (!id || isNaN(id)) {
                    return Response.json(
                        { error: "Invalid ID" },
                        { status: 400, headers: corsHeaders }
                    );
                }

                const { results } = await env.DB
                    .prepare("SELECT * FROM cats WHERE id = ?")
                    .bind(id)
                    .all();

                return Response.json(results[0] || { error: "Not found" }, {
                    status: results[0] ? 200 : 404,
                    headers: corsHeaders
                });
            } catch (error) {
                console.error("Database error:", error);
                return Response.json(
                    { error: "Database error" },
                    { status: 500, headers: corsHeaders }
                );
            }
        }

        // POST /cats - Add new cat
        if (pathname === "/cats" && method === "POST") {
            try {
                const body = await request.json();
                if (!body.name) {
                    return Response.json(
                        { error: "Name is required" },
                        { status: 400, headers: corsHeaders }
                    );
                }

                const result = await env.DB
                    .prepare("INSERT INTO cats (name, tag, description, IMG) VALUES (?, ?, ?, ?)")
                    .bind(body.name, body.tag || null, body.description || null, body.IMG || null)
                    .run();

                return Response.json(
                    {
                        message: "Cat added successfully",
                        id: result.meta.last_row_id
                    },
                    { status: 201, headers: corsHeaders }
                );
            } catch (error) {
                console.error("Database error:", error);
                return Response.json(
                    { error: "Failed to add cat" },
                    { status: 500, headers: corsHeaders }
                );
            }
        }

        // PUT /cats/:id - Update cat
        if (pathname.startsWith("/cats/") && method === "PUT") {
            try {
                const id = pathname.split("/")[2];
                const body = await request.json();

                await env.DB
                    .prepare("UPDATE cats SET name = ?, tag = ?, description = ?, IMG = ? WHERE id = ?")
                    .bind(body.name, body.tag, body.description, body.IMG, id)
                    .run();

                return Response.json(
                    { message: "Cat updated successfully" },
                    { headers: corsHeaders }
                );
            } catch (error) {
                console.error("Database error:", error);
                return Response.json(
                    { error: "Failed to update cat" },
                    { status: 500, headers: corsHeaders }
                );
            }
        }

        // DELETE /cats/:id - Delete cat
        if (pathname.startsWith("/cats/") && method === "DELETE") {
            try {
                const id = pathname.split("/")[2];
                await env.DB.prepare("DELETE FROM cats WHERE id = ?").bind(id).run();

                return Response.json(
                    { message: "Cat deleted successfully" },
                    { headers: corsHeaders }
                );
            } catch (error) {
                console.error("Database error:", error);
                return Response.json(
                    { error: "Failed to delete cat" },
                    { status: 500, headers: corsHeaders }
                );
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
                return Response.json(tags, { headers: corsHeaders });
            } catch (error) {
                console.error("Database error:", error);
                return Response.json(
                    { error: "Failed to get tags" },
                    { status: 500, headers: corsHeaders }
                );
            }
        }

        ///AUTH

        // ============ AUTH ENDPOINTS ============

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
                INSERT INTO users (username, email, password_hash, role)
                VALUES (?, ?, ?, ?)
            `).bind(username, email, password_hash, 'user').run();

                    console.log("✅ User inserted with ID:", result.meta.last_row_id);

                    // Get the newly created user (without password)
                    const user = await env.DB.prepare(`
                SELECT id, username, email, role, created_at 
                FROM users WHERE id = ?
            `).bind(result.meta.last_row_id).first();

                    // Generate JWT token
                    const token = generateToken({
                        id: user.id,
                        username: user.username,
                        role: user.role
                    });

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

                // Hash the password to compare
                const password_hash = await hashPassword(password);

                // Find user by email
                const user = await env.DB.prepare(`
            SELECT id, username, email, role, password_hash, created_at
            FROM users WHERE email = ?
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

                // Remove password hash from response
                const { password_hash: _, ...userWithoutPassword } = user;

                // Generate JWT token
                const token = generateToken({
                    id: user.id,
                    username: user.username,
                    role: user.role
                });

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

        // ============ HELPER FUNCTIONS ============

        // Hash password using SHA-256
        async function hashPassword(password) {
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hash = await crypto.subtle.digest("SHA-256", data);
            return Array.from(new Uint8Array(hash))
                .map(b => b.toString(16).padStart(2, "0"))
                .join("");
        }

        // Generate JWT-like token (simplified for Cloudflare Workers)
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

            // In production, you would sign this with a secret key
            // For simplicity, we're just base64 encoding
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

        //auth

        // Helper functions
        const getRandomAvatar = () => {
            const avatars = ['😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '🐱'];
            return avatars[Math.floor(Math.random() * avatars.length)];
        };

        // Database simulation using KV storage
        class Database {
            constructor(env) {
                this.usersKV = env.USERS_KV;
                this.catsKV = env.CATS_KV;
                this.activitiesKV = env.ACTIVITIES_KV;
            }

            // User methods
            async createUser(userData) {
                const userId = Date.now().toString(); // Simple ID generation
                const user = {
                    id: userId,
                    ...userData,
                    joined: new Date().toISOString(),
                    lastLogin: null,
                    role: 'user',
                    status: 'active',
                    catsPosted: 0,
                    totalLikes: 0,
                    profileViews: 0,
                    bio: '',
                    location: '',
                    avatar: getRandomAvatar()
                };

                await this.usersKV.put(userId, JSON.stringify(user));
                await this.usersKV.put(`email:${userData.email}`, userId);
                await this.usersKV.put(`username:${userData.username}`, userId);

                return user;
            }

            async getUserById(userId) {
                const userData = await this.usersKV.get(userId);
                return userData ? JSON.parse(userData) : null;
            }

            async getUserByEmail(email) {
                const userId = await this.usersKV.get(`email:${email}`);
                if (!userId) return null;
                return this.getUserById(userId);
            }

            async getUserByUsername(username) {
                const userId = await this.usersKV.get(`username:${username}`);
                if (!userId) return null;
                return this.getUserById(userId);
            }

            async updateUser(userId, updates) {
                const user = await this.getUserById(userId);
                if (!user) return null;

                const updatedUser = { ...user, ...updates };
                await this.usersKV.put(userId, JSON.stringify(updatedUser));
                return updatedUser;
            }

            async getAllUsers() {
                const users = [];
                const keys = await this.usersKV.list();

                for (const key of keys.keys) {
                    if (!key.name.includes(':') && !key.name.includes('admin')) {
                        const user = await this.getUserById(key.name);
                        if (user) {
                            const { password, ...userWithoutPassword } = user;
                            users.push(userWithoutPassword);
                        }
                    }
                }

                return users.sort((a, b) => new Date(b.joined) - new Date(a.joined));
            }

            async getUsersCount() {
                const keys = await this.usersKV.list();
                let count = 0;
                for (const key of keys.keys) {
                    if (!key.name.includes(':') && !key.name.includes('admin')) {
                        count++;
                    }
                }
                return count;
            }

            // Cat methods
            async createCat(catData) {
                const catId = Date.now().toString();
                const cat = {
                    id: catId,
                    ...catData,
                    createdAt: new Date().toISOString(),
                    likes: 0,
                    views: 0,
                    approved: true
                };

                await this.catsKV.put(catId, JSON.stringify(cat));

                // Add to owner's cats list
                const owner = await this.getUserById(catData.owner);
                if (owner) {
                    const userCats = await this.getUserCats(catData.owner) || [];
                    userCats.push(catId);
                    await this.usersKV.put(`cats:${catData.owner}`, JSON.stringify(userCats));

                    // Update user's cat count
                    await this.updateUser(catData.owner, {
                        catsPosted: (owner.catsPosted || 0) + 1
                    });
                }

                return cat;
            }

            async getCatById(catId) {
                const catData = await this.catsKV.get(catId);
                return catData ? JSON.parse(catData) : null;
            }

            async getAllCats() {
                const cats = [];
                const keys = await this.catsKV.list();

                for (const key of keys.keys) {
                    const cat = await this.getCatById(key.name);
                    if (cat && cat.approved) {
                        cats.push(cat);
                    }
                }

                return cats.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            }

            async getUserCats(userId) {
                const catsData = await this.usersKV.get(`cats:${userId}`);
                if (!catsData) return [];

                const catIds = JSON.parse(catsData);
                const cats = [];

                for (const catId of catIds) {
                    const cat = await this.getCatById(catId);
                    if (cat) cats.push(cat);
                }

                return cats.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            }

            async getCatsCount() {
                const keys = await this.catsKV.list();
                return keys.keys.length;
            }

            // Activity methods
            async logActivity(activityData) {
                const activityId = Date.now().toString();
                const activity = {
                    id: activityId,
                    ...activityData,
                    timestamp: new Date().toISOString()
                };

                await this.activitiesKV.put(activityId, JSON.stringify(activity));

                // Add to user's activity list
                if (activityData.user) {
                    const userActivities = await this.getUserActivities(activityData.user) || [];
                    userActivities.push(activityId);
                    await this.usersKV.put(`activities:${activityData.user}`, JSON.stringify(userActivities));
                }

                return activity;
            }

            async getUserActivities(userId) {
                const activitiesData = await this.usersKV.get(`activities:${userId}`);
                if (!activitiesData) return [];

                const activityIds = JSON.parse(activitiesData);
                const activities = [];

                for (const activityId of activityIds.slice(-10)) { // Last 10 activities
                    const activityData = await this.activitiesKV.get(activityId);
                    if (activityData) {
                        activities.push(JSON.parse(activityData));
                    }
                }

                return activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            }

            async getStats() {
                const totalUsers = await this.getUsersCount();
                const totalCats = await this.getCatsCount();

                // Calculate total likes
                const cats = await this.getAllCats();
                const totalLikes = cats.reduce((sum, cat) => sum + (cat.likes || 0), 0);

                // Get recent users (last 7 days)
                const users = await this.getAllUsers();
                const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                const newUsers = users.filter(user => new Date(user.joined) >= weekAgo).length;

                // Get recent cats (last 7 days)
                const newCats = cats.filter(cat => new Date(cat.createdAt) >= weekAgo).length;

                return {
                    totalUsers,
                    totalCats,
                    totalLikes,
                    newUsers,
                    newCats,
                    activeUsers: Math.min(totalUsers, 10) // Simple estimation
                };
            }
        }

        // Authentication middleware
        const authenticateToken = (request, env, context) => {
            return new Promise((resolve, reject) => {
                const authHeader = request.headers.get('Authorization');
                const token = authHeader && authHeader.split(' ')[1];

                if (!token) {
                    resolve(null);
                    return;
                }

                jwt.verify(token, env.JWT_SECRET, (err, user) => {
                    if (err) {
                        resolve(null);
                    } else {
                        resolve(user);
                    }
                });
            });
        };

        const isAdmin = (user) => {
            return user && user.role === 'admin';
        };

        // Initialize default admin
        const initializeDefaultAdmin = async (db) => {
            try {
                const adminExists = await db.getUserByEmail('admin@cattey.com');
                if (!adminExists) {
                    const hashedPassword = await bcrypt.hash('admin123', 10);
                    await db.createUser({
                        username: 'admin',
                        email: 'admin@cattey.com',
                        password: hashedPassword,
                        role: 'admin',
                        avatar: '👑',
                        bio: 'System Administrator'
                    });
                    console.log('Default admin user created');
                }
            } catch (error) {
                console.error('Error creating admin user:', error);
            }
        };

        // CORS headers

        // Response helper
        const jsonResponse = (data, status = 200) => {
            return new Response(JSON.stringify(data), {
                status,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        };

        const errorResponse = (message, status = 400) => {
            return jsonResponse({ error: message }, status);
        };

        // Main handler

        const path = url.pathname;

        // Initialize database
        const db = new Database(env);

        // Initialize admin on first request
        await initializeDefaultAdmin(db);

        try {
            // Public routes
            if (path === '/api/auth/register' && method === 'POST') {
                return await handleRegister(request, db, env);
            }

            if (path === '/api/auth/login' && method === 'POST') {
                return await handleLogin(request, db, env);
            }

            if (path === '/api/cats' && method === 'GET') {
                return await handleGetCats(request, db);
            }

            // Authenticated routes
            const user = await authenticateToken(request, env, ctx);
            if (!user) {
                return errorResponse('Authentication required', 401);
            }

            // User routes
            if (path === '/api/auth/verify' && method === 'GET') {
                return await handleVerify(user, db);
            }

            if (path === '/api/users/me' && method === 'GET') {
                return await handleGetUserProfile(user, db);
            }

            if (path === '/api/users/me' && method === 'PUT') {
                return await handleUpdateProfile(request, user, db);
            }

            if (path === '/api/cats' && method === 'POST') {
                return await handleCreateCat(request, user, db, env);
            }

            // Admin routes
            if (!isAdmin(user)) {
                return errorResponse('Admin access required', 403);
            }

            if (path === '/api/admin/users' && method === 'GET') {
                return await handleGetAllUsers(db);
            }

            if (path === '/api/admin/stats' && method === 'GET') {
                return await handleGetStats(db);
            }

            if (path === '/api/admin/users' && method === 'PUT') {
                return await handleUpdateUser(request, user, db, env);
            }

            if (path === '/api/admin/users' && method === 'DELETE') {
                return await handleDeleteUser(request, user, db, env);
            }

            return errorResponse('Not found', 404);

        } catch (error) {
            console.error('Handler error:', error);
            return errorResponse('Internal server error', 500);
        }
    }
};

// Route handlers
async function handleRegister(request, db, env) {
    try {
        const { username, email, password } = await request.json();

        // Check if user exists
        const existingByEmail = await db.getUserByEmail(email);
        const existingByUsername = await db.getUserByUsername(username);

        if (existingByEmail || existingByUsername) {
            return errorResponse('User with this email or username already exists');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await db.createUser({
            username,
            email,
            password: hashedPassword
        });

        // Create token
        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Log activity
        await db.logActivity({
            user: user.id,
            action: 'New user registration',
            type: 'signup',
            details: { username, email }
        });

        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;

        return jsonResponse({
            message: 'User registered successfully',
            token,
            user: userWithoutPassword
        }, 201);
    } catch (error) {
        console.error('Registration error:', error);
        return errorResponse('Registration failed');
    }
}

async function handleLogin(request, db, env) {
    try {
        const { email, password } = await request.json();

        // Find user
        const user = await db.getUserByEmail(email);
        if (!user) {
            return errorResponse('Invalid credentials', 401);
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return errorResponse('Invalid credentials', 401);
        }

        // Check if user is active
        if (user.status !== 'active') {
            return errorResponse('Account is ' + user.status, 403);
        }

        // Update last login
        await db.updateUser(user.id, { lastLogin: new Date().toISOString() });

        // Create token
        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Log activity
        await db.logActivity({
            user: user.id,
            action: 'User login',
            type: 'login'
        });

        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;

        return jsonResponse({
            message: 'Login successful',
            token,
            user: userWithoutPassword
        });
    } catch (error) {
        console.error('Login error:', error);
        return errorResponse('Login failed');
    }
}

async function handleVerify(user, db) {
    const userData = await db.getUserById(user.userId);
    if (!userData) {
        return errorResponse('User not found', 404);
    }

    const { password: _, ...userWithoutPassword } = userData;
    return jsonResponse({ user: userWithoutPassword });
}

async function handleGetUserProfile(user, db) {
    const userData = await db.getUserById(user.userId);
    if (!userData) {
        return errorResponse('User not found', 404);
    }

    // Get user's cats
    const userCats = await db.getUserCats(user.userId);

    // Get recent activities
    const activities = await db.getUserActivities(user.userId);

    // Calculate stats
    const stats = {
        totalCats: userData.catsPosted || 0,
        totalLikes: userData.totalLikes || 0,
        profileViews: userData.profileViews || 0,
        averageLikes: userData.catsPosted > 0 ?
            ((userData.totalLikes || 0) / userData.catsPosted).toFixed(1) : 0
    };

    const { password: _, ...userWithoutPassword } = userData;

    return jsonResponse({
        user: userWithoutPassword,
        stats,
        recentCats: userCats.slice(0, 10),
        activities: activities.slice(0, 10)
    });
}

async function handleUpdateProfile(request, user, db) {
    try {
        const { bio, location, avatar } = await request.json();
        const updates = {};

        if (bio !== undefined) updates.bio = bio;
        if (location !== undefined) updates.location = location;
        if (avatar !== undefined) updates.avatar = avatar;

        const updatedUser = await db.updateUser(user.userId, updates);
        if (!updatedUser) {
            return errorResponse('User not found', 404);
        }

        const { password: _, ...userWithoutPassword } = updatedUser;

        return jsonResponse({
            message: 'Profile updated successfully',
            user: userWithoutPassword
        });
    } catch (error) {
        console.error('Update profile error:', error);
        return errorResponse('Update failed');
    }
}

async function handleCreateCat(request, user, db, env) {
    try {
        const { name, img, tag, description } = await request.json();

        if (!name || !img) {
            return errorResponse('Name and image URL are required');
        }

        const userData = await db.getUserById(user.userId);
        if (!userData) {
            return errorResponse('User not found', 404);
        }

        const cat = await db.createCat({
            name,
            img,
            tag: tag || 'cute',
            description: description || '',
            owner: user.userId,
            ownerName: userData.username
        });

        // Log activity
        await db.logActivity({
            user: user.userId,
            action: `Added new cat: ${name}`,
            type: 'cat_added',
            details: { catId: cat.id }
        });

        return jsonResponse({
            message: 'Cat added successfully',
            cat
        }, 201);
    } catch (error) {
        console.error('Create cat error:', error);
        return errorResponse('Failed to add cat');
    }
}

async function handleGetCats(request, db) {
    try {
        const cats = await db.getAllCats();
        return jsonResponse(cats);
    } catch (error) {
        console.error('Get cats error:', error);
        return errorResponse('Failed to fetch cats');
    }
}

async function handleGetAllUsers(db) {
    try {
        const users = await db.getAllUsers();
        const stats = await db.getStats();

        return jsonResponse({
            users,
            stats: {
                totalUsers: stats.totalUsers,
                activeUsers: stats.activeUsers,
                newUsersToday: stats.newUsers // Simple approximation
            }
        });
    } catch (error) {
        console.error('Get all users error:', error);
        return errorResponse('Failed to fetch users');
    }
}

async function handleGetStats(db) {
    try {
        const stats = await db.getStats();

        // Simple chart data (last 7 days)
        const userGrowth = [];
        const catUploads = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            // Simplified data - in production you'd query KV for actual counts
            userGrowth.push({ date: dateStr, count: Math.floor(Math.random() * 5) });
            catUploads.push({ date: dateStr, count: Math.floor(Math.random() * 10) });
        }

        return jsonResponse({
            stats,
            charts: {
                userGrowth,
                catUploads
            }
        });
    } catch (error) {
        console.error('Get stats error:', error);
        return errorResponse('Failed to fetch stats');
    }
}

async function handleUpdateUser(request, user, db, env) {
    try {
        const { userId, role, status } = await request.json();

        if (!userId) {
            return errorResponse('User ID is required');
        }

        const userToUpdate = await db.getUserById(userId);
        if (!userToUpdate) {
            return errorResponse('User not found', 404);
        }

        const updates = {};
        if (role) updates.role = role;
        if (status) updates.status = status;

        const updatedUser = await db.updateUser(userId, updates);
        if (!updatedUser) {
            return errorResponse('Failed to update user', 500);
        }

        // Log admin action
        await db.logActivity({
            user: user.userId,
            action: `Admin updated user ${userToUpdate.username}`,
            type: 'admin_action',
            details: { updatedUser: userId, changes: { role, status } }
        });

        const { password: _, ...userWithoutPassword } = updatedUser;
        return jsonResponse({
            message: 'User updated successfully',
            user: userWithoutPassword
        });
    } catch (error) {
        console.error('Update user error:', error);
        return errorResponse('Failed to update user');
    }
}

async function handleDeleteUser(request, user, db, env) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('id');

        if (!userId) {
            return errorResponse('User ID is required');
        }

        const userToDelete = await db.getUserById(userId);
        if (!userToDelete) {
            return errorResponse('User not found', 404);
        }

        // Delete user's cats
        const userCats = await db.getUserCats(userId);
        for (const cat of userCats) {
            await db.catsKV.delete(cat.id);
        }

        // Delete user from KV
        await db.usersKV.delete(userId);
        await db.usersKV.delete(`email:${userToDelete.email}`);
        await db.usersKV.delete(`username:${userToDelete.username}`);
        await db.usersKV.delete(`cats:${userId}`);
        await db.usersKV.delete(`activities:${userId}`);

        // Log admin action
        await db.logActivity({
            user: user.userId,
            action: `Admin deleted user ${userToDelete.username}`,
            type: 'admin_action',
            details: { deletedUser: userId }
        });

        return jsonResponse({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        return errorResponse('Failed to delete user');
    }
}

// ========== STATIC FILES ==========
// For everything else, Cloudflare will serve static files from /public
// This includes /, /index.html, /style.css, etc.

// IMPORTANT: Return fetch(request) to let Cloudflare handle static files
return fetch(request);
