import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const pathname = url.pathname;
        const method = request.method;

        // Handle static assets first
        if (method === 'GET' && pathname.startsWith('/public/')) {
            return env.ASSETS.fetch(request);
        }

        // CORS headers
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        };

        // Handle preflight requests
        if (method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        // ========== AUTHENTICATION MIDDLEWARE ==========
        async function authenticate(request) {
            try {
                const cookieHeader = request.headers.get('Cookie');
                if (!cookieHeader) return null;

                // Parse cookies
                const cookies = Object.fromEntries(
                    cookieHeader.split(';').map(cookie => {
                        const [key, ...value] = cookie.trim().split('=');
                        return [key, value.join('=')];
                    })
                );

                const token = cookies.auth_token;
                if (!token) return null;

                // Verify JWT
                const decoded = jwt.verify(token, env.JWT_SECRET);
                return decoded;
            } catch (error) {
                console.error('Authentication error:', error.message);
                return null;
            }
        }

        // ========== AUTHENTICATION ROUTES ==========

        // POST /auth/register - Register new user
        if (pathname === "/auth/register" && method === "POST") {
            try {
                const body = await request.json();
                const { username, email, password } = body;

                // Validation
                if (!username || !email || !password) {
                    return Response.json(
                        { error: "All fields are required" },
                        { status: 400, headers: corsHeaders }
                    );
                }

                // Check if user already exists
                const existingUser = await env.DB.prepare(
                    "SELECT id FROM users WHERE email = ? OR username = ?"
                ).bind(email, username).first();

                if (existingUser) {
                    return Response.json(
                        { error: "Email or username already exists" },
                        { status: 409, headers: corsHeaders }
                    );
                }

                // Hash password
                const hashedPassword = await bcrypt.hash(password, 10);

                // Create user in database
                const result = await env.DB.prepare(
                    "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)"
                ).bind(username, email, hashedPassword, 'user').run();

                return Response.json(
                    {
                        message: "User registered successfully",
                        userId: result.meta.last_row_id
                    },
                    { status: 201, headers: corsHeaders }
                );

            } catch (error) {
                console.error("Registration error:", error);
                return Response.json(
                    { error: "Registration failed. Please try again." },
                    { status: 500, headers: corsHeaders }
                );
            }
        }

        // POST /auth/login - Login user
        if (pathname === "/auth/login" && method === "POST") {
            try {
                const body = await request.json();
                const { email, password } = body;

                // Validation
                if (!email || !password) {
                    return Response.json(
                        { error: "Email and password are required" },
                        { status: 400, headers: corsHeaders }
                    );
                }

                // Get user from database
                const user = await env.DB.prepare(
                    "SELECT id, username, email, password_hash, role FROM users WHERE email = ?"
                ).bind(email).first();

                if (!user) {
                    return Response.json(
                        { error: "Invalid email or password" },
                        { status: 401, headers: corsHeaders }
                    );
                }

                // Verify password
                const passwordValid = await bcrypt.compare(password, user.password_hash);
                if (!passwordValid) {
                    return Response.json(
                        { error: "Invalid email or password" },
                        { status: 401, headers: corsHeaders }
                    );
                }

                // Create JWT token
                const token = jwt.sign(
                    {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        role: user.role
                    },
                    env.JWT_SECRET,
                    { expiresIn: '7d' }
                );

                // Create response with HttpOnly cookie
                const response = Response.json(
                    {
                        message: "Login successful",
                        user: {
                            id: user.id,
                            username: user.username,
                            email: user.email,
                            role: user.role
                        }
                    },
                    { headers: corsHeaders }
                );

                // Set secure HttpOnly cookie
                response.headers.append('Set-Cookie',
                    `auth_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/`
                );

                return response;

            } catch (error) {
                console.error("Login error:", error);
                return Response.json(
                    { error: "Login failed. Please try again." },
                    { status: 500, headers: corsHeaders }
                );
            }
        }

        // POST /auth/logout - Logout user
        if (pathname === "/auth/logout" && method === "POST") {
            const response = Response.json(
                { message: "Logged out successfully" },
                { headers: corsHeaders }
            );

            // Clear the auth cookie
            response.headers.append('Set-Cookie',
                'auth_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/'
            );

            return response;
        }

        // GET /api/me - Get current user info
        if (pathname === "/api/me" && method === "GET") {
            const auth = await authenticate(request);
            if (!auth) {
                return Response.json(
                    { error: "Not authenticated" },
                    { status: 401, headers: corsHeaders }
                );
            }

            return Response.json(
                {
                    id: auth.id,
                    username: auth.username,
                    email: auth.email,
                    role: auth.role
                },
                { headers: corsHeaders }
            );
        }

        // ========== CAT ROUTES ==========

        // GET /cats - Get all cats
        if (pathname === "/cats" && method === "GET") {
            try {
                const { results } = await env.DB.prepare(`
                    SELECT c.*, u.username as owner_name 
                    FROM cats c 
                    LEFT JOIN users u ON c.user_id = u.id 
                    ORDER BY c.created_at DESC
                `).all();
                return Response.json(results, { headers: corsHeaders });
            } catch (error) {
                console.error("Database error:", error);
                return Response.json(
                    { error: "Failed to fetch cats" },
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
                    .prepare(`
                        SELECT c.*, u.username as owner_name 
                        FROM cats c 
                        LEFT JOIN users u ON c.user_id = u.id 
                        WHERE c.id = ?
                    `)
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
            const auth = await authenticate(request);

            if (!auth) {
                return Response.json(
                    { error: "Authentication required" },
                    { status: 401, headers: corsHeaders }
                );
            }

            try {
                const body = await request.json();
                if (!body.name) {
                    return Response.json(
                        { error: "Name is required" },
                        { status: 400, headers: corsHeaders }
                    );
                }

                const result = await env.DB
                    .prepare("INSERT INTO cats (name, tag, description, IMG, user_id) VALUES (?, ?, ?, ?, ?)")
                    .bind(
                        body.name,
                        body.tag || null,
                        body.description || null,
                        body.IMG || null,
                        auth.id  // Link cat to logged-in user
                    )
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
            const auth = await authenticate(request);

            if (!auth) {
                return Response.json(
                    { error: "Authentication required" },
                    { status: 401, headers: corsHeaders }
                );
            }

            try {
                const id = pathname.split("/")[2];
                const body = await request.json();

                // Check if cat exists and belongs to user (or user is admin)
                const cat = await env.DB
                    .prepare("SELECT * FROM cats WHERE id = ?")
                    .bind(id)
                    .first();

                if (!cat) {
                    return Response.json(
                        { error: "Cat not found" },
                        { status: 404, headers: corsHeaders }
                    );
                }

                // Check ownership (admin can edit any cat)
                if (auth.role !== 'admin' && cat.user_id !== auth.id) {
                    return Response.json(
                        { error: "Not authorized to edit this cat" },
                        { status: 403, headers: corsHeaders }
                    );
                }

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
            const auth = await authenticate(request);

            if (!auth) {
                return Response.json(
                    { error: "Authentication required" },
                    { status: 401, headers: corsHeaders }
                );
            }

            try {
                const id = pathname.split("/")[2];

                // Check if cat exists and belongs to user (or user is admin)
                const cat = await env.DB
                    .prepare("SELECT * FROM cats WHERE id = ?")
                    .bind(id)
                    .first();

                if (!cat) {
                    return Response.json(
                        { error: "Cat not found" },
                        { status: 404, headers: corsHeaders }
                    );
                }

                // Check ownership (admin can delete any cat)
                if (auth.role !== 'admin' && cat.user_id !== auth.id) {
                    return Response.json(
                        { error: "Not authorized to delete this cat" },
                        { status: 403, headers: corsHeaders }
                    );
                }

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

        // GET /api/my-cats - Get current user's cats
        if (pathname === "/api/my-cats" && method === "GET") {
            const auth = await authenticate(request);
            if (!auth) {
                return Response.json(
                    { error: "Authentication required" },
                    { status: 401, headers: corsHeaders }
                );
            }

            try {
                const { results } = await env.DB.prepare(`
                    SELECT * FROM cats 
                    WHERE user_id = ? 
                    ORDER BY created_at DESC
                `).bind(auth.id).all();

                return Response.json(results, { headers: corsHeaders });
            } catch (error) {
                console.error("Database error:", error);
                return Response.json(
                    { error: "Failed to fetch your cats" },
                    { status: 500, headers: corsHeaders }
                );
            }
        }

        // GET /api/stats - Get user statistics
        if (pathname === "/api/stats" && method === "GET") {
            const auth = await authenticate(request);
            if (!auth) {
                return Response.json(
                    { error: "Authentication required" },
                    { status: 401, headers: corsHeaders }
                );
            }

            try {
                const catStats = await env.DB.prepare(`
                    SELECT 
                        COUNT(*) as total_cats,
                        COUNT(DISTINCT tag) as unique_tags,
                        COUNT(CASE WHEN IMG IS NOT NULL THEN 1 END) as cats_with_images
                    FROM cats 
                    WHERE user_id = ?
                `).bind(auth.id).first();

                return Response.json(catStats, { headers: corsHeaders });
            } catch (error) {
                console.error("Database error:", error);
                return Response.json(
                    { error: "Failed to fetch stats" },
                    { status: 500, headers: corsHeaders }
                );
            }
        }

        // ========== STATIC FILE SERVING ==========
        // Serve static files from /public directory
        if (method === 'GET') {
            return env.ASSETS.fetch(request);
        }

        // 404 for unknown routes
        return new Response("Not Found", {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "text/plain" }
        });
    }
};