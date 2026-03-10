/**
 * group_chat.js – Study group chat interface with @AI support
 *
 * Usage:
 *   - Regular messages: typed and shown as "You" on the right.
 *   - @AI messages: the @AI prefix is stripped and the remainder is sent
 *     to /api/groups/<id>/ai-chat; the reply is displayed as the AI bot.
 *
 * GROUP_ID and GROUP_COURSE_CODE must be set in the page before this script loads.
 */

// ── State ─────────────────────────────────────────────────────────────────────

let aiConversationHistory = [];

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  loadGroupMessages();
});

// ── Load initial messages ─────────────────────────────────────────────────────

async function loadGroupMessages() {
  try {
    const res = await fetch(`/api/groups/${GROUP_ID}`);
    const data = await res.json();
    const messages = data.messages || [];

    if (!messages.length) {
      appendSystemNotice("💬 No messages yet. Start the conversation!");
      return;
    }

    messages.forEach((msg) => {
      if (msg.is_ai) {
        appendAIMessage(msg.text, msg.timestamp);
      } else {
        appendPeerMessage(msg.sender, msg.avatar, msg.role, msg.text, msg.timestamp);
      }
    });
  } catch (err) {
    console.error("Failed to load group messages:", err);
    appendSystemNotice("⚠️ Could not load message history.");
  }
}

// ── Input handlers ────────────────────────────────────────────────────────────

function handleGroupKeyDown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendGroupMessage();
  }
}

function autoResizeGroup(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 128) + "px";
}

async function sendGroupMessage() {
  const input = document.getElementById("message-input");
  const rawText = input.value.trim();

  if (!rawText) return;

  input.value = "";
  input.style.height = "auto";

  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Detect @AI mention (case-insensitive) at the start of the message
  const aiMentionMatch = rawText.match(/^@[Aa][Ii]\s*([\s\S]*)/);

  if (aiMentionMatch) {
    // Show the user's @AI message first
    appendYourMessage(rawText, now);

    const question = aiMentionMatch[1].trim();
    if (!question) {
      appendSystemNotice("⚠️ Please type a question after @AI, e.g. `@AI What is normalisation?`");
      return;
    }

    await fetchAIReply(question, now);
  } else {
    // Regular chat message
    appendYourMessage(rawText, now);
  }
}

async function fetchAIReply(question, timestamp) {
  setInputDisabled(true);
  showAIStatus(true);
  const typingId = appendAITyping();

  try {
    const res = await fetch(`/api/groups/${GROUP_ID}/ai-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: question,
        history: aiConversationHistory,
      }),
    });

    const data = await res.json();
    removeTypingIndicator(typingId);

    if (data.error) {
      appendSystemNotice(`⚠️ ${data.error}`);
    } else {
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      appendAIMessage(data.reply, now);

      aiConversationHistory.push({ role: "user", content: question });
      aiConversationHistory.push({ role: "assistant", content: data.reply });
      if (aiConversationHistory.length > 20) {
        aiConversationHistory = aiConversationHistory.slice(-20);
      }
    }
  } catch (err) {
    removeTypingIndicator(typingId);
    appendSystemNotice("⚠️ Network error. Please check your connection and try again.");
  } finally {
    setInputDisabled(false);
    showAIStatus(false);
    document.getElementById("message-input").focus();
  }
}

function clearGroupChat() {
  aiConversationHistory = [];
  document.getElementById("chat-messages").innerHTML = "";
  appendSystemNotice("🗑️ Chat history cleared for this session.");
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function setInputDisabled(disabled) {
  const btn = document.getElementById("send-btn");
  const input = document.getElementById("message-input");
  const icon = document.getElementById("send-icon");
  btn.disabled = disabled;
  input.disabled = disabled;
  icon.className = disabled
    ? "fa-solid fa-spinner fa-spin text-sm"
    : "fa-solid fa-paper-plane text-sm";
}

function showAIStatus(visible) {
  const el = document.getElementById("ai-status");
  if (el) {
    if (visible) {
      el.classList.remove("hidden");
      el.classList.add("flex");
    } else {
      el.classList.add("hidden");
      el.classList.remove("flex");
    }
  }
}

/** A message from another group member (from loaded history). */
function appendPeerMessage(senderName, avatarCode, role, text, timestamp) {
  const messagesEl = document.getElementById("chat-messages");
  const div = document.createElement("div");
  div.className = "flex items-start gap-2.5";
  div.innerHTML = `
    <div class="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-primary-700 mt-0.5">
      ${escapeHtml(avatarCode)}
    </div>
    <div class="max-w-[80%]">
      <div class="flex items-baseline gap-1.5 mb-1">
        <span class="text-xs font-semibold text-slate-700">${escapeHtml(senderName)}</span>
        ${role === "leader" ? '<span class="text-xs bg-amber-100 text-amber-700 px-1 rounded">Leader</span>' : ""}
        <span class="text-xs text-slate-400">${escapeHtml(timestamp || "")}</span>
      </div>
      <div class="chat-bubble-peer">${formatGroupMarkdown(text)}</div>
    </div>`;
  messagesEl.appendChild(div);
  scrollToBottom();
}

/** The current user's outgoing message. */
function appendYourMessage(text, timestamp) {
  const messagesEl = document.getElementById("chat-messages");
  const div = document.createElement("div");
  div.className = "flex items-start gap-2.5 justify-end";

  const isAIMention = /^@[Aa][Ii]/i.test(text);
  div.innerHTML = `
    <div class="max-w-[80%]">
      <div class="flex items-baseline gap-1.5 mb-1 justify-end">
        <span class="text-xs text-slate-400">${escapeHtml(timestamp)}</span>
        <span class="text-xs font-semibold text-slate-700">You</span>
      </div>
      <div class="chat-bubble-user">
        <p class="${isAIMention ? "font-medium" : ""}">${escapeHtml(text)}</p>
      </div>
    </div>
    <div class="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold mt-0.5">
      S
    </div>`;
  messagesEl.appendChild(div);
  scrollToBottom();
}

/** AI assistant reply. */
function appendAIMessage(text, timestamp) {
  const messagesEl = document.getElementById("chat-messages");
  const div = document.createElement("div");
  div.className = "flex items-start gap-2.5";
  div.innerHTML = `
    <div class="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0 shadow mt-0.5">
      <i class="fa-solid fa-robot text-white text-xs"></i>
    </div>
    <div class="max-w-[85%]">
      <div class="flex items-baseline gap-1.5 mb-1">
        <span class="text-xs font-semibold text-primary-700">EduAI Assistant</span>
        <span class="text-xs bg-primary-100 text-primary-600 px-1.5 rounded-full">AI</span>
        <span class="text-xs text-slate-400">${escapeHtml(timestamp || "")}</span>
      </div>
      <div class="chat-bubble-ai">${formatGroupMarkdown(text)}</div>
    </div>`;
  messagesEl.appendChild(div);
  scrollToBottom();
}

function appendSystemNotice(text) {
  const messagesEl = document.getElementById("chat-messages");
  const div = document.createElement("div");
  div.className = "flex justify-center";
  div.innerHTML = `
    <div class="text-xs text-slate-400 bg-slate-100 px-4 py-1.5 rounded-full">
      ${formatGroupMarkdown(text)}
    </div>`;
  messagesEl.appendChild(div);
  scrollToBottom();
}

function appendAITyping() {
  const messagesEl = document.getElementById("chat-messages");
  const id = "typing-" + Date.now();
  const div = document.createElement("div");
  div.id = id;
  div.className = "flex items-start gap-2.5";
  div.innerHTML = `
    <div class="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0 shadow mt-0.5">
      <i class="fa-solid fa-robot text-white text-xs"></i>
    </div>
    <div class="chat-bubble-ai">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>`;
  messagesEl.appendChild(div);
  scrollToBottom();
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function scrollToBottom() {
  const messagesEl = document.getElementById("chat-messages");
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ── Text formatting ────────────────────────────────────────────────────────────

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatGroupMarkdown(text) {
  if (!text) return "";
  const blocks = text.split(/\n{2,}/);
  return blocks.map((block) => {
    const lines = block.split("\n");

    if (lines.every((l) => /^[\*\-•]\s/.test(l.trim()))) {
      const items = lines.map((l) => `<li>${inlineFormat(l.replace(/^[\*\-•]\s/, ""))}</li>`).join("");
      return `<ul>${items}</ul>`;
    }
    if (lines.every((l) => /^\d+\.\s/.test(l.trim()))) {
      const items = lines.map((l) => `<li>${inlineFormat(l.replace(/^\d+\.\s/, ""))}</li>`).join("");
      return `<ol>${items}</ol>`;
    }

    const htmlLines = lines.map((line) => {
      if (/^[\*\-•]\s/.test(line.trim())) return `<li>${inlineFormat(line.replace(/^[\*\-•]\s/, ""))}</li>`;
      if (/^\d+\.\s/.test(line.trim())) return `<li>${inlineFormat(line.replace(/^\d+\.\s/, ""))}</li>`;
      return inlineFormat(line);
    });

    if (htmlLines.some((l) => l.startsWith("<li>"))) {
      return "<ul>" + htmlLines.join("") + "</ul>";
    }
    return `<p>${htmlLines.join("<br>")}</p>`;
  }).join("");
}

function inlineFormat(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}
