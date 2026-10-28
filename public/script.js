const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("message-input");
const modesEl = document.getElementById("modes");

// The conversation so far. Each item looks like { role: "user" or "model", text: "..." }
const history = [];

// The study modes. The "id" is sent to the server, which has the matching instructions.
const MODES = {
  tutor: "Ask me anything you're studying...",
  explain: "What should I explain in simple words?",
  quiz: "Type a topic you want to be quizzed on...",
  summarize: "Paste the text you want summarized...",
};
let currentMode = "tutor";

// Turns the AI's Markdown into safe HTML.
// If the libraries failed to load (for example, no internet), show plain text instead.
function renderMarkdown(bubble, text) {
  if (typeof marked === "undefined" || typeof DOMPurify === "undefined") {
    bubble.textContent = text;
    return;
  }

  const html = marked.parse(text, { breaks: true });
  bubble.innerHTML = DOMPurify.sanitize(html); // removes anything unsafe

  // Open links in a new tab
  bubble.querySelectorAll("a").forEach((link) => {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });
}

// Adds a message bubble to the chat and scrolls to the bottom
function addMessage(text, role) {
  const bubble = document.createElement("div");
  bubble.className = `message ${role}`;

  if (role === "assistant") {
    renderMarkdown(bubble, text);
  } else {
    bubble.textContent = text; // your own text is never treated as HTML
  }

  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Makes the text box grow while you type (up to the max height set in CSS)
function autoGrow() {
  inputEl.style.height = "auto";
  inputEl.style.height = `${inputEl.scrollHeight}px`;
}

// Switches the study mode when a mode button is clicked
modesEl.addEventListener("click", (event) => {
  const button = event.target.closest(".mode-btn");
  if (!button) return;

  currentMode = button.dataset.mode;

  modesEl.querySelectorAll(".mode-btn").forEach((btn) => {
    const isActive = btn === button;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
  });

  inputEl.placeholder = MODES[currentMode];
  inputEl.focus();
});

// Enter sends the message. Shift + Enter adds a new line.
inputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    formEl.requestSubmit();
  }
});

inputEl.addEventListener("input", autoGrow);

// Sends the message, the earlier conversation and the mode to our server, returns the reply text
async function askServer(message) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, mode: currentMode }),
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
  autoGrow(); // shrink the box back to one line
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