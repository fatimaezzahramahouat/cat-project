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



        // ========== STATIC FILES ==========
        // For everything else, Cloudflare will serve static files from /public
        // This includes /, /index.html, /style.css, etc.

        // IMPORTANT: Return fetch(request) to let Cloudflare handle static files
        return fetch(request);
    }
};