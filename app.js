var KB = null;
var SP = null;

function loadResources(callback) {
  var statusBar = document.getElementById('statusBar');
  statusBar.textContent = 'Laster kunnskapsbase...';
  statusBar.style.display = 'block';

  Promise.all([
    fetch('/data/knowledge_base.json').then(function(r) {
      if (!r.ok) throw new Error('KB ' + r.status);
      return r.json();
    }),
    fetch('/data/system_prompt.txt').then(function(r) {
      if (!r.ok) throw new Error('SP ' + r.status);
      return r.text();
    })
  ]).then(function(results) {
    KB = results[0];
    SP = results[1];
    statusBar.style.display = 'none';
    console.log('Resources loaded OK');
    if (callback) callback();
  }).catch(function(err) {
    statusBar.textContent = 'Kunne ikke laste ressurser — last siden på nytt.';
    console.error('Load error:', err);
  });
}



var chatHistory = [];
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

statusBar.style.display = 'none';

function fmt(text) {
  // Links first: [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:inherit;text-decoration:underline;">$1</a>');
  // Bold: **text**
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');

  var blocks = text.split(/\n\n+/);
  var html = '';

  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i].trim();
    if (!block) continue;

    var lines = block.split('\n');
    var bulletLines = [];
    var isList = true;

    for (var j = 0; j < lines.length; j++) {
      var l = lines[j].trim();
      if (!l) continue;
      if (l.match(/^[\*\-] /)) {
        bulletLines.push(l.replace(/^[\*\-] /, ''));
      } else if (l.match(/^\d+\. /)) {
        bulletLines.push(l.replace(/^\d+\. /, ''));
      } else {
        isList = false;
        break;
      }
    }

    if (isList && bulletLines.length > 1) {
      html += '<ul style="margin:8px 0 8px 18px;">';
      for (var k = 0; k < bulletLines.length; k++) {
        html += '<li style="margin-bottom:6px;">' + bulletLines[k] + '</li>';
      }
      html += '</ul>';
    } else {
      var p = block.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
      p = p.replace(/^#{1,3} (.+)$/gm, '<strong>$1</strong>');
      p = p.replace(/\n/g, '<br>');
      html += '<p>' + p + '</p>';
    }
  }

  return html || '<p>' + text + '</p>';
}

function switchToChat() {
  welcomeView.style.display = 'none';
  chatView.style.display = 'flex';
}

function addMsg(role, text) {
  var inner = document.getElementById('chatInner');
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
  inner.appendChild(wrap);
  chatArea.scrollTop = chatArea.scrollHeight;
}

var typingMessages = [
  'Søker i Raw Denim Guiden...',
  'Sjekker produktdatabasen...',
  'Grünerløkka-eksperten tenker...',
  'Henter fra 10 års denimnerderi...',
  'Vi holder til i Thorvald Meyers gate 50...',
  'Åpent man-lør 11:30-18:00...',
  'Følg oss på Instagram @rawdenimnorway...',
  'Sjekker kunnskapsbasen...'
];
var typingInterval = null;

function showTyping() {
  var inner = document.getElementById('chatInner');
  var wrap = document.createElement('div');
  wrap.className = 'msg';
  wrap.id = 'typing';
  var av = document.createElement('div');
  av.className = 'avatar bot';
  av.textContent = 'RAW';
  var bub = document.createElement('div');
  bub.className = 'bubble';
  var idx = 0;
  bub.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div><div class="typing-status">' + typingMessages[0] + '</div>';
  typingInterval = setInterval(function() {
    idx = (idx + 1) % typingMessages.length;
    var status = bub.querySelector('.typing-status');
    if (status) status.textContent = typingMessages[idx];
  }, 2000);
  wrap.appendChild(av);
  wrap.appendChild(bub);
  inner.appendChild(wrap);
  document.getElementById('chatArea').scrollTop = document.getElementById('chatArea').scrollHeight;
}

function removeTyping() {
  if (typingInterval) { clearInterval(typingInterval); typingInterval = null; }
  var t = document.getElementById('typing');
  if (t) t.parentNode.removeChild(t);
}

function showError(msg) {
  errorBar.textContent = msg;
  errorBar.style.display = 'block';
  setTimeout(function() { errorBar.style.display = 'none'; }, 8000);
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
  chatHistory.push({role: 'user', parts: [{text: text}]});
  setDisabled(true);
  showTyping();

  var systemText = SP + '\n\nKUNNSKAPSBASE:\n' + JSON.stringify(KB);
  var messages = [
    {role: 'user', parts: [{text: systemText}]},
    {role: 'model', parts: [{text: 'Forstatt! Jeg er klar til a hjelpe kunder av Raw Denim Norway.'}]}
  ];
  for (var i = 0; i < chatHistory.length; i++) {
    messages.push(chatHistory[i]);
  }

  fetch(API_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      contents: messages,
      generationConfig: {temperature: 0.7, maxOutputTokens: 2048}
    })
  })
  .then(function(res) {
    return res.json().then(function(d) {
      return {ok: res.ok, data: d};
    });
  })
  .then(function(result) {
    removeTyping();
    if (!result.ok) {
      var msg = result.data && result.data.error ? result.data.error.message : 'API-feil';
      throw new Error(msg);
    }
    var reply = result.data.candidates[0].content.parts[0].text;
    chatHistory.push({role: 'model', parts: [{text: reply}]});
    addMsg('bot', reply);
    setDisabled(false);
    chatInput.focus();
  })
  .catch(function(err) {
    removeTyping();
    chatHistory.pop();
    showError('Feil: ' + err.message);
    setDisabled(false);
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



console.log('RAW Denim chatbot loaded OK')
/* LANGUAGE */
