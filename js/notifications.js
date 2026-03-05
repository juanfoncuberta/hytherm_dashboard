// ════════════════════════════════════════════════════════════
//  NOTIFICATION CENTER — Hytherm v7
//  Gestiona alertas, datos API y eventos sin molestar la UI
// ════════════════════════════════════════════════════════════

const Notif = (() => {
    let items = [];
    let _id = 0;
    let _open = false;
    let _filter = 'all';

    const ICONS = { critical:'!', warning:'⚠', info:'ℹ', success:'✓', data:'⟳' };
    const MAX = 200;

    // ── Crear notificación ──
    function push(severity, title, message, opts = {}) {
        const n = {
            id: ++_id,
            severity,     // critical | warning | info | success | data
            title,
            message,
            time: new Date(),
            read: false,
            source: opts.source || 'SYS',
            autoDismiss: opts.autoDismiss || false,
            dismissMs: opts.dismissMs || 30000
        };
        items.unshift(n);
        if (items.length > MAX) items.length = MAX;

        _updateBadge();
        if (_open) _renderList();

        if (n.autoDismiss) setTimeout(() => dismiss(n.id), n.dismissMs);
        return n.id;
    }

    function dismiss(id) {
        items = items.filter(n => n.id !== id);
        _updateBadge();
        if (_open) _renderList();
    }

    function clearAll() {
        items = [];
        _updateBadge();
        if (_open) _renderList();
    }

    // ── Panel ──
    function toggle() {
        _open = !_open;
        $('notif-panel').classList.toggle('open', _open);
        $('notif-overlay').classList.toggle('open', _open);
        if (_open) {
            setTimeout(() => { items.forEach(n => n.read = true); _updateBadge(); }, 1200);
            _renderList();
        }
    }
    function close() {
        if (!_open) return;
        _open = false;
        $('notif-panel')?.classList.remove('open');
        $('notif-overlay')?.classList.remove('open');
    }

    function setFilter(f) {
        _filter = f;
        document.querySelectorAll('.notif-tab').forEach(b => b.classList.toggle('active', b.dataset.f === f));
        _renderList();
    }

    // ── Badge ──
    function _updateBadge() {
        const badge = $('notif-badge');
        const bell  = $('notif-bell');
        if (!badge || !bell) return;
        const unread = items.filter(n => !n.read).length;
        badge.textContent = unread;
        badge.classList.toggle('visible', unread > 0);
        bell.classList.remove('has-critical','has-warn');
        const un = items.filter(n => !n.read);
        if (un.some(n => n.severity==='critical')) bell.classList.add('has-critical');
        else if (un.some(n => n.severity==='warning')) bell.classList.add('has-warn');
    }

    // ── Render ──
    function _renderList() {
        const el = $('notif-list');
        if (!el) return;
        let list = _filter === 'all' ? items : items.filter(n => n.severity === _filter);

        if (!list.length) {
            el.innerHTML = `<div class="notif-empty"><span style="font-size:28px;opacity:0.3">🔔</span><span>${_filter==='all'?'Sin notificaciones':'Sin alertas de este tipo'}</span></div>`;
            return;
        }
        el.innerHTML = list.map(n => `
            <div class="notif-item ${n.read?'':'unread'}" data-id="${n.id}">
                <div class="notif-icon ${n.severity}">${ICONS[n.severity]||'•'}</div>
                <div class="notif-body">
                    <div class="notif-title">
                        <span>${_esc(n.title)}</span>
                        <span class="notif-sev ${n.severity}">${n.severity.toUpperCase()}</span>
                    </div>
                    <div class="notif-msg">${_esc(n.message)}</div>
                    <div class="notif-time">${n.source} · ${timeAgo(n.time)}</div>
                </div>
                <button class="notif-dismiss" onclick="Notif.dismiss(${n.id})" title="Descartar">✕</button>
            </div>`).join('');
    }

    function _esc(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

    function getCount() { return items.filter(n => !n.read).length; }

    // ── Atajos ──
    return {
        push, dismiss, clearAll, toggle, close, setFilter, getCount,
        critical: (t,m,o) => push('critical',t,m,o),
        warning:  (t,m,o) => push('warning',t,m,o),
        info:     (t,m,o) => push('info',t,m,o),
        success:  (t,m,o) => push('success',t,m,o),
        data:     (t,m,o) => push('data',t,m,o)
    };
})();
