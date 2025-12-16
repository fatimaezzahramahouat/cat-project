const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");

const app = express();
const port = process.env.PORT || 5000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(express.static("public"));

// == Mysql ==
const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "nodejsp",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// Get cats
app.get("/cats", (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) {
            console.error("DB connection error:", err);
            return res.status(500).json({ error: "DB connection error" });
        }
        connection.query("SELECT * FROM cats", (qErr, rows) => {
            connection.release();
            if (qErr) {
                console.error("Query error:", qErr);
                return res.status(500).json({ error: "Query error" });
            }
            res.json(rows);
        });
    });
});

// Get cats by id
app.get("/cats/:id", (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) {
            console.error("DB connection error:", err);
            return res.status(500).json({ error: "DB connection error" });
        }
        connection.query("SELECT * FROM cats where id = ?", [req.params.id], (qErr, rows) => {
            // const sql = "SELECT * FROM cats WHERE id = " + req.params.id;
            // SELECT * FROM cats WHERE id = '5; DROP TABLE cats;'
            connection.release();
            if (qErr) {
                console.error("Query error:", qErr);
                return res.status(500).json({ error: "Query error" });
            }
            res.json(rows);
        });
    });
});

// Delete a record
app.delete("/cats/:id", (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) {
            console.error("DB connection error:", err);
            return res.status(500).json({ error: "DB connection error" });
        }
        connection.query("DELETE FROM cats where id = ?", [req.params.id], (qErr, rows) => {
            connection.release();
            if (qErr) {
                console.error("Query error:", qErr);
                return res.status(500).json({ error: "Query error" });
            }
            res.json({ message: `Record Num : ${req.params.id} deleted successfully` });
        });
    });
});


// Add a record
app.post("/cats", (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) {
            console.error("DB connection error:", err);
            return res.status(500).json({ error: "DB connection error" });
        }
        const params = req.body
        connection.query("INSERT INTO cats SET ?", params, (qErr, rows) => {
            // connection.query("INSERT INTO cats (name, age, color) VALUES (?, ?, ?)",
            // [req.body.name, req.body.age, req.body.color],
            connection.release();
            if (qErr) {
                console.error("Query error:", qErr);
                return res.status(500).json({ error: "Query error" });
            }
            res.json({ message: `Record of ${params.name} added successfully` });
        });

        console.log(params)
    });
});

// Update a record

app.put("/cats/:id", (req, res) => {
    const id = req.params.id;
    const { name, tag, description, IMG } = req.body;

    pool.getConnection((err, connection) => {
        if (err) return res.status(500).json({ error: "DB connection error" });

        const sql = "UPDATE cats SET name = ?, tag = ?, description = ?, IMG = ? WHERE id = ?";
        connection.query(sql, [name, tag, description, IMG, id], (qErr, rows) => {
            connection.release();
            if (qErr) return res.status(500).json({ error: "Query error" });
            res.json({ message: `Cat ${id} updated successfully` });
        });
    });
});

// tags
// server.js - Enhanced with better error handling
app.get("/tags", (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Database connection error:", err);
            return res.status(500).json({
                error: "Database connection failed",
                details: err.message
            });
        }

        // Improved query with trimming and sorting
        const query = `
            SELECT DISTINCT TRIM(tag) as tag 
            FROM cats 
            WHERE tag IS NOT NULL 
            AND tag != '' 
            AND TRIM(tag) != ''
            ORDER BY LOWER(tag) ASC
        `;

        connection.query(query, (err, rows) => {
            connection.release();

            if (err) {
                console.error("Database query error:", err);
                return res.status(500).json({
                    error: "Failed to fetch tags",
                    details: err.message
                });
            }

            // Extract tags and remove any remaining empty strings
            const tags = rows
                .map(row => row.tag)
                .filter(tag => tag && tag.trim().length > 0);

            console.log(`✅ Returning ${tags.length} unique tags`);
            res.json(tags);
        });
    });
});
// List on the Port 
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
}); 