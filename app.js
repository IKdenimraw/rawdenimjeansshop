var API_KEY = 'AIzaSyC6EMILqz6fZgsh9hh0qs4oPMv5kCxvQqI';
var API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + API_KEY;
var KB_URL = 'https://ikdenimraw.github.io/rawdenimjeansshop/knowledge_base.json';
var SP_URL = 'https://ikdenimraw.github.io/rawdenimjeansshop/system_prompt.txt';

var KB = null;
var SP = null;
var history = [];
var busy = false;

var statusBar = document.getElementById('statusBar');
var errorBar = document.getElementById('errorBar');
var welcomeView = document.getElementById('welcomeView');
var chatView = document.getElementById('chatView');
var chatArea = document.getElementById('chatArea');
var welcomeInput = document.getElementById('welcomeInput');
var chatInput = document.getElementById('chatInput');
var welcomeBtn = document.getElementById('welcomeBtn');
var sendBtn = document.getElementById('sendBtn');

statusBar.textContent = 'Laster kunnskapsbase...';
statusBar.style.display = 'block';

Promise.all([
  fetch(KB_URL).then(function(r) {
    if (!r.ok) throw new Error('KB HTTP ' + r.status);
    return r.json();
  }),
  fetch(SP_URL).then(function(r) {
    if (!r.ok) throw new Error('SP HTTP ' + r.status);
    return r.text();
  })
]).then(function(results) {
  KB = results[0];
  SP = results[1];
  statusBar.style.display = 'none';
  console.log('Resources loaded OK');
}).catch(function(err) {
  console.error('Load error:', err);
  statusBar.textContent = 'Kunne ikke laste ressurser (' + err.message + ') — last siden på nytt.';
});

function fmt(text) {
  var html = '';
  var paragraphs = text.split('\n\n');
  for (var i = 0; i < paragraphs.length; i++) {
    var p = paragraphs[i].trim();
    if (!p) continue;
    p = p.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    p = p.replace(/^#{1,3} (.+)$/gm, '<strong>$1</strong>');
    p = p.replace(/\n/g, '<br>');
    html += '<p>' + p + '</p>';
  }
  return html || '<p>' + text + '</p>';
}

function switchToChat() {
  welcomeView.style.display = 'none';
  chatView.style.display = 'flex';
}

function addMsg(role, text) {
  var wrap = document.createElement('div');
  wrap.className = role === 'user' ? 'msg user' : 'msg';
  var av = document.createElement('div');
  av.className = role === 'user' ? 'avatar user' : 'avatar bot';
  av.textContent = role === 'user' ? 'DU' : 'RAW';
  var bub = document.createElement('div');
  bub.className = 'bubble';
  bub.innerHTML = role === 'user' ? '<p>' + text + '</p>' : fmt(text);
  wrap.appendChild(av);
  wrap.appendChild(bub);
  chatArea.appendChild(wrap);
  chatArea.scrollTop = chatArea.scrollHeight;
}

function showTyping() {
  var wrap = document.createElement('div');
  wrap.className = 'msg';
  wrap.id = 'typing';
  var av = document.createElement('div');
  av.className = 'avatar bot';
  av.textContent = 'RAW';
  var bub = document.createElement('div');
  bub.className = 'bubble';
  bub.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
  wrap.appendChild(av);
  wrap.appendChild(bub);
  chatArea.appendChild(wrap);
  chatArea.scrollTop = chatArea.scrollHeight;
}

function removeTyping() {
  var t = document.getElementById('typing');
  if (t) t.parentNode.removeChild(t);
}

function showError(msg) {
  errorBar.textContent = msg;
  errorBar.style.display = 'block';
  setTimeout(function() { errorBar.style.display = 'none'; }, 7000);
}

function setDisabled(val) {
  busy = val;
  welcomeBtn.disabled = val;
  sendBtn.disabled = val;
}

function doSend(text) {
  if (!text || busy) return;
  if (!KB || !SP) {
    showError('Kunnskapsbasen laster fortsatt — vent litt og prøv igjen.');
    return;
  }

  switchToChat();
  addMsg('user', text);
  history.push({role: 'user', parts: [{text: text}]});
  setDisabled(true);
  showTyping();

  var systemText = SP + '\n\nKUNNSKAPSBASE:\n' + JSON.stringify(KB);
  var messages = [
    {role: 'user', parts: [{text: systemText}]},
    {role: 'model', parts: [{text: 'Forstått! Jeg er klar til å hjelpe kunder av Raw Denim Norway.'}]}
  ];
  for (var i = 0; i < history.length; i++) {
    messages.push(history[i]);
  }

  fetch(API_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({contents: messages, generationConfig: {temperature: 0.7, maxOutputTokens: 1024}})
  })
  .then(function(res) {
    return res.json().then(function(d) { return {ok: res.ok, data: d}; });
  })
  .then(function(result) {
    removeTyping();
    if (!result.ok) {
      var msg = (result.data.error && result.data.error.message) ? result.data.error.message : 'API-feil';
      throw new Error(msg);
    }
    var reply = result.data.candidates[0].content.parts[0].text;
    history.push({role: 'model', parts: [{text: reply}]});
    addMsg('bot', reply);
  })
  .catch(function(err) {
    removeTyping();
    history.pop();
    showError('Feil: ' + err.message);
  })
  .then(function() {
    setDisabled(false);
    chatInput.focus();
  }, function() {
    setDisabled(false);
    chatInput.focus();
  });
}

welcomeBtn.addEventListener('click', function() {
  var text = welcomeInput.value.trim();
  welcomeInput.value = '';
  doSend(text);
});

welcomeInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    var text = welcomeInput.value.trim();
    welcomeInput.value = '';
    doSend(text);
  }
});

sendBtn.addEventListener('click', function() {
  var text = chatInput.value.trim();
  chatInput.value = '';
  chatInput.style.height = 'auto';
  doSend(text);
});

chatInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    var text = chatInput.value.trim();
    chatInput.value = '';
    chatInput.style.height = 'auto';
    doSend(text);
  }
});

welcomeInput.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

chatInput.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

var chips = document.querySelectorAll('.chip');
for (var i = 0; i < chips.length; i++) {
  chips[i].addEventListener('click', function() {
    doSend(this.textContent.trim());
  });
}