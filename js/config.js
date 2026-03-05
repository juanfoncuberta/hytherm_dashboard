// ════════════════════════════════════════════════════════════
//  CONFIG & GLOBAL STATE — Hytherm v7
// ════════════════════════════════════════════════════════════

const CFG = {
    AEMET_API_KEY: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJqZm9uY3ViZXJ0YUBtaWIuaXNkaS5lcyIsImp0aSI6IjY4MmJmMmY4LTMzMDctNDExNi1hMTNhLWQ0ZDI5ZGI2Nzc2OSIsImlzcyI6IkFFTUVUIiwiaWF0IjoxNzcyNjQ5NTA1LCJ1c2VySWQiOiI2ODJiZjJmOC0zMzA3LTQxMTYtYTEzYS1kNGQyOWRiNjc3NjkiLCJyb2xlIjoiIn0.5pE5WJOxJcrIgj1dR7CnHwsRAjBJdUV6bn94ch2OFbE',
    ELECTRICITYMAPS_API_KEY: '',
    REFRESH_INTERVAL: 60 * 60 * 1000, // 1 hora
    NODES: {
        alm: { lat: 36.8381, lon: -2.4597, label: 'ALMERÍA',  estacion: '6291B', municipio: '04013', zona: '61' },
        gal: { lat: 43.3623, lon: -8.4115, label: 'A CORUÑA', estacion: '1387',  municipio: '15030', zona: '72' }
    }
};

const PROXY     = 'https://api.allorigins.win/get?url=';
const PROXY_RAW = 'https://api.allorigins.win/raw?url=';

// ── Estado global ──
let sim = {
    price: 0.14, priceIsHigh: false, seismicActive: false,
    data: {
        alm: { extT: 34.2, intT: 24.5, pcm: 65, irr: 0 },
        gal: { extT: 12.5, intT: 20.0, pcm: 35, irr: 0 }
    },
    targets: { alm: { t: 24, h: 50 }, gal: { t: 21, h: 55 } },
    api: { alm: {}, gal: {}, energy: null, gdacs: null },
    lastRefresh: null,
    refreshCount: 0
};

// ── Utilidades DOM ──
const $ = id => document.getElementById(id);
const set = (id, val, color) => {
    const el = $(id); if (!el) return;
    el.textContent = val;
    if (color) el.style.color = color;
};

function apiStatus(name, state) {
    const el = $(`st-${name}`); if (!el) return;
    const map = { ok: ['● LIVE','var(--ok)'], loading: ['○ CARGA','var(--warn)'], error: ['✕ ERR','var(--danger)'] };
    const [txt, col] = map[state] || ['○ --','var(--muted)'];
    el.textContent = txt; el.style.color = col;
}

function wmoDesc(code) {
    const m = {0:'Despejado',1:'Mayorm. despejado',2:'Parcial nublado',3:'Nublado',45:'Niebla',51:'Llovizna leve',61:'Lluvia leve',63:'Lluvia mod.',65:'Lluvia intensa',71:'Nieve leve',80:'Chubascos',95:'Tormenta'};
    return m[code] || `WMO ${code}`;
}

function windDir(deg) {
    const d = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];
    return d[Math.round(deg/22.5)%16];
}

async function proxyFetch(url, raw=false) {
    const base = raw ? PROXY_RAW : PROXY;
    const res = await fetch(`${base}${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(`Proxy ${res.status}`);
    if (raw) return await res.text();
    const w = await res.json();
    return w.contents;
}

function timeAgo(date) {
    const s = Math.floor((Date.now() - date) / 1000);
    if (s < 60) return 'ahora';
    if (s < 3600) return `hace ${Math.floor(s/60)}m`;
    if (s < 86400) return `hace ${Math.floor(s/3600)}h`;
    return date.toLocaleDateString('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}
