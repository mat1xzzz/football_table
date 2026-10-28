(function () {
  'use strict';

  var THEMES = { light: 'light', dark: 'dark' };

/* ── Тема ──────────────────────────────────── */

var themeBtn = document.getElementById('btn-theme');
var root = document.documentElement;

function applyTheme(theme) {
  root.setAttribute('data-theme', theme);
  themeBtn.textContent = theme === THEMES.dark ? '☀️' : '🌙';
  try {
    localStorage.setItem('fb-board-theme', theme);
  } catch (e) { /* file:// может запрещать хранилище */ }
}

  function initTheme() {
    var saved = null;
    try {
      saved = localStorage.getItem('fb-board-theme');
    } catch (e) { /* нет доступа */ }
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved === THEMES.dark || saved === THEMES.light ? saved : (prefersDark ? THEMES.dark : THEMES.light));
  }

  themeBtn.addEventListener('click', function () {
    applyTheme(root.getAttribute('data-theme') === THEMES.dark ? THEMES.light : THEMES.dark);
  });

/* ── Повернуть поле ────────────────────────── */

var FIELD_ASPECT = 1200 / 780;

var state = {
  orientation: 'horizontal' /* 'horizontal' | 'vertical' */
};

var btnRotate = document.getElementById('btn-rotate');
var fieldWrap = document.getElementById('field-wrap');
var rotator = document.getElementById('field-rotator');
var orientationLabel = document.getElementById('orientation');
var rotating = false;
var angle = 0;

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) { /* file:// может запрещать хранилище */ }
}

/* Подбирает размеры контейнера поля так, чтобы оно целиком
   помещалось в доступную область и сохраняло пропорции.
   В вертикальном режиме контейнер повёрнут на 90°,
   поэтому после поворования ширина и высота меняются местами. */
function fitField() {
  var availW = fieldWrap.clientWidth;
  var availH = fieldWrap.clientHeight;
  var w;

  if (state.orientation === 'horizontal') {
    w = Math.min(availW, availH * FIELD_ASPECT);
  } else {
    /* повёрнутые габариты: ширина контейнера -> высота экрана, высота -> ширина */
    w = Math.min(availH, availW * FIELD_ASPECT);
  }

  w = Math.max(0, Math.floor(w));
  rotator.style.width = w + 'px';
  rotator.style.height = Math.max(0, Math.floor(w / FIELD_ASPECT)) + 'px';
}

function applyOrientation(animate) {
  var vertical = state.orientation === 'vertical';
  orientationLabel.textContent = vertical ? 'Вертикальная' : 'Горизонтальная';
  fitField();

  if (!animate) {
    angle = vertical ? 90 : 0;
    rotator.style.transform = 'rotate(' + angle + 'deg)';
    updateTokenRotation(angle, false);
    return;
  }

  if (rotating) return;
  rotating = true;

  var targetAngle = angle + 90;
  updateTokenRotation(targetAngle % 360, true);

  anime({
    targets: rotator,
    rotate: targetAngle,
    scale: [1, 0.9, 1],
    duration: 700,
    easing: 'easeInOutCubic',
    complete: function () {
      angle = targetAngle % 360;
      rotator.style.transform = 'rotate(' + angle + 'deg)';
      updateTokenRotation(angle, false);
      rotating = false;
    }
  });
}

btnRotate.addEventListener('click', function () {
  if (rotating) return;
  state.orientation = state.orientation === 'horizontal' ? 'vertical' : 'horizontal';
  storageSet('fb-board-orientation', state.orientation);
  applyOrientation(true);
});

window.addEventListener('resize', fitField);

/* ── Боковая панель ────────────────────────── */

var btnMenu = document.getElementById('btn-menu');
var sidebar = document.getElementById('sidebar');

btnMenu.addEventListener('click', function () {
  sidebar.classList.toggle('collapsed');
  var collapsed = sidebar.classList.contains('collapsed');
  anime({
    targets: btnMenu,
    scale: [1, 0.92, 1],
    duration: 320,
    easing: 'easeOutQuad'
  });
});

  /* ── Инструменты (заготовка этапа 1) ───────── */

  var counter = document.getElementById('counter');
  var count = 0;

  document.querySelectorAll('.tool-grid .tool-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!btn.dataset.action) {
        var siblings = btn.parentElement.querySelectorAll('.tool-btn');
        siblings.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        document.getElementById('mode').textContent = btn.textContent.trim();
      }

      anime({
        targets: btn,
        scale: [1, 0.92, 1],
        duration: 320,
        easing: 'easeOutQuad'
      });

      if (btn.dataset.action === 'clear') {
        clearField();
      }
    });
  });

  /* ── Составы команд ───────────────────────── */

  var PLAYERS_KEY = 'fb-board-players-v1';
  var players = []; /* { id, name, number, team: 'own'|'opponent', status: 'start'|'bench' } */
  var cardEls = {};

  var playerForm = document.getElementById('player-form');
  var playerNameInput = document.getElementById('player-name');
  var playerNumberInput = document.getElementById('player-number');
  var playerTargetSelect = document.getElementById('player-target');
  var listStart = document.getElementById('list-start');
  var listBench = document.getElementById('list-bench');
  var listOpponent = document.getElementById('list-opponent');

  function getPlayer(id) {
    for (var i = 0; i < players.length; i++) {
      if (players[i].id === id) return players[i];
    }
    return null;
  }

  function getListEl(p) {
    if (p.team === 'opponent') return listOpponent;
    return p.status === 'start' ? listStart : listBench;
  }

  function validPos(value) {
    return !!value && typeof value === 'object' &&
      isFinite(value.x) && isFinite(value.y) &&
      value.x >= 0 && value.x <= 1 && value.y >= 0 && value.y <= 1;
  }

  function loadPlayers() {
    var raw = storageGet(PLAYERS_KEY);
    if (!raw) return;
    try {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        players = parsed
          .filter(function (p) { return p && typeof p === 'object' && p.id && typeof p.name === 'string'; })
          .map(function (p) {
            return {
              id: String(p.id),
              name: String(p.name),
              number: p.number == null ? '' : String(p.number),
              team: p.team === 'opponent' ? 'opponent' : 'own',
              status: p.status === 'bench' ? 'bench' : 'start',
              /* позиция на поле в долях 0–1 (x — вдоль длины поля, y — вдоль ширины) */
              pos: validPos(p.pos) ? { x: Number(p.pos.x), y: Number(p.pos.y) } : null
            };
          });
      }
    } catch (e) {
      players = [];
    }
  }

  function savePlayers() {
    storageSet(PLAYERS_KEY, JSON.stringify(players));
  }

  function makeId() {
    return 'p' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function normalizeNumber(value) {
    return String(value).replace(/\D/g, '').slice(0, 3);
  }

  function updateHints() {
    [listStart, listBench, listOpponent].forEach(function (list) {
      var hint = list.parentElement.querySelector('.list-empty');
      if (hint) hint.hidden = list.children.length > 0;
    });
  }

  function buildCard(p) {
    var li = document.createElement('li');
    li.className = 'player-card';
    li.dataset.id = p.id;

    var main = document.createElement('div');
    main.className = 'player-main';
    var nameEl = document.createElement('span');
    nameEl.className = 'player-name';
    main.appendChild(nameEl);
    var badge = document.createElement('span');
    badge.className = 'on-field-badge';
    badge.textContent = 'на поле';
    main.appendChild(badge);
    li.appendChild(main);

    var actions = document.createElement('div');
    actions.className = 'player-actions';

    var moveBtn = document.createElement('button');
    moveBtn.type = 'button';
    moveBtn.className = 'mini-btn move-btn';
    moveBtn.addEventListener('click', function () { movePlayer(p.id); });
    actions.appendChild(moveBtn);

    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'mini-btn edit-btn';
    editBtn.textContent = 'Изменить';
    editBtn.addEventListener('click', function () { startEdit(p.id); });
    actions.appendChild(editBtn);

    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'mini-btn danger remove-btn';
    delBtn.textContent = 'Удалить';
    delBtn.addEventListener('click', function () { removePlayer(p.id); });
    actions.appendChild(delBtn);

    li.appendChild(actions);

    var editBox = document.createElement('div');
    editBox.className = 'player-edit';
    editBox.hidden = true;

    var editName = document.createElement('input');
    editName.className = 'player-input edit-name';
    editName.type = 'text';
    editName.maxLength = 40;
    editName.placeholder = 'Имя игрока';

    var editNumber = document.createElement('input');
    editNumber.className = 'player-input edit-number';
    editNumber.type = 'text';
    editNumber.inputMode = 'numeric';
    editNumber.maxLength = 3;
    editNumber.placeholder = '№ (необяз.)';
    editNumber.addEventListener('input', function () {
      editNumber.value = normalizeNumber(editNumber.value);
    });

    var editActions = document.createElement('div');
    editActions.className = 'edit-actions';

    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'mini-btn primary';
    saveBtn.textContent = 'Сохранить';
    saveBtn.addEventListener('click', function () { endEdit(p.id, true); });

    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'mini-btn';
    cancelBtn.textContent = 'Отмена';
    cancelBtn.addEventListener('click', function () { endEdit(p.id, false); });

    editActions.appendChild(saveBtn);
    editActions.appendChild(cancelBtn);
    editBox.appendChild(editName);
    editBox.appendChild(editNumber);
    editBox.appendChild(editActions);
    li.appendChild(editBox);

    li.addEventListener('pointerdown', onCardPointerDown);

    editName.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') endEdit(p.id, true);
      if (e.key === 'Escape') endEdit(p.id, false);
    });
    editNumber.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') endEdit(p.id, true);
      if (e.key === 'Escape') endEdit(p.id, false);
    });

    refreshCard(p, li);
    cardEls[p.id] = li;
    return li;
  }

  function refreshCard(p, cardEl) {
    var li = cardEl || cardEls[p.id];
    if (!li) return;
    li.querySelector('.player-name').textContent = p.number ? '№' + p.number + ' ' + p.name : p.name;
    li.classList.toggle('on-field', !!(p && p.pos));
    var moveBtn = li.querySelector('.move-btn');
    if (moveBtn) moveBtn.textContent = p.status === 'start' ? 'Запасной' : 'Основа';
    li.querySelector('.edit-name').value = p.name;
    li.querySelector('.edit-number').value = p.number;
  }

  function animateShake(el) {
    anime({
      targets: el,
      translateX: [-6, 6, -6, 6, 0],
      duration: 350,
      easing: 'easeOutQuad'
    });
  }

  function appendCard(p, animate) {
    var card = buildCard(p);
    getListEl(p).appendChild(card);
    updateHints();
    if (animate) {
      anime({
        targets: card,
        opacity: [0, 1],
        translateX: [-24, 0],
        duration: 400,
        easing: 'easeOutCubic'
      });
    }
  }

  function addPlayer(name, number, team, status) {
    var p = { id: makeId(), name: name, number: number, team: team, status: status || 'start' };
    players.push(p);
    savePlayers();
    appendCard(p, true);
  }

  function removePlayer(id) {
    var card = cardEls[id];
    var token = tokenEls ? tokenEls[id] : null;
    players = players.filter(function (p) { return p.id !== id; });
    savePlayers();
    delete cardEls[id];
    if (token) {
      delete tokenEls[id];
      token.remove();
      syncCounter();
    }
    if (!card) { updateHints(); return; }
    card.classList.add('removing');
    var cs = getComputedStyle(card);
    anime({
      targets: card,
      height: [card.offsetHeight, 0],
      paddingTop: [parseFloat(cs.paddingTop), 0],
      paddingBottom: [parseFloat(cs.paddingBottom), 0],
      opacity: [1, 0],
      duration: 320,
      easing: 'easeInQuad',
      complete: function () {
        card.remove();
        updateHints();
      }
    });
  }

  function movePlayer(id) {
    var p = getPlayer(id);
    var card = cardEls[id];
    if (!p || !card || p.team === 'opponent') return;
    p.status = p.status === 'start' ? 'bench' : 'start';
    savePlayers();
    refreshCard(p);

    /* Анимация перелёта (FLIP): запоминаем позицию до, переносим, летим из разницы */
    var first = card.getBoundingClientRect();
    getListEl(p).appendChild(card);
    updateHints();
    var last = card.getBoundingClientRect();
    var dx = first.left - last.left;
    var dy = first.top - last.top;
    if (dx || dy) {
      anime({
        targets: card,
        translateX: [dx, 0],
        translateY: [dy, 0],
        duration: 450,
        easing: 'easeOutCubic'
      });
    }
  }

  function startEdit(id) {
    var p = getPlayer(id);
    var card = cardEls[id];
    if (!p || !card || card.classList.contains('editing')) return;
    refreshCard(p);
    card.classList.add('editing');
    card.querySelector('.player-main').hidden = true;
    card.querySelector('.player-actions').hidden = true;
    var box = card.querySelector('.player-edit');
    box.hidden = false;
    box.querySelector('.edit-name').focus();
  }

  function endEdit(id, apply) {
    var p = getPlayer(id);
    var card = cardEls[id];
    if (!p || !card || !card.classList.contains('editing')) return;
    var box = card.querySelector('.player-edit');
    if (apply) {
      var nameVal = box.querySelector('.edit-name').value.trim();
      if (!nameVal) {
        var nameInput = box.querySelector('.edit-name');
        nameInput.focus();
        animateShake(nameInput);
        return;
      }
      p.name = nameVal;
      p.number = normalizeNumber(box.querySelector('.edit-number').value);
      savePlayers();
      updateTokenText(p);
    }
    card.classList.remove('editing');
    box.hidden = true;
    card.querySelector('.player-main').hidden = false;
    card.querySelector('.player-actions').hidden = false;
    refreshCard(p);
  }

  function renderAllPlayers() {
    players.forEach(function (p) {
      appendCard(p, false);
      if (p.pos) showToken(p);
    });
    updateHints();
    syncCounter();
  }

  playerNumberInput.addEventListener('input', function () {
    playerNumberInput.value = normalizeNumber(playerNumberInput.value);
  });

  playerForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = playerNameInput.value.trim();
    if (!name) {
      playerNameInput.focus();
      animateShake(playerNameInput);
      return;
    }
    var target = playerTargetSelect.value;
    var team = target === 'opponent' ? 'opponent' : 'own';
    var status = target === 'own-bench' ? 'bench' : 'start';
    addPlayer(name, normalizeNumber(playerNumberInput.value), team, status);
    playerNameInput.value = '';
    playerNumberInput.value = '';
    playerNameInput.focus();
  });

  /* ── Игроки на поле ───────────────────────── */

  var tokenEls = {}; /* id -> DOM-элемент круга на поле */
  var drag = null;   /* текущее перетаскивание */

  var tokensLayer = document.createElement('div');
  tokensLayer.className = 'tokens-layer';
  rotator.appendChild(tokensLayer);

  function round4(value) {
    return Math.round(value * 10000) / 10000;
  }

  /* Точка курсора в координатах поля (0..1). Поворот учитывается
     через матрицу transform контейнера поля. */
  function localFieldPoint(clientX, clientY) {
    var rect = rotator.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var cos = 1;
    var sin = 0;
    var transform = getComputedStyle(rotator).transform;
    if (transform && transform !== 'none') {
      try {
        var m = new DOMMatrixReadOnly(transform);
        var len = Math.hypot(m.a, m.b) || 1;
        cos = m.a / len;
        sin = m.b / len;
      } catch (err) {
        var rad = (angle % 360) * Math.PI / 180;
        cos = Math.cos(rad);
        sin = Math.sin(rad);
      }
    }
    var dx = clientX - cx;
    var dy = clientY - cy;
    var W = rotator.offsetWidth || 1;   /* длина поля (локальная ось x) */
    var H = rotator.offsetHeight || 1;  /* ширина поля (локальная ось y) */
    return {
      u: 0.5 + (dx * cos + dy * sin) / W,
      v: 0.5 + (-dx * sin + dy * cos) / H
    };
  }

  function isInsideField(pt) {
    return pt.u >= 0 && pt.u <= 1 && pt.v >= 0 && pt.v <= 1;
  }

  function isOverField(clientX, clientY) {
    return isInsideField(localFieldPoint(clientX, clientY));
  }

  var fieldSvg = document.getElementById('field');

  function setFieldHighlight(on) {
    fieldSvg.classList.toggle('drop-ready', !!on);
  }

  /* Держит круг целиком внутри поля */
  function clampPos(u, v) {
    var W = rotator.offsetWidth || 1;
    var H = rotator.offsetHeight || 1;
    var r = 17; /* радиус круга в px */
    var mu = Math.min(0.5, r / W);
    var mv = Math.min(0.5, r / H);
    return {
      u: Math.min(1 - mu, Math.max(mu, u)),
      v: Math.min(1 - mv, Math.max(mv, v))
    };
  }

  /* Угол подписи, обратный повороту поля, чтобы текст не вставал боком */
  function tokenInnerDeg(newAngle) {
    return ((-newAngle % 360) + 360) % 360;
  }

  function setInnerRotations(deg) {
    var inners = tokensLayer.querySelectorAll('.token-inner');
    for (var i = 0; i < inners.length; i++) {
      inners[i].style.transform = 'rotate(' + deg + 'deg)';
    }
  }

  function updateTokenRotation(newAngle, animate) {
    var deg = tokenInnerDeg(newAngle);
    var inners = tokensLayer.querySelectorAll('.token-inner');
    if (!inners.length) return;
    if (animate) {
      anime({
        targets: inners,
        rotate: deg,
        duration: 700,
        easing: 'easeInOutCubic',
        complete: function () { setInnerRotations(deg); }
      });
    } else {
      setInnerRotations(deg);
    }
  }

  function createTokenEl(p) {
    var el = document.createElement('div');
    el.className = 'token ' + (p.team === 'opponent' ? 'token-opponent' : 'token-own');
    el.dataset.id = p.id;

    var scale = document.createElement('div');
    scale.className = 'token-scale';

    var inner = document.createElement('div');
    inner.className = 'token-inner';
    inner.style.transform = 'rotate(' + tokenInnerDeg(angle) + 'deg)';

    var disc = document.createElement('div');
    disc.className = 'token-disc';
    var num = document.createElement('span');
    num.textContent = p.number || '';
    disc.appendChild(num);

    var label = document.createElement('div');
    label.className = 'token-label';
    label.textContent = p.name;

    inner.appendChild(disc);
    inner.appendChild(label);
    scale.appendChild(inner);
    el.appendChild(scale);
    return el;
  }

  function placeToken(el, p) {
    el.style.left = (p.pos.x * 100) + '%';
    el.style.top = (p.pos.y * 100) + '%';
  }

  function updateTokenText(p) {
    var el = tokenEls[p.id];
    if (!el) return;
    el.querySelector('.token-disc span').textContent = p.number || '';
    el.querySelector('.token-label').textContent = p.name;
    el.classList.toggle('token-own', p.team !== 'opponent');
    el.classList.toggle('token-opponent', p.team === 'opponent');
  }

  function showToken(p) {
    if (!p || !p.pos) return;
    var el = tokenEls[p.id];
    if (!el) {
      el = createTokenEl(p);
      placeToken(el, p);
      tokenEls[p.id] = el;
      tokensLayer.appendChild(el);
      el.addEventListener('pointerdown', onTokenPointerDown);
      el.addEventListener('dblclick', function () {
        returnPlayerToSquad(p.id);
      });
      anime({
        targets: el.querySelector('.token-scale'),
        scale: [0, 1],
        opacity: [0, 1],
        duration: 900,
        easing: 'easeOutElastic'
      });
    } else {
      placeToken(el, p);
      updateTokenText(p);
    }
    refreshCard(p);
    syncCounter();
  }

  /* Возвращает игрока с поля в список */
  function returnPlayerToSquad(id) {
    var p = getPlayer(id);
    if (!p || !p.pos) return;
    p.pos = null;
    savePlayers();
    var el = tokenEls[id];
    delete tokenEls[id];
    refreshCard(p);
    syncCounter();
    if (!el) return;
    el.classList.add('removing');
    anime({
      targets: el.querySelector('.token-scale'),
      scale: [1, 0],
      opacity: [1, 0],
      duration: 300,
      easing: 'easeInQuad',
      complete: function () { el.remove(); }
    });
    var card = cardEls[id];
    if (card) {
      anime({
        targets: card,
        scale: [0.82, 1],
        duration: 550,
        easing: 'easeOutElastic'
      });
    }
  }

  function clearField() {
    Object.keys(tokenEls).forEach(function (id) {
      returnPlayerToSquad(id);
    });
  }

  function onFieldCount() {
    var n = 0;
    players.forEach(function (p) { if (p.pos) n++; });
    return n;
  }

  function syncCounter() {
    counter.textContent = String(onFieldCount());
  }

  /* ── Призрак при перетаскивании из списка ─── */

  function buildGhost(p) {
    var g = document.createElement('div');
    g.className = 'drag-ghost ' + (p.team === 'opponent' ? 'ghost-opponent' : 'ghost-own');
    g.textContent = (p.number ? '№' + p.number + ' ' : '') + p.name;
    document.body.appendChild(g);
    return g;
  }

  function moveGhost(ghost, x, y) {
    ghost.style.left = x + 'px';
    ghost.style.top = y + 'px';
  }

  /* Начало перетаскивания из списка (только с карточки, не с кнопок) */
  function onCardPointerDown(e) {
    var card = e.currentTarget;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('button, input, select')) return;
    if (card.classList.contains('editing') || card.classList.contains('removing')) return;
    var p = getPlayer(card.dataset.id);
    if (!p) return;
    if (p.pos) { /* игрок уже на поле — повторно тащить нельзя */
      animateShake(card);
      return;
    }
    e.preventDefault();
    try { card.setPointerCapture(e.pointerId); } catch (err) { /* необязательно */ }
    drag = {
      type: 'pending',
      id: p.id,
      card: card,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY
    };
  }

  /* Призрак появляется только после реального движения */
  function promotePendingDrag(e) {
    var dx = e.clientX - drag.startX;
    var dy = e.clientY - drag.startY;
    if (Math.hypot(dx, dy) < 6) return;
    var p = getPlayer(drag.id);
    if (!p) { drag = null; return; }
    var ghost = buildGhost(p);
    moveGhost(ghost, e.clientX, e.clientY);
    drag.card.classList.add('drag-source');
    drag.ghost = ghost;
    drag.type = 'ghost';
    setFieldHighlight(isOverField(e.clientX, e.clientY));
  }

  /* Начало перетаскивания круга по полю */
  function onTokenPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    var token = e.currentTarget;
    var p = getPlayer(token.dataset.id);
    if (!p || !p.pos) return;
    e.preventDefault();
    var pt = localFieldPoint(e.clientX, e.clientY);
    drag = {
      type: 'token',
      id: p.id,
      token: token,
      pointerId: e.pointerId,
      ox: p.pos.x - pt.u,
      oy: p.pos.y - pt.v
    };
    try { token.setPointerCapture(e.pointerId); } catch (err) { /* необязательно */ }
  }

  document.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (drag.type === 'pending') {
      promotePendingDrag(e);
      if (!drag) return;
      if (drag.type !== 'ghost') return;
    }
    if (drag.type === 'ghost') {
      moveGhost(drag.ghost, e.clientX, e.clientY);
      setFieldHighlight(isOverField(e.clientX, e.clientY));
    } else {
      var pt = localFieldPoint(e.clientX, e.clientY);
      var u = Math.min(1.5, Math.max(-0.5, pt.u + drag.ox));
      var v = Math.min(1.5, Math.max(-0.5, pt.v + drag.oy));
      drag.token.style.left = (u * 100) + '%';
      drag.token.style.top = (v * 100) + '%';
    }
  });

  document.addEventListener('pointerup', function (e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    finishDrag(e);
  });

  document.addEventListener('pointercancel', function (e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    finishDrag(e);
  });

  function finishDrag(e) {
    setFieldHighlight(false);
    var d = drag;
    drag = null;
    if (!d) return;
    if (d.type === 'pending') return; /* был просто клик по карточке */
    if (d.type === 'ghost') {
      dropGhost(e.clientX, e.clientY, d);
    } else {
      dropToken(e.clientX, e.clientY, d);
    }
  }

  function dropGhost(clientX, clientY, d) {
    var p = getPlayer(d.id);
    var pt = localFieldPoint(clientX, clientY);
    if (p && isInsideField(pt)) {
      var pos = clampPos(pt.u, pt.v);
      p.pos = { x: round4(pos.u), y: round4(pos.v) };
      savePlayers();
      d.ghost.remove();
      d.card.classList.remove('drag-source');
      showToken(p);
      return;
    }
    /* Мимо поля — призрак плавно возвращается на место */
    var rect = d.card.getBoundingClientRect();
    d.card.classList.remove('drag-source');
    anime({
      targets: d.ghost,
      left: rect.left + rect.width / 2,
      top: rect.top + rect.height / 2,
      duration: 330,
      easing: 'easeOutCubic',
      complete: function () { d.ghost.remove(); }
    });
  }

  function dropToken(clientX, clientY, d) {
    var p = getPlayer(d.id);
    if (!p || !p.pos || tokenEls[d.id] !== d.token) return;
    var pt = localFieldPoint(clientX, clientY);
    if (!isInsideField(pt)) {
      returnPlayerToSquad(d.id);
      return;
    }
    var pos = clampPos(pt.u + d.ox, pt.v + d.oy);
    p.pos = { x: round4(pos.u), y: round4(pos.v) };
    savePlayers();
    placeToken(d.token, p);
  }

  loadPlayers();
  renderAllPlayers();

  /* ── Появление при загрузке ────────────────── */

  anime.timeline({ easing: 'easeOutExpo' })
    .add({
      targets: '.toolbar',
      translateY: [-40, 0],
      opacity: [0, 1],
      duration: 700
    })
    .add({
      targets: '.sidebar .fade-item',
      translateX: [-30, 0],
      opacity: [0, 1],
      delay: anime.stagger(90),
      duration: 600
    }, '-=400')
    .add({
      targets: '.field-area',
      opacity: [0, 1],
      scale: [0.94, 1],
      duration: 700
    }, '-=350');

  /* ── Старт ─────────────────────────────────── */

  initTheme();

  var savedOrientation = storageGet('fb-board-orientation');
  if (savedOrientation === 'vertical' || savedOrientation === 'horizontal') {
    state.orientation = savedOrientation;
  }
  applyOrientation(false);

  syncCounter();
})();
