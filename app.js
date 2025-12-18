// app.js - Complete conversion from Express to Cloudflare Workers
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const pathname = url.pathname;
        const method = request.method;

        // Add CORS headers (if needed for frontend)
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        // Handle OPTIONS preflight requests
        if (method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        // ===== GET ALL CATS ===== (Matches: app.get("/cats"))
        if (pathname === "/cats" && method === "GET") {
            try {
                const { results } = await env.DB.prepare("SELECT * FROM cats").all();
                return Response.json(results, { headers: corsHeaders });
            } catch (error) {
                console.error("Database error:", error);
                return Response.json(
                    { error: "Database query error", details: error.message },
                    { status: 500, headers: corsHeaders }
                );
            }
        }

        // ===== GET CAT BY ID ===== (Matches: app.get("/cats/:id"))
        if (pathname.startsWith("/cats/") && method === "GET") {
            try {
                const id = pathname.split("/")[2];
                if (!id || isNaN(id)) {
                    return Response.json(
                        { error: "Invalid ID format" },
                        { status: 400, headers: corsHeaders }
                    );
                }

                const { results } = await env.DB
                    .prepare("SELECT * FROM cats WHERE id = ?")
                    .bind(id)
                    .all();

                if (!results || results.length === 0) {
                    return Response.json(
                        { error: "Cat not found" },
                        { status: 404, headers: corsHeaders }
                    );
                }

                return Response.json(results[0], { headers: corsHeaders });
            } catch (error) {
                console.error("Database error:", error);
                return Response.json(
                    { error: "Database query error", details: error.message },
                    { status: 500, headers: corsHeaders }
                );
            }
        }

        // ===== DELETE A RECORD ===== (Matches: app.delete("/cats/:id"))
        if (pathname.startsWith("/cats/") && method === "DELETE") {
            try {
                const id = pathname.split("/")[2];
                if (!id || isNaN(id)) {
                    return Response.json(
                        { error: "Invalid ID format" },
                        { status: 400, headers: corsHeaders }
                    );
                }

                // Check if exists first
                const check = await env.DB
                    .prepare("SELECT id FROM cats WHERE id = ?")
                    .bind(id)
                    .first();

                if (!check) {
                    return Response.json(
                        { error: "Cat not found" },
                        { status: 404, headers: corsHeaders }
                    );
                }

                await env.DB.prepare("DELETE FROM cats WHERE id = ?").bind(id).run();

                return Response.json(
                    { message: `Record Num: ${id} deleted successfully` },
                    { headers: corsHeaders }
                );
            } catch (error) {
                console.error("Database error:", error);
                return Response.json(
                    { error: "Database deletion error", details: error.message },
                    { status: 500, headers: corsHeaders }
                );
            }
        }

        // ===== ADD A RECORD ===== (Matches: app.post("/cats"))
        if (pathname === "/cats" && method === "POST") {
            try {
                const params = await request.json();

                // Validate required fields
                if (!params.name) {
                    return Response.json(
                        { error: "Name is required" },
                        { status: 400, headers: corsHeaders }
                    );
                }

                const result = await env.DB
                    .prepare("INSERT INTO cats (name, tag, description, IMG) VALUES (?, ?, ?, ?)")
                    .bind(
                        params.name || null,
                        params.tag || null,
                        params.description || null,
                        params.IMG || null
                    )
                    .run();

                console.log("Inserted:", params);

                return Response.json(
                    {
                        message: `Record of ${params.name} added successfully`,
                        id: result.meta.last_row_id
                    },
                    { status: 201, headers: corsHeaders }
                );
            } catch (error) {
                console.error("Database error:", error);
                return Response.json(
                    { error: "Database insertion error", details: error.message },
                    { status: 500, headers: corsHeaders }
                );
            }
        }

        // ===== UPDATE A RECORD ===== (Matches: app.put("/cats/:id"))
        if (pathname.startsWith("/cats/") && method === "PUT") {
            try {
                const id = pathname.split("/")[2];
                if (!id || isNaN(id)) {
                    return Response.json(
                        { error: "Invalid ID format" },
                        { status: 400, headers: corsHeaders }
                    );
                }

                const { name, tag, description, IMG } = await request.json();

                // Check if exists first
                const check = await env.DB
                    .prepare("SELECT id FROM cats WHERE id = ?")
                    .bind(id)
                    .first();

                if (!check) {
                    return Response.json(
                        { error: "Cat not found" },
                        { status: 404, headers: corsHeaders }
                    );
                }

                await env.DB
                    .prepare("UPDATE cats SET name = ?, tag = ?, description = ?, IMG = ? WHERE id = ?")
                    .bind(name, tag, description, IMG, id)
                    .run();

                return Response.json(
                    { message: `Cat ${id} updated successfully` },
                    { headers: corsHeaders }
                );
            } catch (error) {
                console.error("Database error:", error);
                return Response.json(
                    { error: "Database update error", details: error.message },
                    { status: 500, headers: corsHeaders }
                );
            }
        }

        // ===== GET TAGS ===== (Matches: app.get("/tags"))
        if (pathname === "/tags" && method === "GET") {
            try {
                const { results } = await env.DB.prepare(`
                    SELECT DISTINCT TRIM(tag) AS tag
                    FROM cats
                    WHERE tag IS NOT NULL AND tag != '' AND TRIM(tag) != ''
                    ORDER BY LOWER(tag) ASC
                `).all();

                const tags = results.map(r => r.tag);
                console.log(`✅ Returning ${tags.length} unique tags`);

                return Response.json(tags, { headers: corsHeaders });
            } catch (error) {
                console.error("Database error:", error);
                return Response.json(
                    { error: "Failed to fetch tags", details: error.message },
                    { status: 500, headers: corsHeaders }
                );
            }
        }

        // ===== ROOT ROUTE - Show API documentation =====
        if (pathname === "/" && method === "GET") {
            const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Cat API Server (Migrated from Express)</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
        .method { font-weight: bold; padding: 2px 6px; border-radius: 3px; }
        .get { background: #d4edda; color: #155724; }
        .post { background: #d1ecf1; color: #0c5460; }
        .put { background: #fff3cd; color: #856404; }
        .delete { background: #f8d7da; color: #721c24; }
        .status { margin-top: 20px; padding: 10px; background: #e9ecef; }
    </style>
</head>
<body>
    <h1>🐱 Cat API Server (Migrated from Express to Cloudflare Workers)</h1>
    <p>All Express.js routes have been converted to Cloudflare Workers + D1</p>
    
    <h2>Available Endpoints:</h2>
    <div class="endpoint">
        <span class="method get">GET</span> <code>/cats</code> - Get all cats
    </div>
    <div class="endpoint">
        <span class="method get">GET</span> <code>/cats/:id</code> - Get cat by ID
    </div>
    <div class="endpoint">
        <span class="method post">POST</span> <code>/cats</code> - Add new cat (JSON)
    </div>
    <div class="endpoint">
        <span class="method put">PUT</span> <code>/cats/:id</code> - Update cat (JSON)
    </div>
    <div class="endpoint">
        <span class="method delete">DELETE</span> <code>/cats/:id</code> - Delete cat
    </div>
    <div class="endpoint">
        <span class="method get">GET</span> <code>/tags</code> - Get all unique tags
    </div>
    
    <div class="status">
        <h3>Migration Status:</h3>
        <ul>
            <li>✅ Express.js routes converted</li>
            <li>✅ MySQL replaced with Cloudflare D1</li>
            <li>✅ CORS headers added</li>
            <li>✅ Error handling implemented</li>
            <li>✅ Deployed to: ${url.origin}</li>
        </ul>
    </div>
    
    <h3>Test Links:</h3>
    <p><a href="/cats" target="_blank">Test GET /cats</a></p>
    <p><a href="/tags" target="_blank">Test GET /tags</a></p>
</body>
</html>`;
            return new Response(html, {
                headers: { "Content-Type": "text/html; charset=UTF-8" }
            });
        }

        // If no route matches
        return new Response("Not Found", {
            status: 404,
            headers: corsHeaders
        });
    }
};