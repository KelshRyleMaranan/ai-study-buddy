require("dotenv").config(); // loads the secret key from .env
const express = require("express");
const path = require("path");
const rateLimit = require("express-rate-limit");
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
const MAX_MESSAGE_LENGTH = 4000;
const DAILY_LIMIT = Number(process.env.DAILY_LIMIT) || 200; // total chats per day for the whole app

// Who the buddy is. This is sent with every request.
const BASE_PROMPT =
  "You are AI Study Buddy, a friendly and patient tutor for students. " +
  "Keep answers clear and fairly short, because many users are on phones. " +
  "Use Markdown: short paragraphs, bullet points, and code blocks for code. " +
  "If you are not sure about something, say so instead of guessing. " +
  "Stay on study and learning topics, and gently steer off-topic requests back to studying.";

// Extra instructions for each study mode
const MODE_PROMPTS = {
  tutor:
    "Mode: Ask. Answer the student's question clearly, then offer one short follow-up they could try.",
  explain:
    "Mode: Explain simply. Explain the topic like the student is 12 years old. " +
    "Use plain words, one everyday analogy, and a tiny example. Avoid jargon, or explain it right away.",
  quiz:
    "Mode: Quiz me. Quiz the student on the topic they give you. " +
    "Ask ONE question at a time and wait for their answer. " +
    "After they answer, say if it was right, explain briefly, then ask the next question. " +
    "Start easy and get slightly harder. Never give the answer before they try.",
  summarize:
    "Mode: Summarize. Summarize the text the student pastes. " +
    "Give a one-sentence overview, then 3 to 6 bullet points of the key ideas, " +
    "then a short list of key terms. Do not add facts that are not in the text.",
};

// Hosting services put a proxy in front of the app.
// This makes the rate limiter see each visitor's real IP address.
app.set("trust proxy", 1);

// Limit 1: each visitor can send 10 messages per minute
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "You're sending messages too fast. Wait a minute and try again." },
});

// Limit 2: a daily cap for the whole app, to protect the free quota.
// It lives in memory, so it also resets when the server restarts.
let dailyCount = 0;
let dailyDay = new Date().toDateString();

function useDailyAllowance() {
  const today = new Date().toDateString();
  if (today !== dailyDay) {
    dailyDay = today;
    dailyCount = 0;
  }
  if (dailyCount >= DAILY_LIMIT) return false;
  dailyCount++;
  return true;
}

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

// Only allow modes we know. Anything else falls back to "tutor".
function cleanMode(mode) {
  return Object.prototype.hasOwnProperty.call(MODE_PROMPTS, mode) ? mode : "tutor";
}

// Asks Gemini for an answer, using earlier messages as memory and the mode as instructions
async function getAIReply(message, history, mode) {
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
    config: {
      systemInstruction: `${BASE_PROMPT}\n\n${MODE_PROMPTS[mode]}`,
    },
  });
  return response.text;
}

// The chat route: the browser sends a message, the server sends back a reply
app.post("/api/chat", chatLimiter, async (req, res) => {
  const { message, history, mode } = req.body;

  // Check the message before using it
  if (typeof message !== "string" || message.trim() === "") {
    return res.status(400).json({ error: "Please send a message." });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res
      .status(400)
      .json({ error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` });
  }

  // Stop if the whole app used up its daily allowance
  if (!useDailyAllowance()) {
    return res
      .status(429)
      .json({ error: "AI Study Buddy has reached its daily limit. Please come back tomorrow!" });
  }

  try {
    const reply = await getAIReply(message.trim(), cleanHistory(history), cleanMode(mode));
    if (!reply) {
      return res.status(502).json({ error: "The AI sent an empty answer. Try again." });
    }
    res.json({ reply });
  } catch (error) {
    // Full details stay in the server terminal, not in the browser
    console.error("Gemini error:", error.message);

    if (error.status === 429) {
      return res
        .status(429)
        .json({ error: "The AI is getting too many requests right now. Wait a moment and try again." });
    }
    if (error.status === 503) {
      return res.status(503).json({ error: "The AI is busy right now. Try again in a few seconds." });
    }
    res.status(500).json({ error: "Something went wrong talking to the AI." });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});