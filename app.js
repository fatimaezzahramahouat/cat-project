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

        /* ================= HELPERS ================= */
        function json(data, status = 200, headers = {}) {
            return new Response(JSON.stringify(data), {
                status,
                headers: {
                    "Content-Type": "application/json",
                    ...corsHeaders,
                    ...headers
                }
            });
        }

        async function hashPassword(password) {
            const data = new TextEncoder().encode(password);
            const hash = await crypto.subtle.digest("SHA-256", data);
            return [...new Uint8Array(hash)]
                .map(b => b.toString(16).padStart(2, "0"))
                .join("");
        }

        function verifyToken(token) {
            try {
                const decoded = JSON.parse(atob(token));
                if (decoded.exp < Date.now()) {
                    return null; // Token expired
                }
                return decoded;
            } catch {
                return null;
            }
        }

        async function authenticate(request) {
            const authHeader = request.headers.get("Authorization");
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                return null;
            }

            const token = authHeader.slice(7);
            return verifyToken(token);
        }

        /* ================= AUTH ENDPOINTS ================= */

        // POST /auth/register - Register new user
        if (pathname === "/auth/register" && method === "POST") {
            try {
                const { username, email, password } = await request.json();

                if (!username || !email || !password) {
                    return json({ error: "All fields required" }, 400);
                }

                if (password.length < 6) {
                    return json({ error: "Password must be at least 6 characters" }, 400);
                }

                const password_hash = await hashPassword(password);

                try {
                    const result = await env.DB.prepare(`
                        INSERT INTO users (username, email, password_hash, role)
                        VALUES (?, ?, ?, ?)
                    `).bind(username, email, password_hash, 'user').run();

                    // Generate token
                    const token = btoa(JSON.stringify({
                        id: result.meta.last_row_id,
                        username,
                        role: 'user',
                        exp: Date.now() + 86400000 // 24 hours
                    }));

                    return json({
                        message: "Account created successfully",
                        token,
                        user: {
                            id: result.meta.last_row_id,
                            username,
                            email,
                            role: 'user'
                        }
                    }, 201);
                } catch (error) {
                    if (error.message.includes("UNIQUE constraint failed")) {
                        return json({ error: "Username or email already exists" }, 409);
                    }
                    throw error;
                }
            } catch (error) {
                console.error("Register error:", error);
                return json({ error: "Registration failed" }, 500);
            }
        }

        // POST /auth/login - Login user
        if (pathname === "/auth/login" && method === "POST") {
            try {
                const { email, password } = await request.json();

                if (!email || !password) {
                    return json({ error: "Email and password required" }, 400);
                }

                const password_hash = await hashPassword(password);

                const user = await env.DB.prepare(`
                    SELECT id, username, email, role
                    FROM users
                    WHERE email = ? AND password_hash = ?
                `).bind(email, password_hash).first();

                if (!user) {
                    return json({ error: "Invalid credentials" }, 401);
                }

                // Generate token
                const token = btoa(JSON.stringify({
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    exp: Date.now() + 86400000 // 24 hours
                }));

                return json({
                    message: "Login successful",
                    token,
                    user
                });
            } catch (error) {
                console.error("Login error:", error);
                return json({ error: "Login failed" }, 500);
            }
        }

        // GET /auth/profile - Get user profile (protected)
        if (pathname === "/auth/profile" && method === "GET") {
            try {
                const user = await authenticate(request);
                if (!user) {
                    return json({ error: "Unauthorized" }, 401);
                }

                const userData = await env.DB.prepare(`
                    SELECT id, username, email, role, created_at
                    FROM users WHERE id = ?
                `).bind(user.id).first();

                return json({
                    message: "Profile retrieved successfully",
                    user: userData
                });
            } catch (error) {
                console.error("Profile error:", error);
                return json({ error: "Failed to get profile" }, 500);
            }
        }

        /* ================= CATS ENDPOINTS (PROTECTED) ================= */

        // Helper to verify cat ownership
        async function verifyCatOwnership(user, catId) {
            if (user.role === 'admin') return true;

            const cat = await env.DB.prepare(`
                SELECT user_id FROM cats WHERE id = ?
            `).bind(catId).first();

            return cat && cat.user_id === user.id;
        }

        // GET /cats - Get all cats (public)
        if (pathname === "/cats" && method === "GET") {
            try {
                const user = await authenticate(request);

                let query = "SELECT * FROM cats";
                let params = [];

                // If user is authenticated, show all cats
                // If not, maybe show only public cats (add is_public column if needed)
                if (user) {
                    // Regular users see all cats
                    if (user.role !== 'admin') {
                        // Optional: Add filtering logic here
                    }
                }

                const { results } = await env.DB.prepare(query).bind(...params).all();
                return json(results);
            } catch (error) {
                console.error("Database error:", error);
                return json({ error: "Database query error" }, 500);
            }
        }

        // GET /my-cats - Get user's cats (protected)
        if (pathname === "/my-cats" && method === "GET") {
            try {
                const user = await authenticate(request);
                if (!user) {
                    return json({ error: "Unauthorized" }, 401);
                }

                let query = "SELECT * FROM cats WHERE user_id = ?";
                const { results } = await env.DB.prepare(query).bind(user.id).all();

                return json(results);
            } catch (error) {
                console.error("Database error:", error);
                return json({ error: "Failed to get user cats" }, 500);
            }
        }

        // GET /cats/:id - Get specific cat (public)
        if (pathname.startsWith("/cats/") && method === "GET" && pathname.split("/").length === 3) {
            try {
                const id = pathname.split("/")[2];
                if (!id || isNaN(id)) {
                    return json({ error: "Invalid ID" }, 400);
                }

                const cat = await env.DB.prepare(`
                    SELECT c.*, u.username as owner_name 
                    FROM cats c 
                    LEFT JOIN users u ON c.user_id = u.id 
                    WHERE c.id = ?
                `).bind(id).first();

                if (!cat) {
                    return json({ error: "Cat not found" }, 404);
                }

                return json(cat);
            } catch (error) {
                console.error("Database error:", error);
                return json({ error: "Database error" }, 500);
            }
        }

        // POST /cats - Add new cat (protected)
        if (pathname === "/cats" && method === "POST") {
            try {
                const user = await authenticate(request);
                if (!user) {
                    return json({ error: "Unauthorized" }, 401);
                }

                const body = await request.json();
                if (!body.name) {
                    return json({ error: "Name is required" }, 400);
                }

                const result = await env.DB.prepare(`
                    INSERT INTO cats (name, tag, description, IMG, user_id) 
                    VALUES (?, ?, ?, ?, ?)
                `).bind(
                    body.name,
                    body.tag || null,
                    body.description || null,
                    body.IMG || null,
                    user.id
                ).run();

                return json({
                    message: "Cat added successfully",
                    id: result.meta.last_row_id
                }, 201);
            } catch (error) {
                console.error("Database error:", error);
                return json({ error: "Failed to add cat" }, 500);
            }
        }

        // PUT /cats/:id - Update cat (protected)
        if (pathname.startsWith("/cats/") && method === "PUT") {
            try {
                const user = await authenticate(request);
                if (!user) {
                    return json({ error: "Unauthorized" }, 401);
                }

                const id = pathname.split("/")[2];
                const body = await request.json();

                // Verify ownership
                const canEdit = await verifyCatOwnership(user, id);
                if (!canEdit) {
                    return json({ error: "You don't have permission to edit this cat" }, 403);
                }

                await env.DB.prepare(`
                    UPDATE cats 
                    SET name = ?, tag = ?, description = ?, IMG = ? 
                    WHERE id = ?
                `).bind(body.name, body.tag, body.description, body.IMG, id).run();

                return json({ message: "Cat updated successfully" });
            } catch (error) {
                console.error("Database error:", error);
                return json({ error: "Failed to update cat" }, 500);
            }
        }

        // DELETE /cats/:id - Delete cat (protected)
        if (pathname.startsWith("/cats/") && method === "DELETE") {
            try {
                const user = await authenticate(request);
                if (!user) {
                    return json({ error: "Unauthorized" }, 401);
                }

                const id = pathname.split("/")[2];

                // Verify ownership
                const canDelete = await verifyCatOwnership(user, id);
                if (!canDelete) {
                    return json({ error: "You don't have permission to delete this cat" }, 403);
                }

                await env.DB.prepare("DELETE FROM cats WHERE id = ?").bind(id).run();

                return json({ message: "Cat deleted successfully" });
            } catch (error) {
                console.error("Database error:", error);
                return json({ error: "Failed to delete cat" }, 500);
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

        // POST /contact - Contact form
        if (pathname === "/contact" && method === "POST") {
            try {
                const { name, email, message } = await request.json();

                if (!name || !email || !message) {
                    return json({ error: "All fields are required" }, 400);
                }

                // Store in contact_messages table
                await env.DB.prepare(`
                    CREATE TABLE IF NOT EXISTS contact_messages (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        email TEXT NOT NULL,
                        message TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `).run();

                const result = await env.DB.prepare(`
                    INSERT INTO contact_messages (name, email, message) 
                    VALUES (?, ?, ?)
                `).bind(name, email, message).run();

                return json({
                    message: "Message sent successfully",
                    id: result.meta.last_row_id
                }, 201);
            } catch (error) {
                console.error("Contact error:", error);
                return json({ error: "Failed to send message" }, 500);
            }
        }

        // GET /stats - Get statistics
        if (pathname === "/stats" && method === "GET") {
            try {
                const [
                    totalCats,
                    totalUsers,
                    recentCats
                ] = await Promise.all([
                    env.DB.prepare("SELECT COUNT(*) as count FROM cats").first(),
                    env.DB.prepare("SELECT COUNT(*) as count FROM users").first(),
                    env.DB.prepare(`
                        SELECT c.*, u.username as owner_name 
                        FROM cats c 
                        LEFT JOIN users u ON c.user_id = u.id 
                        ORDER BY c.created_at DESC 
                        LIMIT 5
                    `).all()
                ]);

                return json({
                    totalCats: totalCats.count,
                    totalUsers: totalUsers.count,
                    recentCats: recentCats.results
                });
            } catch (error) {
                console.error("Stats error:", error);
                return json({ error: "Failed to get statistics" }, 500);
            }
        }

        // ========== STATIC FILES ==========
        // For everything else, Cloudflare will serve static files from /public
        return fetch(request);
    }
};