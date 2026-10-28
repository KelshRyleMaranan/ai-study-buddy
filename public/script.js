const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("message-input");

// Adds a message bubble to the chat and scrolls to the bottom
function addMessage(text, role) {
  const bubble = document.createElement("div");
  bubble.className = `message ${role}`;
  bubble.textContent = text; // textContent is safe: it never runs HTML
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Temporary fake reply. Replaced by the server in commit 4.
function getFakeReply(question) {
  return `You asked: "${question}". I'm not connected to the AI yet, but soon I'll give you a real answer!`;
}

formEl.addEventListener("submit", (event) => {
  event.preventDefault(); // stop the page from reloading

  const text = inputEl.value.trim();
  if (text === "") return; // ignore empty messages

  addMessage(text, "user");
  inputEl.value = "";
  inputEl.focus();

  // Wait a moment so it feels like the buddy is "thinking"
  setTimeout(() => {
    addMessage(getFakeReply(text), "assistant");
  }, 600);
});