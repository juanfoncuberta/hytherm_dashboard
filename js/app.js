// ════════════════════════════════════════════════════════════
//  APP — Hytherm v7
//  Navegación, terminal, carga APIs (1h refresh), init
// ════════════════════════════════════════════════════════════

// ── NAVEGACIÓN ──
function nav(pageId, btn) {
    document.querySelectorAll('.content-area').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    $('page-'+pageId).classList.add('active');
    if (btn) btn.classList.add('active');

    // Actualizar histórico si esa pestaña
    if (pageId === 'history' && typeof renderHistoryPage === 'function') {
        renderHistoryPage();
    }
}

// ── TERMINAL ──
function log(mod, msg, type='ai') {
    const terminal = $('terminal');
    if (!terminal) return;
    const colors = { ai:'log-ai', act:'log-act', warn:'log-warn', crit:'log-crit', think:'log-think', api:'log-api' };
    const p = document.createElement('p');
    const t = new Date().toLocaleTimeString('es-ES');
    p.innerHTML = `<span class="log-time">[${t}]</span> <span class="log-module">[${mod}]</span> <span class="${colors[type]||'log-ai'}">${msg}</span>`;
    terminal.appendChild(p);
    if (terminal.childNodes.length > 90) terminal.removeChild(terminal.firstChild);
    terminal.scrollTop = terminal.scrollHeight;
}

// ── REFRESH INDICATOR ──
function setRefreshState(loading) {
    const dot = $('refresh-dot');
    const txt = $('refresh-text');
    if (dot) dot.classList.toggle('loading', loading);
    if (loading) {
        if (txt) txt.textContent = 'Actualizando...';
    } else {
        sim.lastRefresh = new Date();
        sim.refreshCount++;
        if (txt) txt.textContent = `Última: ${sim.lastRefresh.toLocaleTimeString('es-ES')} (#${sim.refreshCount})`;
    }
}

// Actualizar cuenta regresiva
setInterval(() => {
    const next = $('next-refresh');
    if (!next || !sim.lastRefresh) return;
    const elapsed = Date.now() - sim.lastRefresh.getTime();
    const remaining = Math.max(0, CFG.REFRESH_INTERVAL - elapsed);
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    next.textContent = `Próxima: ${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
}, 1000);

// ── CARGA PRINCIPAL DE APIS ──
async function loadAPIs() {
    setRefreshState(true);
    log('SYS',`Iniciando conexión con APIs externas... (ciclo #${sim.refreshCount + 1})`,'api');

    // Open-Meteo
    apiStatus('openmeteo','loading');
    try {
        const [omAlm, omGal] = await Promise.all([fetchOpenMeteo('alm'), fetchOpenMeteo('gal')]);
        sim.data.alm.extT = omAlm.current.temperature_2m;
        sim.data.gal.extT = omGal.current.temperature_2m;
        if(typeof renderWeather === 'function') {
            renderWeather('alm', omAlm, null);
            renderWeather('gal', omGal, null);
        }
        apiStatus('openmeteo','ok');
        log('API_METEO',`ALM → ${omAlm.current.temperature_2m}°C / ${omAlm.current.relative_humidity_2m}% RH | COR → ${omGal.current.temperature_2m}°C / ${omGal.current.relative_humidity_2m}% RH`,'api');

        // NASA POWER
        apiStatus('nasa','loading');
        try {
            const [nasaAlm, nasaGal] = await Promise.all([fetchNASA('alm'), fetchNASA('gal')]);
            if(typeof renderWeather === 'function') {
                renderWeather('alm', omAlm, nasaAlm);
                renderWeather('gal', omGal, nasaGal);
            }
            apiStatus('nasa','ok');
            const pAlm = nasaAlm.properties.parameter.ALLSKY_SFC_SW_DWN;
            const lastAlm = Object.values(pAlm).slice(-1)[0];
            log('API_NASA',`ALM → ${Math.round(lastAlm)}W/m² irradiancia`,'api');
        } catch(e) {
            apiStatus('nasa','error');
            log('API_NASA',`Error NASA: ${e.message}`,'warn');
            Feed.add('NASA', `Error: ${e.message}`, 'err');
        }

    } catch(e) {
        apiStatus('openmeteo','error');
        log('API_METEO',`Error Open-Meteo: ${e.message}`,'warn');
        Feed.add('OPEN_METEO', `Error: ${e.message}`, 'err');
    }

    // REData (AHORA CON PRECIO Y DEMANDA)
    apiStatus('redata','loading');
    try {
        const energy = await fetchREData();
        
        // Guardar variables globales para usar en el HUD
        if (energy.price) {
            sim.price = energy.price;
            sim.priceIsHigh = energy.price > 0.15; // Más de 0.15€ = caro
        }
        sim.api.energy = energy;

        if(typeof renderEnergy === 'function') renderEnergy(energy);
        apiStatus('redata','ok');
        
        // ── INYECCIÓN DE DATOS EN TU HTML ──
        // Barra superior (KPIs globales)
        set('global-price', energy.price ? `${energy.price} €/kWh` : '--', sim.priceIsHigh ? 'var(--danger)' : 'var(--ok)');
        set('price-trend', sim.priceIsHigh ? '▲ Pico' : '▼ Valle', sim.priceIsHigh ? 'var(--danger)' : 'var(--ok)');
        set('global-co2', energy.co2 ? `${energy.co2} g/kWh` : '--');
        set('global-ren', energy.renewablePct ? `${energy.renewablePct}%` : '--');
        
        // Panel de Energía
        set('energy-price', energy.price ? `${energy.price} €/kWh` : '--', sim.priceIsHigh ? 'var(--danger)' : 'var(--ok)');
        set('energy-demand', `${Math.round(energy.demand)} MW`);

        log('API_GRID',`REData → Precio: ${energy.price}€/kWh | Demanda: ${Math.round(energy.demand)}MW | Renovables: ${energy.renewablePct}%`,'api');
    } catch(e) {
        apiStatus('redata','error');
        log('API_GRID',`Error REData: ${e.message}`,'warn');
        Feed.add('REDATA', `Error: ${e.message}`, 'err');
    }

    // EFFIS + EDO
    apiStatus('effis','loading');
    try {
        const [fAlm, fGal] = await Promise.all([fetchEFFIS('alm'), fetchEFFIS('gal')]);
        if(typeof renderRisk === 'function') {
            renderRisk('alm', fAlm);
            renderRisk('gal', fGal);
        }
        apiStatus('effis','ok');
        log('API_EFFIS',`FWI ALM: ${fAlm?.fwi?.toFixed(1)} → ${fAlm?.fwiInfo?.l} | FWI COR: ${fGal?.fwi?.toFixed(1)} → ${fGal?.fwiInfo?.l}`,'warn');
    } catch(e) {
        apiStatus('effis','error');
        log('API_EFFIS',`Error EFFIS: ${e.message}`,'warn');
        Feed.add('EFFIS', `Error: ${e.message}`, 'err');
    }

    // GDACS
    apiStatus('gdacs','loading');
    try {
        const gdacs = await fetchGDACS();
        if(typeof renderGDACS === 'function') renderGDACS(gdacs);
        apiStatus('gdacs','ok');
        log('API_GDACS',`GDACS → ${gdacs.total} alertas globales | ${gdacs.europe?.length??0} en Europa`,'api');
    } catch(e) {
        apiStatus('gdacs','error');
        log('API_GDACS',`Error GDACS: ${e.message}`,'warn');
        Feed.add('GDACS', `Error: ${e.message}`, 'err');
    }

    // AEMET
    apiStatus('aemet','loading');
    try {
        const [obsAlm, obsGal, avisos, predAlm, predGal] = await Promise.all([
            fetchAEMETobs('alm'), fetchAEMETobs('gal'),
            fetchAEMETavisos(), fetchAEMETpred('alm'), fetchAEMETpred('gal')
        ]);
        if(typeof renderAEMETobs === 'function') {
            renderAEMETobs('alm', obsAlm);
            renderAEMETobs('gal', obsGal);
            renderAEMETavisos(avisos);
            renderAEMETpred('alm', predAlm);
            renderAEMETpred('gal', predGal);
        }
        apiStatus('aemet','ok');
        log('API_AEMET',`Observación ALM → ${obsAlm.temp?.toFixed(1)}°C OFICIAL | COR → ${obsGal.temp?.toFixed(1)}°C OFICIAL`,'api');
    } catch(e) {
        apiStatus('aemet','error');
        log('API_AEMET',`Error AEMET: ${e.message}`,'warn');
        Feed.add('AEMET', `Error: ${e.message}`, 'err');
    }

    // Copernicus EMS
    apiStatus('copernicus','loading');
    try {
        const cop = await fetchCopernicus();
        if(typeof renderCopernicus === 'function') renderCopernicus(cop);
        apiStatus('copernicus','ok');
        log('API_COP',`Copernicus EMS → ${cop.total} activaciones | ${cop.europe?.length??0} en Europa`,'api');
    } catch(e) {
        apiStatus('copernicus','error');
        log('API_COP',`Error Copernicus: ${e.message}`,'warn');
        Feed.add('COPERNICUS', `Error: ${e.message}`, 'err');
    }

    // WRI Aqueduct
    apiStatus('aqueduct','loading');
    const aqAlm = getAqueduct('alm');
    const aqGal = getAqueduct('gal');
    if(typeof renderAqueduct === 'function') {
        renderAqueduct('alm', aqAlm);
        renderAqueduct('gal', aqGal);
    }
    apiStatus('aqueduct','ok');
    log('API_AQUEDUCT',`WRI Aqueduct ALM → ${aqAlm.overall.l} | COR → ${aqGal.overall.l}`,'warn');
    if (typeof History !== 'undefined') {
        History.add('AQUEDUCT', 'alm', { stressLevel: aqAlm.overall.l });
        History.add('AQUEDUCT', 'gal', { stressLevel: aqGal.overall.l });
    }

    // Fallbacks visuales para EDO
    set('alm-edo-spi',    '~ estimado');
    set('alm-edo-label',  'Ver Sequía HUD', 'var(--muted)');
    set('alm-edo-source', 'EDO JRC proxy no disponible — usando Open-Meteo balance hídrico');
    set('gal-edo-spi',    '~ estimado');
    set('gal-edo-label',  'Ver Sequía HUD', 'var(--muted)');
    set('gal-edo-source', 'EDO JRC proxy no disponible — usando Open-Meteo balance hídrico');

    setRefreshState(false);
    log('SYS',`Carga completada (ciclo #${sim.refreshCount}). Proxima actualizacion en 30 min.`,'act');
    if(typeof Notif !== 'undefined') {
        Notif.info('APIs Actualizadas',
            `Ciclo #${sim.refreshCount} completado. Registros listos.`,
            { source: 'SYS', autoDismiss: true, dismissMs: 15000 });
    }
}

// ── RELOJ ──
setInterval(()=>{ const el = $('clock'); if(el) el.textContent = new Date().toLocaleTimeString('es-ES'); }, 1000);

// ── REFRESH CADA 30 MIN ──
setInterval(loadAPIs, CFG.REFRESH_INTERVAL);

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
    log('SYS','Hytherm Digital Twin v7.0 inicializado. Conectando APIs...','act');
    if(typeof Notif !== 'undefined') {
        Notif.info('Sistema Inicializado', 'Hytherm Core v7.0 conectado. Refresh cada 30 min. Conectando fuentes API + sensoria CSV.', { source: 'SYS', autoDismiss: true, dismissMs: 20000 });
    }

    if(typeof Sensors !== 'undefined') {
        Sensors.load(false).then(() => {
            log('SYS', 'Sensoria interna lista. Iniciando APIs externas...', 'act');
            loadAPIs();
        }).catch(() => {
            log('SYS', 'CSVs no disponibles. Iniciando APIs...', 'warn');
            loadAPIs();
        });
    } else {
        loadAPIs();
    }
});