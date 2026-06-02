// ============================================================
// claude.js — Integración Claude API (fetch directo)
// ============================================================

async function claudeChat(userMessage, contextData) {
  if (!CONFIG.CLAUDE_API_KEY || CONFIG.CLAUDE_API_KEY === 'PONER_AQUI') {
    return 'Configura tu CLAUDE_API_KEY en config.js para usar el asistente.';
  }

  const systemPrompt = `Eres un asistente de ventas experto en análisis de rutas comerciales.
El usuario tiene un CRM con sus clientes y visitas. Responde en español, de forma concisa y útil.
Analiza los datos que se te proporcionen para dar insights accionables.

CONTEXTO ACTUAL DE DATOS:
${JSON.stringify(contextData, null, 2)}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':            'application/json',
      'x-api-key':               CONFIG.CLAUDE_API_KEY,
      'anthropic-version':       '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model:      CONFIG.CLAUDE_MODEL,
      max_tokens: 1024,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userMessage }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '(Sin respuesta)';
}

// ---- Chat UI -----------------------------------------

function initChat() {
  const fab     = document.getElementById('chatFab');
  const panel   = document.getElementById('chatPanel');
  const closeBtn = document.getElementById('chatClose');
  const input   = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSend');
  const msgs    = document.getElementById('chatMessages');

  if (!fab) return;

  fab.addEventListener('click', () => panel.classList.toggle('open'));
  closeBtn.addEventListener('click', () => panel.classList.remove('open'));

  async function send() {
    const text = input.value.trim();
    if (!text) return;

    appendMsg(text, 'user');
    input.value = '';
    sendBtn.disabled = true;

    const loadingEl = appendMsg('Pensando...', 'bot loading');

    try {
      const ctx = await dbGetResumenContexto();
      const reply = await claudeChat(text, ctx);
      loadingEl.classList.remove('loading');
      loadingEl.textContent = reply;
    } catch (e) {
      loadingEl.classList.remove('loading');
      loadingEl.classList.add('error');
      loadingEl.textContent = 'Error: ' + e.message;
    } finally {
      sendBtn.disabled = false;
    }
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });

  function appendMsg(text, className) {
    const el = document.createElement('div');
    el.className = 'msg ' + className;
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }
}
