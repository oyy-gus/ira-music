/* greeting.js — Welcome & Leave Studio */
(function () {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────────────
  var currentMode         = 'welcome';
  var currentDeliveryMode = 'standalone';
  var guildConfig         = (window.INITIAL_GREETING_CONFIG) || {};
  var serverChannels      = [];
  var updateTimer         = null;
  var pendingResetType    = null;
  var currentBgPreset     = 'default';

  // ─── Bootstrap ───────────────────────────────────────────────────────────────
  function init() {
    bindEvents();
    loadGuildConfig();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ─── Event Binding ───────────────────────────────────────────────────────────
  // All handlers registered here — NO onclick= in HTML needed
  function bindEvents() {
    // Document level delegation for mode buttons, tab buttons, align buttons & placeholders
    document.addEventListener('click', function (e) {
      var modeBtn = e.target.closest('.mode-btn');
      if (modeBtn && modeBtn.dataset.mode) {
        setDeliveryMode(modeBtn.dataset.mode);
        return;
      }

      var tabBtn = e.target.closest('.tab-btn');
      if (tabBtn && tabBtn.dataset.tab) {
        switchMode(tabBtn.dataset.tab);
        return;
      }

      var alignBtn = e.target.closest('.btn-align');
      if (alignBtn && alignBtn.dataset.align) {
        setAlign(alignBtn.dataset.align);
        return;
      }

      var insertBtn = e.target.closest('[data-insert]');
      if (insertBtn && insertBtn.dataset.insert) {
        insertPlaceholder(insertBtn.dataset.insert, insertBtn.dataset.target || 'cfg-message');
        return;
      }
    });

    // Welcome / Leave tabs explicit
    on('tab-btn-welcome', 'click', function () { switchMode('welcome'); });
    on('tab-btn-leave',   'click', function () { switchMode('leave'); });

    // Delivery mode buttons explicit
    on('mode-btn-standalone', 'click', function () { setDeliveryMode('standalone'); });
    on('mode-btn-embed',      'click', function () { setDeliveryMode('embed'); });
    on('mode-btn-text',       'click', function () { setDeliveryMode('text'); });

    // Action buttons
    on('btn-save',            'click', saveCurrentConfig);
    on('btn-refresh-preview', 'click', refreshPreview);
    on('btn-reset-style',     'click', function () { openResetModal('appearance'); });
    on('btn-reset-full',      'click', function () { openResetModal('full'); });
    on('btn-modal-cancel',    'click', closeResetModal);
    on('btn-modal-confirm',   'click', confirmReset);

    // Channel selector
    on('cfg-channelId', 'change', function () {
      checkSelectedChannelPermissions();
      triggerUpdate();
    });

    // Inputs that trigger live preview
    li('cfg-enabled',  'change'); li('cfg-useCard', 'change'); li('cfg-message', 'input');
    li('cfg-messageEnabled', 'change'); li('cfg-disableMention', 'change');
    li('emb-title', 'input'); li('emb-description', 'input'); li('emb-color', 'input');
    li('emb-authorName', 'input'); li('emb-footerText', 'input');
    li('emb-showCanvasCard', 'change');
    li('bg-fit', 'change'); li('bg-position', 'change');

    on('bg-overlayOpacity', 'input', function () {
      var v = document.getElementById('bg-opacity-val');
      if (v) v.innerText = this.value + '%';
      triggerUpdate();
    });
    bindColorPair('bg-overlayColor');
    bindColorPair('clr-primary'); bindColorPair('clr-secondary');
    bindColorPair('clr-text');    bindColorPair('clr-subtext');
    bindColorPair('clr-accent');  bindColorPair('avt-borderColor');

    li('fnt-heading', 'change'); li('fnt-body', 'change');
    on('tpo-headingSize', 'input', function () {
      var v = document.getElementById('tpo-hsize-val');
      if (v) v.innerText = this.value + 'px';
      triggerUpdate();
    });
    on('tpo-bodySize', 'input', function () {
      var v = document.getElementById('tpo-bsize-val');
      if (v) v.innerText = this.value + 'px';
      triggerUpdate();
    });

    on('align-left',   'click', function () { setAlign('left'); });
    on('align-center', 'click', function () { setAlign('center'); });
    on('align-right',  'click', function () { setAlign('right'); });

    li('avt-shape', 'change'); li('avt-frame', 'change');
    on('avt-size', 'input', function () {
      var v = document.getElementById('avt-size-val');
      if (v) v.innerText = this.value + 'px';
      triggerUpdate();
    });
    on('avt-borderWidth', 'input', function () {
      var v = document.getElementById('avt-bwidth-val');
      if (v) v.innerText = this.value + 'px';
      triggerUpdate();
    });
    on('avt-shadowIntensity', 'input', function () {
      var v = document.getElementById('avt-shadow-val');
      if (v) v.innerText = this.value;
      triggerUpdate();
    });

    li('vis-avatar', 'change'); li('vis-heading', 'change'); li('vis-message', 'change');
    li('vis-serverName', 'change'); li('vis-memberNumber', 'change'); li('vis-memberCount', 'change');

    // Background preset buttons (event delegation on container)
    var presetsCtr = document.getElementById('bg-presets-container');
    if (presetsCtr) {
      presetsCtr.addEventListener('click', function (e) {
        var btn = e.target.closest('.bg-preset-btn');
        if (btn && btn.dataset.preset) selectBgPreset(btn.dataset.preset);
      });
    }

    // Custom background file upload
    on('btn-choose-bg',  'click', function () {
      var fi = document.getElementById('bg-file-input');
      if (fi) fi.click();
    });
    on('bg-file-input', 'change', handleBgFileUpload);

    // Placeholder insert buttons — event delegation (data-insert + data-target attributes)
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-insert]');
      if (btn) insertPlaceholder(btn.dataset.insert, btn.dataset.target || 'cfg-message');
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  function on(id, ev, fn) { var el = document.getElementById(id); if (el) el.addEventListener(ev, fn); }
  function li(id, ev)     { on(id, ev, triggerUpdate); }
  function bindColorPair(base) {
    on(base, 'input', function () { syncColorPicker(base, this.value); });
    on(base + '-picker', 'input', function () { syncColorInput(base, this.value); });
  }
  function sh(el, d)       { if (el) el.style.display = d || 'block'; }
  function hi(el)           { if (el) el.style.display = 'none'; }
  function st(id, val)      { var el = document.getElementById(id); if (el) el.innerText = val; }
  function sv(id, val)      { var el = document.getElementById(id); if (el) { el.value = val; el.dispatchEvent(new Event('change', { bubbles: true })); } }
  function gv(id)           { var el = document.getElementById(id); return el ? el.value : ''; }
  function sc(id, val)      { var el = document.getElementById(id); if (el) el.checked = Boolean(val); }
  function gc(id)           { var el = document.getElementById(id); return el ? el.checked : false; }
  function scol(id, val) {
    sv(id, val);
    var p = document.getElementById(id + '-picker');
    if (p && /^#[0-9A-F]{6}$/i.test(val)) p.value = val;
  }
  function syncColorInput(id, val) {
    var el = document.getElementById(id);
    if (el) el.value = val;
    triggerUpdate();
  }
  function syncColorPicker(id, val) {
    var p = document.getElementById(id + '-picker');
    if (p && /^#[0-9A-F]{6}$/i.test(val)) p.value = val;
    triggerUpdate();
  }

  // ─── Config Load ─────────────────────────────────────────────────────────────
  async function loadGuildConfig() {
    var guildId = window.CURRENT_GUILD_ID;
    if (!guildId || guildId === '{{GUILD_ID}}') { switchMode('welcome'); return; }
    try {
      var res  = await fetch('/api/guilds/' + guildId + '/greeting');
      var data = await res.json();
      if (data.status === 'OK' && data.config) {
        guildConfig = data.config;
        if (data.channels) { serverChannels = data.channels; populateChannels(serverChannels); }
      }
    } catch (e) { console.warn('[GreetingStudio] Using embedded config'); }
    switchMode('welcome');
  }

  // ─── Channel ─────────────────────────────────────────────────────────────────
  function populateChannels(channels) {
    var select = document.getElementById('cfg-channelId');
    if (!select) return;
    var cur = select.value;
    select.innerHTML = '<option value="">-- Select Channel --</option>';
    (channels || []).forEach(function (ch) {
      var opt  = document.createElement('option');
      opt.value = ch.id;
      var miss = ch.missingPermissions && ch.missingPermissions.length > 0;
      opt.textContent = '#' + ch.name + (miss ? ' ⚠️ (Missing: ' + ch.missingPermissions.join(', ') + ')' : '');
      select.appendChild(opt);
    });
    if (cur) select.value = cur;
    checkSelectedChannelPermissions();
  }

  function checkSelectedChannelPermissions() {
    var select = document.getElementById('cfg-channelId');
    var box    = document.getElementById('channel-perm-box');
    var list   = document.getElementById('channel-perm-list');
    if (!select || !box || !list) return;
    var ch = serverChannels.find(function (c) { return c.id === select.value; });
    if (ch && ch.missingPermissions && ch.missingPermissions.length > 0) {
      list.innerHTML = ch.missingPermissions.map(function (p) { return '• <b>' + p + '</b>'; }).join('<br>');
      box.style.display = 'block';
    } else {
      box.style.display = 'none';
    }
  }

  // ─── Mode Switch (Welcome / Leave tab) ───────────────────────────────────────
  function switchMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.tab-btn-mode').forEach(function (btn) {
      var a = btn.id === 'tab-btn-' + mode;
      btn.classList.toggle('active', a);
      btn.style.background = a ? 'var(--primary)' : 'rgba(255,255,255,.05)';
      btn.style.color      = a ? '#fff' : 'var(--muted)';
    });
    populateUiFromConfig();
    refreshPreview();
  }

  // ─── Delivery Mode Switch ────────────────────────────────────────────────────
  var lastCanvasDataUrl = null;

  function setDeliveryMode(mode) {
    if (!mode) return;
    currentDeliveryMode = mode;
    applyDeliveryModeUI(mode);
    triggerUpdate();
  }

  function applyDeliveryModeUI(mode) {
    currentDeliveryMode = mode || 'standalone';

    // Update mode buttons — toggle class AND inline styles
    document.querySelectorAll('.mode-btn').forEach(function (btn) {
      var a = btn.dataset.mode === currentDeliveryMode;
      btn.classList.toggle('mode-btn--active', a);
      btn.classList.toggle('active', a);
      btn.style.background = a ? 'var(--primary)' : 'rgba(255,255,255,.05)';
      btn.style.color      = a ? '#fff' : 'var(--muted)';
      btn.style.borderColor = a ? 'var(--primary)' : 'rgba(255,255,255,.08)';
    });

    // Show/hide right-side panels
    var ep    = document.getElementById('panel-embed-customizer');
    var cp    = document.getElementById('panel-canvas-customizer');
    var badge = document.getElementById('preview-mode-badge');

    if (currentDeliveryMode === 'embed') {
      sh(ep); sh(cp);
      if (badge) badge.textContent = 'Custom Discord Embed';
    } else if (currentDeliveryMode === 'text') {
      hi(ep); hi(cp);
      if (badge) badge.textContent = 'Text Only';
    } else {
      hi(ep); sh(cp);
      if (badge) badge.textContent = 'Canvas Card';
    }

    // Instantly update preview container without waiting
    updatePreviewDOM();
  }

  function updatePreviewDOM() {
    var standaloneBox = document.getElementById('preview-standalone-box');
    var emb           = document.getElementById('preview-embed-box');
    var txt           = document.getElementById('preview-text-box');
    var img           = document.getElementById('preview-img');
    var ldr           = document.getElementById('preview-loader');

    var msg = gv('cfg-message');
    var isMsgEnabled = gc('cfg-messageEnabled');
    var ec  = collectEmbedConfigFromUI();
    var botName   = window.BOT_NAME || 'Ira Music';
    var botAvatar = window.BOT_AVATAR || 'https://cdn.discordapp.com/embed/avatars/0.png';

    if (currentDeliveryMode === 'text') {
      hi(ldr); hi(standaloneBox); hi(emb);
      if (txt) {
        st('text-preview-author-name', botName);
        var ti = document.getElementById('text-preview-author-icon');
        if (ti) ti.src = botAvatar;
        st('text-preview-body', isMsgEnabled ? (resolveMock(msg) || '(empty message)') : '(Caption disabled)');
        sh(txt);
      }
    } else if (currentDeliveryMode === 'embed') {
      hi(ldr); hi(standaloneBox); hi(txt);
      if (emb) {
        // Bot header
        st('emb-mock-author-name', botName);
        var emi = document.getElementById('emb-mock-author-icon');
        if (emi) emi.src = botAvatar;

        // Caption text above embed
        var capEl = document.getElementById('emb-preview-caption');
        var resolvedMsg = resolveMock(msg);
        if (capEl) {
          if (isMsgEnabled && resolvedMsg && resolvedMsg.trim()) {
            capEl.textContent = resolvedMsg;
            sh(capEl);
          } else {
            hi(capEl);
          }
        }

        // Inner embed
        var innerEmb = document.getElementById('emb-inner-container');
        if (innerEmb) innerEmb.style.borderLeftColor = ec.color || '#8B5CF6';
        st('emb-preview-author-text', resolveMock(ec.authorName || ''));
        st('emb-preview-title',       resolveMock(ec.title       || ''));
        st('emb-preview-desc',        resolveMock(ec.description || ''));
        st('emb-preview-footer-text', resolveMock(ec.footerText  || ''));
        var ai = document.getElementById('emb-preview-author-icon');
        if (ai && window.USER_AVATAR) ai.src = window.USER_AVATAR;
        var ei = document.getElementById('emb-preview-img');
        if (ei) {
          if (ec.showCanvasCard && lastCanvasDataUrl) {
            ei.src = lastCanvasDataUrl;
            sh(ei);
          } else {
            hi(ei);
          }
        }
        sh(emb);
      }
    } else {
      // Standalone mode
      hi(txt); hi(emb);
      if (standaloneBox) {
        st('standalone-preview-author-name', botName);
        var sai = document.getElementById('standalone-preview-author-icon');
        if (sai) sai.src = botAvatar;
        
        var stextEl = document.getElementById('standalone-preview-text');
        if (stextEl) {
          if (isMsgEnabled) {
            stextEl.textContent = resolveMock(msg) || '(empty caption)';
            sh(stextEl);
          } else {
            hi(stextEl);
          }
        }

        if (img && lastCanvasDataUrl) {
          hi(ldr);
          img.src = lastCanvasDataUrl;
          sh(img);
        }
        sh(standaloneBox);
      }
    }
  }


  // ─── Populate UI ─────────────────────────────────────────────────────────────
  function getConfigObject() { return guildConfig[currentMode] || {}; }

  function populateUiFromConfig() {
    var cfg  = getConfigObject();
    var card = cfg.card || {};
    var emb  = cfg.embedConfig || {};
    var bg   = card.background || {};
    var clr  = card.colors || {};
    var fnt  = card.fonts || {};
    var tpo  = card.typography || {};
    var avt  = card.avatar || {};
    var vis  = card.visibility || {};

    sc('cfg-enabled', cfg.enabled !== false);
    sc('cfg-useCard', cfg.useCard !== false);
    sc('cfg-messageEnabled', cfg.messageEnabled !== false);
    sc('cfg-disableMention', cfg.disableMention === true);
    sv('cfg-channelId', cfg.channelId || '');
    sv('cfg-message', cfg.message || (currentMode === 'welcome'
      ? 'Welcome {user} to {server}! 🎉'
      : "Goodbye {user}, we'll miss you!"));

    applyDeliveryModeUI(cfg.mode || 'standalone');

    // Embed fields
    sv('emb-title', emb.title || (currentMode === 'welcome' ? 'Welcome to {server}! 🎉' : 'Goodbye from {server}'));
    sv('emb-description', emb.description || (currentMode === 'welcome'
      ? 'Welcome {user} to **{server}**! We are glad to have you.'
      : "Goodbye **{displayName}**, we'll miss you!"));
    scol('emb-color', emb.color || (currentMode === 'welcome' ? '#8B5CF6' : '#EF4444'));
    sv('emb-authorName', emb.authorName || '{displayName}');
    sv('emb-footerText', emb.footerText || (currentMode === 'welcome' ? 'Member #{memberNumber} • {server}' : '{server}'));
    sc('emb-showCanvasCard', emb.showCanvasCard !== false);

    // Background
    selectBgPresetUI(bg.value || 'default');
    sv('bg-fit', bg.fit || 'cover');
    sv('bg-position', bg.position || 'center');
    sv('bg-overlayOpacity', bg.overlayOpacity != null ? bg.overlayOpacity : 50);
    var opv = document.getElementById('bg-opacity-val');
    if (opv) opv.innerText = (bg.overlayOpacity != null ? bg.overlayOpacity : 50) + '%';
    scol('bg-overlayColor', bg.overlayColor || '#000000');

    // Colors
    scol('clr-primary',   clr.primary   || (currentMode === 'welcome' ? '#8B5CF6' : '#EF4444'));
    scol('clr-secondary', clr.secondary || '#3B82F6');
    scol('clr-text',      clr.text      || '#FFFFFF');
    scol('clr-subtext',   clr.subtext   || '#9CA3AF');
    scol('clr-accent',    clr.accent    || clr.primary || '#8B5CF6');

    // Fonts & Typography
    sv('fnt-heading',     fnt.heading     || 'Sans-Serif');
    sv('fnt-body',        fnt.body        || 'Sans-Serif');
    sv('tpo-headingSize', tpo.headingSize || 28);
    sv('tpo-bodySize',    tpo.bodySize    || 16);
    var hv = document.getElementById('tpo-hsize-val'); if (hv) hv.innerText = (tpo.headingSize || 28) + 'px';
    var bv = document.getElementById('tpo-bsize-val'); if (bv) bv.innerText = (tpo.bodySize    || 16) + 'px';
    setAlignUI(tpo.alignment || 'center');

    // Avatar
    sv('avt-shape',           avt.shape           || 'circle');
    sv('avt-frame',           avt.frame           || 'ira');
    sv('avt-size',            avt.size            || 100);
    sv('avt-borderWidth',     avt.borderWidth  != null ? avt.borderWidth  : 4);
    scol('avt-borderColor',   avt.borderColor     || clr.primary || '#8B5CF6');
    sv('avt-shadowIntensity', avt.shadowIntensity != null ? avt.shadowIntensity : 15);
    var szv = document.getElementById('avt-size-val');   if (szv) szv.innerText = (avt.size || 100) + 'px';
    var bwv = document.getElementById('avt-bwidth-val'); if (bwv) bwv.innerText = (avt.borderWidth != null ? avt.borderWidth : 4) + 'px';
    var shv = document.getElementById('avt-shadow-val'); if (shv) shv.innerText = avt.shadowIntensity != null ? avt.shadowIntensity : 15;

    // Visibility
    sc('vis-avatar',       vis.avatar       !== false);
    sc('vis-heading',      vis.heading      !== false);
    sc('vis-message',      vis.message      !== false);
    sc('vis-serverName',   vis.serverName   !== false);
    sc('vis-memberNumber', vis.memberNumber !== false);
    sc('vis-memberCount',  vis.memberCount  !== false);

    checkSelectedChannelPermissions();
  }

  // ─── Collect from UI ─────────────────────────────────────────────────────────
  function collectCardConfigFromUI() {
    var activeAlign = document.querySelector('.btn-align.active');
    return {
      enabled:    gc('cfg-enabled'),
      background: {
        type:           currentBgPreset.startsWith('custom:') ? 'custom' : 'builtin',
        value:          currentBgPreset.startsWith('custom:') ? currentBgPreset.replace('custom:', '') : currentBgPreset,
        fit:            gv('bg-fit'),
        position:       gv('bg-position'),
        overlay:        true,
        overlayColor:   gv('bg-overlayColor'),
        overlayOpacity: parseInt(gv('bg-overlayOpacity'), 10) || 50,
      },
      colors: {
        primary:   gv('clr-primary'),   secondary: gv('clr-secondary'),
        text:      gv('clr-text'),      subtext:   gv('clr-subtext'),
        accent:    gv('clr-accent'),
      },
      fonts:      { heading: gv('fnt-heading'), body: gv('fnt-body') },
      typography: {
        headingSize:   parseInt(gv('tpo-headingSize'), 10) || 28,
        headingWeight: 'bold',
        bodySize:      parseInt(gv('tpo-bodySize'), 10) || 16,
        bodyWeight:    'normal',
        alignment:     activeAlign ? activeAlign.id.replace('align-', '') : 'center',
      },
      avatar: {
        shape:           gv('avt-shape'),
        frame:           gv('avt-frame'),
        size:            parseInt(gv('avt-size'), 10) || 100,
        border:          true,
        borderWidth:     parseInt(gv('avt-borderWidth'), 10) || 4,
        borderColor:     gv('avt-borderColor'),
        shadow:          true,
        shadowIntensity: parseInt(gv('avt-shadowIntensity'), 10) || 15,
      },
      visibility: {
        avatar:       gc('vis-avatar'),   heading:      gc('vis-heading'),
        message:      gc('vis-message'),  serverName:   gc('vis-serverName'),
        memberNumber: gc('vis-memberNumber'), memberCount: gc('vis-memberCount'),
      },
    };
  }

  function collectEmbedConfigFromUI() {
    return {
      enabled:        true,
      title:          gv('emb-title'),
      description:    gv('emb-description'),
      color:          gv('emb-color'),
      authorName:     gv('emb-authorName'),
      authorIcon:     true,
      footerText:     gv('emb-footerText'),
      footerIcon:     true,
      showCanvasCard: gc('emb-showCanvasCard'),
    };
  }

  // ─── Preview ─────────────────────────────────────────────────────────────────
  function triggerUpdate() {
    updatePreviewDOM();
    if (updateTimer) clearTimeout(updateTimer);
    if (currentDeliveryMode === 'text') return; // no canvas rendering needed for text mode
    updateTimer = setTimeout(refreshPreview, 250);
  }

  async function refreshPreview() {
    var img   = document.getElementById('preview-img');
    var emb   = document.getElementById('preview-embed-box');
    var txt   = document.getElementById('preview-text-box');
    var ldr   = document.getElementById('preview-loader');
    var gid   = window.CURRENT_GUILD_ID;

    if (!gid || gid === '{{GUILD_ID}}') return;

    // Immediately update DOM texts and layouts
    updatePreviewDOM();

    if (currentDeliveryMode === 'text') return;

    var ec  = collectEmbedConfigFromUI();
    if (currentDeliveryMode === 'embed' && !ec.showCanvasCard) return;

    // If we don't have an image yet in standalone mode, show loader
    if (currentDeliveryMode === 'standalone' && !lastCanvasDataUrl && ldr) {
      hi(img);
      ldr.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;color:var(--primary)"></i><span>Generating preview...</span>';
      sh(ldr, 'flex');
    }

    var cc  = collectCardConfigFromUI();
    var msg = gv('cfg-message');

    try {
      var res  = await fetch('/api/guilds/' + gid + '/greeting/preview', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ mode: currentMode, cardConfig: cc, message: msg }),
      });
      var data = await res.json();
      if (ldr) hi(ldr);

      if (data.status === 'OK' && data.dataUrl) {
        lastCanvasDataUrl = data.dataUrl;
        updatePreviewDOM();
      } else if (currentDeliveryMode === 'standalone' && !lastCanvasDataUrl && ldr) {
        ldr.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="font-size:1.5rem;color:#f87171"></i><span>Failed to load preview</span>';
        sh(ldr, 'flex');
      }
    } catch (e) {
      if (ldr && currentDeliveryMode === 'standalone' && !lastCanvasDataUrl) {
        ldr.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="font-size:1.5rem;color:#f87171"></i><span>Connection error</span>';
        sh(ldr, 'flex');
      }
    }
  }

  function resolveMock(tmpl) {
    if (!tmpl) return '';
    var d = window.USER_DISPLAY_NAME || window.BOT_NAME || 'Ira Music';
    var u = window.USER_NAME || 'iramusic';
    return tmpl
      .replace(/{user}/g,         '@' + d)
      .replace(/{username}/g,     u)
      .replace(/{displayName}/g,  d)
      .replace(/{server}/g,       'Ira Community')
      .replace(/{memberCount}/g,  '250')
      .replace(/{memberNumber}/g, '152')
      .replace(/{userId}/g,       '999888777');
  }

  // ─── Save ────────────────────────────────────────────────────────────────────
  async function saveCurrentConfig() {
    var gid = window.CURRENT_GUILD_ID;
    if (!gid || gid === '{{GUILD_ID}}') return;
    var payload = {
      type:   currentMode,
      config: {
        enabled:        gc('cfg-enabled'),
        mode:           currentDeliveryMode,
        channelId:      gv('cfg-channelId'),
        message:        gv('cfg-message'),
        messageEnabled: gc('cfg-messageEnabled'),
        disableMention: gc('cfg-disableMention'),
        useCard:        gc('cfg-useCard'),
        embedConfig:    collectEmbedConfigFromUI(),
        card:           collectCardConfigFromUI(),
      },
    };
    showToast('Saving changes...', 'info');
    try {
      var res  = await fetch('/api/guilds/' + gid + '/greeting', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      var data = await res.json();
      if (data.status === 'OK') {
        showToast('Settings saved successfully!', 'success');
        if (data.config) guildConfig = data.config;
      } else { throw new Error(data.message || 'Save failed'); }
    } catch (e) { showToast(e.message || 'Failed to save settings.', 'error'); }
  }

  // ─── Reset ───────────────────────────────────────────────────────────────────
  function openResetModal(type) {
    pendingResetType = type;
    var modal = document.getElementById('reset-modal');
    var title = document.getElementById('reset-modal-title');
    var desc  = document.getElementById('reset-modal-desc');
    if (type === 'appearance') {
      if (title) title.innerText = 'Reset Appearance Style?';
      if (desc)  desc.innerText  = 'This will reset background, colors, fonts, avatar and embed styling to defaults.';
    } else {
      if (title) title.innerText = 'Reset All Settings?';
      if (desc)  desc.innerText  = 'This will reset all channels, messages, modes and visual styling to factory defaults.';
    }
    if (modal) modal.style.display = 'flex';
  }

  function closeResetModal() {
    var m = document.getElementById('reset-modal');
    if (m) m.style.display = 'none';
    pendingResetType = null;
  }

  async function confirmReset() {
    if (!pendingResetType) return;
    var gid    = window.CURRENT_GUILD_ID;
    var action = pendingResetType === 'appearance' ? 'reset-appearance' : 'reset';
    closeResetModal();
    showToast('Resetting...', 'info');
    try {
      var res  = await fetch('/api/guilds/' + gid + '/greeting/' + action, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: currentMode }),
      });
      var data = await res.json();
      if (data.status === 'OK') {
        showToast('Reset completed!', 'success');
        if (data.config) guildConfig = data.config;
        populateUiFromConfig();
        refreshPreview();
      } else { throw new Error(data.message || 'Reset failed'); }
    } catch (e) { showToast(e.message || 'Failed to reset.', 'error'); }
  }

  // ─── Background Presets ──────────────────────────────────────────────────────
  function selectBgPreset(name) { currentBgPreset = name; selectBgPresetUI(name); triggerUpdate(); }

  function selectBgPresetUI(name) {
    currentBgPreset = name;
    document.querySelectorAll('.bg-preset-btn').forEach(function (btn) {
      var a = btn.dataset.preset === name;
      btn.classList.toggle('active', a);
      btn.style.border = a ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,.1)';
    });
  }

  async function handleBgFileUpload(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    var statusEl = document.getElementById('upload-status');
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--primary)"><i class="fa-solid fa-spinner fa-spin"></i> Uploading...</span>';
    var reader = new FileReader();
    reader.onload = async function () {
      try {
        var res  = await fetch('/api/guilds/' + window.CURRENT_GUILD_ID + '/greeting/upload-background', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ data: reader.result, filename: file.name, mime: file.type }),
        });
        var data = await res.json();
        if (data.status === 'OK' && data.url) {
          currentBgPreset = 'custom:' + data.url;
          document.querySelectorAll('.bg-preset-btn').forEach(function (b) {
            b.classList.remove('active');
            b.style.border = '1px solid rgba(255,255,255,.1)';
          });
          if (statusEl) statusEl.innerHTML = '<span style="color:#4ade80"><i class="fa-solid fa-check"></i> Upload successful!</span>';
          triggerUpdate();
        } else { throw new Error(data.message || 'Upload failed'); }
      } catch (err) {
        if (statusEl) statusEl.innerHTML = '<span style="color:#f87171"><i class="fa-solid fa-xmark"></i> ' + err.message + '</span>';
      }
    };
    reader.readAsDataURL(file);
  }

  // ─── Text Alignment ──────────────────────────────────────────────────────────
  function setAlign(a) { setAlignUI(a); triggerUpdate(); }
  function setAlignUI(a) {
    document.querySelectorAll('.btn-align').forEach(function (btn) {
      var act = btn.id === 'align-' + a;
      btn.classList.toggle('active', act);
      btn.style.background = act ? 'var(--primary)' : 'rgba(255,255,255,.06)';
    });
  }

  // ─── Placeholder Insert ──────────────────────────────────────────────────────
  function insertPlaceholder(token, targetId) {
    var input = document.getElementById(targetId || 'cfg-message');
    if (!input) return;
    var s = input.selectionStart != null ? input.selectionStart : input.value.length;
    var e = input.selectionEnd   != null ? input.selectionEnd   : input.value.length;
    input.value = input.value.substring(0, s) + token + input.value.substring(e);
    input.selectionStart = input.selectionEnd = s + token.length;
    input.focus();
    triggerUpdate();
  }

  // ─── Toast ───────────────────────────────────────────────────────────────────
  function showToast(msg, type) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.style.display = 'block';
    var map = {
      success: ['rgba(34,197,94,.15)',  '#4ade80', 'rgba(34,197,94,.3)',  'fa-check'],
      error:   ['rgba(239,68,68,.15)',  '#f87171', 'rgba(239,68,68,.3)',  'fa-circle-exclamation'],
      info:    ['rgba(59,130,246,.15)', '#60a5fa', 'rgba(59,130,246,.3)', 'fa-info-circle'],
    };
    var c = map[type] || map.info;
    toast.style.background = c[0];
    toast.style.color      = c[1];
    toast.style.border     = '1px solid ' + c[2];
    toast.innerHTML        = '<i class="fa-solid ' + c[3] + '" style="margin-right:6px"></i>' + msg;
    setTimeout(function () { toast.style.display = 'none'; }, 4000);
  }

  // Expose on window for global fallback
  window.setDeliveryMode    = setDeliveryMode;
  window.switchMode         = switchMode;
  window.saveCurrentConfig  = saveCurrentConfig;
  window.refreshPreview     = refreshPreview;
  window.insertPlaceholder  = insertPlaceholder;
  window.selectBgPreset     = selectBgPreset;
  window.setAlign           = setAlign;
})();
