import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
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


        if (url.pathname === "/register" && req.method === "POST") {
      return register(req, env);
    }

    if (url.pathname === "/login" && req.method === "POST") {
      return login(req, env);
    }

    if (url.pathname === "/dashboard" && req.method === "GET") {
      return dashboard(req, env);
    }

    if (url.pathname === "/logout") {
      return logout();
    }

    return new Response("Not Found", { status: 404 });
  
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
async function register(req, env) {
  const { email, password } = await req.json();
  const hashed = await bcrypt.hash(password, 10);

  await env.DB.prepare(
    "INSERT INTO users (email, password) VALUES (?, ?)"
  ).bind(email, hashed).run();

  return new Response("User created");
}
async function login(req, env) {
  const { email, password } = await req.json();

  const user = await env.DB.prepare(
    "SELECT * FROM users WHERE email = ?"
  ).bind(email).first();

  if (!user) return new Response("Invalid email", { status: 401 });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return new Response("Wrong password", { status: 401 });

  const token = jwt.sign(
    { id: user.id },
    env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  return new Response("Login success", {
    headers: {
      "Set-Cookie": `token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/`
    }
  });
}
function verifyToken(req, env) {
  const cookie = req.headers.get("Cookie");
  if (!cookie) return null;

  const token = cookie.split("token=")[1];
  if (!token) return null;

  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch {
    return null;
  }
}
async function dashboard(req, env) {
  const user = verifyToken(req, env);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  return new Response(`Welcome user ${user.id}`);
}
function logout() {
  return new Response("Logged out", {
    headers: {
      "Set-Cookie": "token=; HttpOnly; Secure; Max-Age=0; Path=/"
    }
  });
}




        // ========== STATIC FILES ==========
        // For everything else, Cloudflare will serve static files from /public
        // This includes /, /index.html, /style.css, etc.

        // IMPORTANT: Return fetch(request) to let Cloudflare handle static files
        return fetch(request);
    }
};