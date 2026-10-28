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
    return;
  }

  if (rotating) return;
  rotating = true;

  anime({
    targets: rotator,
    rotate: angle + 90,
    scale: [1, 0.9, 1],
    duration: 700,
    easing: 'easeInOutCubic',
    complete: function () {
      angle = (angle + 90) % 360;
      rotator.style.transform = 'rotate(' + angle + 'deg)';
      rotating = false;
    }
  });
}

btnRotate.addEventListener('click', function () {
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
        count = 0;
        counter.textContent = String(count);
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
              status: p.status === 'bench' ? 'bench' : 'start'
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
    players = players.filter(function (p) { return p.id !== id; });
    savePlayers();
    delete cardEls[id];
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
    }
    card.classList.remove('editing');
    box.hidden = true;
    card.querySelector('.player-main').hidden = false;
    card.querySelector('.player-actions').hidden = false;
    refreshCard(p);
  }

  function renderAllPlayers() {
    players.forEach(function (p) { appendCard(p, false); });
    updateHints();
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

  counter.textContent = '0';
})();
