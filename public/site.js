// 主题切换、文档搜索、移动端目录、本页目录高亮、代码复制。无第三方依赖。
(function () {
  var root = window.RA_ROOT || '';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  // 主题
  var tb = $('[data-theme-toggle]');
  if (tb) tb.addEventListener('click', function () {
    var cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('ra-theme', next); } catch (e) {}
  });

  // 代码复制
  $$('.code-copy').forEach(function (b) {
    b.addEventListener('click', function () {
      var code = $('code', b.parentNode); if (!code || !navigator.clipboard) return;
      navigator.clipboard.writeText(code.textContent).then(function () {
        b.textContent = '已复制'; setTimeout(function () { b.textContent = '复制'; }, 1600);
      });
    });
  });

  // 文档目录抽屉（窄屏）
  var side = $('[data-side]'), scrim = $('[data-nav-close]');
  function drawer(open) { if (!side) return; side.classList.toggle('is-open', open); if (scrim) scrim.hidden = !open; }
  $$('[data-nav-open]').forEach(function (b) { b.addEventListener('click', function () { drawer(true); }); });
  if (scrim) scrim.addEventListener('click', function () { drawer(false); });
  if (side) side.addEventListener('click', function (e) { if (e.target.tagName === 'A') drawer(false); });
  var act = $('.side-group a.is-active');
  if (act && act.scrollIntoView) { var sc = $('.side-scroll'); if (sc) sc.scrollTop = Math.max(0, act.offsetTop - 120); }

  // 本页目录高亮
  var links = $$('.toc a');
  if (links.length && 'IntersectionObserver' in window) {
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { links.forEach(function (a) { a.classList.remove('is-on'); }); var a = map[e.target.id]; if (a) a.classList.add('is-on'); }
      });
    }, { rootMargin: '-72px 0px -70% 0px' });
    Object.keys(map).forEach(function (id) { var h = document.getElementById(id); if (h) io.observe(h); });
  }

  // 自动播放视频：进入视口才播放
  var vids = $$('video[autoplay]');
  if (vids.length && 'IntersectionObserver' in window) {
    vids.forEach(function (v) { v.pause(); });
    var vo = new IntersectionObserver(function (es) {
      es.forEach(function (e) { var p = e.isIntersecting ? e.target.play() : (e.target.pause(), null); if (p && p.catch) p.catch(function () {}); });
    }, { threshold: .35 });
    vids.forEach(function (v) { vo.observe(v); });
  }

  // 搜索
  var modal = $('[data-search-modal]'), input = $('[data-search-input]'), list = $('[data-search-results]');
  if (!modal) return;
  var index = null, loading = null, sel = 0, shown = [];
  function load() {
    if (index) return Promise.resolve(index);
    return loading || (loading = fetch(root + 'search-index.json').then(function (r) { return r.json(); }).then(function (j) { index = j; return j; }).catch(function () { index = []; return index; }));
  }
  function open() { modal.hidden = false; input.value = ''; render(''); setTimeout(function () { input.focus(); }, 0); load().then(function () { render(input.value); }); }
  function close() { modal.hidden = true; }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mark(text, terms) {
    var out = esc(text);
    terms.forEach(function (t) { if (t) out = out.replace(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/&/g, '&amp;'), 'gi'), function (m) { return '<mark>' + m + '</mark>'; }); });
    return out;
  }
  function snippet(text, terms) {
    var low = text.toLowerCase(), pos = -1;
    for (var i = 0; i < terms.length; i++) { pos = low.indexOf(terms[i]); if (pos >= 0) break; }
    if (pos < 0) return text.slice(0, 90);
    var s = Math.max(0, pos - 24); return (s > 0 ? '…' : '') + text.slice(s, s + 100);
  }
  function render(q) {
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    sel = 0;
    if (!terms.length) { shown = (index || []).filter(function (x) { return !x.section; }).slice(0, 8); }
    else {
      shown = (index || []).map(function (x) {
        var t = (x.title + ' ' + x.section).toLowerCase(), b = x.text.toLowerCase(), score = 0;
        for (var i = 0; i < terms.length; i++) {
          var inT = t.indexOf(terms[i]) >= 0, inB = b.indexOf(terms[i]) >= 0;
          if (!inT && !inB) return null;
          score += (inT ? 10 : 0) + (inB ? 3 : 0);
        }
        return { x: x, s: score };
      }).filter(Boolean).sort(function (a, b) { return b.s - a.s; }).slice(0, 10).map(function (r) { return r.x; });
    }
    if (!shown.length) { list.innerHTML = '<li class="search-empty">没有找到「' + esc(q) + '」。换个词试试，例如“上传”“导出”“账号”。</li>'; return; }
    list.innerHTML = shown.map(function (x, i) {
      return '<li' + (i === 0 ? ' class="is-on"' : '') + '><a href="' + root + x.url + '"><div><span class="r-t">' + mark(x.title + (x.section ? ' › ' + x.section : ''), terms) + '</span><span class="r-g">' + esc(x.group) + '</span></div><div class="r-s">' + mark(snippet(x.text, terms), terms) + '</div></a></li>';
    }).join('');
  }
  function move(d) {
    var items = $$('li', list); if (!items.length || items[0].className === 'search-empty') return;
    items[sel].classList.remove('is-on'); sel = (sel + d + items.length) % items.length; items[sel].classList.add('is-on'); items[sel].scrollIntoView({ block: 'nearest' });
  }
  $$('[data-search-open]').forEach(function (b) { b.addEventListener('click', open); });
  modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
  input.addEventListener('input', function () { render(input.value); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { var a = $$('li a', list)[sel]; if (a) location.href = a.href; }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); modal.hidden ? open() : close(); }
    else if (e.key === 'Escape' && !modal.hidden) close();
    else if (e.key === '/' && modal.hidden && !/input|textarea/i.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); open(); }
  });
})();
