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
        

   if (request.method === "POST" && new URL(request.url).pathname === "/register") {
      return register(request, env);
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

        ///AUTH kankhdmo b web crypto api hit worker 

    async function register(request, env) {
  const body = await request.json();
  const { username, email, password } = body;

  if (!username || !email || !password) {
    return Response.json({ message: "All fields required" }, { status: 400 });
  }

  // 🔐 hash password
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const password_hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  try {
    await env.DB.prepare(`
      INSERT INTO users (username, email, password_hash)
      VALUES (?, ?, ?)
    `).bind(username, email, password_hash).run();

    return Response.json({ message: "User registered successfully" });

  } catch (err) {
    return Response.json(
      { message: "Username or email already exists" },
      { status: 400 }
    );
  }
}


  



        // ========== STATIC FILES ==========
        // For everything else, Cloudflare will serve static files from /public
        // This includes /, /index.html, /style.css, etc.

        // IMPORTANT: Return fetch(request) to let Cloudflare handle static files
        return fetch(request);
    }
}; 