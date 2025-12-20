export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const pathname = url.pathname;
        const method = request.method;

        // CORS headers
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        };

        // Handle preflight
        if (method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        // Helper functions
        function json(data, status = 200) {
            return new Response(JSON.stringify(data), {
                status,
                headers: {
                    "Content-Type": "application/json",
                    ...corsHeaders
                }
            });
        }

        async function hashPassword(password) {
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hash = await crypto.subtle.digest("SHA-256", data);
            return Array.from(new Uint8Array(hash))
                .map(b => b.toString(16).padStart(2, "0"))
                .join("");
        }

        function generateToken(user) {
            const payload = {
                id: user.id,
                username: user.username,
                role: user.role,
                exp: Date.now() + 86400000 // 24 hours
            };
            return btoa(JSON.stringify(payload));
        }

        function verifyToken(token) {
            try {
                const decoded = JSON.parse(atob(token));
                if (decoded.exp < Date.now()) return null;
                return decoded;
            } catch {
                return null;
            }
        }

        async function authenticate(request) {
            const authHeader = request.headers.get("Authorization");
            if (!authHeader?.startsWith("Bearer ")) return null;

            const token = authHeader.slice(7);
            return verifyToken(token);
        }

        // ================= AUTH ENDPOINTS =================

        // POST /auth/register
        if (pathname === "/auth/register" && method === "POST") {
            try {
                const data = await request.json();
                const { username, email, password } = data;

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

                    const user = await env.DB.prepare(`
                        SELECT id, username, email, role, created_at 
                        FROM users WHERE id = ?
                    `).bind(result.meta.last_row_id).first();

                    const token = generateToken(user);

                    return json({
                        message: "Account created successfully",
                        token,
                        user
                    }, 201);

                } catch (error) {
                    if (error.message.includes("UNIQUE")) {
                        return json({ error: "Username or email already exists" }, 409);
                    }
                    return json({ error: "Registration failed" }, 500);
                }
            } catch (error) {
                console.error("Register error:", error);
                return json({ error: "Registration failed" }, 500);
            }
        }

        // POST /auth/login
        if (pathname === "/auth/login" && method === "POST") {
            try {
                const data = await request.json();
                const { email, password } = data;

                if (!email || !password) {
                    return json({ error: "Email and password required" }, 400);
                }

                const password_hash = await hashPassword(password);

                const user = await env.DB.prepare(`
                    SELECT id, username, email, role, password_hash, created_at
                    FROM users WHERE email = ?
                `).bind(email).first();

                if (!user) {
                    return json({ error: "Invalid credentials" }, 401);
                }

                // Verify password
                const inputHash = await hashPassword(password);
                if (inputHash !== user.password_hash) {
                    return json({ error: "Invalid credentials" }, 401);
                }

                // Remove password hash from response
                const { password_hash: _, ...userWithoutPassword } = user;

                const token = generateToken(userWithoutPassword);

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

        // ================= CAT ENDPOINTS =================

        // GET /cats - Get all cats (public)
        if (pathname === "/cats" && method === "GET") {
            try {
                const cats = await env.DB.prepare(`
                    SELECT c.*, u.username as owner_name 
                    FROM cats c 
                    LEFT JOIN users u ON c.user_id = u.id 
                    ORDER BY c.created_at DESC
                `).all();

                if (!cats.results) {
                    return json([]);
                }

                return json(cats.results);
            } catch (error) {
                console.error("Get cats error:", error);
                return json({ error: "Failed to get cats" }, 500);
            }
        }

        // GET /my-cats - Get user's cats (protected)
        if (pathname === "/my-cats" && method === "GET") {
            const user = await authenticate(request);
            if (!user) return json({ error: "Unauthorized" }, 401);

            try {
                const cats = await env.DB.prepare(`
                    SELECT * FROM cats 
                    WHERE user_id = ? 
                    ORDER BY created_at DESC
                `).bind(user.id).all();

                if (!cats.results) {
                    return json([]);
                }

                return json(cats.results);
            } catch (error) {
                console.error("Get my cats error:", error);
                return json({ error: "Failed to get your cats" }, 500);
            }
        }

        // GET /cats/:id - Get specific cat
        if (pathname.startsWith("/cats/") && method === "GET") {
            const id = pathname.split("/")[2];
            if (!id || isNaN(id)) {
                return json({ error: "Invalid ID" }, 400);
            }

            try {
                const cat = await env.DB.prepare(`
                    SELECT c.*, u.username as owner_name 
                    FROM cats c 
                    LEFT JOIN users u ON c.user_id = u.id 
                    WHERE c.id = ?
                `).bind(id).first();

                if (!cat) return json({ error: "Cat not found" }, 404);
                return json(cat);
            } catch (error) {
                console.error("Get cat error:", error);
                return json({ error: "Failed to get cat" }, 500);
            }
        }

        // POST /cats - Add new cat (protected)
        if (pathname === "/cats" && method === "POST") {
            const user = await authenticate(request);
            if (!user) return json({ error: "Unauthorized" }, 401);

            try {
                const data = await request.json();
                const { name, tag, description, IMG } = data;

                if (!name?.trim()) {
                    return json({ error: "Cat name is required" }, 400);
                }

                const result = await env.DB.prepare(`
                    INSERT INTO cats (name, tag, description, IMG, user_id) 
                    VALUES (?, ?, ?, ?, ?)
                `).bind(
                    name.trim(),
                    tag?.trim() || null,
                    description?.trim() || null,
                    IMG?.trim() || null,
                    user.id
                ).run();

                const cat = await env.DB.prepare(`
                    SELECT c.*, u.username as owner_name 
                    FROM cats c 
                    LEFT JOIN users u ON c.user_id = u.id 
                    WHERE c.id = ?
                `).bind(result.meta.last_row_id).first();

                return json({
                    message: "Cat added successfully",
                    cat
                }, 201);

            } catch (error) {
                console.error("Add cat error:", error);
                return json({ error: "Failed to add cat" }, 500);
            }
        }

        // PUT /cats/:id - Update cat (protected)
        if (pathname.startsWith("/cats/") && method === "PUT") {
            const user = await authenticate(request);
            if (!user) return json({ error: "Unauthorized" }, 401);

            const id = pathname.split("/")[2];
            if (!id || isNaN(id)) {
                return json({ error: "Invalid ID" }, 400);
            }

            try {
                // Check ownership
                const cat = await env.DB.prepare(
                    "SELECT user_id FROM cats WHERE id = ?"
                ).bind(id).first();

                if (!cat) return json({ error: "Cat not found" }, 404);
                if (user.role !== 'admin' && cat.user_id !== user.id) {
                    return json({ error: "Not authorized to edit this cat" }, 403);
                }

                const data = await request.json();
                const { name, tag, description, IMG } = data;

                if (!name?.trim()) {
                    return json({ error: "Cat name is required" }, 400);
                }

                await env.DB.prepare(`
                    UPDATE cats 
                    SET name = ?, tag = ?, description = ?, IMG = ? 
                    WHERE id = ?
                `).bind(
                    name.trim(),
                    tag?.trim() || null,
                    description?.trim() || null,
                    IMG?.trim() || null,
                    id
                ).run();

                return json({ message: "Cat updated successfully" });

            } catch (error) {
                console.error("Update cat error:", error);
                return json({ error: "Failed to update cat" }, 500);
            }
        }

        // DELETE /cats/:id - Delete cat (protected)
        if (pathname.startsWith("/cats/") && method === "DELETE") {
            const user = await authenticate(request);
            if (!user) return json({ error: "Unauthorized" }, 401);

            const id = pathname.split("/")[2];
            if (!id || isNaN(id)) {
                return json({ error: "Invalid ID" }, 400);
            }

            try {
                // Check ownership
                const cat = await env.DB.prepare(
                    "SELECT user_id FROM cats WHERE id = ?"
                ).bind(id).first();

                if (!cat) return json({ error: "Cat not found" }, 404);
                if (user.role !== 'admin' && cat.user_id !== user.id) {
                    return json({ error: "Not authorized to delete this cat" }, 403);
                }

                await env.DB.prepare(
                    "DELETE FROM cats WHERE id = ?"
                ).bind(id).run();

                return json({ message: "Cat deleted successfully" });

            } catch (error) {
                console.error("Delete cat error:", error);
                return json({ error: "Failed to delete cat" }, 500);
            }
        }

        // GET /tags - Get all unique tags
        if (pathname === "/tags" && method === "GET") {
            try {
                const tags = await env.DB.prepare(`
                    SELECT DISTINCT TRIM(tag) as tag 
                    FROM cats 
                    WHERE tag IS NOT NULL AND tag != '' 
                    ORDER BY tag ASC
                `).all();

                if (!tags.results) {
                    return json([]);
                }

                const tagList = tags.results.map(r => r.tag).filter(tag => tag);
                return json(tagList);
            } catch (error) {
                console.error("Get tags error:", error);
                return json({ error: "Failed to get tags" }, 500);
            }
        }

        // POST /contact - Contact form
        if (pathname === "/contact" && method === "POST") {
            try {
                const data = await request.json();
                const { name, email, message } = data;

                if (!name || !email || !message) {
                    return json({ error: "All fields are required" }, 400);
                }

                // Create table if not exists
                await env.DB.prepare(`
                    CREATE TABLE IF NOT EXISTS contact_messages (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        email TEXT NOT NULL,
                        message TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `).run();

                await env.DB.prepare(`
                    INSERT INTO contact_messages (name, email, message) 
                    VALUES (?, ?, ?)
                `).bind(name, email, message).run();

                return json({ message: "Message sent successfully" }, 201);

            } catch (error) {
                console.error("Contact error:", error);
                return json({ error: "Failed to send message" }, 500);
            }
        }

        // GET /health - Health check
        if (pathname === "/health" && method === "GET") {
            try {
                // Test database connection
                await env.DB.prepare("SELECT 1").first();
                return json({
                    status: "ok",
                    timestamp: new Date().toISOString(),
                    database: "connected"
                });
            } catch (error) {
                return json({
                    status: "error",
                    timestamp: new Date().toISOString(),
                    error: error.message
                }, 500);
            }
        }

        // ================= STATIC FILES =================
        // For everything else, serve static files
        return fetch(request);
    }
};