require("dotenv").config(); // loads the secret key from .env
const express = require("express");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;

// The key stays here on the server. It is never sent to the browser.
if (!process.env.GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY. Add it to your .env file.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";

const MAX_HISTORY = 20; // only remember the last 20 messages to save quota

// Lets the server read JSON sent from the browser
app.use(express.json());

// Serve the frontend files from the "public" folder
app.use(express.static(path.join(__dirname, "public")));

// Simple health check so we know the server is alive
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "AI Study Buddy server is running" });
});

// Cleans the history sent by the browser. Never trust data from the browser.
function cleanHistory(history) {
  if (!Array.isArray(history)) return [];

  const cleaned = history
    .filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "model") &&
        typeof item.text === "string" &&
        item.text.trim() !== ""
    )
    .map((item) => ({ role: item.role, text: item.text.slice(0, 8000) }))
    .slice(-MAX_HISTORY);

  // The conversation must start with a user message
  while (cleaned.length > 0 && cleaned[0].role !== "user") {
    cleaned.shift();
  }
  return cleaned;
}

// Asks Gemini for an answer, using the earlier messages as memory
async function getAIReply(message, history) {
  const contents = [
    ...history.map((item) => ({
      role: item.role,
      parts: [{ text: item.text }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  const response = await ai.models.generateContent({
    model: MODEL,
    contents,
  });
  return response.text;
}

// The chat route: the browser sends a message, the server sends back a reply
app.post("/api/chat", async (req, res) => {
  const { message, history } = req.body;

  // Check the message before using it
  if (typeof message !== "string" || message.trim() === "") {
    return res.status(400).json({ error: "Please send a message." });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: "Message is too long (max 2000 characters)." });
  }

  try {
    const reply = await getAIReply(message.trim(), cleanHistory(history));
    if (!reply) {
      return res.status(502).json({ error: "The AI sent an empty answer. Try again." });
    }
    res.json({ reply });
  } catch (error) {
    // Full details stay in the server terminal, not in the browser
    console.error("Gemini error:", error.message);

    if (error.status === 429) {
      return res.status(429).json({ error: "Too many requests right now. Wait a moment and try again." });
    }
    res.status(500).json({ error: "Something went wrong talking to the AI." });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});