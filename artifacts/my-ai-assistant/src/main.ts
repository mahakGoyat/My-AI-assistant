import './index.css';

type Role = 'user' | 'assistant';
type ChatMessage = { role: Role; content: string };
type ChatRecord = { id: string; title: string; messages: ChatMessage[]; updatedAt: number };
type IconName = 'plus' | 'sun' | 'moon' | 'menu' | 'arrow' | 'spark' | 'trash';

const STORAGE_KEY = 'my-ai-assistant.chats';
const THEME_KEY = 'my-ai-assistant.theme';
const root = document.getElementById('root')!;

const state: {
  messages: ChatMessage[];
  history: ChatRecord[];
  chatId: string;
  input: string;
  streaming: boolean;
  error: string;
  dark: boolean;
  sidebarOpen: boolean;
  deleteChatId: string | null;
  copied: boolean;
} = {
  messages: [],
  history: [],
  chatId: makeId(),
  input: '',
  streaming: false,
  error: '',
  dark: false,
  sidebarOpen: window.innerWidth > 760,
  deleteChatId: null,
  copied: false,
};

let activeController: AbortController | null = null;
let lastPrompt = '';
let copyTimer = 0;
let longPressTimer = 0;
let longPressChatId: string | null = null;
let longPressOrigin: { x: number; y: number } | null = null;
let suppressNextHistoryClick = false;
let suppressHistoryClickResetTimer = 0;

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function icon(name: IconName, size = 16) {
  const paths: Record<IconName, string> = {
    plus: '<path d="M12 5v14M5 12h14" />',
    sun: '<circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />',
    moon: '<path d="M20.3 15.2A8.5 8.5 0 0 1 8.8 3.7 8.5 8.5 0 1 0 20.3 15.2Z" />',
    menu: '<path d="M4 6h16M4 12h16M4 18h16" />',
    arrow: '<path d="M5 12h13M13 6l6 6-6 6" />',
    spark: '<path d="m12 2 1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6L12 2Z" /><path d="m19 17 .6 2.4L22 20l-2.4.6L19 23l-.6-2.4L16 20l2.4-.6L19 17Z" />',
    trash: '<path d="M3 6h18M8 6V4h8v2m3 0-.9 14H5.9L5 6m4 4v6m6-6v6" />',
  };
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function safeHref(value: string) {
  return /^https?:\/\//i.test(value) ? value : '#';
}

function inlineMarkdown(value: string) {
  const parts = value.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);
  return parts.map((part) => {
    if (part.startsWith('`') && part.endsWith('`')) return `<code class="inline-code">${escapeHtml(part.slice(1, -1))}</code>`;
    if (part.startsWith('**') && part.endsWith('**')) return `<strong>${escapeHtml(part.slice(2, -2))}</strong>`;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return `<a href="${escapeHtml(safeHref(link[2]))}" target="_blank" rel="noreferrer">${escapeHtml(link[1])}</a>`;
    return escapeHtml(part);
  }).join('');
}

function markdownToHtml(content: string) {
  const lines = content.replace(/\r/g, '').split('\n');
  const output: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let code: string[] = [];
  let codeLanguage = '';
  let inCode = false;

  const flushParagraph = () => {
    if (paragraph.length) {
      output.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      output.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</ul>`);
      list = [];
    }
  };
  const flushCode = () => {
    const source = code.join('\n');
    output.push(`<div class="code-block"><div class="code-head"><span>${escapeHtml(codeLanguage || 'code')}</span><button class="copy-code" type="button" data-code="${escapeHtml(source)}">Copy</button></div><pre><code>${escapeHtml(source)}</code></pre></div>`);
    code = [];
    codeLanguage = '';
  };

  lines.forEach((line) => {
    if (line.startsWith('```')) {
      flushParagraph();
      flushList();
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        codeLanguage = line.slice(3).trim();
        inCode = true;
      }
      return;
    }
    if (inCode) {
      code.push(line);
      return;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      return;
    }
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      output.push(`<p><strong>${inlineMarkdown(heading[1])}</strong></p>`);
      return;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
      return;
    }
    paragraph.push(line);
  });
  if (inCode || code.length) flushCode();
  flushParagraph();
  flushList();
  return output.join('');
}

function titleFor(messages: ChatMessage[]) {
  const first = messages.find((message) => message.role === 'user')?.content.trim() || 'Untitled conversation';
  return first.length > 38 ? `${first.slice(0, 38)}…` : first;
}

function loadSavedState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as ChatRecord[];
    if (Array.isArray(saved)) state.history = saved;
    const preferred = localStorage.getItem(THEME_KEY);
    state.dark = preferred ? preferred === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    state.history = [];
  }
}

function applyTheme() {
  document.documentElement.classList.toggle('dark', state.dark);
  localStorage.setItem(THEME_KEY, state.dark ? 'dark' : 'light');
}

function persistCurrent() {
  if (!state.messages.length) return;
  const record: ChatRecord = { id: state.chatId, title: titleFor(state.messages), messages: state.messages, updatedAt: Date.now() };
  state.history = [record, ...state.history.filter((item) => item.id !== state.chatId)].slice(0, 30);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
}

function deleteChat(chatId: string) {
  state.history = state.history.filter((record) => record.id !== chatId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
  state.deleteChatId = null;

  if (state.chatId === chatId) {
    activeController?.abort();
    state.chatId = makeId();
    state.messages = [];
    state.input = '';
    state.error = '';
    state.streaming = false;
  }

  render();
}

function renderMessages() {
  if (!state.messages.length) {
    const prompts = [
      ['Understand', 'Explain a difficult idea in plain language.'],
      ['Build', 'Help me think through a small coding project.'],
      ['Study', 'Make a focused study plan for a topic I am learning.'],
      ['Write', 'Help me make this writing clearer and more confident.'],
    ];
    return `<section class="welcome" data-testid="empty-state">
      <p class="eyebrow">${icon('spark', 13)} A moment for your question</p>
      <h1>What are you<br />thinking about?</h1>
      <p>Ask for a second brain on learning, code, career, or the words you are trying to find.</p>
      <div class="prompt-grid">${prompts.map(([label, text]) => `<button class="prompt-card" type="button" data-prompt="${escapeHtml(text)}" data-testid="button-prompt-${label.toLowerCase()}"><strong>${label}</strong>${text}</button>`).join('')}</div>
    </section>`;
  }
  const messages = state.messages.map((message, index) => {
    const avatar = message.role === 'assistant' ? 'AI' : 'You';
    const content = message.content
      ? markdownToHtml(message.content)
      : state.streaming && index === state.messages.length - 1
        ? '<span class="typing" aria-label="Assistant is typing"><i></i><i></i><i></i></span>'
        : '';
    return `<article class="message-row ${message.role}" data-testid="message-${message.role}-${index}">
      ${message.role === 'assistant' ? `<div class="message-avatar" aria-hidden="true">${avatar}</div>` : ''}
      <div class="message-body"><div class="message-role">${message.role === 'assistant' ? 'Assistant' : 'You'}</div><div class="message-content">${content}</div></div>
      ${message.role === 'user' ? `<div class="message-avatar" aria-hidden="true">${avatar}</div>` : ''}
    </article>`;
  }).join('');
  return `<section class="messages" aria-live="polite">${messages}</section>`;
}

function render(focusComposerAfterRender = false) {
  applyTheme();
  const currentTextarea = root.querySelector<HTMLTextAreaElement>('textarea');
  const restoreTextareaFocus = document.activeElement === currentTextarea;
  const textareaSelection = currentTextarea?.selectionStart ?? 0;
  const history = state.history.map((record) => `<div class="history-row ${record.id === state.deleteChatId ? 'delete-ready' : ''}" data-chat-row="${escapeHtml(record.id)}">
    <button class="history-item ${record.id === state.chatId ? 'active' : ''}" type="button" data-chat-id="${escapeHtml(record.id)}" data-testid="history-chat-${escapeHtml(record.id)}" title="${escapeHtml(record.title)}">${escapeHtml(record.title)}</button>
    <button class="history-delete" type="button" data-delete-chat="${escapeHtml(record.id)}" data-testid="delete-chat-${escapeHtml(record.id)}" aria-label="Delete conversation: ${escapeHtml(record.title)}" title="Delete conversation">${icon('trash', 14)}<span>Delete</span></button>
  </div>`).join('');
  root.innerHTML = `<main class="app-shell ${state.sidebarOpen ? 'sidebar-visible' : 'sidebar-collapsed'}">
    <aside class="sidebar ${state.sidebarOpen ? 'open' : ''}" aria-label="Conversation history">
      <div class="brand"><span class="brand-mark" aria-hidden="true"></span><span><span class="brand-name">My AI Assistant</span><span class="brand-kicker">A quieter place to think</span></span></div>
      <button class="new-chat" type="button" data-action="new-chat" data-testid="button-new-chat">${icon('plus')}New chat</button>
      <section class="history-section"><div class="section-label">Recent conversations</div><div class="history-list">${history || '<div class="history-empty">Your conversations will settle here as you use the assistant.</div>'}</div></section>
      <div class="sidebar-foot"><span class="status-line"><span class="status-dot"></span>Ready when you are</span><button class="theme-button" type="button" data-action="theme" data-testid="button-theme" aria-label="${state.dark ? 'Switch to light mode' : 'Switch to dark mode'}">${icon(state.dark ? 'sun' : 'moon')}</button></div>
    </aside>
    <section class="main-panel">
      <header class="topbar"><button class="mobile-menu" type="button" data-action="mobile-menu" data-testid="button-mobile-menu" aria-label="${state.sidebarOpen ? 'Close conversation history' : 'Open conversation history'}" aria-expanded="${state.sidebarOpen}">${icon('menu')}</button><span class="topbar-title">Conversation</span><div class="topbar-meta"><span><span class="status-dot"></span>Private workspace</span><span>Enter to send</span></div></header>
      <div class="conversation">${renderMessages()}${state.error ? `<div class="error-banner" role="alert" data-testid="status-error">${escapeHtml(state.error)}<button type="button" data-action="retry" data-testid="button-retry">Try again</button></div>` : ''}</div>
      <div class="composer-wrap"><form class="composer" data-chat-form><textarea ${state.streaming ? 'disabled' : ''} placeholder="Ask anything worth thinking through…" rows="1" aria-label="Message" data-testid="input-message">${escapeHtml(state.input)}</textarea><button class="send-button" type="submit" ${!state.input.trim() || state.streaming ? 'disabled' : ''} data-testid="button-send" aria-label="Send message">${icon('arrow')}</button></form><div class="composer-hint">${state.streaming ? 'Writing a considered response…' : 'Enter to send · Shift + Enter for a new line'}</div><span class="sr-only" aria-live="polite" data-testid="status-copy">${state.copied ? 'Copied code to clipboard' : ''}</span></div>
  </main>`;
  const textarea = root.querySelector<HTMLTextAreaElement>('textarea');
  if (textarea && (restoreTextareaFocus || focusComposerAfterRender)) {
    textarea.focus({ preventScroll: true });
    const selection = focusComposerAfterRender ? textarea.value.length : textareaSelection;
    textarea.setSelectionRange(selection, selection);
  }
  if (state.messages.length) {
    root.querySelector('.conversation')?.scrollIntoView({
      behavior: state.streaming ? 'auto' : 'smooth',
      block: 'end',
    });
  }
}

function setInput(value: string) {
  state.input = value;
  const textarea = root.querySelector<HTMLTextAreaElement>('textarea');
  if (textarea) {
    textarea.value = value;
    textarea.focus();
    textarea.setSelectionRange(value.length, value.length);
  }
  syncComposer();
}

function syncComposer() {
  const textarea = root.querySelector<HTMLTextAreaElement>('textarea');
  const sendButton = root.querySelector<HTMLButtonElement>('[data-testid="button-send"]');
  if (textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  }
  if (sendButton) sendButton.disabled = !state.input.trim() || state.streaming;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function sendMessage(value?: string, replaceLastUser = false) {
  const content = (value ?? state.input).trim();
  if (!content || state.streaming) return;
  const userMessage: ChatMessage = { role: 'user', content };
  const baseMessages = replaceLastUser && state.messages.at(-1)?.role === 'user' ? state.messages.slice(0, -1) : state.messages;
  const outgoing = [...baseMessages, userMessage];
  lastPrompt = content;
  state.input = '';
  state.error = '';
  state.streaming = true;
  state.messages = [...outgoing, { role: 'assistant', content: '' }];
  render();

  const controller = new AbortController();
  activeController = controller;
  try {
    const request = () => fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ messages: outgoing }),
      signal: controller.signal,
    });
    let response = await request();
    if ([502, 503, 504].includes(response.status) && !controller.signal.aborted) {
      await wait(700);
      response = await request();
    }
    if (!response.ok) {
      let detail = '';
      const vercelError = response.headers.get('x-vercel-error');
      try {
        const payload = await response.json() as { error?: string };
        detail = payload.error || '';
      } catch {
        // Keep the fallback below when an upstream failure is not JSON.
      }
      if (!detail && vercelError === 'FUNCTION_INVOCATION_FAILED') {
        detail = `Vercel could not start the API function (${response.status}). Check the api-server Runtime Logs.`;
      }
      throw new Error(detail || 'I couldn’t reach the assistant right now. Please try again.');
    }
    if (!response.body) throw new Error('The assistant did not open a response stream. Please try again.');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let assistant = '';
    const consume = (frame: string) => {
      const data = frame.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('');
      if (!data || data === '[DONE]') return;
      const parsed = JSON.parse(data) as { content?: string; error?: string };
      if (parsed.error) throw new Error(parsed.error);
      if (parsed.content) {
        assistant += parsed.content;
        state.messages = [...outgoing, { role: 'assistant', content: assistant }];
        render();
      }
    };
    while (true) {
      const { value: chunk, done } = await reader.read();
      buffer += decoder.decode(chunk || new Uint8Array(), { stream: !done });
      const frames = buffer.split(/\n\n/);
      buffer = frames.pop() || '';
      frames.forEach(consume);
      if (done) break;
    }
    if (buffer.trim()) consume(buffer);
    if (!assistant) throw new Error('The assistant returned an empty response.');
  } catch (requestError) {
    if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
    state.error = requestError instanceof Error ? requestError.message : 'Something interrupted the response.';
    state.messages = outgoing;
  } finally {
    state.streaming = false;
    activeController = null;
    persistCurrent();
    render(true);
  }
}

function startNewChat() {
  persistCurrent();
  activeController?.abort();
  state.chatId = makeId();
  state.messages = [];
  state.input = '';
  state.error = '';
  state.streaming = false;
  if (window.innerWidth <= 760) state.sidebarOpen = false;
  state.deleteChatId = null;
  render();
}

function selectChat(chatId: string) {
  const record = state.history.find((item) => item.id === chatId);
  if (!record) return;
  activeController?.abort();
  state.chatId = record.id;
  state.messages = record.messages;
  state.input = '';
  state.error = '';
  state.streaming = false;
  if (window.innerWidth <= 760) state.sidebarOpen = false;
  state.deleteChatId = null;
  render();
}

root.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const deleteButton = target.closest<HTMLElement>('[data-delete-chat]');
  if (deleteButton?.dataset.deleteChat) {
    deleteChat(deleteButton.dataset.deleteChat);
    return;
  }
  const actionElement = target.closest<HTMLElement>('[data-action]');
  const action = actionElement?.dataset.action;
  if (action === 'new-chat') startNewChat();
  if (action === 'theme') {
    state.dark = !state.dark;
    render();
  }
  if (action === 'mobile-menu') {
    state.sidebarOpen = !state.sidebarOpen;
    render();
  }
  if (action === 'retry') void sendMessage(lastPrompt, true);
  const chatButton = target.closest<HTMLElement>('[data-chat-id]');
  if (chatButton?.dataset.chatId && suppressNextHistoryClick) {
    event.preventDefault();
    suppressNextHistoryClick = false;
    window.clearTimeout(suppressHistoryClickResetTimer);
    return;
  }
  if (chatButton?.dataset.chatId) selectChat(chatButton.dataset.chatId);
  const prompt = target.closest<HTMLElement>('[data-prompt]');
  if (prompt?.dataset.prompt) setInput(prompt.dataset.prompt);
  const copyButton = target.closest<HTMLButtonElement>('.copy-code');
  if (copyButton) {
    void navigator.clipboard?.writeText(copyButton.dataset.code || '');
    state.copied = true;
    window.clearTimeout(copyTimer);
    copyTimer = window.setTimeout(() => { state.copied = false; render(); }, 1400);
    render();
  }
});

root.addEventListener('pointerdown', (event) => {
  const target = event.target as HTMLElement;
  if (target.closest('[data-delete-chat]')) return;
  if (event.pointerType !== 'touch' && event.button !== 0) return;

  const row = target.closest<HTMLElement>('[data-chat-row]');
  if (!row?.dataset.chatRow) return;

  window.clearTimeout(longPressTimer);
  longPressChatId = row.dataset.chatRow;
  longPressOrigin = { x: event.clientX, y: event.clientY };
  longPressTimer = window.setTimeout(() => {
    const chatId = longPressChatId;
    if (!chatId) return;
    state.deleteChatId = chatId;
    suppressNextHistoryClick = true;
    render();
  }, 550);
});

function cancelLongPress(resetClickSuppression = false) {
  window.clearTimeout(longPressTimer);
  longPressTimer = 0;
  longPressChatId = null;
  longPressOrigin = null;
  if (resetClickSuppression && suppressNextHistoryClick) {
    window.clearTimeout(suppressHistoryClickResetTimer);
    suppressHistoryClickResetTimer = window.setTimeout(() => {
      suppressNextHistoryClick = false;
    }, 300);
  }
}

window.addEventListener('pointerup', () => cancelLongPress(true));
window.addEventListener('pointercancel', () => cancelLongPress(true));
window.addEventListener('pointermove', (event) => {
  if (!longPressOrigin) return;
  const moved = Math.hypot(event.clientX - longPressOrigin.x, event.clientY - longPressOrigin.y);
  if (moved > 9) cancelLongPress();
});

root.addEventListener('contextmenu', (event) => {
  const target = event.target as HTMLElement;
  const row = target.closest<HTMLElement>('[data-chat-row]');
  if (!row?.dataset.chatRow) return;
  event.preventDefault();
  state.deleteChatId = row.dataset.chatRow;
  render();
});

root.addEventListener('input', (event) => {
  const textarea = event.target as HTMLTextAreaElement;
  if (!textarea.matches('textarea')) return;
  state.input = textarea.value;
  syncComposer();
});

root.addEventListener('keydown', (event) => {
  const textarea = event.target as HTMLTextAreaElement;
  if (!textarea.matches('textarea') || event.key !== 'Enter' || event.shiftKey) return;
  event.preventDefault();
  void sendMessage();
});

root.addEventListener('submit', (event) => {
  const form = event.target as HTMLFormElement;
  if (!form.matches('[data-chat-form]')) return;
  event.preventDefault();
  void sendMessage();
});

loadSavedState();
render();

window.matchMedia('(max-width: 760px)').addEventListener('change', (event) => {
  state.sidebarOpen = !event.matches;
  state.deleteChatId = null;
  render();
});