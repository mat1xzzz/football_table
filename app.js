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
