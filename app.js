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
var BALL_DIAMETER = 52;

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
    if (drawState.on) return; /* в режиме рисования составы не перетаскиваются */
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
    if (drawState.on) return; /* в режиме рисования круги не двигаются */
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

  var BALL_KEY = 'fb-board-ball-v1';

  /* Мяч тоже сохраняется, чтобы пережить перезагрузку страницы */
  function saveBall() {
    storageSet(BALL_KEY, ball.pos ? JSON.stringify({ x: ball.pos.x, y: ball.pos.y }) : '');
  }

  function loadBall() {
    var raw = storageGet(BALL_KEY);
    if (!raw) return;
    try {
      var parsed = JSON.parse(raw);
      if (validPos(parsed)) {
        ball.pos = { x: Number(parsed.x), y: Number(parsed.y) };
      }
    } catch (e) {
      /* повреждённые данные — мяча на поле нет */
    }
  }

  function removeBall() {
    ball.pos = null;
    saveBall();
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
      saveBall();
      showBall(0);
    }
    updateBallButton();
    pushHistory();
  }

  function updateBallButton() {
    if (btnAddBallEl) btnAddBallEl.textContent = ball.pos ? 'Убрать мяч' : 'Добавить мяч';
  }

  function onBallPointerDown(e) {
    if (drawState.on) return; /* в режиме рисования мяч не двигается */
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
    saveBall();
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

  /* ── Рисование на поле ───────────────────── */

  var DRAW_VIEW_W = 1200;
  var DRAW_VIEW_H = 780;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  /* { id, type: 'free'|'arrow', points: [{x, y} в долях 0–1], color, width } */
  var drawings = [];

  var DRAWINGS_KEY = 'fb-board-drawings-v1';

  /* Рисунки сохраняются при каждом изменении, восстанавливаются после
     перезагрузки: точки уже в долях 0–1, поэтому ориентация не важна */
  function saveDrawings() {
    storageSet(DRAWINGS_KEY, JSON.stringify(drawings));
  }

  function loadDrawings() {
    var raw = storageGet(DRAWINGS_KEY);
    if (!raw) return;
    try {
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      /* normalizeDrawing отбрасывает повреждённые элементы и
         подставляет значения по умолчанию там, где нужно */
      drawings = parsed.map(normalizeDrawing).filter(function (d) { return !!d; });
    } catch (e) {
      /* повреждённые данные — начинаем без рисунков */
    }
  }

  var drawSvg = document.createElementNS(SVG_NS, 'svg');
  drawSvg.setAttribute('id', 'draw-layer');
  drawSvg.setAttribute('viewBox', '0 0 ' + DRAW_VIEW_W + ' ' + DRAW_VIEW_H);
  drawSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  rotator.appendChild(drawSvg);

  function makeDrawId() {
    return 'd' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  var btnDrawMode = document.getElementById('btn-draw-mode');
  var btnClearDrawings = document.getElementById('btn-clear-drawings');
  var btnDownloadPng = document.getElementById('btn-download-png');
  var drawColorInput = document.getElementById('draw-color');
  var drawInstrumentBtns = Array.prototype.slice.call(document.querySelectorAll('.draw-instrument'));
  var drawWidthBtns = Array.prototype.slice.call(document.querySelectorAll('.draw-width'));

  var drawState = { on: false, tool: 'free', color: '#ffffff', width: 4, prevModeText: null };
  var activeDraw = null;

  function cloneDrawingData(d) {
    return JSON.parse(JSON.stringify(d));
  }

  function setDrawMode(on) {
    drawState.on = !!on;
    fieldWrap.classList.toggle('draw-mode', drawState.on);
    if (btnDrawMode) {
      btnDrawMode.classList.toggle('active', drawState.on);
      btnDrawMode.textContent = drawState.on ? 'Выключить рисование' : 'Включить рисование';
    }
    if (drawState.on) {
      drawState.prevModeText = modeLabel ? modeLabel.textContent : null;
      if (modeLabel) modeLabel.textContent = 'Рисование';
    } else if (modeLabel && drawState.prevModeText != null) {
      modeLabel.textContent = drawState.prevModeText;
    }
    cancelActiveDraw();
  }

  function setDrawTool(tool) {
    if (tool !== 'free' && tool !== 'arrow' && tool !== 'eraser') tool = 'free';
    drawState.tool = tool;
    drawInstrumentBtns.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.drawTool === tool);
    });
  }

  drawInstrumentBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      anime({ targets: btn, scale: [1, 0.92, 1], duration: 320, easing: 'easeOutQuad' });
      setDrawTool(btn.dataset.drawTool);
    });
  });

  drawWidthBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      anime({ targets: btn, scale: [1, 0.92, 1], duration: 320, easing: 'easeOutQuad' });
      drawState.width = Number(btn.dataset.drawWidth) || 4;
      drawWidthBtns.forEach(function (b) { b.classList.toggle('active', b === btn); });
    });
  });

  drawColorInput.addEventListener('input', function () {
    drawState.color = drawColorInput.value;
  });

  btnDrawMode.addEventListener('click', function () {
    anime({ targets: btnDrawMode, scale: [1, 0.93, 1], duration: 320, easing: 'easeOutQuad' });
    setDrawMode(!drawState.on);
  });

  /* ── Геометрия рисунков (координаты 0–1) ── */

  function clampDrawPoint(pt) {
    return {
      x: Math.min(1, Math.max(0, pt.u)),
      y: Math.min(1, Math.max(0, pt.v))
    };
  }

  function drawingPointsPx(d) {
    return d.points.map(function (p) {
      return { x: p.x * DRAW_VIEW_W, y: p.y * DRAW_VIEW_H };
    });
  }

  /* Сглаживание свободной линии: квадратичные кривые через середины отрезков */
  function smoothPathData(pts) {
    if (pts.length < 2) return '';
    function f(n) { return n.toFixed(1); }
    if (pts.length === 2) {
      return 'M ' + f(pts[0].x) + ' ' + f(pts[0].y) + ' L ' + f(pts[1].x) + ' ' + f(pts[1].y);
    }
    var data = 'M ' + f(pts[0].x) + ' ' + f(pts[0].y);
    var m1 = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    data += ' L ' + f(m1.x) + ' ' + f(m1.y);
    for (var i = 1; i < pts.length - 1; i++) {
      var mid = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
      data += ' Q ' + f(pts[i].x) + ' ' + f(pts[i].y) + ' ' + f(mid.x) + ' ' + f(mid.y);
    }
    var last = pts[pts.length - 1];
    data += ' L ' + f(last.x) + ' ' + f(last.y);
    return data;
  }

  /* Треугольник наконечника стрелки: острие на конце линии */
  function arrowHeadPoints(p0, p1, width) {
    var back = Math.max(14, width * 3);
    var wing = Math.max(9, width * 1.9);
    var ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    var cs = Math.cos(ang);
    var sn = Math.sin(ang);
    var bx = p1.x - back * cs;
    var by = p1.y - back * sn;
    return [
      { x: p1.x, y: p1.y },
      { x: bx + wing * (-sn), y: by + wing * cs },
      { x: bx - wing * (-sn), y: by - wing * cs }
    ];
  }

  function pointsToAttr(arr) {
    return arr.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');
  }

  function setDrawStrokeAttrs(el, d, isHit) {
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', isHit ? '#000000' : d.color);
    if (isHit) el.setAttribute('stroke-opacity', '0');
    el.setAttribute('stroke-width', String(isHit ? Math.max(d.width + 14, 16) : d.width));
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
  }

  function buildDrawEl(d) {
    var g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'draw-item');
    g.setAttribute('data-id', d.id);
    var pts = drawingPointsPx(d);
    var stroke;
    var hit;
    if (d.type === 'arrow' && pts.length >= 2) {
      stroke = document.createElementNS(SVG_NS, 'line');
      hit = document.createElementNS(SVG_NS, 'line');
      var from = pts[0];
      var to = pts[pts.length - 1];
      [stroke, hit].forEach(function (el) {
        el.setAttribute('x1', from.x.toFixed(1));
        el.setAttribute('y1', from.y.toFixed(1));
        el.setAttribute('x2', to.x.toFixed(1));
        el.setAttribute('y2', to.y.toFixed(1));
      });
      stroke.setAttribute('class', 'draw-stroke');
      hit.setAttribute('class', 'draw-hit');
      var head = document.createElementNS(SVG_NS, 'polygon');
      head.setAttribute('points', pointsToAttr(arrowHeadPoints(from, to, d.width)));
      head.setAttribute('class', 'draw-head');
      head.setAttribute('fill', d.color);
      g.appendChild(stroke);
      g.appendChild(head);
      g.appendChild(hit);
    } else {
      var data = smoothPathData(pts);
      stroke = document.createElementNS(SVG_NS, 'path');
      stroke.setAttribute('d', data);
      stroke.setAttribute('class', 'draw-stroke');
      hit = document.createElementNS(SVG_NS, 'path');
      hit.setAttribute('d', data);
      hit.setAttribute('class', 'draw-hit');
      g.appendChild(stroke);
      g.appendChild(hit);
    }
    setDrawStrokeAttrs(stroke, d, false);
    setDrawStrokeAttrs(hit, d, true);
    return g;
  }

  function updateDrawElGeometry(el, d) {
    if (!el) return;
    var pts = drawingPointsPx(d);
    if (d.type === 'arrow') {
      if (pts.length < 2) return;
      var to = pts[1];
      var line = el.querySelector('.draw-stroke');
      if (line) {
        line.setAttribute('x2', to.x.toFixed(1));
        line.setAttribute('y2', to.y.toFixed(1));
      }
      var hit = el.querySelector('.draw-hit');
      if (hit) {
        hit.setAttribute('x2', to.x.toFixed(1));
        hit.setAttribute('y2', to.y.toFixed(1));
      }
      var head = el.querySelector('.draw-head');
      if (head) head.setAttribute('points', pointsToAttr(arrowHeadPoints(pts[0], to, d.width)));
    } else {
      var data = smoothPathData(pts);
      var path = el.querySelector('.draw-stroke');
      if (path) path.setAttribute('d', data);
      var hitPath = el.querySelector('.draw-hit');
      if (hitPath) hitPath.setAttribute('d', data);
    }
  }

  /* Анимация появления линии: обводка прорисовывается через stroke-dashoffset */
  function animateStrokeIn(el) {
    var stroke = el.querySelector('.draw-stroke');
    if (!stroke || typeof anime === 'undefined' || !anime.setDashoffset) return;
    anime({
      targets: stroke,
      strokeDashoffset: [anime.setDashoffset, 0],
      duration: 550,
      easing: 'easeOutCubic',
      complete: function () {
        stroke.style.strokeDasharray = '';
        stroke.style.strokeDashoffset = '';
      }
    });
    var head = el.querySelector('.draw-head');
    if (head) {
      head.style.opacity = '0';
      anime({
        targets: head,
        opacity: 1,
        delay: 260,
        duration: 200,
        easing: 'easeOutQuad'
      });
    }
  }

  function renderDrawings() {
    var items = drawSvg.querySelectorAll('g.draw-item');
    for (var i = 0; i < items.length; i++) items[i].remove();
    drawings.forEach(function (d) {
      drawSvg.appendChild(buildDrawEl(d));
    });
  }

  function cancelActiveDraw() {
    activeDraw = null;
    var preview = drawSvg.querySelector('.draw-item.draw-preview');
    if (preview) preview.remove();
  }

  function commitActiveDraw() {
    var ad = activeDraw;
    activeDraw = null;
    if (ad.el) ad.el.remove();
    if (ad.points.length < 2) return;
    var pts = ad.points.map(function (p) { return { x: round4(p.x), y: round4(p.y) }; });
    var len = 0;
    for (var i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    if (len < 0.02) return; /* случайный клик — не рисуем */
    var d = { id: ad.id, type: ad.type, points: pts, color: ad.color, width: ad.width };
    drawings.push(d);
    var el = buildDrawEl(d);
    drawSvg.appendChild(el);
    animateStrokeIn(el);
    saveDrawings();
    pushHistory();
  }

  function eraseDrawingById(id) {
    var idx = -1;
    for (var i = 0; i < drawings.length; i++) {
      if (drawings[i].id === id) { idx = i; break; }
    }
    if (idx < 0) return;
    drawings.splice(idx, 1);
    var el = drawSvg.querySelector('g.draw-item[data-id="' + id + '"]');
    if (el) {
      anime({
        targets: el,
        opacity: 0,
        duration: 160,
        easing: 'easeInQuad',
        complete: function () { el.remove(); }
      });
    }
    saveDrawings();
    pushHistory();
  }

  btnClearDrawings.addEventListener('click', function () {
    anime({ targets: btnClearDrawings, scale: [1, 0.93, 1], duration: 320, easing: 'easeOutQuad' });
    openModal({
      title: 'Очистить рисунки?',
      text: 'Все нарисованные линии и стрелки будут удалены безвозвратно.',
      buttons: [
        { label: 'Отмена', className: 'ghost' },
        {
          label: 'Очистить',
          className: 'danger',
          action: function () {
            drawings = [];
            renderDrawings();
            saveDrawings();
            pushHistory();
            toast('Рисунки удалены');
          }
        }
      ]
    });
  });

  /* Рисование через Pointer Events (мышь и палец) */
  drawSvg.addEventListener('pointerdown', function (e) {
    if (!drawState.on) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    var pt = localFieldPoint(e.clientX, e.clientY);
    if (!isInsideField(pt)) return;
    if (drawState.tool === 'eraser') {
      var item = e.target && e.target.closest ? e.target.closest('g.draw-item') : null;
      if (item && !item.classList.contains('draw-preview')) {
        eraseDrawingById(item.getAttribute('data-id'));
      }
      return;
    }
    e.preventDefault();
    try { drawSvg.setPointerCapture(e.pointerId); } catch (err) { /* необязательно */ }
    var type = drawState.tool === 'arrow' ? 'arrow' : 'free';
    var startPt = clampDrawPoint(pt);
    var points = type === 'arrow'
      ? [startPt, { x: startPt.x, y: startPt.y }]
      : [startPt];
    activeDraw = {
      id: makeDrawId(),
      pointerId: e.pointerId,
      type: type,
      color: drawState.color,
      width: drawState.width,
      points: points,
      el: null
    };
    var preview = buildDrawEl(adPreview(ad));
    preview.setAttribute('class', 'draw-item draw-preview');
    activeDraw.el = preview;
    drawSvg.appendChild(preview);
  });

  function adPreview(ad) {
    return { id: ad.id, type: ad.type, points: ad.points, color: ad.color, width: ad.width };
  }

  drawSvg.addEventListener('pointermove', function (e) {
    if (!activeDraw || e.pointerId !== activeDraw.pointerId) return;
    var pt = clampDrawPoint(localFieldPoint(e.clientX, e.clientY));
    if (activeDraw.type === 'arrow') {
      activeDraw.points[1] = pt;
    } else {
      var last = activeDraw.points[activeDraw.points.length - 1];
      var dx = pt.x - last.x;
      var dy = pt.y - last.y;
      if (dx * dx + dy * dy < 0.000009) return; /* отсекаем дрожание */
      activeDraw.points.push(pt);
    }
    updateDrawElGeometry(activeDraw.el, activeDraw);
  });

  drawSvg.addEventListener('pointerup', function (e) {
    if (activeDraw && e.pointerId === activeDraw.pointerId) commitActiveDraw();
  });

  drawSvg.addEventListener('pointercancel', function (e) {
    if (activeDraw && e.pointerId === activeDraw.pointerId) cancelActiveDraw();
  });

  /* ── Экспорт PNG (сборка изображения вручную на canvas) ── */

  function loadFieldImage(onDone) {
    var img = new Image();
    var url = null;
    try {
      var str = new XMLSerializer().serializeToString(fieldSvg);
      var blob = new Blob([str], { type: 'image/svg+xml;charset=utf-8' });
      url = URL.createObjectURL(blob);
    } catch (e) {
      onDone(null);
      return;
    }
    img.onload = function () {
      URL.revokeObjectURL(url);
      onDone(img);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      onDone(null);
    };
    img.src = url;
  }

  /* Упрощённое поле, если SVG не удалось отрисовать как изображение */
  function paintFallbackField(ctx) {
    var grad = ctx.createLinearGradient(0, 0, DRAW_VIEW_W, 0);
    grad.addColorStop(0, '#3fa63f');
    grad.addColorStop(0.5, '#48b448');
    grad.addColorStop(1, '#3fa63f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, DRAW_VIEW_W, DRAW_VIEW_H);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (var i = 0; i < 6; i++) ctx.fillRect(i * 200, 0, 100, DRAW_VIEW_H);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 40, 1120, 700);
    ctx.beginPath(); ctx.moveTo(600, 40); ctx.lineTo(600, 740); ctx.stroke();
    ctx.beginPath(); ctx.arc(600, 390, 91.5, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeRect(40, 203, 176, 374);
    ctx.strokeRect(984, 203, 176, 374);
    ctx.strokeRect(40, 311, 66, 158);
    ctx.strokeRect(1094, 311, 66, 158);
  }

  /* Экранная точка из координат поля в px: учитывает поворот на 90° */
  function fieldPointToScreen(px, py) {
    if (state.orientation === 'vertical') return { x: DRAW_VIEW_H - py, y: px };
    return { x: px, y: py };
  }

  function clipLabelFor(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    var t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) {
      t = t.slice(0, -1);
    }
    return t + '…';
  }

  function pngDateStamp() {
    var d = new Date();
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function downloadPng() {
    var s = 2; /* масштаб для чёткости */
    var vertical = state.orientation === 'vertical';
    var canvas = document.createElement('canvas');
    canvas.width = (vertical ? DRAW_VIEW_H : DRAW_VIEW_W) * s;
    canvas.height = (vertical ? DRAW_VIEW_W : DRAW_VIEW_H) * s;
    var ctx = canvas.getContext('2d');
    if (!ctx) {
      toast('Не удалось создать изображение', true);
      return;
    }

    /* Отрисовка в локальных координатах поля: при вертикальной
       ориентации поле повёрнуто на 90 градусов, как на экране */
    function setRot() {
      if (vertical) ctx.setTransform(0, s, -s, 0, DRAW_VIEW_H * s, 0);
      else ctx.setTransform(s, 0, 0, s, 0, 0);
    }

    /* Отрисовка без поворота (текст, круги) — в экранной ориентации */
    function setScreen() {
      ctx.setTransform(s, 0, 0, s, 0, 0);
    }

    loadFieldImage(function (img) {
      /* 1. Поле */
      setRot();
      if (img) {
        try { ctx.drawImage(img, 0, 0, DRAW_VIEW_W, DRAW_VIEW_H); }
        catch (e) { paintFallbackField(ctx); }
      } else {
        paintFallbackField(ctx);
      }

      /* 2. Рисунки (линии и стрелки поворачиваются вместе с полем) */
      setRot();
      drawings.forEach(function (d) {
        var pts = drawingPointsPx(d);
        ctx.strokeStyle = d.color;
        ctx.fillStyle = d.color;
        ctx.lineWidth = d.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (d.type === 'arrow' && pts.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          ctx.lineTo(pts[1].x, pts[1].y);
          ctx.stroke();
          var head = arrowHeadPoints(pts[0], pts[1], d.width);
          ctx.beginPath();
          head.forEach(function (p, i) {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.closePath();
          ctx.fill();
        } else {
          try { ctx.stroke(new Path2D(smoothPathData(pts))); } catch (e) { /* пустой путь */ }
        }
      });

      /* 3. Круги игроков с номерами и подписями */
      players.forEach(function (p) {
        if (!p.pos) return;
        var pos = clampPos(p.pos.x, p.pos.y);
        var scr = fieldPointToScreen(pos.u * DRAW_VIEW_W, pos.v * DRAW_VIEW_H);
        var disc = PLAYER_RADIUS * 2;
        var r = PLAYER_RADIUS;
        var hex = p.team === 'opponent' ? teamColors.opponent : teamColors.own;
        setScreen();
        ctx.beginPath();
        ctx.arc(scr.x, scr.y, r, 0, Math.PI * 2);
        ctx.fillStyle = hex;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 3;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.lineWidth = disc * 0.0588;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.arc(scr.x, scr.y, r - ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.stroke();
        var fs = disc * 0.3824;
        ctx.font = '700 ' + fs.toFixed(1) + 'px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = numberColorFor(hex);
        if (p.number) ctx.fillText(p.number, scr.x, scr.y + fs * 0.05);
        if (p.name) {
          var lfs = disc * 0.3235;
          ctx.font = '600 ' + lfs.toFixed(1) + 'px "Segoe UI", Arial, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
          ctx.shadowBlur = 3;
          ctx.fillText(clipLabelFor(ctx, p.name, disc * 3.235),
            scr.x, scr.y + r + disc * 0.0588 + lfs * 0.75);
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        }
      });

      /* 4. Мяч */
      if (ball.pos) {
        var bpos = clampPos(ball.pos.x, ball.pos.y, ballRadiusPx());
        var bscr = fieldPointToScreen(bpos.u * DRAW_VIEW_W, bpos.v * DRAW_VIEW_H);
        var bd = BALL_DIAMETER;
        setScreen();
        var grad = ctx.createRadialGradient(
          bscr.x - bd * 0.17, bscr.y - bd * 0.2, bd * 0.08,
          bscr.x, bscr.y, bd * 0.55
        );
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(1, '#d6d9de');
        ctx.beginPath();
        ctx.arc(bscr.x, bscr.y, bd / 2, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 3;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.lineWidth = bd * 0.075;
        ctx.strokeStyle = 'rgba(17, 24, 39, 0.65)';
        ctx.beginPath();
        ctx.arc(bscr.x, bscr.y, bd / 2 - ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.stroke();
        var box = bd * 0.44;
        var rel = [[0, -0.5], [0.5, -0.14], [0.31, 0.5], [-0.31, 0.5], [-0.5, -0.14]];
        ctx.beginPath();
        rel.forEach(function (rp, i) {
          var x = bscr.x + rp[0] * box;
          var y = bscr.y + rp[1] * box;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = '#111827';
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      /* 5. Скачивание */
      try {
        canvas.toBlob(function (blob) {
          if (!blob) {
            toast('Не удалось сохранить PNG', true);
            return;
          }
          var name = 'тактика-' + pngDateStamp() + '.png';
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
          toast('PNG сохранён: ' + name);
        }, 'image/png');
      } catch (err) {
        toast('Не удалось сохранить PNG', true);
      }
    });
  }

  btnDownloadPng.addEventListener('click', function () {
    anime({ targets: btnDownloadPng, scale: [1, 0.93, 1], duration: 320, easing: 'easeOutQuad' });
    downloadPng();
  });

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
      }),
      drawings: drawings.map(cloneDrawingData)
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
    drawings = (snap.drawings || []).map(cloneDrawingData);
    renderDrawings();
    /* Undo/Redo тоже оставляет след в автосохранении */
    saveBall();
    saveDrawings();

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

  /* Рисунок из пресета с подстановкой значений по умолчанию.
      Некорректные записи отбрасываются, а не ломают загрузку. */
  function normalizeDrawing(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.type !== 'free' && raw.type !== 'arrow') return null;
    if (!Array.isArray(raw.points)) return null;
    var pts = raw.points.filter(function (p) {
      return p && typeof p === 'object' && isFinite(p.x) && isFinite(p.y) &&
        p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
    }).map(function (p) {
      return { x: Number(p.x), y: Number(p.y) };
    });
    if (pts.length < 2) return null;
    var width = Number(raw.width);
    if (!isFinite(width) || width < 2) width = 4;
    width = Math.min(24, width);
    return {
      id: raw.id == null ? makeDrawId() : String(raw.id),
      type: raw.type,
      points: pts,
      color: parseHex(raw.color) ? raw.color : '#ffffff',
      width: width
    };
  }

  /* Игрок из пресета с подстановкой значений по умолчанию */  function normalizePresetPlayer(raw) {
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
      /* в старых пресетах рисунков нет — считаем, что поле чистое */
      drawings: Array.isArray(raw.drawings)
        ? raw.drawings.map(normalizeDrawing).filter(function (d) { return !!d; })
        : [],
      players: raw.players.map(normalizePresetPlayer)
    };
  }

  /* Текущее состояние доски как снимок для пресета */
  function snapshotPreset() {
    return {
      orientation: state.orientation,
      colors: { own: teamColors.own, opponent: teamColors.opponent },
      ball: ball.pos ? { x: round4(ball.pos.x), y: round4(ball.pos.y) } : null,
      drawings: drawings.map(function (d) {
        return {
          id: d.id,
          type: d.type,
          points: d.points.map(function (pt) { return { x: round4(pt.x), y: round4(pt.y) }; }),
          color: d.color,
          width: d.width
        };
      }),
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
    saveBall();

    if (state.orientation !== preset.orientation) {
      state.orientation = preset.orientation;
      storageSet('fb-board-orientation', state.orientation);
      applyOrientation(false);
    }

    drawings = (preset.drawings || []).map(cloneDrawingData);
    renderDrawings();
    saveDrawings();

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
    return JSON.stringify([snap.orientation, snap.colors, snap.ball, snap.drawings, snap.players]) !==
      JSON.stringify([p.orientation, p.colors, p.ball, p.drawings, p.players]);
  }

  function overwritePreset(p) {
    var snap = snapshotPreset();
    p.orientation = snap.orientation;
    p.colors = snap.colors;
    p.ball = snap.ball;
    p.drawings = snap.drawings;
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
        drawings: snapshot.drawings,
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
    saveDrawings();
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

  /* Восстановление мяча и рисунков: после того, как поле получило
     размеры и ориентацию. Точки в долях 0–1, поэтому позиции верны
     в том числе при вертикальной ориентации. */
  loadBall();
  loadDrawings();
  renderDrawings();
  syncBall(false);

  initPresets();
  syncCounter();
  updateBallButton();
  pushHistory();
  updateHistoryButtons();
})();
