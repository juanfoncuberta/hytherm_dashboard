// ════════════════════════════════════════════════════════════
//  NOTIFICATION CENTER
// ════════════════════════════════════════════════════════════

const NotificationCenter = (() => {
    let notifications = [];
    let idCounter = 0;
    let currentFilter = 'all';
    let panelOpen = false;

    // Severity levels: critical, warning, info, success
    const ICONS = {
        critical: '!',
        warning:  '⚠',
        info:     'ℹ',
        success:  '✓'
    };

    function create(severity, title, message, options = {}) {
        const notif = {
            id: ++idCounter,
            severity,
            title,
            message,
            time: new Date(),
            read: false,
            source: options.source || 'SYS',
            autoDismiss: options.autoDismiss || false,
            dismissAfter: options.dismissAfter || 30000
        };
        notifications.unshift(notif);

        // Keep max 100 notifications
        if (notifications.length > 100) {
            notifications = notifications.slice(0, 100);
        }

        updateBadge();
        if (panelOpen) renderList();

        // Auto-dismiss if configured
        if (notif.autoDismiss) {
            setTimeout(() => dismiss(notif.id), notif.dismissAfter);
        }

        return notif.id;
    }

    function dismiss(id) {
        notifications = notifications.filter(n => n.id !== id);
        updateBadge();
        if (panelOpen) renderList();
    }

    function clearAll() {
        notifications = [];
        updateBadge();
        if (panelOpen) renderList();
    }

    function clearRead() {
        notifications = notifications.filter(n => !n.read);
        updateBadge();
        if (panelOpen) renderList();
    }

    function markAllRead() {
        notifications.forEach(n => n.read = true);
        updateBadge();
        if (panelOpen) renderList();
    }

    function getUnreadCount() {
        return notifications.filter(n => !n.read).length;
    }

    function getHighestSeverity() {
        const unread = notifications.filter(n => !n.read);
        if (unread.some(n => n.severity === 'critical')) return 'critical';
        if (unread.some(n => n.severity === 'warning'))  return 'warning';
        return null;
    }

    function updateBadge() {
        const badge = $('notif-badge');
        const bell  = $('notif-bell');
        if (!badge || !bell) return;

        const count = getUnreadCount();
        badge.textContent = count > 0 ? count : '';
        badge.setAttribute('data-count', count);

        // Highlight bell based on severity
        bell.classList.remove('has-critical', 'has-warn');
        const severity = getHighestSeverity();
        if (severity === 'critical') bell.classList.add('has-critical');
        else if (severity === 'warning') bell.classList.add('has-warn');
    }

    function togglePanel() {
        panelOpen = !panelOpen;
        const panel    = $('notif-panel');
        const backdrop = $('notif-backdrop');
        if (panelOpen) {
            panel.classList.add('open');
            backdrop.classList.add('visible');
            // Mark visible as read after a short delay
            setTimeout(() => {
                notifications.forEach(n => n.read = true);
                updateBadge();
            }, 1500);
            renderList();
        } else {
            panel.classList.remove('open');
            backdrop.classList.remove('visible');
        }
    }

    function closePanel() {
        if (!panelOpen) return;
        panelOpen = false;
        $('notif-panel')?.classList.remove('open');
        $('notif-backdrop')?.classList.remove('visible');
    }

    function setFilter(filter) {
        currentFilter = filter;
        // Update filter button states
        document.querySelectorAll('.notif-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        renderList();
    }

    function formatTime(date) {
        const now  = new Date();
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60) return 'ahora';
        if (diff < 3600) return `hace ${Math.floor(diff/60)}m`;
        if (diff < 86400) return `hace ${Math.floor(diff/3600)}h`;
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    }

    function renderList() {
        const list = $('notif-list');
        if (!list) return;

        let filtered = notifications;
        if (currentFilter !== 'all') {
            filtered = notifications.filter(n => n.severity === currentFilter);
        }

        if (filtered.length === 0) {
            list.innerHTML = `
                <div class="notif-empty">
                    <span class="notif-empty-icon">🔔</span>
                    <span>${currentFilter === 'all' ? 'Sin notificaciones' : 'Sin alertas de este tipo'}</span>
                </div>`;
            return;
        }

        list.innerHTML = filtered.map(n => `
            <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
                <div class="notif-icon ${n.severity}">${ICONS[n.severity]}</div>
                <div class="notif-body">
                    <div class="notif-title">
                        <span>${n.title}</span>
                        <span class="notif-severity ${n.severity}">${n.severity.toUpperCase()}</span>
                    </div>
                    <div class="notif-msg">${n.message}</div>
                    <div class="notif-time">${n.source} · ${formatTime(n.time)}</div>
                </div>
                <button class="notif-dismiss" onclick="NotificationCenter.dismiss(${n.id})" title="Descartar">✕</button>
            </div>
        `).join('');
    }

    // Public API
    return {
        create,
        dismiss,
        clearAll,
        clearRead,
        markAllRead,
        togglePanel,
        closePanel,
        setFilter,
        getUnreadCount,

        // Convenience methods
        critical: (title, msg, opts) => create('critical', title, msg, opts),
        warning:  (title, msg, opts) => create('warning',  title, msg, opts),
        info:     (title, msg, opts) => create('info',     title, msg, opts),
        success:  (title, msg, opts) => create('success',  title, msg, opts)
    };
})();
