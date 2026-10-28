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

  var btnRotate = document.getElementById('btn-rotate');
  var fieldWrap = document.getElementById('field-wrap');
  var orientationLabel = document.getElementById('orientation');
  var rotated = false;
  var rotating = false;

  btnRotate.addEventListener('click', function () {
    if (rotating) return;
    rotating = true;

    anime({
      targets: fieldWrap,
      scale: [1, 0.86],
      duration: 350,
      easing: 'easeInQuad',
      complete: function () {
        rotated = !rotated;
        orientationLabel.textContent = rotated ? 'Вертикальная' : 'Горизонтальная';

        anime({
          targets: fieldWrap,
          rotate: rotated ? 180 : 0,
          scale: [0.86, 1],
          duration: 650,
          easing: 'easeOutElastic(1, .6)',
          complete: function () {
            fieldWrap.style.transform = rotated ? 'rotate(180deg)' : 'rotate(0deg)';
            rotating = false;
          }
        });
      }
    });
  });

  /* ── Боковая панель ────────────────────────── */

  var btnMenu = document.getElementById('btn-menu');
  var sidebar = document.getElementById('sidebar');

  btnMenu.addEventListener('click', function () {
    sidebar.classList.toggle('collapsed');
    var collapsed = sidebar.classList.contains('collapsed');
    anime({
      targets: btnMenu,
      rotate: collapsed ? -90 : 0,
      duration: 300,
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
  counter.textContent = '0';
})();
