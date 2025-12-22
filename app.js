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

        // ========== MIDDLEWARE دايركت ==========
        async function authenticate(request) {
            try {
                const cookieHeader = request.headers.get('Cookie');
                if (!cookieHeader) return null;
                
                const cookies = Object.fromEntries(
                    cookieHeader.split(';').map(cookie => {
                        const [key, ...value] = cookie.trim().split('=');
                        return [key, value.join('=')];
                    })
                );
                
                const token = cookies.auth_token;
                if (!token) return null;
                
                const decoded = jwt.verify(token, env.JWT_SECRET);
                return decoded;
            } catch (error) {
                console.error('Authentication error:', error.message);
                return null;
            }
        }

        // ========== AUTH ROUTES ==========

        // POST /auth/register - تسجيل حساب جديد
        if (pathname === "/auth/register" && method === "POST") {
            try {
                const body = await request.json();
                const { username, email, password } = body;

                // تحقق من المدخلات
                if (!username || !email || !password) {
                    return Response.json(
                        { error: "المرجو إدخال جميع المعلومات" },
                        { status: 400, headers: corsHeaders }
                    );
                }

                // تحقق إذا كان المستخدم موجود
                const existingUser = await env.DB.prepare(
                    "SELECT id FROM users WHERE email = ? OR username = ?"
                ).bind(email, username).first();

                if (existingUser) {
                    return Response.json(
                        { error: "البريد الإلكتروني أو اسم المستخدم موجود مسبقاً" },
                        { status: 409, headers: corsHeaders }
                    );
                }

                // تشفير الباسوورد
                const hashedPassword = await bcrypt.hash(password, 10);

                // إدخال المستخدم في قاعدة البيانات
                const result = await env.DB.prepare(
                    "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)"
                ).bind(username, email, hashedPassword).run();

                return Response.json(
                    { 
                        success: true,
                        message: "تم إنشاء الحساب بنجاح",
                        userId: result.meta.last_row_id 
                    },
                    { status: 201, headers: corsHeaders }
                );

            } catch (error) {
                console.error("Registration error:", error);
                return Response.json(
                    { error: "حدث خطأ أثناء إنشاء الحساب" },
                    { status: 500, headers: corsHeaders }
                );
            }
        }

        // POST /auth/login - تسجيل الدخول
        if (pathname === "/auth/login" && method === "POST") {
            try {
                const body = await request.json();
                const { email, password } = body;

                if (!email || !password) {
                    return Response.json(
                        { error: "المرجو إدخال البريد الإلكتروني وكلمة المرور" },
                        { status: 400, headers: corsHeaders }
                    );
                }

                // البحث عن المستخدم
                const user = await env.DB.prepare(
                    "SELECT id, username, email, password_hash, role FROM users WHERE email = ?"
                ).bind(email).first();

                if (!user) {
                    return Response.json(
                        { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" },
                        { status: 401, headers: corsHeaders }
                    );
                }

                // التحقق من الباسوورد
                const passwordValid = await bcrypt.compare(password, user.password_hash);
                if (!passwordValid) {
                    return Response.json(
                        { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" },
                        { status: 401, headers: corsHeaders }
                    );
                }

                // إنشاء JWT token
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

                // إنشاء الرد مع cookie
                const response = Response.json(
                    { 
                        success: true,
                        message: "تم تسجيل الدخول بنجاح",
                        user: {
                            id: user.id,
                            username: user.username,
                            email: user.email
                        }
                    },
                    { headers: corsHeaders }
                );

                // إضافة Cookie آمنة
                response.headers.append('Set-Cookie', 
                    `auth_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/`
                );

                return response;

            } catch (error) {
                console.error("Login error:", error);
                return Response.json(
                    { error: "حدث خطأ أثناء تسجيل الدخول" },
                    { status: 500, headers: corsHeaders }
                );
            }
        }

        // POST /auth/logout - تسجيل الخروج
        if (pathname === "/auth/logout" && method === "POST") {
            const response = Response.json(
                { 
                    success: true,
                    message: "تم تسجيل الخروج بنجاح" 
                },
                { headers: corsHeaders }
            );
            
            // حذف الـ Cookie
            response.headers.append('Set-Cookie',
                'auth_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/'
            );
            
            return response;
        }

        // GET /api/me - الحصول على معلومات المستخدم الحالي
        if (pathname === "/api/me" && method === "GET") {
            const auth = await authenticate(request);
            if (!auth) {
                return Response.json(
                    { error: "غير مصرح" },
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

        // GET /dashboard - لوحة التحكم (محمية)
        if (pathname === "/dashboard" && method === "GET") {
            const auth = await authenticate(request);
            if (!auth) {
                return Response.json(
                    { error: "المرجو تسجيل الدخول للوصول للوحة التحكم" },
                    { status: 401, headers: corsHeaders }
                );
            }

            // الحصول على معلومات المستخدم وقططه
            const userCats = await env.DB.prepare(`
                SELECT * FROM cats WHERE user_id = ? ORDER BY created_at DESC
            `).bind(auth.id).all();

            return Response.json(
                {
                    success: true,
                    user: {
                        id: auth.id,
                        username: auth.username,
                        email: auth.email
                    },
                    cats: userCats.results || []
                },
                { headers: corsHeaders }
            );
        }

        // ========== PUBLIC ROUTES ==========

        // GET /cats - عرض جميع القطط (عام)
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
                    { error: "حدث خطأ في جلب القطط" },
                    { status: 500, headers: corsHeaders }
                );
            }
        }

        // POST /cats - إضافة قط جديد (محمي)
        if (pathname === "/cats" && method === "POST") {
            const auth = await authenticate(request);
            if (!auth) {
                return Response.json(
                    { error: "المرجو تسجيل الدخول لإضافة قط" },
                    { status: 401, headers: corsHeaders }
                );
            }

            try {
                const body = await request.json();
                if (!body.name) {
                    return Response.json(
                        { error: "المرجو إدخال اسم القط" },
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
                        auth.id
                    )
                    .run();

                return Response.json(
                    {
                        success: true,
                        message: "تم إضافة القط بنجاح",
                        id: result.meta.last_row_id
                    },
                    { status: 201, headers: corsHeaders }
                );
            } catch (error) {
                console.error("Database error:", error);
                return Response.json(
                    { error: "حدث خطأ أثناء إضافة القط" },
                    { status: 500, headers: corsHeaders }
                );
            }
        }

        // ========== STATIC FILES ==========
        // تقديم الملفات الثابتة
        if (method === 'GET') {
            return env.ASSETS.fetch(request);
        }

        // 404 للرابط غير موجود
        return new Response("Not Found", { 
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "text/plain" }
        });
    }
};