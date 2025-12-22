import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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

        // ========== AUTH MIDDLEWARE ==========
        async function authenticate(request) {
            const cookieHeader = request.headers.get('Cookie');
            if (!cookieHeader) return null;

            const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
                const [key, value] = cookie.trim().split('=');
                acc[key] = value;
                return acc;
            }, {});

            const token = cookies.auth_token;
            if (!token) return null;

            try {
                const decoded = jwt.verify(token, env.JWT_SECRET);
                return decoded;
            } catch (error) {
                console.error('JWT verification failed:', error);
                return null;
            }
        }

        // ========== AUTH ROUTES ==========

        // POST /auth/register - Register new user
        if (pathname === "/auth/register" && method === "POST") {
            try {
                const body = await request.json();
                const { username, email, password } = body;

                // Validate input
                if (!username || !email || !password) {
                    return Response.json(
                        { error: "All fields are required" },
                        { status: 400, headers: corsHeaders }
                    );
                }

                // Check if user exists
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

                // Create user
                const result = await env.DB.prepare(
                    "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)"
                ).bind(username, email, hashedPassword).run();

                return Response.json(
                    { message: "User registered successfully" },
                    { status: 201, headers: corsHeaders }
                );
            } catch (error) {
                console.error("Registration error:", error);
                return Response.json(
                    { error: "Registration failed" },
                    { status: 500, headers: corsHeaders }
                );
            }
        }

        // POST /auth/login - Login user
        if (pathname === "/auth/login" && method === "POST") {
            try {
                const body = await request.json();
                const { email, password } = body;

                // Get user from database
                const user = await env.DB.prepare(
                    "SELECT id, username, email, password_hash, role FROM users WHERE email = ?"
                ).bind(email).first();

                if (!user) {
                    return Response.json(
                        { error: "Invalid credentials" },
                        { status: 401, headers: corsHeaders }
                    );
                }

                // Verify password
                const passwordValid = await bcrypt.compare(password, user.password_hash);
                if (!passwordValid) {
                    return Response.json(
                        { error: "Invalid credentials" },
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

                // Set HttpOnly cookie
                response.headers.append('Set-Cookie',
                    `auth_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/`
                );

                return response;
            } catch (error) {
                console.error("Login error:", error);
                return Response.json(
                    { error: "Login failed" },
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

        // ========== PROTECTED CAT ROUTES ==========

        // GET /cats - Get all cats (public)
        if (pathname === "/cats" && method === "GET") {
            try {
                const { results } = await env.DB.prepare(`
                    SELECT c.*, u.username 
                    FROM cats c 
                    LEFT JOIN users u ON c.user_id = u.id 
                    ORDER BY c.created_at DESC
                `).all();
                return Response.json(results, { headers: corsHeaders });
            } catch (error) {
                console.error("Database error:", error);
                return Response.json(
                    { error: "Database query error" },
                    { status: 500, headers: corsHeaders }
                );
            }
        }

        // POST /cats - Add new cat (requires auth)
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
                    .prepare(`
                        INSERT INTO cats (name, tag, description, IMG, user_id) 
                        VALUES (?, ?, ?, ?, ?)
                    `)
                    .bind(
                        body.name,
                        body.tag || null,
                        body.description || null,
                        body.IMG || null,
                        auth.id
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

        // PUT /cats/:id - Update cat (requires auth & ownership)
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

                // Check ownership
                const cat = await env.DB
                    .prepare("SELECT user_id FROM cats WHERE id = ?")
                    .bind(id)
                    .first();

                if (!cat) {
                    return Response.json(
                        { error: "Cat not found" },
                        { status: 404, headers: corsHeaders }
                    );
                }

                // Admin can edit any cat, users can only edit their own
                if (auth.role !== 'admin' && cat.user_id !== auth.id) {
                    return Response.json(
                        { error: "Not authorized to edit this cat" },
                        { status: 403, headers: corsHeaders }
                    );
                }

                await env.DB
                    .prepare(`
                        UPDATE cats 
                        SET name = ?, tag = ?, description = ?, IMG = ? 
                        WHERE id = ?
                    `)
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

        // DELETE /cats/:id - Delete cat (requires auth & ownership)
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

                // Check ownership
                const cat = await env.DB
                    .prepare("SELECT user_id FROM cats WHERE id = ?")
                    .bind(id)
                    .first();

                if (!cat) {
                    return Response.json(
                        { error: "Cat not found" },
                        { status: 404, headers: corsHeaders }
                    );
                }

                // Admin can delete any cat, users can only delete their own
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

        // ========== USER DASHBOARD ROUTES ==========

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
                const { results } = await env.DB
                    .prepare("SELECT * FROM cats WHERE user_id = ? ORDER BY created_at DESC")
                    .bind(auth.id)
                    .all();

                return Response.json(results, { headers: corsHeaders });
            } catch (error) {
                console.error("Database error:", error);
                return Response.json(
                    { error: "Failed to get your cats" },
                    { status: 500, headers: corsHeaders }
                );
            }
        }

        // Static files fallback
        return fetch(request);
    }
};