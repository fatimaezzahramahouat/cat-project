export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const pathname = url.pathname;
        const method = request.method;

        // ===== GET ALL CATS =====
        if (pathname === "/cats" && method === "GET") {
            const { results } = await env.DB.prepare("SELECT * FROM cats").all();
            return Response.json(results);
        }

        // ===== GET CAT BY ID =====
        if (pathname.startsWith("/cats/") && method === "GET") {
            const id = pathname.split("/")[2];
            const { results } = await env.DB
                .prepare("SELECT * FROM cats WHERE id=?")
                .bind(id)
                .all();
            return Response.json(results);
        }

        // ===== DELETE A RECORD =====
        if (pathname.startsWith("/cats/") && method === "DELETE") {
            const id = pathname.split("/")[2];
            await env.DB.prepare("DELETE FROM cats WHERE id=?").bind(id).run();
            return Response.json({ message: `Record Num : ${id} deleted successfully` });
        }

        // ===== ADD A RECORD =====
        if (pathname === "/cats" && method === "POST") {
            const params = await request.json();
            await env.DB
                .prepare("INSERT INTO cats (name, tag, description, IMG) VALUES (?, ?, ?, ?)")
                .bind(params.name, params.tag, params.description, params.IMG)
                .run();
            console.log(params);
            return Response.json({ message: `Record of ${params.name} added successfully` });
        }

        // ===== UPDATE A RECORD =====
        if (pathname.startsWith("/cats/") && method === "PUT") {
            const id = pathname.split("/")[2];
            const { name, tag, description, IMG } = await request.json();
            await env.DB
                .prepare("UPDATE cats SET name=?, tag=?, description=?, IMG=? WHERE id=?")
                .bind(name, tag, description, IMG, id)
                .run();
            return Response.json({ message: `Cat ${id} updated successfully` });
        }

        // ===== GET TAGS =====
        if (pathname === "/tags" && method === "GET") {
            const { results } = await env.DB.prepare(`
        SELECT DISTINCT TRIM(tag) AS tag
        FROM cats
        WHERE tag IS NOT NULL AND tag != '' AND TRIM(tag) != ''
        ORDER BY LOWER(tag) ASC
      `).all();

            const tags = results.map(r => r.tag);
            console.log(`✅ Returning ${tags.length} unique tags`);
            return Response.json(tags);
        }

        return new Response("Not Found", { status: 404 });
    }
};
