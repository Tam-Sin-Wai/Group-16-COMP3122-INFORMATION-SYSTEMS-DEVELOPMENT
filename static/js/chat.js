/**
 * chat.js – Virtual Teacher chat interface logic
 */

// State
let selectedCourseId = "";
let conversationHistory = [];

// ── Initialise ────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  loadCourses();
  document.getElementById("course-select").addEventListener("change", onCourseChange);
});

// ── Course management ──────────────────────────────────────────────────────

async function loadCourses() {
  try {
    const res = await fetch("/api/courses");
    const data = await res.json();
    const select = document.getElementById("course-select");
    select.innerHTML = '<option value="">— Choose a course —</option>';
    (data.courses || []).forEach((course) => {
      const opt = document.createElement("option");
      opt.value = course.id;
      opt.textContent = `${course.code} – ${course.name}`;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("Failed to load courses:", err);
  }
}

async function onCourseChange() {
  const select = document.getElementById("course-select");
  selectedCourseId = select.value;

  const descEl = document.getElementById("course-description");
  const typesEl = document.getElementById("material-types");
  const statusEl = document.getElementById("chat-header-status");
  const titleEl = document.getElementById("chat-header-title");

  if (!selectedCourseId) {
    descEl.classList.add("hidden");
    typesEl.innerHTML = '<p class="text-slate-400 italic">Select a course to see available materials.</p>';
    statusEl.textContent = "Ready – select a course to begin";
    titleEl.textContent = "Virtual Teacher";
    conversationHistory = [];
    return;
  }

  // Show course description
  const selectedOption = select.options[select.selectedIndex];
  const courseLabel = selectedOption.textContent;
  titleEl.textContent = `Virtual Teacher – ${courseLabel}`;
  statusEl.textContent = "Loading course materials…";

  try {
    const res = await fetch(`/api/courses/${selectedCourseId}/materials`);
    const data = await res.json();
    const materials = data.materials || [];

    const typeCounts = { lecture_notes: 0, transcript: 0, assignment: 0, padlet: 0 };
    materials.forEach((m) => {
      if (typeCounts[m.type] !== undefined) typeCounts[m.type]++;
    });

    const icons = {
      lecture_notes: "fa-file-lines",
      transcript: "fa-microphone-lines",
      assignment: "fa-file-pen",
      padlet: "fa-comments",
    };
    const labels = {
      lecture_notes: "Lecture Notes",
      transcript: "Transcripts",
      assignment: "Assignments",
      padlet: "Padlet Posts",
    };

    typesEl.innerHTML = Object.entries(typeCounts)
      .filter(([, count]) => count > 0)
      .map(
        ([type, count]) => `
        <div class="flex items-center gap-2">
          <i class="fa-solid ${icons[type]} text-primary-500 text-xs w-4 text-center"></i>
          <span>${labels[type]}: <strong>${count}</strong></span>
        </div>`
      )
      .join("") || '<p class="text-slate-400 italic">No materials found for this course.</p>';

    statusEl.textContent = `${materials.length} context items loaded`;
    descEl.classList.remove("hidden");
    descEl.textContent = materials.length
      ? `${materials.length} material(s) available to inform responses.`
      : "No materials found – responses will use general knowledge.";
  } catch (err) {
    console.error("Failed to load materials:", err);
    statusEl.textContent = "Materials loaded (with error)";
  }

  // Reset conversation when course changes
  conversationHistory = [];
  appendSystemMessage(`✅ Switched to **${courseLabel}**. How can I help you today?`);
}

// ── Chat ──────────────────────────────────────────────────────────────────

function handleKeyDown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 128) + "px";
}

async function sendMessage() {
  const input = document.getElementById("message-input");
  const message = input.value.trim();

  if (!message) return;
  if (!selectedCourseId) {
    appendSystemMessage("⚠️ Please select a course before asking a question.");
    return;
  }

  // Disable input while sending
  setInputDisabled(true);
  input.value = "";
  input.style.height = "auto";

  appendUserMessage(message);
  const typingId = appendTypingIndicator();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course_id: selectedCourseId,
        message: message,
        history: conversationHistory,
      }),
    });

    const data = await res.json();
    removeTypingIndicator(typingId);

    if (data.error) {
      appendSystemMessage(`⚠️ ${data.error}`);
    } else {
      appendAIMessage(data.reply);
      conversationHistory.push({ role: "user", content: message });
      conversationHistory.push({ role: "assistant", content: data.reply });
      // Keep last 20 turns to avoid token bloat
      if (conversationHistory.length > 20) {
        conversationHistory = conversationHistory.slice(-20);
      }
    }
  } catch (err) {
    removeTypingIndicator(typingId);
    appendSystemMessage("⚠️ Network error. Please check your connection and try again.");
  } finally {
    setInputDisabled(false);
    document.getElementById("message-input").focus();
  }
}

function clearChat() {
  conversationHistory = [];
  const messagesEl = document.getElementById("chat-messages");
  messagesEl.innerHTML = "";
  appendSystemMessage("🗑️ Chat cleared. Ask me anything about your selected course!");
}

// ── DOM helpers ───────────────────────────────────────────────────────────

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

function appendUserMessage(text) {
  const messagesEl = document.getElementById("chat-messages");
  const div = document.createElement("div");
  div.className = "flex items-start gap-3 justify-end";
  div.innerHTML = `
    <div class="chat-bubble-user max-w-[85%]">
      <p>${escapeHtml(text)}</p>
    </div>
    <div class="w-8 h-8 rounded-xl bg-primary-600 flex items-center justify-center flex-shrink-0 shadow mt-0.5">
      <i class="fa-solid fa-user text-white text-xs"></i>
    </div>`;
  messagesEl.appendChild(div);
  scrollToBottom();
}

function appendAIMessage(text) {
  const messagesEl = document.getElementById("chat-messages");
  const div = document.createElement("div");
  div.className = "flex items-start gap-3";
  div.innerHTML = `
    <div class="w-8 h-8 rounded-xl bg-primary-600 flex items-center justify-center flex-shrink-0 shadow mt-0.5">
      <i class="fa-solid fa-robot text-white text-xs"></i>
    </div>
    <div class="chat-bubble-ai max-w-[85%]">
      ${formatMarkdown(text)}
    </div>`;
  messagesEl.appendChild(div);
  scrollToBottom();
}

function appendSystemMessage(text) {
  const messagesEl = document.getElementById("chat-messages");
  const div = document.createElement("div");
  div.className = "flex items-start gap-3";
  div.innerHTML = `
    <div class="w-8 h-8 rounded-xl bg-primary-600 flex items-center justify-center flex-shrink-0 shadow mt-0.5">
      <i class="fa-solid fa-robot text-white text-xs"></i>
    </div>
    <div class="chat-bubble-ai max-w-[85%]">
      <p>${formatMarkdown(text)}</p>
    </div>`;
  messagesEl.appendChild(div);
  scrollToBottom();
}

function appendTypingIndicator() {
  const messagesEl = document.getElementById("chat-messages");
  const id = "typing-" + Date.now();
  const div = document.createElement("div");
  div.id = id;
  div.className = "flex items-start gap-3";
  div.innerHTML = `
    <div class="w-8 h-8 rounded-xl bg-primary-600 flex items-center justify-center flex-shrink-0 shadow mt-0.5">
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

// ── Text formatting ────────────────────────────────────────────────────────

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Minimal Markdown → HTML conversion for AI responses:
 * - **bold** → <strong>
 * - *italic* → <em>
 * - `code` → <code>
 * - Bullet lists (lines starting with - or *)
 * - Numbered lists
 * - Line breaks → <br> or paragraph splits
 */
function formatMarkdown(text) {
  if (!text) return "";

  // Split into blocks by double newlines
  const blocks = text.split(/\n{2,}/);
  const htmlBlocks = blocks.map((block) => {
    const lines = block.split("\n");

    // Detect bullet list
    if (lines.every((l) => /^[\*\-•]\s/.test(l.trim()))) {
      const items = lines.map((l) => `<li>${inlineFormat(l.replace(/^[\*\-•]\s/, ""))}</li>`).join("");
      return `<ul>${items}</ul>`;
    }

    // Detect numbered list
    if (lines.every((l) => /^\d+\.\s/.test(l.trim()))) {
      const items = lines.map((l) => `<li>${inlineFormat(l.replace(/^\d+\.\s/, ""))}</li>`).join("");
      return `<ol>${items}</ol>`;
    }

    // Mixed block with some list items
    const htmlLines = lines.map((line) => {
      if (/^[\*\-•]\s/.test(line.trim())) {
        return `<li>${inlineFormat(line.replace(/^[\*\-•]\s/, ""))}</li>`;
      }
      if (/^\d+\.\s/.test(line.trim())) {
        return `<li>${inlineFormat(line.replace(/^\d+\.\s/, ""))}</li>`;
      }
      return inlineFormat(line);
    });

    // Check if any list items were generated
    if (htmlLines.some((l) => l.startsWith("<li>"))) {
      return "<ul>" + htmlLines.join("") + "</ul>";
    }

    return `<p>${htmlLines.join("<br>")}</p>`;
  });

  return htmlBlocks.join("");
}

function inlineFormat(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}
