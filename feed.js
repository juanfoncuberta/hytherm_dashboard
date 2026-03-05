// ════════════════════════════════════════════════════════════
//  DATA FEED — Hytherm v7
//  Muestra en tiempo real los datos que llegan de las APIs
//  y los registra en el centro de notificaciones + historial
// ════════════════════════════════════════════════════════════

const Feed = (() => {
    const MAX_FEED = 60;
    let entries = [];

    const COLORS = {
        'OPEN_METEO': '#34d399',
        'NASA':       '#60a5fa',
        'REDATA':     '#f59e0b',
        'AEMET':      '#f472b6',
        'EFFIS':      '#84cc16',
        'GDACS':      '#f97316',
        'COPERNICUS': '#a78bfa',
        'AQUEDUCT':   '#22d3ee',
        'EMAPS':      '#10b981'
    };

    function add(apiName, message, status = 'ok', details = null) {
        const entry = {
            id: Date.now() + Math.random(),
            api: apiName,
            message,
            status,  // 'ok' | 'err' | 'load'
            time: new Date(),
            details
        };
        entries.unshift(entry);
        if (entries.length > MAX_FEED) entries.length = MAX_FEED;

        // También enviar al centro de notificaciones como tipo "data"
        if (status === 'ok') {
            Notif.data(
                `${apiName} — Datos recibidos`,
                message,
                { source: apiName, autoDismiss: true, dismissMs: 60000 }
            );
        } else if (status === 'err') {
            Notif.warning(
                `${apiName} — Error`,
                message,
                { source: apiName }
            );
        }

        _render();
    }

    function _render() {
        const el = $('feed-container');
        if (!el) return;

        if (!entries.length) {
            el.innerHTML = '<div style="color:var(--muted);font-size:11px;padding:20px;text-align:center;">Esperando datos de APIs...</div>';
            return;
        }

        el.innerHTML = entries.slice(0, 30).map(e => {
            const color = COLORS[e.api] || 'var(--ai)';
            const statusCls = e.status === 'ok' ? 'ok' : e.status === 'err' ? 'err' : 'load';
            const statusTxt = e.status === 'ok' ? '✓ OK' : e.status === 'err' ? '✕ ERR' : '○ ...';
            const t = e.time.toLocaleTimeString('es-ES');
            return `<div class="feed-item">
                <span class="feed-dot" style="background:${color}"></span>
                <span class="feed-api">${e.api}</span>
                <span class="feed-msg">${_esc(e.message)}</span>
                <span class="feed-status ${statusCls}">${statusTxt}</span>
                <span class="feed-time">${t}</span>
            </div>`;
        }).join('');
    }

    function _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    function getEntries() { return entries; }

    return { add, getEntries };
})();
