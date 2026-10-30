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

/* Размер кругов игроков: радиус относительно ширины поля.
   Эталонная ширина поля — 1200, базовый радиус — 17px,
   итоговый радиус — базовый размер, умноженный на 0.7. */
var PLAYER_REFERENCE_WIDTH = 1200;
var PLAYER_RADIUS = 17 * 1.05 * 2 * 0.7;

/* Диаметр мяча: тоже задан относительно ширины поля (эталон 1200) */
var BALL_DIAMETER = 26;

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
  setPlayerSize();
}

/* Диаметр круга в px от текущей ширины поля,
   публикуется как CSS-переменная --player-size */
function setPlayerSize() {
  var W = rotator.offsetWidth || PLAYER_REFERENCE_WIDTH;
  var d = PLAYER_RADIUS * 2 / PLAYER_REFERENCE_WIDTH * W;
  rotator.style.setProperty('--player-size', d.toFixed(2) + 'px');
  var db = BALL_DIAMETER / PLAYER_REFERENCE_WIDTH * W;
  rotator.style.setProperty('--ball-size', db.toFixed(2) + 'px');
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

  /* Мяч: позиция в долях 0–1 или null (мяча нет на поле) */
  var ball = { pos: null };
  var ballEl = null;

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
      if (btn.dataset.action === 'ball') {
        toggleBall();
      }
      if (btn.dataset.action === 'undo') {
        undoHistory();
      }
      if (btn.dataset.action === 'redo') {
        redoHistory();
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
    return String(value).replace(/\D/g, '').slice(0, 2);
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

    var editNumber = document.createElement('input');
    editNumber.className = 'player-input edit-number';
    editNumber.type = 'number';
    editNumber.inputMode = 'numeric';
    editNumber.min = '0';
    editNumber.max = '99';
    editNumber.step = '1';
    editNumber.placeholder = 'Номер (обяз.)';
    editNumber.addEventListener('input', function () {
      editNumber.value = normalizeNumber(editNumber.value);
      editNumber.classList.remove('input-error');
    });
    editNumber.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') endEdit(p.id, true);
      if (e.key === 'Escape') endEdit(p.id, false);
    });

    var editName = document.createElement('input');
    editName.className = 'player-input edit-name';
    editName.type = 'text';
    editName.maxLength = 40;
    editName.placeholder = 'Имя (необяз.)';
    editName.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') endEdit(p.id, true);
      if (e.key === 'Escape') endEdit(p.id, false);
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
    editBox.appendChild(editNumber);
    editBox.appendChild(editName);
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
    li.querySelector('.player-name').textContent = p.number
      ? '№' + p.number + (p.name ? ' ' + p.name : '')
      : p.name;
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
    pushHistory();
  }

  function removePlayer(id) {
    var card = cardEls[id];
    var token = tokenEls ? tokenEls[id] : null;
    players = players.filter(function (p) { return p.id !== id; });
    savePlayers();
    pushHistory();
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
    pushHistory();

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
    box.querySelector('.edit-number').focus();
  }

  function endEdit(id, apply) {
    var p = getPlayer(id);
    var card = cardEls[id];
    if (!p || !card || !card.classList.contains('editing')) return;
    var box = card.querySelector('.player-edit');
    if (apply) {
      var numberVal = normalizeNumber(box.querySelector('.edit-number').value);
      if (!numberVal) {
        var numberInput = box.querySelector('.edit-number');
        numberInput.classList.add('input-error');
        numberInput.focus();
        animateShake(numberInput);
        return;
      }
      p.number = numberVal;
      p.name = box.querySelector('.edit-name').value.trim();
      savePlayers();
      updateTokenText(p);
      pushHistory();
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
    playerNumberInput.classList.remove('input-error');
  });

  playerForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var numberVal = normalizeNumber(playerNumberInput.value);
    if (!numberVal) {
      playerNumberInput.classList.add('input-error');
      playerNumberInput.focus();
      animateShake(playerNumberInput);
      return;
    }
    var name = playerNameInput.value.trim();
    var target = playerTargetSelect.value;
    var team = target === 'opponent' ? 'opponent' : 'own';
    var status = target === 'own-bench' ? 'bench' : 'start';
    addPlayer(name, numberVal, team, status);
    playerNameInput.value = '';
    playerNumberInput.value = '';
    playerNameInput.focus();
  });

  [playerNumberInput, playerNameInput].forEach(function (input) {
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (playerForm.requestSubmit) playerForm.requestSubmit();
        else playerForm.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    });
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

  /* Радиус круга в px от текущей ширины поля */
  function playerRadiusPx() {
    var W = rotator.offsetWidth || PLAYER_REFERENCE_WIDTH;
    return PLAYER_RADIUS / PLAYER_REFERENCE_WIDTH * W;
  }

  /* Держит круг (или мяч) целиком внутри поля.
     radiusPx — радиус предмета в px; по умолчанию радиус игрока. */
  function clampPos(u, v, radiusPx) {
    var W = rotator.offsetWidth || 1;
    var H = rotator.offsetHeight || 1;
    var r = radiusPx == null ? playerRadiusPx() : radiusPx;
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
    var teamKey = p.team === 'opponent' ? teamColors.opponent : teamColors.own;
    disc.style.background = teamKey;
    disc.style.color = numberColorFor(teamKey);
    var num = document.createElement('span');
    num.textContent = p.number || '';
    disc.appendChild(num);

    var label = document.createElement('div');
    label.className = 'token-label';
    label.textContent = p.name;
    linkLabelHidden(label, p.name);

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
    var label = el.querySelector('.token-label');
    label.textContent = p.name;
    linkLabelHidden(label, p.name);
    el.classList.toggle('token-own', p.team !== 'opponent');
    el.classList.toggle('token-opponent', p.team === 'opponent');
  }

  /* Имя под кругом показывается только если оно есть */
  function linkLabelHidden(label, name) {
    label.hidden = !name;
  }

  function showToken(p, delay) {
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
        delay: delay || 0,
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
    pushHistory();
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

  /* Окно подтверждения очистки (вместо confirm()) */
  function clearField() {
    openModal({
      title: 'Очистить поле?',
      text: 'Все игроки вернутся в свои списки, мяч будет убран. Сами списки сохранятся.',
      buttons: [
        { label: 'Отмена', className: 'ghost' },
        { label: 'Очистить', className: 'danger', action: function () { doClearField(); } }
      ]
    });
  }

  function doClearField() {
    players.forEach(function (p) {
      p.pos = null;
      refreshCard(p);
    });
    savePlayers();
    removeBall();
    syncTokensToPlayers(false);
    pushHistory();
    toast('Поле очищено');
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
    var isOpponent = p.team === 'opponent';
    var g = document.createElement('div');
    g.className = 'drag-ghost ' + (isOpponent ? 'ghost-opponent' : 'ghost-own');
    g.style.background = isOpponent ? teamColors.opponent : teamColors.own;
    g.style.color = numberColorFor(isOpponent ? teamColors.opponent : teamColors.own);
    g.textContent = p.number
      ? '№' + p.number + (p.name ? ' ' + p.name : '')
      : p.name;
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
    } else if (drag.type === 'ball') {
      var ptB = localFieldPoint(e.clientX, e.clientY);
      var posB = clampPos(ptB.u + drag.ox, ptB.v + drag.oy, ballRadiusPx());
      drag.token.style.left = (posB.u * 100) + '%';
      drag.token.style.top = (posB.v * 100) + '%';
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
    } else if (d.type === 'ball') {
      dropBall(e.clientX, e.clientY, d);
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
      pushHistory();
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
    pushHistory();
  }

  /* ── Мяч ─────────────────────────────────── */

  /* Радиус мяча в px от текущей ширины поля */
  function ballRadiusPx() {
    var W = rotator.offsetWidth || PLAYER_REFERENCE_WIDTH;
    return BALL_DIAMETER / 2 / PLAYER_REFERENCE_WIDTH * W;
  }

  function createBallEl() {
    var el = document.createElement('div');
    el.className = 'token token-ball';
    var scale = document.createElement('div');
    scale.className = 'token-scale';
    var disc = document.createElement('div');
    disc.className = 'ball-disc';
    scale.appendChild(disc);
    el.appendChild(scale);
    return el;
  }

  /* Мяч на поле: при первом появлении — пружинный эффект */
  function showBall(delay) {
    if (!ball.pos) return;
    if (!ballEl) {
      var el = createBallEl();
      placeToken(el, { pos: ball.pos });
      tokensLayer.appendChild(el);
      ballEl = el;
      el.addEventListener('pointerdown', onBallPointerDown);
      anime({
        targets: el.querySelector('.token-scale'),
        scale: [0, 1],
        opacity: [0, 1],
        duration: 900,
        delay: delay || 0,
        easing: 'easeOutElastic'
      });
    } else {
      placeToken(ballEl, { pos: ball.pos });
    }
  }

  function removeBall() {
    ball.pos = null;
    if (!ballEl) return;
    var el = ballEl;
    ballEl = null;
    fadeOutTokenEl(el);
  }

  /* Кнопка «Добавить мяч»: если мяч уже на поле — убирает его */
  function toggleBall() {
    if (ball.pos) {
      removeBall();
    } else {
      var pos = clampPos(0.5, 0.5, ballRadiusPx());
      ball.pos = { x: round4(pos.u), y: round4(pos.v) };
      showBall(0);
    }
    updateBallButton();
    pushHistory();
  }

  function updateBallButton() {
    if (btnAddBallEl) btnAddBallEl.textContent = ball.pos ? 'Убрать мяч' : 'Добавить мяч';
  }

  function onBallPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!ball.pos || !ballEl) return;
    e.preventDefault();
    var pt = localFieldPoint(e.clientX, e.clientY);
    drag = {
      type: 'ball',
      token: ballEl,
      pointerId: e.pointerId,
      ox: ball.pos.x - pt.u,
      oy: ball.pos.y - pt.v
    };
    try { ballEl.setPointerCapture(e.pointerId); } catch (err) { /* необязательно */ }
  }

  /* Мяч всегда остаётся в границах поля, поэтому clamp на сбросе */
  function dropBall(clientX, clientY, d) {
    if (ballEl !== d.token) return;
    var pt = localFieldPoint(clientX, clientY);
    var pos = clampPos(pt.u + d.ox, pt.v + d.oy, ballRadiusPx());
    ball.pos = { x: round4(pos.u), y: round4(pos.v) };
    placeToken(ballEl, { pos: ball.pos });
    pushHistory();
  }

  /* Приводит мяч в соответствие с состоянием: показать, переехать или убрать */
  function syncBall(animated, delay) {
    if (ball.pos) {
      var pos = clampPos(ball.pos.x, ball.pos.y, ballRadiusPx());
      ball.pos = { x: round4(pos.u), y: round4(pos.v) };
      if (ballEl) {
        var dragging = drag && drag.type === 'ball';
        if (animated && !dragging) {
          animateTokenTo(
            ballEl,
            pos,
            600,
            delay || 0,
            rotator.offsetWidth || PLAYER_REFERENCE_WIDTH,
            rotator.offsetHeight || rotator.offsetWidth / FIELD_ASPECT
          );
        } else {
          placeToken(ballEl, { pos: ball.pos });
        }
      } else {
        showBall(delay || 0);
      }
    } else if (ballEl) {
      removeBall();
    }
  }

  /* ── Цвета команд ─────────────────────────── */

  var COLORS_KEY = 'fb-board-colors';
  var DEFAULT_COLORS = { own: '#2563eb', opponent: '#dc2626' };
  var teamColors = { own: DEFAULT_COLORS.own, opponent: DEFAULT_COLORS.opponent };

  var colorInputs = {
    own: document.getElementById('color-own'),
    opponent: document.getElementById('color-opponent')
  };
  var colorSwatches = {
    own: document.getElementById('swatch-own'),
    opponent: document.getElementById('swatch-opponent')
  };
  var teamDots = document.querySelectorAll('.team-dot');
  var btnResetColors = document.getElementById('btn-reset-colors');

  function parseHex(hex) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return null;
    return {
      r: parseInt(m[1].substr(0, 2), 16),
      g: parseInt(m[1].substr(2, 2), 16),
      b: parseInt(m[1].substr(4, 2), 16)
    };
  }

  /* Относительная яркость по WCAG (линеаризованный sRGB) */
  function relativeLuminance(rgb) {
    function lin(c) {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
  }

  /* Чёрный номер на светлом фоне, белый на тёмном */
  function numberColorFor(hex) {
    var rgb = parseHex(hex);
    if (!rgb) return '#ffffff';
    return relativeLuminance(rgb) > 0.45 ? '#111827' : '#ffffff';
  }

  function saveColors() {
    storageSet(COLORS_KEY, JSON.stringify(teamColors));
  }

  function loadColors() {
    var raw = storageGet(COLORS_KEY);
    if (!raw) return;
    try {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        ['own', 'opponent'].forEach(function (team) {
          if (parseHex(parsed[team])) teamColors[team] = parsed[team];
        });
      }
    } catch (e) { /* повреждённые данные — используем значения по умолчанию */ }
  }

  /* Обновляет образцы, поля выбора и маркеры в заголовках списков */
  function refreshColorControls() {
    ['own', 'opponent'].forEach(function (team) {
      if (colorInputs[team]) colorInputs[team].value = teamColors[team];
      if (colorSwatches[team]) colorSwatches[team].style.background = teamColors[team];
    });
    for (var i = 0; i < teamDots.length; i++) {
      var dot = teamDots[i];
      dot.style.background = teamColors[dot.dataset.team === 'opponent' ? 'opponent' : 'own'];
    }
  }

  /* Плавно перекрашивает сами круги (с одновременной сменой цвета номера) */
  function animateTeamDiscs(team, hex) {
    var discs = tokensLayer.querySelectorAll(
      '.' + (team === 'opponent' ? 'token-opponent' : 'token-own') + ' .token-disc'
    );
    if (!discs.length) return;
    anime({
      targets: discs,
      backgroundColor: hex,
      color: numberColorFor(hex),
      duration: 300,
      easing: 'easeOutQuad'
    });
  }

  function setTeamColor(team, hex, animateDiscs) {
    if (!parseHex(hex)) return;
    teamColors[team] = hex;
    saveColors();
    refreshColorControls();
    if (animateDiscs) animateTeamDiscs(team, hex);
  }

  function onColorInput(team) {
    return function (e) {
      setTeamColor(team, e.target.value, true);
    };
  }

  colorInputs.own.addEventListener('input', onColorInput('own'));
  colorInputs.opponent.addEventListener('input', onColorInput('opponent'));

  btnResetColors.addEventListener('click', function () {
    anime({
      targets: btnResetColors,
      scale: [1, 0.92, 1],
      duration: 320,
      easing: 'easeOutQuad'
    });
    setTeamColor('own', DEFAULT_COLORS.own, true);
    setTeamColor('opponent', DEFAULT_COLORS.opponent, true);
  });

  loadColors();
  refreshColorControls();

  loadPlayers();
  renderAllPlayers();

  /* ── История действий (Undo/Redo) ─────────── */

  var HISTORY_LIMIT = 50;
  var history = [];   /* снимки состояний; history[historyIndex] — текущее */
  var historyIndex = -1;

  var btnUndo = document.querySelector('[data-action="undo"]');
  var btnRedo = document.querySelector('[data-action="redo"]');
  var btnAddBallEl = document.getElementById('btn-add-ball');

  /* Снимок: позиции кругов, мяч, составы и то, кто на поле */
  function snapshotState() {
    return {
      ball: ball.pos ? { x: ball.pos.x, y: ball.pos.y } : null,
      players: players.map(function (p) {
        return {
          id: p.id,
          name: p.name,
          number: p.number,
          team: p.team,
          status: p.status,
          pos: p.pos ? { x: p.pos.x, y: p.pos.y } : null
        };
      })
    };
  }

  function sameState(a, b) {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; }
  }

  /* Снимок добавляется после завершённого действия;
     тривиальные повторные вызовы (без изменений) не засоряют историю */
  function pushHistory() {
    var snap = snapshotState();
    if (historyIndex >= 0 && sameState(history[historyIndex], snap)) return;
    history.splice(historyIndex + 1);
    history.push(snap);
    if (history.length > HISTORY_LIMIT) history.shift();
    historyIndex = history.length - 1;
    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    if (btnUndo) btnUndo.disabled = historyIndex <= 0;
    if (btnRedo) btnRedo.disabled = historyIndex >= history.length - 1;
  }

  /* Восстановление состояния из снимка: карточки, круги и мяч */
  function restoreSnapshot(snap, animated) {
    players = snap.players.map(function (p) {
      return {
        id: p.id,
        name: p.name,
        number: p.number,
        team: p.team,
        status: p.status,
        pos: p.pos ? { x: p.pos.x, y: p.pos.y } : null
      };
    });
    savePlayers();
    ball.pos = snap.ball ? { x: snap.ball.x, y: snap.ball.y } : null;

    /* карточки исчезнувших игроков убираем, новые добавляем, раскладываем по спискам */
    var keep = {};
    players.forEach(function (p) { keep[p.id] = true; });
    Object.keys(cardEls).forEach(function (id) {
      if (!keep[id]) {
        var card = cardEls[id];
        delete cardEls[id];
        animateRemoveCard(card);
      }
    });
    players.forEach(function (p) {
      var card = cardEls[p.id];
      if (card) {
        var list = getListEl(p);
        if (card.parentElement !== list) list.appendChild(card);
        refreshCard(p);
      } else {
        appendCard(p, true);
      }
    });
    updateHints();

    /* круги плавно переезжают на прежние места (в т.ч. после отмены) */
    syncTokensToPlayers(animated);
    syncBall(animated);
    updateBallButton();
  }

  function undoHistory() {
    if (historyIndex <= 0) return;
    historyIndex--;
    restoreSnapshot(history[historyIndex], true);
  }

  function redoHistory() {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    restoreSnapshot(history[historyIndex], true);
  }

  /* Горячие клавиши: Cmd+Z / Cmd+Shift+Z (или Ctrl вместо Cmd) */
  document.addEventListener('keydown', function (e) {
    if (!(e.metaKey || e.ctrlKey)) return;
    if ((e.key || '').toLowerCase() !== 'z') return;
    var t = e.target;
    if (t && t.closest && t.closest('input, textarea, select')) return;
    e.preventDefault();
    if (e.shiftKey) redoHistory();
    else undoHistory();
  });

  /* ── Пресеты и схемы расстановки ──────────── */

  var PRESETS_KEY = 'fb-board-presets-v1';
  var CURRENT_PRESET_KEY = 'fb-board-current-preset';

  /* Линии схем: вратарь, защита, полузащита, атака и т.д.
     Своя половина — левая половина поля (координаты 0–1). */
  var FORMATIONS = {
    '4-4-2': [1, 4, 4, 2],
    '4-3-3': [1, 4, 3, 3],
    '3-5-2': [1, 3, 5, 2],
    '4-2-3-1': [1, 4, 2, 3, 1],
    '5-3-2': [1, 5, 3, 2]
  };

  var presets = [];        /* { id, name, savedAt, orientation, colors, players } */
  var currentPresetId = null; /* последний загруженный пресет */

  var presetListEl = document.getElementById('preset-list');
  var presetEmptyEl = document.getElementById('preset-empty');
  var btnSavePreset = document.getElementById('btn-save-preset');
  var btnFormations = document.getElementById('btn-formations');
  var btnExportPresets = document.getElementById('btn-export-presets');
  var btnImportPresets = document.getElementById('btn-import-presets');
  var fileImportPresets = document.getElementById('file-import-presets');
  var modeLabel = document.getElementById('mode');

  /* ── Toast: всплывающее уведомление внизу ──── */

  var toastEl = null;
  var toastTimer = null;

  function toast(text, isError) {
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    if (toastEl) { toastEl.remove(); toastEl = null; }
    toastEl = document.createElement('div');
    toastEl.className = 'toast' + (isError ? ' toast-error' : '');
    toastEl.setAttribute('role', 'status');
    toastEl.textContent = text;
    document.body.appendChild(toastEl);
    anime({
      targets: toastEl,
      opacity: [0, 1],
      translateY: [16, 0],
      duration: 260,
      easing: 'easeOutCubic'
    });
    toastTimer = setTimeout(function () {
      anime({
        targets: toastEl,
        opacity: 0,
        translateY: [0, 10],
        duration: 240,
        easing: 'easeInQuad',
        complete: function () {
          if (toastEl) { toastEl.remove(); toastEl = null; }
        }
      });
    }, 2600);
  }

  /* ── Универсальное модальное окно ──────────── */

  /* opts: { title, text, content, buttons: [{ label, className, submit, action }] }
     action(ctx) вызывается при клике; чтобы окно осталось открытым,
     action должен вернуть true. Возвращает контекст модального окна. */
  function openModal(opts) {
    opts = opts || {};

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    var card = document.createElement('div');
    card.className = 'modal-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    overlay.appendChild(card);

    var titleEl = document.createElement('h3');
    titleEl.className = 'modal-title';
    titleEl.textContent = opts.title || '';
    if (titleEl.textContent) card.appendChild(titleEl);

    if (opts.text) {
      var textEl = document.createElement('p');
      textEl.className = 'modal-text';
      textEl.textContent = opts.text;
      card.appendChild(textEl);
    }

    var body = document.createElement('div');
    body.className = 'modal-body';
    if (opts.content) body.appendChild(opts.content);
    card.appendChild(body);

    var errorEl = document.createElement('p');
    errorEl.className = 'modal-error';
    errorEl.hidden = true;
    card.appendChild(errorEl);

    var actions = document.createElement('div');
    actions.className = 'modal-actions';
    card.appendChild(actions);

    var submitBtn = null;
    var buttons = opts.buttons && opts.buttons.length ? opts.buttons : [{ label: 'Отмена', className: 'ghost' }];
    buttons.forEach(function (b) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'modal-btn' + (b.className ? ' ' + b.className : '');
      btn.textContent = b.label;
      if (b.submit) submitBtn = btn;
      btn.addEventListener('click', function () {
        var keepOpen = b.action ? b.action(ctx) === true : false;
        if (!keepOpen) closeModal();
      });
      actions.appendChild(btn);
    });

    document.body.appendChild(overlay);

    var prevActive = document.activeElement;
    var closed = false;

    function closeModal() {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey, true);
      anime({ targets: overlay, opacity: [1, 0], duration: 200, easing: 'easeInQuad' });
      anime({
        targets: card,
        translateY: [0, 14],
        scale: [1, 0.95],
        opacity: [1, 0],
        duration: 200,
        easing: 'easeInQuad',
        complete: function () {
          overlay.remove();
          if (prevActive && prevActive.focus && !document.querySelector('.modal-overlay')) {
            prevActive.focus();
          }
        }
      });
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeModal();
        return;
      }
      if (e.key === 'Enter' && !e.isComposing && submitBtn &&
          !(e.target && e.target.closest && e.target.closest('button'))) {
        e.preventDefault();
        submitBtn.click();
      }
    }
    document.addEventListener('keydown', onKey, true);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });

    var ctx = {
      card: card,
      body: body,
      errorEl: errorEl,
      close: closeModal,
      setError: function (msg) {
        errorEl.textContent = msg;
        errorEl.hidden = false;
        anime({
          targets: errorEl,
          translateX: [-6, 6, -4, 4, 0],
          duration: 320,
          easing: 'easeOutQuad'
        });
      },
      clearError: function () {
        errorEl.hidden = true;
        errorEl.textContent = '';
      }
    };

    anime({ targets: overlay, opacity: [0, 1], duration: 220, easing: 'easeOutQuad' });
    anime({
      targets: card,
      translateY: [18, 0],
      scale: [0.95, 1],
      opacity: [0, 1],
      duration: 250,
      easing: 'easeOutCubic'
    });

    var firstInput = card.querySelector('input, select, textarea');
    if (firstInput) firstInput.focus();
    else if (submitBtn) submitBtn.focus();

    return ctx;
  }

  /* ОКно с полем ввода названия (обязательное) */
  function nameModal(title, initial, onConfirm) {
    var content = document.createElement('div');
    content.className = 'modal-input-wrap';
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'player-input modal-input';
    input.placeholder = 'Название пресета';
    input.maxLength = 60;
    input.value = initial || '';
    content.appendChild(input);

    var ctx = openModal({
      title: title,
      content: content,
      buttons: [
        { label: 'Отмена', className: 'ghost' },
        {
          label: 'Сохранить',
          className: 'primary',
          submit: true,
          action: function (mctx) {
            var name = input.value.trim();
            if (!name) {
              mctx.setError('Введите название пресета');
              input.classList.add('input-error');
              animateShake(input);
              input.focus();
              return true;
            }
            onConfirm(name);
          }
        }
      ]
    });

    input.addEventListener('input', function () {
      input.classList.remove('input-error');
      ctx.clearError();
    });
  }

  function makePresetId() {
    return 's' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  /* Игрок из пресета с подстановкой значений по умолчанию */
  function normalizePresetPlayer(raw) {
    if (!raw || typeof raw !== 'object') {
      return { id: makeId(), name: '', number: '', team: 'own', status: 'start', pos: null };
    }
    return {
      id: raw.id == null ? makeId() : String(raw.id),
      name: typeof raw.name === 'string' ? raw.name : '',
      number: raw.number == null ? '' : String(raw.number),
      team: raw.team === 'opponent' ? 'opponent' : 'own',
      status: raw.status === 'bench' ? 'bench' : 'start',
      pos: validPos(raw.pos) ? { x: Number(raw.pos.x), y: Number(raw.pos.y) } : null
    };
  }

  /* Пресет с проверкой структуры; отсутствующие поля заменяются значениями по умолчанию */
  function normalizePreset(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.players)) return null;
    var name = typeof raw.name === 'string' ? raw.name.trim() : '';
    var savedAt = typeof raw.savedAt === 'string' && !isNaN(new Date(raw.savedAt).getTime())
      ? raw.savedAt
      : new Date().toISOString();
    var colorsRaw = raw.colors && typeof raw.colors === 'object' ? raw.colors : {};
    return {
      id: raw.id == null ? '' : String(raw.id),
      name: name || 'Без названия',
      savedAt: savedAt,
      orientation: raw.orientation === 'vertical' ? 'vertical' : 'horizontal',
      colors: {
        own: parseHex(colorsRaw.own) ? colorsRaw.own : DEFAULT_COLORS.own,
        opponent: parseHex(colorsRaw.opponent) ? colorsRaw.opponent : DEFAULT_COLORS.opponent
      },
      /* в старых пресетах мяча нет — считаем, что мяча на поле нет */
      ball: validPos(raw.ball) ? { x: Number(raw.ball.x), y: Number(raw.ball.y) } : null,
      players: raw.players.map(normalizePresetPlayer)
    };
  }

  /* Текущее состояние доски как снимок для пресета */
  function snapshotPreset() {
    return {
      orientation: state.orientation,
      colors: { own: teamColors.own, opponent: teamColors.opponent },
      ball: ball.pos ? { x: round4(ball.pos.x), y: round4(ball.pos.y) } : null,
      players: players.map(function (p) {
        return {
          id: p.id,
          name: p.name,
          number: p.number,
          team: p.team,
          status: p.status,
          pos: p.pos ? { x: p.pos.x, y: p.pos.y } : null
        };
      })
    };
  }

  function persistPresets() {
    storageSet(PRESETS_KEY, JSON.stringify(presets));
    storageSet(CURRENT_PRESET_KEY, currentPresetId || '');
  }

  function findPreset(id) {
    for (var i = 0; i < presets.length; i++) {
      if (presets[i].id === id) return presets[i];
    }
    return null;
  }

  function loadPresetsFromStorage() {
    presets = [];
    currentPresetId = null;
    var raw = storageGet(PRESETS_KEY);
    if (raw) {
      var seen = {};
      try {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach(function (rp) {
            var np = normalizePreset(rp);
            if (!np) return;
            if (!np.id || seen[np.id]) np.id = makePresetId();
            seen[np.id] = true;
            presets.push(np);
          });
        }
      } catch (e) {
        presets = []; /* повреждённые данные — начинаем с пустого списка */
      }
    }
    var cur = storageGet(CURRENT_PRESET_KEY);
    if (cur && findPreset(cur)) currentPresetId = cur;
  }

  function initPresets() {
    loadPresetsFromStorage();
    renderPresetList();
  }

  function formatPresetDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    try {
      return d.toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (e) {
      return d.toLocaleString();
    }
  }

  function renderPresetList() {
    if (!presetListEl) return;
    presetListEl.innerHTML = '';
    if (presetEmptyEl) presetEmptyEl.hidden = presets.length > 0;
    presets.forEach(function (p) {
      var li = document.createElement('li');
      li.className = 'preset-item';
      if (p.id === currentPresetId) li.classList.add('active');
      li.dataset.id = p.id;

      var nameEl = document.createElement('div');
      nameEl.className = 'preset-item-name';
      nameEl.textContent = p.name;
      li.appendChild(nameEl);

      var dateEl = document.createElement('div');
      dateEl.className = 'preset-item-date';
      dateEl.textContent = formatPresetDate(p.savedAt);
      li.appendChild(dateEl);

      li.addEventListener('click', function () { openPresetActions(p); });
      presetListEl.appendChild(li);
    });
  }

  /* Плавное исчезновение круга с поля */
  function fadeOutTokenEl(el) {
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
  }

  /* Плавный переезд круга на новое место (позиции в px, в конце — %) */
  function animateTokenTo(el, pos, duration, delay, pxW, pxH) {
    anime({
      targets: el,
      left: pos.u * pxW,
      top: pos.v * pxH,
      duration: duration,
      delay: delay,
      easing: 'easeInOutCubic',
      complete: function () {
        el.style.left = (pos.u * 100) + '%';
        el.style.top = (pos.v * 100) + '%';
      }
    });
  }

  /* Приводит круги на поле в соответствие с массивом players:
     существующие плавно переезжают (stagger), новые появляются
     пружинным эффектом, лишние плавно исчезают. */
  function syncTokensToPlayers(animated) {
    var pxW = rotator.offsetWidth || PLAYER_REFERENCE_WIDTH;
    var pxH = rotator.offsetHeight || pxW / FIELD_ASPECT;
    var moveDelay = 0;
    var springDelay = 0;
    var present = {};

    players.forEach(function (p) {
      present[p.id] = true;
      var el = tokenEls[p.id];
      if (p.pos) {
        var pos = clampPos(p.pos.x, p.pos.y);
        if (el) {
          refreshCard(p);
          var dragging = drag && drag.type === 'token' && drag.id === p.id;
          if (animated && !dragging) {
            moveDelay += 55;
            animateTokenTo(el, pos, 600, moveDelay, pxW, pxH);
          } else {
            el.style.left = (pos.u * 100) + '%';
            el.style.top = (pos.v * 100) + '%';
          }
        } else {
          if (animated) {
            springDelay += 80;
            showToken(p, springDelay);
          } else {
            showToken(p);
          }
        }
      } else if (el) {
        delete tokenEls[p.id];
        refreshCard(p);
        fadeOutTokenEl(el);
      }
    });

    Object.keys(tokenEls).forEach(function (id) {
      if (!present[id]) {
        var el = tokenEls[id];
        delete tokenEls[id];
        fadeOutTokenEl(el);
      }
    });

    syncCounter();
  }

  /* Плавное удаление карточки из списка (без побочных эффектов removePlayer) */
  function animateRemoveCard(card) {
    if (!card) return;
    card.classList.add('removing');
    var cs = getComputedStyle(card);
    anime({
      targets: card,
      height: [card.offsetHeight, 0],
      paddingTop: [parseFloat(cs.paddingTop), 0],
      paddingBottom: [parseFloat(cs.paddingBottom), 0],
      opacity: [1, 0],
      duration: 280,
      easing: 'easeInQuad',
      complete: function () {
        card.remove();
        updateHints();
      }
    });
  }

  /* Применяет пресет к доске: составы, позиции, цвета, ориентация */
  function applyPresetState(preset, animated) {
    var newPlayers = preset.players.map(normalizePresetPlayer);
    var seen = {};
    newPlayers.forEach(function (p) {
      while (!p.id || seen[p.id]) p.id = makeId();
      seen[p.id] = true;
    });

    /* удаляем карточки исчезнувших игроков */
    var keep = {};
    newPlayers.forEach(function (p) { keep[p.id] = true; });
    players.forEach(function (p) {
      if (keep[p.id]) return;
      var card = cardEls[p.id];
      delete cardEls[p.id];
      if (card) animateRemoveCard(card);
    });

    players = newPlayers;
    savePlayers();

    players.forEach(function (p) {
      var card = cardEls[p.id];
      if (card) {
        var list = getListEl(p);
        if (card.parentElement !== list) list.appendChild(card);
        refreshCard(p);
      } else {
        appendCard(p, true);
      }
    });
    updateHints();

    teamColors.own = preset.colors.own;
    teamColors.opponent = preset.colors.opponent;
    saveColors();
    refreshColorControls();

    if (preset.ball) {
      var bpos = clampPos(preset.ball.x, preset.ball.y, ballRadiusPx());
      ball.pos = { x: round4(bpos.u), y: round4(bpos.v) };
    } else {
      ball.pos = null;
    }

    if (state.orientation !== preset.orientation) {
      state.orientation = preset.orientation;
      storageSet('fb-board-orientation', state.orientation);
      applyOrientation(false);
    }

    syncTokensToPlayers(animated);
    syncBall(animated);
    updateBallButton();

    currentPresetId = preset.id;
    persistPresets();
    renderPresetList();
  }

  function loadPreset(id) {
    var p = findPreset(id);
    if (!p) {
      toast('Пресет не найден', true);
      return;
    }
    applyPresetState(p, true);
    pushHistory();
    toast('Пресет загружен: ' + p.name);
  }

  /* Есть ли несохранённые изменения относительно загруженного пресета */
  function hasUnsavedChanges() {
    if (!currentPresetId) return false;
    var p = findPreset(currentPresetId);
    if (!p) return false;
    var snap = snapshotPreset();
    return JSON.stringify([snap.orientation, snap.colors, snap.players]) !==
      JSON.stringify([p.orientation, p.colors, p.players]);
  }

  function overwritePreset(p) {
    var snap = snapshotPreset();
    p.orientation = snap.orientation;
    p.colors = snap.colors;
    p.players = snap.players;
    p.savedAt = new Date().toISOString();
    currentPresetId = p.id;
    persistPresets();
    renderPresetList();
    toast('Пресет перезаписан: ' + p.name);
  }

  function deletePresetById(id) {
    var p = findPreset(id);
    if (!p) return;
    presets = presets.filter(function (item) { return item.id !== id; });
    if (currentPresetId === id) currentPresetId = null;
    persistPresets();
    renderPresetList();
    toast('Пресет удалён: ' + p.name);
  }

  /* Модальные окна действий */

  function requestLoadPreset(p) {
    if (hasUnsavedChanges()) {
      openModal({
        title: 'Загрузить пресет?',
        text: 'Есть несохранённые изменения. Загрузить «' + p.name + '» и заменить текущую расстановку?',
        buttons: [
          { label: 'Отмена', className: 'ghost' },
          { label: 'Загрузить', className: 'primary', action: function () { loadPreset(p.id); } }
        ]
      });
    } else {
      loadPreset(p.id);
    }
  }

  function confirmOverwrite(p) {
    openModal({
      title: 'Перезаписать пресет?',
      text: 'Пресет «' + p.name + '» будет заменён текущей расстановкой.',
      buttons: [
        { label: 'Отмена', className: 'ghost' },
        { label: 'Перезаписать', className: 'primary', action: function () { overwritePreset(p); } }
      ]
    });
  }

  function confirmDelete(p) {
    openModal({
      title: 'Удалить пресет?',
      text: 'Пресет «' + p.name + '» будет удалён безвозвратно.',
      buttons: [
        { label: 'Отмена', className: 'ghost' },
        { label: 'Удалить', className: 'danger', action: function () { deletePresetById(p.id); } }
      ]
    });
  }

  function renameModal(p) {
    nameModal('Переименовать пресет', p.name, function (name) {
      p.name = name;
      persistPresets();
      renderPresetList();
      toast('Пресет переименован: ' + name);
    });
  }

  function duplicateModal(p) {
    nameModal('Дублировать пресет', p.name + ' — копия', function (name) {
      var copy = normalizePreset(JSON.parse(JSON.stringify(p)));
      do { copy.id = makePresetId(); } while (findPreset(copy.id));
      copy.name = name;
      copy.savedAt = new Date().toISOString();
      presets.push(copy);
      persistPresets();
      renderPresetList();
      toast('Создана копия: ' + name);
    });
  }

  /* Клик по карточке пресета: окно со всеми действиями */
  function openPresetActions(p) {
    openModal({
      title: p.name,
      text: 'Сохранён: ' + (formatPresetDate(p.savedAt) || 'неизвестно когда'),
      buttons: [
        { label: 'Загрузить', className: 'primary', action: function () { requestLoadPreset(p); } },
        { label: 'Перезаписать', action: function () { confirmOverwrite(p); } },
        { label: 'Переименовать', action: function () { renameModal(p); } },
        { label: 'Дублировать', action: function () { duplicateModal(p); } },
        { label: 'Удалить', className: 'danger', action: function () { confirmDelete(p); } }
      ]
    });
  }

  /* Сохранить текущую расстановку как новый пресет */
  btnSavePreset.addEventListener('click', function () {
    nameModal('Сохранить как новый', '', function (name) {
      var snapshot = snapshotPreset();
      var preset = {
        id: makePresetId(),
        name: name,
        savedAt: new Date().toISOString(),
        orientation: snapshot.orientation,
        colors: snapshot.colors,
        ball: snapshot.ball,
        players: snapshot.players
      };
      presets.push(preset);
      currentPresetId = preset.id;
      persistPresets();
      renderPresetList();
      toast('Пресет сохранён: ' + name);
    });
  });

  /* ── Готовые схемы расстановки ─────────────── */

  /* Слоты схемы: x возрастает от ворот к атаке, игроки линии
     распределяются по ширине поля равномерно (координаты 0–1). */
  function formationSlots(counts) {
    var xs = [0.06]; /* вратарь */
    var lines = counts.length;
    for (var i = 1; i < lines; i++) {
      xs.push(lines === 2 ? 0.3 : round4(0.17 + (i - 1) * (0.29 / (lines - 2))));
    }
    var slots = [];
    counts.forEach(function (m, lineIdx) {
      var gap = 0.8 / m;
      for (var j = 0; j < m; j++) {
        slots.push({
          x: xs[lineIdx],
          y: m === 1 ? 0.5 : round4(0.5 + (j - (m - 1) / 2) * gap)
        });
      }
    });
    return slots;
  }

  function doApplyFormation(key) {
    var counts = FORMATIONS[key];
    if (!counts) return;
    var slots = formationSlots(counts);
    var starters = players.filter(function (p) {
      return p.team === 'own' && p.status === 'start';
    });
    /* меняем только игроков основного состава; лишние остаются в списке */
    starters.forEach(function (p) { p.pos = null; });
    var placed = Math.min(starters.length, slots.length);
    for (var i = 0; i < placed; i++) {
      var pos = clampPos(slots[i].x, slots[i].y);
      starters[i].pos = { x: round4(pos.u), y: round4(pos.v) };
    }
    savePlayers();
    if (modeLabel) modeLabel.textContent = 'Схема ' + key;
    syncTokensToPlayers(true);
    pushHistory();
    toast('Схема ' + key + ': на поле ' + placed + ' из ' + starters.length);
  }

  /* Вертикальное превью схемы: вратарь внизу по центру, линии снизу
     вверх. Те же координаты, что в расстановке (x — от ворот к атаке,
     y — по ширине), спроецированные на превью: половина поля по x
     растянута на всю высоту, y — на ширину. Цвет точек — текущий
     цвет своей команды. */
  function buildFormationPreview(counts) {
    var box = document.createElement('span');
    box.className = 'formation-preview';
    formationSlots(counts).forEach(function (slot) {
      var dot = document.createElement('span');
      dot.className = 'formation-dot';
      dot.style.left = (slot.y * 100) + '%';
      dot.style.top = ((1 - slot.x * 2) * 100) + '%';
      dot.style.background = teamColors.own;
      box.appendChild(dot);
    });
    return box;
  }

  function openFormationsModal() {
    var content = document.createElement('div');
    content.className = 'formation-grid';
    var ctx = openModal({
      title: 'Схемы расстановки',
      text: 'Схема расставит основной состав на своей половине поля.',
      content: content,
      buttons: [{ label: 'Отмена', className: 'ghost' }]
    });
    Object.keys(FORMATIONS).forEach(function (key) {
      var cardBtn = document.createElement('button');
      cardBtn.type = 'button';
      cardBtn.className = 'formation-card';
      cardBtn.appendChild(buildFormationPreview(FORMATIONS[key]));
      var label = document.createElement('span');
      label.className = 'formation-card-label';
      label.textContent = key;
      cardBtn.appendChild(label);
      cardBtn.addEventListener('click', function () {
        ctx.close();
        doApplyFormation(key);
      });
      content.appendChild(cardBtn);
    });
  }

  btnFormations.addEventListener('click', function () {
    anime({
      targets: btnFormations,
      scale: [1, 0.92, 1],
      duration: 320,
      easing: 'easeOutQuad'
    });
    openFormationsModal();
  });

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

  /* ── Экспорт и импорт пресетов ─────────────── */

  function exportPresets(list, label) {
    var payload = {
      app: 'football-board',
      type: 'presets',
      exportedAt: new Date().toISOString(),
      presets: list.map(function (p) { return JSON.parse(JSON.stringify(p)); })
    };
    try {
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'presety-futbolnoy-doski.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      toast('Экспортировано пресетов: ' + list.length + ' (' + label + ')');
    } catch (e) {
      toast('Не удалось экспортировать пресеты', true);
    }
  }

  function openExportModal() {
    if (!presets.length) {
      toast('Нет пресетов для экспорта', true);
      return;
    }
    var current = findPreset(currentPresetId);
    var buttons = [];
    if (current) {
      buttons.push({
        label: 'Выбранный пресет',
        className: 'primary',
        action: function () { exportPresets([current], 'выбранный'); }
      });
      buttons.push({
        label: 'Все пресеты',
        action: function () { exportPresets(presets, 'все'); }
      });
    } else {
      buttons.push({
        label: 'Все пресеты',
        className: 'primary',
        action: function () { exportPresets(presets, 'все'); }
      });
    }
    buttons.push({ label: 'Отмена', className: 'ghost' });
    openModal({
      title: 'Экспорт пресетов',
      text: current
        ? 'Скачать JSON: выбранный пресет «' + current.name + '» или все пресеты.'
        : 'Загруженный пресет отсутствует, можно скачать все пресеты.',
      buttons: buttons
    });
  }

  function openImportModal() {
    var content = document.createElement('div');
    content.className = 'modal-input-wrap';
    var pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'modal-btn primary modal-file-btn';
    pick.textContent = 'Выбрать файл';
    content.appendChild(pick);

    var ctx = openModal({
      title: 'Импорт пресетов',
      text: 'Выберите JSON-файл, экспортированный с этой доски.',
      content: content,
      buttons: [{ label: 'Отмена', className: 'ghost' }]
    });

    pick.addEventListener('click', function () {
      fileImportPresets.value = '';
      fileImportPresets.click();
    });

    fileImportPresets.onchange = function () {
      var file = fileImportPresets.files && fileImportPresets.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var err = importPresetsFromText(String(reader.result));
        if (err) ctx.setError(err);
        else ctx.close();
      };
      reader.onerror = function () {
        ctx.setError('Не удалось прочитать файл');
      };
      try {
        reader.readAsText(file);
      } catch (e) {
        ctx.setError('Не удалось прочитать файл');
      }
    };
  }

  /* Возвращает текст ошибки для показа в окне импорта или null при успехе */
  function importPresetsFromText(text) {
    var data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return 'Файл повреждён или это не JSON. Импорт не выполнен.';
    }
    var rawList = null;
    if (Array.isArray(data)) {
      rawList = data;
    } else if (data && typeof data === 'object') {
      if (Array.isArray(data.presets)) rawList = data.presets;
      else if (Array.isArray(data.players)) rawList = [data]; /* одиночный пресет */
    }
    if (!rawList) {
      return 'Неверный формат файла: ожидается список пресетов, экспортированный с этой доски.';
    }
    var imported = [];
    rawList.forEach(function (raw) {
      var np = normalizePreset(raw);
      if (!np) return;
      do { np.id = makePresetId(); } while (findPreset(np.id));
      imported.push(np);
    });
    if (!imported.length) {
      return 'В файле нет корректных пресетов. Импорт не выполнен.';
    }
    imported.forEach(function (np) { presets.push(np); });
    persistPresets();
    renderPresetList();
    toast('Импортировано пресетов: ' + imported.length);
    return null;
  }

  btnExportPresets.addEventListener('click', function () {
    anime({
      targets: btnExportPresets,
      scale: [1, 0.92, 1],
      duration: 320,
      easing: 'easeOutQuad'
    });
    openExportModal();
  });

  btnImportPresets.addEventListener('click', function () {
    anime({
      targets: btnImportPresets,
      scale: [1, 0.92, 1],
      duration: 320,
      easing: 'easeOutQuad'
    });
    openImportModal();
  });

  /* ── Старт ─────────────────────────────────── */

  initTheme();

  var savedOrientation = storageGet('fb-board-orientation');
  if (savedOrientation === 'vertical' || savedOrientation === 'horizontal') {
    state.orientation = savedOrientation;
  }
  applyOrientation(false);

  initPresets();
  syncCounter();
  updateBallButton();
  pushHistory();
  updateHistoryButtons();
})();
