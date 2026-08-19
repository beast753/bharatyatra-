/* Supabase handles data and authentication; this server serves static files. */
require("dotenv").config();
const express = require("express");
const path = require("path");
const app = express();

app.use(express.static(__dirname));
app.get("/api/health", (_req, res) => res.json({ ok: true, database: "supabase" }));
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`BharatYatra running at http://localhost:${PORT}`));
