/* ==================================================================
   modules/ui.js — v2.4
   ==================================================================
   v2.4 changes:
     - installKeyboardShortcuts now aborts its previous listener on
       reinstall (same pattern as installOnlineListeners).
     - Ctrl+B routes through Promise.resolve(...).catch(...) so async
       rejections from exportBackup are caught. The old bare try/catch
       only caught synchronous throws — the function returns a Promise
       immediately, so any failure inside escaped as an unhandled
       rejection.
     - Ctrl+B now calls exportBackup({ encrypt: true }) to match the
       toolbar button. Previously Ctrl+B wrote a silent plaintext file.

   v2.3 changes (audit H5, M2):
     - renderRequiredFields skips disabled inputs.
     - _lastReqState is a WeakMap keyed on the input element.
   ================================================================== */
(function () {
    'use strict';

    /* ==============================================================
       ONLINE STATUS
       ============================================================== */
    let _onlineAC = null;
    let _probeAC = null;

    function _setOnlineState(el, state) {
        if (!el || !el.isConnected) return;
        const map = {
            online:  { text: '🟢 Online',                  color: 'var(--pass)' },
            offline: { text: '🟠 Offline — saving locally', color: 'var(--warn)' },
            probing: { text: '🟡 Reconnecting…',           color: 'var(--warn)' }
        };
        const s = map[state] || map.online;
        el.textContent = s.text;
        el.style.color = s.color;
    }

    async function _probeConnectivity(el) {
        if (window.location.protocol === 'file:') {
            _setOnlineState(el, 'online');
            return;
        }
        if (_probeAC) _probeAC.abort();
        _probeAC = new AbortController();
        const timer = setTimeout(() => _probeAC.abort(), 2500);
        try {
            await fetch('./?_probe=' + Date.now(), {
                method: 'HEAD',
                cache: 'no-store',
                signal: _probeAC.signal
            });
            clearTimeout(timer);
            _setOnlineState(el, 'online');
        } catch (e) {
            clearTimeout(timer);
            _setOnlineState(el, 'probing');
        }
    }

    function updateOnlineStatus() {
        const el = document.getElementById('offlineIndicator');
        if (!el) return;
        if (!navigator.onLine) { _setOnlineState(el, 'offline'); return; }
        _setOnlineState(el, 'online');
        _probeConnectivity(el);
    }

    function installOnlineListeners() {
        if (_onlineAC) _onlineAC.abort();
        _onlineAC = new AbortController();
        const { signal } = _onlineAC;
        window.addEventListener('online', updateOnlineStatus, { signal });
        window.addEventListener('offline', updateOnlineStatus, { signal });
        updateOnlineStatus();
    }

    /* ==============================================================
       REQUIRED FIELDS
       ============================================================== */
    const _lastReqState = new WeakMap();

    function _getFieldRules() {
        try {
            return (typeof FIELD_RULES !== 'undefined' && FIELD_RULES) || {};
        } catch (e) { return {}; }
    }

    function renderRequiredFields() {
        const RULES = _getFieldRules();
        document.querySelectorAll('.fg').forEach(fg => {
            const input = fg.querySelector('input, textarea, select');
            if (!input) return;
            const key = (input.id || '').replace(/^(in_|ndt_in_)/, '');
            const rule = RULES[key];
            if (!rule || !rule.required) return;
            const title = fg.querySelector('.fg-title');
            if (!title) return;
            // Disabled = deliberately turned off by the user. Not an error.
            if (input.disabled) {
                title.classList.remove('field-required-empty');
                _lastReqState.set(input, false);
                return;
            }
            const isEmpty = !input.value.trim();
            if (_lastReqState.get(input) === isEmpty) return;
            _lastReqState.set(input, isEmpty);
            title.classList.toggle('field-required-empty', isEmpty);
        });
    }

    /* ==============================================================
       FOCUS TRAP
       ============================================================== */
    let _trapDepth = 0;
    let _trapPrevInert = null;
    let _trapPrevAriaHidden = null;
    let _trapPrevPointerEvents = null;

    const FOCUSABLE_SEL = [
        'button:not([disabled])',
        'a[href]',
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    function _supportsInert() {
        return typeof HTMLElement !== 'undefined' && 'inert' in HTMLElement.prototype;
    }

    function installFocusTrap(modalEl, options) {
        options = options || {};
        if (!modalEl || !modalEl.isConnected) return () => {};
        const main = document.querySelector('main');
        if (!main) return () => {};
        if (main.contains(modalEl)) {
            console.warn('[focusTrap] Modal inside <main> — inert would break it. Skipping.');
            return () => {};
        }

        const prev = (document.activeElement && document.activeElement !== document.body)
            ? document.activeElement : null;

        if (_trapDepth === 0) {
            _trapPrevInert = main.hasAttribute('inert');
            _trapPrevAriaHidden = main.getAttribute('aria-hidden');
            _trapPrevPointerEvents = main.style.pointerEvents;
            if (_supportsInert()) {
                main.setAttribute('inert', '');
            } else {
                main.setAttribute('aria-hidden', 'true');
                main.style.pointerEvents = 'none';
            }
        }
        _trapDepth++;

        let cleaned = false;
        let observer = null;

        const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            _trapDepth = Math.max(0, _trapDepth - 1);
            if (_trapDepth === 0) {
                if (!_trapPrevInert) main.removeAttribute('inert');
                if (_trapPrevAriaHidden === null) main.removeAttribute('aria-hidden');
                else main.setAttribute('aria-hidden', _trapPrevAriaHidden);
                main.style.pointerEvents = _trapPrevPointerEvents || '';
            }
            modalEl.removeEventListener('keydown', trapHandler);
            modalEl.removeEventListener('keydown', escHandler);
            if (observer) observer.disconnect();
            if (prev && prev.isConnected && typeof prev.focus === 'function') {
                try { prev.focus(); } catch (e) {}
            }
        };

        const trapHandler = (e) => {
            if (e.key !== 'Tab') return;
            const focusables = modalEl.querySelectorAll(FOCUSABLE_SEL);
            if (!focusables.length) { e.preventDefault(); return; }
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement;
            if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
            else if (!modalEl.contains(active)) { e.preventDefault(); first.focus(); }
        };

        const escHandler = (e) => {
            if (e.key !== 'Escape') return;
            if (typeof options.onEscape !== 'function') return;
            e.preventDefault();
            options.onEscape();
        };

        observer = new MutationObserver(() => {
            if (!modalEl.isConnected || !modalEl.classList.contains('open')) {
                cleanup();
            }
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });

        modalEl.addEventListener('keydown', trapHandler);
        modalEl.addEventListener('keydown', escHandler);

        const initial = modalEl.querySelector(FOCUSABLE_SEL);
        if (initial) { try { initial.focus(); } catch (e) {} }

        return cleanup;
    }

    /* ==============================================================
       STICKY BANNER
       ============================================================== */
    function installStickyBanner() {
        const banner = document.querySelector('.a4-gauge-banner');
        if (!banner) return;
        Object.assign(banner.style, {
            position: 'sticky',
            top: '0',
            zIndex: '200',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)'
        });
    }

    /* ==============================================================
       KEYBOARD SHORTCUTS
       ============================================================== */
    let _lastBackupAt = 0;
    const BACKUP_THROTTLE_MS = 3000;
    let _shortcutAC = null;

    function _isEditableTarget(el) {
        let cur = el;
        while (cur && cur !== document.body && cur.nodeType === 1) {
            if (cur.isContentEditable) return true;
            const tag = cur.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
            cur = cur.parentElement;
        }
        return false;
    }

    function installKeyboardShortcuts() {
        if (_shortcutAC) _shortcutAC.abort();
        _shortcutAC = new AbortController();
        const { signal } = _shortcutAC;

        document.addEventListener('keydown', (e) => {
            if (_isEditableTarget(e.target)) return;
            const isCtrl = e.ctrlKey || e.metaKey;
            if (isCtrl && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                const now = Date.now();
                if (now - _lastBackupAt < BACKUP_THROTTLE_MS) return;
                _lastBackupAt = now;
                if (typeof window.exportBackup !== 'function') return;
                // exportBackup is async. Promise.resolve().then() catches
                // both sync throws and async rejections in one handler.
                // { encrypt: true } matches the toolbar button.
                Promise.resolve()
                    .then(() => window.exportBackup({ encrypt: true }))
                    .catch(err => console.error('[shortcut] exportBackup failed:', err));
            }
        }, { signal, passive: false });
    }

    /* ==============================================================
       MOBILE SELECT PICKER (Bottom Sheet Dialog)
       ============================================================== */
    let _activeMobileSelect = null;

    function openMobileSelectDialog(selectEl) {
        if (!selectEl) return;
        const dialog = document.getElementById('mobileSelectDialog');
        const list = document.getElementById('mobileSelectOptionsList');
        const titleEl = document.getElementById('mobileSelectTitle');
        if (!dialog || !list) return;

        _activeMobileSelect = selectEl;

        // Find label text if available
        let title = 'Select Option';
        if (selectEl.id) {
            const lbl = document.querySelector('label[for="' + selectEl.id + '"]');
            if (lbl && lbl.textContent) title = lbl.textContent.replace(':', '').trim();
        }
        if (titleEl) titleEl.textContent = title;

        list.innerHTML = '';

        // Build options list respecting optgroups
        Array.from(selectEl.children).forEach(child => {
            if (child.tagName === 'OPTGROUP') {
                const groupTitle = document.createElement('div');
                groupTitle.className = 'mobile-select-optgroup';
                groupTitle.textContent = child.label;
                list.appendChild(groupTitle);

                Array.from(child.children).forEach(opt => {
                    _appendOptionButton(list, opt, selectEl);
                });
            } else if (child.tagName === 'OPTION') {
                _appendOptionButton(list, child, selectEl);
            }
        });

        if (typeof dialog.showModal === 'function') {
            dialog.showModal();
        } else {
            dialog.setAttribute('open', '');
        }

        // Scroll selected item into view
        const selBtn = list.querySelector('.mobile-select-option-item.selected');
        if (selBtn) {
            selBtn.scrollIntoView({ block: 'nearest' });
            selBtn.focus();
        }
    }

    function _appendOptionButton(container, optionEl, selectEl) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mobile-select-option-item' + (optionEl.selected ? ' selected' : '');
        
        const spanLabel = document.createElement('span');
        spanLabel.textContent = optionEl.text;
        btn.appendChild(spanLabel);

        if (optionEl.selected) {
            const check = document.createElement('span');
            check.className = 'check-glyph';
            check.textContent = '✓';
            btn.appendChild(check);
        }

        btn.onclick = () => {
            selectEl.value = optionEl.value;
            selectEl.dispatchEvent(new Event('change', { bubbles: true }));
            closeMobileSelectDialog();
        };

        container.appendChild(btn);
    }

    function closeMobileSelectDialog() {
        const dialog = document.getElementById('mobileSelectDialog');
        if (!dialog) return;
        if (typeof dialog.close === 'function') {
            dialog.close();
        } else {
            dialog.removeAttribute('open');
        }
        if (_activeMobileSelect) {
            try { _activeMobileSelect.focus(); } catch (e) {}
            _activeMobileSelect = null;
        }
    }

    function installMobileSelectInterceptors() {
        // Intercept clicks on selects in formatting-toolbar and gauge banner across desktop and mobile
        document.addEventListener('pointerdown', (e) => {
            const sel = e.target && e.target.closest && e.target.closest('.formatting-toolbar select, .a4-gauge-banner select');
            if (!sel || sel.style.display === 'none') return;
            e.preventDefault();
            e.stopPropagation();
            openMobileSelectDialog(sel);
        }, true);
    }

    /* ==============================================================
       PUBLIC API
       ============================================================== */
    Object.assign(window, {
        updateOnlineStatus,
        installOnlineListeners,
        renderRequiredFields,
        installFocusTrap,
        installStickyBanner,
        installKeyboardShortcuts,
        openMobileSelectDialog,
        closeMobileSelectDialog,
        installMobileSelectInterceptors
    });

    Object.defineProperty(window, '_IMS_UI_DEBUG', {
        value: {
            getTrapDepth: () => _trapDepth,
            isFileProtocol: () => window.location.protocol === 'file:'
        },
        enumerable: false,
        configurable: true,
        writable: false
    });

})();