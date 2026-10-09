(function () {
  var launcher = document.getElementById('chatLauncher');
  var widget = document.getElementById('chatWidget');
  var body = document.getElementById('chatWidgetBody');
  var title = document.getElementById('chatWidgetTitle');
  var note = document.getElementById('chatWidgetNote');
  var chat = null;
  var events = null;
  var storageKey = 'ax_customer_live_chat';
  var apiBase = (new URLSearchParams(window.location.search).get('apiBase') || '').replace(/\/+$/, '');

  function esc(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function api(path, options) {
    options = options || {};
    options.headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    return fetch(apiBase + '/api' + path, options).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok) throw new Error(data.error || 'Could not connect to support.');
        return data;
      });
    });
  }

  function setOpen(open) {
    widget.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    if (open) {
      if (chat) { renderChat(); refreshMessages(); connect(); }
      else renderChoices();
    }
  }

  function renderChoices() {
    title.textContent = 'How can we help?';
    note.textContent = '';
    body.innerHTML = '<p>Choose a way to contact the Axlerate team.</p><div class="chat-widget-choice"><button class="btn" type="button" id="widgetLive">Live chat with an agent</button><button class="btn line" type="button" id="widgetWhatsApp">WhatsApp the store</button></div>';
    document.getElementById('widgetLive').addEventListener('click', renderStartForm);
    document.getElementById('widgetWhatsApp').addEventListener('click', openWhatsApp);
  }

  function renderStartForm() {
    title.textContent = 'Start a live chat';
    body.innerHTML = '<form class="chat-widget-form" id="widgetStartForm"><label class="fld">Your name<input class="in" name="name" maxlength="160" autocomplete="name" required></label><label class="fld">Email (optional)<input class="in" name="email" type="email" maxlength="254" autocomplete="email"></label><label class="fld">Message<textarea class="in" name="message" maxlength="4000" rows="3" required placeholder="How can we help?"></textarea></label><button class="btn" type="submit">Start chatting</button><button class="btn line" id="widgetBack" type="button">Back to contact options</button></form>';
    document.getElementById('widgetBack').addEventListener('click', renderChoices);
    document.getElementById('widgetStartForm').addEventListener('submit', beginChat);
  }

  async function beginChat(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var submit = form.querySelector('[type=submit]');
    submit.disabled = true;
    note.textContent = 'Connecting you to support…';
    var customer = { name: form.elements.name.value.trim(), email: form.elements.email.value.trim() };
    try {
      var created = await api('/chat', { method: 'POST', body: JSON.stringify({ customer: customer }) });
      chat = { id: created.conversation.id, guestToken: created.guestToken, customer: customer };
      localStorage.setItem(storageKey, JSON.stringify(chat));
      await api('/chat/' + encodeURIComponent(chat.id) + '/messages', { method: 'POST', headers: { 'X-Chat-Token': chat.guestToken }, body: JSON.stringify({ body: form.elements.message.value.trim() }) });
      note.textContent = '';
      renderChat();
      refreshMessages();
      connect();
    } catch (error) {
      note.textContent = error.message;
      submit.disabled = false;
    }
  }

  function renderChat() {
    title.textContent = 'Live chat with Axlerate';
    body.innerHTML = '<p class="tiny">A parts specialist will reply here. Keep this page open for live updates.</p><div class="chat-box" id="widgetMessages" aria-live="polite"></div><form class="chat-compose" id="widgetReply"><input class="in" name="message" maxlength="4000" placeholder="Type your message…" aria-label="Your message" required><button class="btn" type="submit">Send</button></form><button class="btn line sm" id="widgetOther" type="button" style="margin-top:10px">Contact options</button>';
    document.getElementById('widgetReply').addEventListener('submit', sendMessage);
    document.getElementById('widgetOther').addEventListener('click', renderChoices);
  }

  async function refreshMessages() {
    if (!chat) return;
    try {
      var result = await api('/chat/' + encodeURIComponent(chat.id) + '/messages', { headers: { 'X-Chat-Token': chat.guestToken } });
      var target = document.getElementById('widgetMessages');
      if (!target) return;
      target.innerHTML = result.messages.map(function (message) {
        return '<div class="chat-msg ' + (message.sender === 'customer' ? 'mine' : '') + '">' + esc(message.body) + '<span class="chat-meta">' + (message.sender === 'admin' ? 'Axlerate support' : 'You') + ' · ' + new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</span></div>';
      }).join('') || '<p class="note">Chat started. Send a message and an agent will reply here.</p>';
      target.scrollTop = target.scrollHeight;
    } catch (error) { note.textContent = error.message; }
  }

  async function sendMessage(event) {
    event.preventDefault();
    var input = event.currentTarget.elements.message;
    var message = input.value.trim();
    if (!message) return;
    input.value = '';
    try {
      await api('/chat/' + encodeURIComponent(chat.id) + '/messages', { method: 'POST', headers: { 'X-Chat-Token': chat.guestToken }, body: JSON.stringify({ body: message }) });
      await refreshMessages();
    } catch (error) { input.value = message; note.textContent = error.message; }
  }

  function connect() {
    if (!chat || events) return;
    events = new EventSource(apiBase + '/api/chat/' + encodeURIComponent(chat.id) + '/stream?token=' + encodeURIComponent(chat.guestToken));
    events.addEventListener('message', refreshMessages);
    events.onerror = function () { events.close(); events = null; };
  }

  async function openWhatsApp() {
    var tab = window.open('about:blank', '_blank');
    note.textContent = 'Opening WhatsApp…';
    try {
      var config = await api('/config');
      if (!config.whatsappAdminNumber || config.whatsappIsSample) {
        if (tab) tab.close();
        note.textContent = 'WhatsApp is not configured yet. Please use live chat or set WHATSAPP_ADMIN_NUMBER in the backend.';
        return;
      }
      var greeting = chat && chat.customer && chat.customer.name
        ? 'Hello Axlerate, I am ' + chat.customer.name + '. I have a question about a car part.'
        : 'Hello Axlerate, I have a question about a car part.';
      var number = String(config.whatsappAdminNumber).replace(/\D/g, '');
      var url = 'https://wa.me/' + number + '?text=' + encodeURIComponent(greeting);
      if (tab) tab.location.href = url;
      else window.location.href = url;
      note.textContent = '';
    } catch (error) {
      if (tab) tab.close();
      note.textContent = error.message;
    }
  }

  try {
    var saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && saved.id && saved.guestToken) chat = saved;
  } catch { localStorage.removeItem(storageKey); }
  launcher.addEventListener('click', function () { setOpen(widget.hidden); });
  document.getElementById('chatWidgetClose').addEventListener('click', function () { setOpen(false); });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !widget.hidden) setOpen(false); });
})();
