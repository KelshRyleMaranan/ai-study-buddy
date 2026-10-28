const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Lets the server read JSON sent from the browser
app.use(express.json());

// Serve the frontend files from the "public" folder
app.use(express.static(path.join(__dirname, "public")));

// Simple health check so we know the server is alive
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "AI Study Buddy server is running" });
});

// Temporary fake reply. Replaced by the real AI in commit 5.
function getFakeReply(question) {
  return `You asked: "${question}". The server is answering now, but I'm not connected to the AI yet!`;
}

// The chat route: the browser sends a message, the server sends back a reply
app.post("/api/chat", (req, res) => {
  const { message } = req.body;

  // Check the message before using it
  if (typeof message !== "string" || message.trim() === "") {
    return res.status(400).json({ error: "Please send a message." });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: "Message is too long (max 2000 characters)." });
  }

  res.json({ reply: getFakeReply(message.trim()) });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});