const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("message-input");

// The conversation so far. Each item looks like { role: "user" or "model", text: "..." }
const history = [];

// Adds a message bubble to the chat and scrolls to the bottom
function addMessage(text, role) {
  const bubble = document.createElement("div");
  bubble.className = `message ${role}`;
  bubble.textContent = text; // textContent is safe: it never runs HTML
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Sends the message and the earlier conversation to our server, returns the reply text
async function askServer(message) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }
  return data.reply;
}

formEl.addEventListener("submit", async (event) => {
  event.preventDefault(); // stop the page from reloading

  const text = inputEl.value.trim();
  if (text === "") return; // ignore empty messages

  addMessage(text, "user");
  inputEl.value = "";
  inputEl.focus();

  try {
    const reply = await askServer(text);
    addMessage(reply, "assistant");

    // Remember this exchange only after it worked
    history.push({ role: "user", text });
    history.push({ role: "model", text: reply });
  } catch (error) {
    addMessage("Sorry, I couldn't reach the server. Please try again.", "assistant");
    console.error(error);
  }
});