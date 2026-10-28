const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve the frontend files from the "public" folder
app.use(express.static(path.join(__dirname, "public")));

// Simple health check so we know the server is alive
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "AI Study Buddy server is running" });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});