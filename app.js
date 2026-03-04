// ════════════════════════════════════════════════════════════
//  NAVEGACIÓN
// ════════════════════════════════════════════════════════════
function nav(pageId, btn) {
    document.querySelectorAll('.content-area').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    $('page-'+pageId).classList.add('active');
    if (btn) btn.classList.add('active');
}

// ════════════════════════════════════════════════════════════
//  TERMINAL
// ════════════════════════════════════════════════════════════
function log(mod, msg, type='ai') {
    const terminal = $('terminal');
    if (!terminal) return;
    const colors = { ai:'log-ai', act:'log-act', warn:'log-warn', crit:'log-crit', think:'log-think', api:'log-api' };
    const p = document.createElement('p');
    const t = new Date().toLocaleTimeString('es-ES');
    p.innerHTML = `<span class="log-time">[${t}]</span> <span class="log-module">[${mod}]</span> <span class="${colors[type]||'log-ai'}">${msg}</span>`;
    terminal.appendChild(p);
    terminal.scrollTop = terminal.scrollHeight;
}

// ════════════════════════════════════════════════════════════
//  CARGA PRINCIPAL DE APIS
// ════════════════════════════════════════════════════════════
async function loadAPIs() {
    log('SYS','Iniciando conexión con APIs externas...','api');

    // ── Open-Meteo ──
    apiStatus('openmeteo','loading');
    try {
        const [omAlm, omGal] = await Promise.all([fetchOpenMeteo('alm'), fetchOpenMeteo('gal')]);
        sim.data.alm.extT = omAlm.current.temperature_2m;
        sim.data.gal.extT = omGal.current.temperature_2m;
        renderWeather('alm', omAlm, null);
        renderWeather('gal', omGal, null);
        apiStatus('openmeteo','ok');
        log('API_METEO',`ALM → ${omAlm.current.temperature_2m}°C / ${omAlm.current.relative_humidity_2m}% RH | COR → ${omGal.current.temperature_2m}°C / ${omGal.current.relative_humidity_2m}% RH`,'api');

        // ── NASA POWER ──
        apiStatus('nasa','loading');
        try {
            const [nasaAlm, nasaGal] = await Promise.all([fetchNASA('alm'), fetchNASA('gal')]);
            renderWeather('alm', omAlm, nasaAlm);
            renderWeather('gal', omGal, nasaGal);
            apiStatus('nasa','ok');
            const pAlm = nasaAlm.properties.parameter.ALLSKY_SFC_SW_DWN;
            const lastAlm = Object.values(pAlm).slice(-1)[0];
            log('API_NASA',`ALM → ${Math.round(lastAlm)}W/m² irradiancia`,'api');
        } catch(e) { apiStatus('nasa','error'); log('API_NASA',`Error NASA: ${e.message}`,'warn'); }

    } catch(e) { apiStatus('openmeteo','error'); log('API_METEO',`Error Open-Meteo: ${e.message}`,'warn'); }

    // ── REData ──
    apiStatus('redata','loading');
    try {
        const energy = await fetchREData();
        renderEnergy(energy);
        apiStatus('redata','ok');
        log('API_GRID',`REData → Renovables: ${energy.renewablePct}% | CO₂ est: ${energy.co2} gCO₂/kWh`,'api');
    } catch(e) { apiStatus('redata','error'); log('API_GRID',`Error REData: ${e.message}`,'warn'); }

    // ── EFFIS + EDO ──
    apiStatus('effis','loading');
    try {
        const [fAlm, fGal] = await Promise.all([fetchEFFIS('alm'), fetchEFFIS('gal')]);
        renderRisk('alm', fAlm);
        renderRisk('gal', fGal);
        apiStatus('effis','ok');
        log('API_EFFIS',`FWI ALM: ${fAlm?.fwi?.toFixed(1)} → ${fAlm?.fwiInfo?.l} | FWI COR: ${fGal?.fwi?.toFixed(1)} → ${fGal?.fwiInfo?.l}`,'warn');
    } catch(e) { apiStatus('effis','error'); log('API_EFFIS',`Error EFFIS: ${e.message}`,'warn'); }

    // ── GDACS ──
    apiStatus('gdacs','loading');
    try {
        const gdacs = await fetchGDACS();
        renderGDACS(gdacs);
        apiStatus('gdacs','ok');
        log('API_GDACS',`GDACS → ${gdacs.total} alertas globales | ${gdacs.europe?.length??0} en Europa`,'api');
    } catch(e) { apiStatus('gdacs','error'); log('API_GDACS',`Error GDACS: ${e.message}`,'warn'); }

    // ── AEMET ──
    apiStatus('aemet','loading');
    try {
        const [obsAlm, obsGal, avisos, predAlm, predGal] = await Promise.all([
            fetchAEMETobs('alm'), fetchAEMETobs('gal'),
            fetchAEMETavisos(),
            fetchAEMETpred('alm'), fetchAEMETpred('gal')
        ]);
        renderAEMETobs('alm', obsAlm);
        renderAEMETobs('gal', obsGal);
        renderAEMETavisos(avisos);
        renderAEMETpred('alm', predAlm);
        renderAEMETpred('gal', predGal);
        apiStatus('aemet','ok');
        log('API_AEMET',`Observación ALM → ${obsAlm.temp?.toFixed(1)}°C OFICIAL | COR → ${obsGal.temp?.toFixed(1)}°C OFICIAL`,'api');
    } catch(e) { apiStatus('aemet','error'); log('API_AEMET',`Error AEMET: ${e.message}`,'warn'); }

    // ── Copernicus EMS ──
    apiStatus('copernicus','loading');
    try {
        const cop = await fetchCopernicus();
        renderCopernicus(cop);
        apiStatus('copernicus','ok');
        log('API_COP',`Copernicus EMS → ${cop.total} activaciones | ${cop.europe?.length??0} en Europa`,'api');
    } catch(e) { apiStatus('copernicus','error'); log('API_COP',`Error Copernicus: ${e.message}`,'warn'); }

    // ── WRI Aqueduct (referencia) ──
    apiStatus('aqueduct','loading');
    const aqAlm = getAqueduct('alm');
    const aqGal = getAqueduct('gal');
    renderAqueduct('alm', aqAlm);
    renderAqueduct('gal', aqGal);
    apiStatus('aqueduct','ok');
    log('API_AQUEDUCT',`WRI Aqueduct ALM → ${aqAlm.overall.l} | COR → ${aqGal.overall.l}`,'warn');

    // EDO water page
    set('alm-edo-spi',    '~ estimado');
    set('alm-edo-label',  'Ver Sequía HUD', 'var(--muted)');
    set('alm-edo-source', 'EDO JRC proxy no disponible — usando Open-Meteo balance hídrico');
    set('gal-edo-spi',    '~ estimado');
    set('gal-edo-label',  'Ver Sequía HUD', 'var(--muted)');
    set('gal-edo-source', 'EDO JRC proxy no disponible — usando Open-Meteo balance hídrico');

    // ── Electricitymaps (si hay key) ──
    if (CFG.ELECTRICITYMAPS_API_KEY) {
        // activar cuando llegue la key
    }

    log('SYS','Carga inicial completada. Próxima actualización en 10 min.','act');
}

// ════════════════════════════════════════════════════════════
//  RELOJ + INIT
// ════════════════════════════════════════════════════════════
setInterval(()=>{ $('clock').textContent = new Date().toLocaleTimeString('es-ES'); },1000);
setInterval(loadAPIs, 10*60*1000);

document.addEventListener('DOMContentLoaded', ()=>{
    log('SYS','Hytherm Digital Twin v6.0 inicializado. Conectando APIs...','act');
    loadAPIs();

    // Welcome notification
    NotificationCenter.info(
        'Sistema Inicializado',
        'Hytherm Core v6.0 conectado. Cargando datos de 9 fuentes API.',
        { source: 'SYS', autoDismiss: true, dismissAfter: 20000 }
    );
});
