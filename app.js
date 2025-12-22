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

                console.log('🔐 Registration attempt:', { username, email });

                // ===== VALIDATION =====
                // 1. Check required fields
                if (!username || !email || !password) {
                    return Response.json(
                        { 
                            success: false,
                            error: "All fields are required" 
                        },
                        { status: 400, headers: corsHeaders }
                    );
                }

                // 2. Validate username (3-20 chars, alphanumeric + underscore)
                const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
                if (!usernameRegex.test(username)) {
                    return Response.json(
                        { 
                            success: false,
                            error: "Username must be 3-20 characters and can only contain letters, numbers, and underscores" 
                        },
                        { status: 400, headers: corsHeaders }
                    );
                }

                // 3. Validate email format
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    return Response.json(
                        { 
                            success: false,
                            error: "Please enter a valid email address" 
                        },
                        { status: 400, headers: corsHeaders }
                    );
                }

                // 4. Validate password length
                if (password.length < 6) {
                    return Response.json(
                        { 
                            success: false,
                            error: "Password must be at least 6 characters" 
                        },
                        { status: 400, headers: corsHeaders }
                    );
                }

                // ===== DATABASE OPERATIONS =====
                
                // 1. Check if user already exists
                try {
                    const existingUser = await env.DB.prepare(
                        "SELECT id, username, email FROM users WHERE email = ? OR username = ?"
                    ).bind(email, username).first();

                    if (existingUser) {
                        console.log('❌ User already exists:', existingUser);
                        
                        if (existingUser.email === email) {
                            return Response.json(
                                { 
                                    success: false,
                                    error: "Email already registered" 
                                },
                                { status: 409, headers: corsHeaders }
                            );
                        }
                        
                        if (existingUser.username === username) {
                            return Response.json(
                                { 
                                    success: false,
                                    error: "Username already taken" 
                                },
                                { status: 409, headers: corsHeaders }
                            );
                        }
                    }
                } catch (dbError) {
                    console.error('❌ Database check error:', dbError);
                    return Response.json(
                        { 
                            success: false,
                            error: "Database error while checking existing user" 
                        },
                        { status: 500, headers: corsHeaders }
                    );
                }

                // 2. Hash password
                let hashedPassword;
                try {
                    hashedPassword = await bcrypt.hash(password, 10);
                    console.log('🔑 Password hashed successfully');
                } catch (hashError) {
                    console.error('❌ Password hash error:', hashError);
                    return Response.json(
                        { 
                            success: false,
                            error: "Error processing password" 
                        },
                        { status: 500, headers: corsHeaders }
                    );
                }

                // 3. Create user in database
                try {
                    const result = await env.DB.prepare(
                        "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)"
                    ).bind(
                        username,
                        email,
                        hashedPassword,
                        'user' // Default role
                    ).run();

                    const userId = result.meta.last_row_id;
                    console.log('✅ User created with ID:', userId);

                    // 4. Get the created user to return
                    const newUser = await env.DB.prepare(
                        "SELECT id, username, email, role, created_at FROM users WHERE id = ?"
                    ).bind(userId).first();

                    return Response.json(
                        { 
                            success: true,
                            message: "Account created successfully!",
                            user: {
                                id: newUser.id,
                                username: newUser.username,
                                email: newUser.email,
                                role: newUser.role,
                                createdAt: newUser.created_at
                            }
                        },
                        { status: 201, headers: corsHeaders }
                    );

                } catch (insertError) {
                    console.error('❌ Database insert error:', insertError);
                    return Response.json(
                        { 
                            success: false,
                            error: "Failed to create account. Please try again." 
                        },
                        { status: 500, headers: corsHeaders }
                    );
                }

            } catch (error) {
                console.error("❌ Registration error:", error);
                return Response.json(
                    { 
                        success: false,
                        error: "Registration failed. Please try again." 
                    },
                    { status: 500, headers: corsHeaders }
                );
            }
        }

        // POST /auth/login - Login user
        if (pathname === "/auth/login" && method === "POST") {
            try {
                const body = await request.json();
                const { email, password } = body;

                console.log('🔐 Login attempt for email:', email);

                // Validation
                if (!email || !password) {
                    return Response.json(
                        { 
                            success: false,
                            error: "Email and password are required" 
                        },
                        { status: 400, headers: corsHeaders }
                    );
                }

                // Get user from database
                const user = await env.DB.prepare(
                    "SELECT id, username, email, password_hash, role FROM users WHERE email = ?"
                ).bind(email).first();

                if (!user) {
                    console.log('❌ User not found for email:', email);
                    return Response.json(
                        { 
                            success: false,
                            error: "Invalid email or password" 
                        },
                        { status: 401, headers: corsHeaders }
                    );
                }

                console.log('✅ User found:', user.username);

                // Verify password
                const passwordValid = await bcrypt.compare(password, user.password_hash);
                if (!passwordValid) {
                    console.log('❌ Invalid password for user:', user.username);
                    return Response.json(
                        { 
                            success: false,
                            error: "Invalid email or password" 
                        },
                        { status: 401, headers: corsHeaders }
                    );
                }

                console.log('✅ Password verified for user:', user.username);

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

                console.log('✅ JWT token created for user:', user.username);

                // Create response with HttpOnly cookie
                const response = Response.json(
                    { 
                        success: true,
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

                console.log('✅ Login successful for user:', user.username);
                return response;

            } catch (error) {
                console.error("❌ Login error:", error);
                return Response.json(
                    { 
                        success: false,
                        error: "Login failed. Please try again." 
                    },
                    { status: 500, headers: corsHeaders }
                );
            }
        }

        // POST /auth/logout - Logout user
        if (pathname === "/auth/logout" && method === "POST") {
            const response = Response.json(
                { 
                    success: true,
                    message: "Logged out successfully" 
                },
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
                    { 
                        success: false,
                        error: "Not authenticated" 
                    },
                    { status: 401, headers: corsHeaders }
                );
            }

            return Response.json(
                {
                    success: true,
                    user: {
                        id: auth.id,
                        username: auth.username,
                        email: auth.email,
                        role: auth.role
                    }
                },
                { headers: corsHeaders }
            );
        }

        // ========== CAT ROUTES ==========

        // GET /cats - Get all cats (public)
if (pathname === "/cats" && method === "GET") {
    try {
        console.log('🐱 Fetching all cats...');
        
        // First, let's check if cats table has data
        const countResult = await env.DB.prepare("SELECT COUNT(*) as count FROM cats").first();
        console.log(`📊 Total cats in database: ${countResult?.count || 0}`);
        
        if (countResult?.count === 0) {
            // Database is empty, return empty array
            console.log('📭 Cats table is empty');
            return Response.json([], { headers: corsHeaders });
        }
        
        // Try with LEFT JOIN first
        try {
            const { results } = await env.DB.prepare(`
                SELECT c.*, u.username as owner_name 
                FROM cats c 
                LEFT JOIN users u ON c.user_id = u.id 
                ORDER BY c.created_at DESC
            `).all();
            
            console.log(`✅ Found ${results.length} cats with JOIN`);
            return Response.json(results, { headers: corsHeaders });
            
        } catch (joinError) {
            console.error('❌ JOIN query failed:', joinError.message);
            
            // If JOIN fails, try simple SELECT without JOIN
            try {
                const { results } = await env.DB.prepare(`
                    SELECT * FROM cats 
                    ORDER BY created_at DESC
                `).all();
                
                console.log(`✅ Found ${results.length} cats (simple query)`);
                return Response.json(results, { headers: corsHeaders });
                
            } catch (simpleError) {
                console.error('❌ Simple query also failed:', simpleError.message);
                return Response.json([], { headers: corsHeaders });
            }
        }
        
    } catch (error) {
        console.error("❌ Database error:", error);
        
        // Return empty array instead of error
        return Response.json([], { headers: corsHeaders });
    }
}

        // PUT /cats/:id - Update cat (protected)
        if (pathname.match(/^\/cats\/\d+$/) && method === "PUT") {
            const auth = await authenticate(request);
            if (!auth) {
                return Response.json(
                    { error: "Authentication required" },
                    { status: 401, headers: corsHeaders }
                );
            }

            try {
                const id = pathname.split('/')[2];
                const body = await request.json();

                // Check if cat exists and user owns it
                const cat = await env.DB.prepare(
                    "SELECT * FROM cats WHERE id = ?"
                ).bind(id).first();

                if (!cat) {
                    return Response.json(
                        { error: "Cat not found" },
                        { status: 404, headers: corsHeaders }
                    );
                }

                // Check ownership (admin can edit any)
                if (auth.role !== 'admin' && cat.user_id !== auth.id) {
                    return Response.json(
                        { error: "Not authorized to edit this cat" },
                        { status: 403, headers: corsHeaders }
                    );
                }

                // Update cat
                await env.DB.prepare(`
                    UPDATE cats 
                    SET name = ?, tag = ?, description = ?, IMG = ? 
                    WHERE id = ?
                `).bind(
                    body.name || cat.name,
                    body.tag !== undefined ? body.tag : cat.tag,
                    body.description !== undefined ? body.description : cat.description,
                    body.IMG !== undefined ? body.IMG : cat.IMG,
                    id
                ).run();

                // Get updated cat
                const updatedCat = await env.DB.prepare(`
                    SELECT c.*, u.username as owner_name 
                    FROM cats c 
                    LEFT JOIN users u ON c.user_id = u.id 
                    WHERE c.id = ?
                `).bind(id).first();

                return Response.json(
                    {
                        message: "Cat updated successfully",
                        cat: updatedCat
                    },
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

        // DELETE /cats/:id - Delete cat (protected)
        if (pathname.match(/^\/cats\/\d+$/) && method === "DELETE") {
            const auth = await authenticate(request);
            if (!auth) {
                return Response.json(
                    { error: "Authentication required" },
                    { status: 401, headers: corsHeaders }
                );
            }

            try {
                const id = pathname.split('/')[2];

                // Check if cat exists and user owns it
                const cat = await env.DB.prepare(
                    "SELECT * FROM cats WHERE id = ?"
                ).bind(id).first();

                if (!cat) {
                    return Response.json(
                        { error: "Cat not found" },
                        { status: 404, headers: corsHeaders }
                    );
                }

                // Check ownership (admin can delete any)
                if (auth.role !== 'admin' && cat.user_id !== auth.id) {
                    return Response.json(
                        { error: "Not authorized to delete this cat" },
                        { status: 403, headers: corsHeaders }
                    );
                }

                // Delete cat
                await env.DB.prepare(
                    "DELETE FROM cats WHERE id = ?"
                ).bind(id).run();

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

        // ========== USER-SPECIFIC ROUTES ==========

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

        // ========== TAG ROUTES ==========

        // GET /tags - Get all unique tags
        // GET /tags - Get all unique tags
if (pathname === "/tags" && method === "GET") {
    try {
        // First check if cats table exists and has data
        const countResult = await env.DB.prepare("SELECT COUNT(*) as count FROM cats").first();
        
        if (countResult?.count === 0) {
            return Response.json([], { headers: corsHeaders });
        }
        
        const { results } = await env.DB.prepare(`
            SELECT DISTINCT TRIM(tag) as tag 
            FROM cats 
            WHERE tag IS NOT NULL 
            AND tag != '' 
            AND TRIM(tag) != ''
            ORDER BY tag ASC
        `).all();

        const tags = results.map(r => r.tag).filter(tag => tag);
        return Response.json(tags, { headers: corsHeaders });
    } catch (error) {
        console.error("Database error:", error);
        return Response.json([], { headers: corsHeaders });
    }
}

        // ========== HEALTH CHECK ROUTES ==========

        // GET /health - Health check endpoint
        if (pathname === "/health" && method === "GET") {
            try {
                // Test database connection
                await env.DB.prepare("SELECT 1").first();
                
                return Response.json(
                    { 
                        status: "healthy",
                        database: "connected",
                        timestamp: new Date().toISOString()
                    },
                    { headers: corsHeaders }
                );
            } catch (error) {
                console.error("Health check failed:", error);
                return Response.json(
                    { 
                        status: "unhealthy",
                        database: "disconnected",
                        error: error.message 
                    },
                    { status: 500, headers: corsHeaders }
                );
            }
        }

        // GET /api/users/check - Check if username/email exists (for real-time validation)
        if (pathname === "/api/users/check" && method === "GET") {
            try {
                const searchParams = url.searchParams;
                const username = searchParams.get('username');
                const email = searchParams.get('email');
                
                if (!username && !email) {
                    return Response.json(
                        { 
                            success: false,
                            error: "Provide username or email to check" 
                        },
                        { status: 400, headers: corsHeaders }
                    );
                }

                let query = "SELECT username, email FROM users WHERE ";
                const params = [];
                
                if (username) {
                    query += "username = ?";
                    params.push(username);
                }
                
                if (email) {
                    if (username) query += " OR ";
                    query += "email = ?";
                    params.push(email);
                }
                
                const { results } = await env.DB.prepare(query).bind(...params).all();
                
                return Response.json(
                    { 
                        success: true,
                        exists: results.length > 0,
                        matches: results
                    },
                    { headers: corsHeaders }
                );
            } catch (error) {
                console.error("Check users error:", error);
                return Response.json(
                    { 
                        success: false,
                        error: "Failed to check users" 
                    },
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