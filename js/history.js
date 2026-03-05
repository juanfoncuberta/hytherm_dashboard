// ════════════════════════════════════════════════════════════
//  HISTORICAL DATA STORE — Hytherm v7
//  Almacena snapshots de cada llamada API con timestamp
//  para visualización en la pestaña "Histórico"
// ════════════════════════════════════════════════════════════

const History = (() => {
    // Cada entrada: { time: Date, source: string, node: 'alm'|'gal'|'global', data: {} }
    let records = [];
    const MAX_RECORDS = 2000;

    function add(source, node, data) {
        const entry = {
            id: records.length + 1,
            time: new Date(),
            source,     // 'OPEN_METEO', 'NASA', 'AEMET', 'REDATA', 'EFFIS', 'GDACS', etc.
            node,       // 'alm', 'gal', 'global'
            data        // snapshot de datos relevantes
        };
        records.push(entry);
        if (records.length > MAX_RECORDS) records = records.slice(-MAX_RECORDS);
        return entry;
    }

    function getAll() { return records; }

    function getBySource(source) { return records.filter(r => r.source === source); }

    function getByNode(node) { return records.filter(r => r.node === node); }

    function getFiltered(opts = {}) {
        let r = records;
        if (opts.source && opts.source !== 'all') r = r.filter(e => e.source === opts.source);
        if (opts.node && opts.node !== 'all') r = r.filter(e => e.node === opts.node);
        if (opts.since) r = r.filter(e => e.time >= opts.since);
        return r;
    }

    function getStats() {
        const now = Date.now();
        const h1  = records.filter(r => (now - r.time) < 3600000);
        const h24 = records.filter(r => (now - r.time) < 86400000);
        const sources = [...new Set(records.map(r => r.source))];
        return {
            total:   records.length,
            last1h:  h1.length,
            last24h: h24.length,
            sources: sources.length,
            lastEntry: records.length ? records[records.length - 1] : null
        };
    }

    // Extraer series temporales para un campo específico
    function timeSeries(source, node, field) {
        return records
            .filter(r => r.source === source && r.node === node && r.data[field] != null)
            .map(r => ({ time: r.time, value: r.data[field] }));
    }

    function clear() { records = []; }

    return { add, getAll, getBySource, getByNode, getFiltered, getStats, timeSeries, clear };
})();
