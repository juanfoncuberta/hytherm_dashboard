// ════════════════════════════════════════════════════════════
//  ESTADO GLOBAL
// ════════════════════════════════════════════════════════════
let sim = {
    price: 0.14, priceIsHigh: false, seismicActive: false,
    data: {
        alm: { extT: 34.2, intT: 24.5, pcm: 65, irr: 0 },
        gal: { extT: 12.5, intT: 20.0, pcm: 35, irr: 0 }
    },
    targets: { alm: { t: 24, h: 50 }, gal: { t: 21, h: 55 } },
    api: { alm: {}, gal: {}, energy: null, gdacs: null }
};

// ════════════════════════════════════════════════════════════
//  UTILS
// ════════════════════════════════════════════════════════════
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
const terminal = $('terminal');
function log(mod, msg, type='ai') {
    const colors = { ai:'log-ai', act:'log-act', warn:'log-warn', crit:'log-crit', think:'log-think', api:'log-api' };
    const p = document.createElement('p');
    p.innerHTML = `<span class="log-time">[${new Date().toLocaleTimeString('es-ES')}]</span> <span class="log-module">[${mod}]</span> <span class="${colors[type]||'log-ai'}">${msg}</span>`;
    terminal.appendChild(p);
    if (terminal.childNodes.length > 90) terminal.removeChild(terminal.firstChild);
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
//  SIMULACIÓN CONTINUA
// ════════════════════════════════════════════════════════════
let tick = 0;
setInterval(() => {
    if (sim.seismicActive) return;
    tick++;

    // Precio
    sim.price = 0.14 + Math.sin(tick*0.5)*0.08 + Math.random()*0.02;
    sim.priceIsHigh = sim.price > 0.18;
    set('global-price', `${sim.price.toFixed(3)} €/kWh`);
    const tr = $('price-trend');
    if (tr) { tr.textContent = sim.priceIsHigh?'▲ Pico':'▼ Valle'; tr.style.color = sim.priceIsHigh?'var(--danger)':'var(--ok)'; }

    // Ruido sensor
    const almT = $('alm-ext-t'); if (almT) almT.textContent = (sim.data.alm.extT+(Math.random()*0.2-0.1)).toFixed(1);
    const galT = $('gal-ext-t'); if (galT) galT.textContent = (sim.data.gal.extT+(Math.random()*0.2-0.1)).toFixed(1);
    $('alm-dekton').textContent = (45.8+Math.random()*0.5).toFixed(1);

    // PCM logic
    sim.data.alm.pcm = Math.min(100,Math.max(0, sim.data.alm.pcm + (sim.priceIsHigh?-0.3:0.5)));
    const pb = $('alm-pcm-bar'); if (pb) pb.style.width = `${sim.data.alm.pcm}%`;
    const ps = $('alm-pcm-st');  if (ps) ps.textContent = `${Math.floor(sim.data.alm.pcm)}% ${sim.priceIsHigh?'DISCHRG':'CHRG'}`;

    // IA logs
    const r = Math.random();
    if (r < 0.15 && sim.priceIsHigh) log('GRID_OPT',`OMIE Price HIGH (${sim.price.toFixed(3)}€). Desviando consumo a PCM.`,'think');
    else if (r < 0.3) log('AI_ALM',`Sensor externo: ${sim.data.alm.extT.toFixed(1)}°C. Ajustando válvulas condensación.`,'think');
    else if (r < 0.5) log('AI_GAL',`Viento en tiempo real. Modulando anclajes Dekton.`,'act');
    else if (r < 0.6 && sim.data.alm.irr>0) log('SEEBECK',`Irradiancia ALM: ${Math.round(sim.data.alm.irr)}W/m². Generando ${(sim.data.alm.irr*0.016).toFixed(1)}W.`,'ai');

}, 2000);

// ════════════════════════════════════════════════════════════
//  CONFORT SLIDERS
// ════════════════════════════════════════════════════════════
function userAdjust(node, param) {
    const val = $(`${param}-${node}`).value;
    const unit = param==='t'?'°C':'%';
    set(`v-${param}-${node}`, `${val} ${unit}`);
    sim.targets[node][param] = parseFloat(val);
    log('USER_INPUT',`Ajuste manual ${node.toUpperCase()} → Target ${param.toUpperCase()}: ${val}${unit}`,'act');
    setTimeout(()=>{ log(`AI_${node.toUpperCase()}`,`Recalculando matriz termodinámica... ΔT = ${Math.abs(sim.data[node].extT - sim.targets[node].t).toFixed(1)}ºC`,'think'); },400);
    setTimeout(()=>{ log(`AI_${node.toUpperCase()}`,`Actuador: ${sim.data[node].intT>sim.targets[node].t?'Cargando PCM':'Descargando PCM'}`,'act'); },1200);
}

// ════════════════════════════════════════════════════════════
//  EVENTO SÍSMICO — Demo a los 45s
// ════════════════════════════════════════════════════════════
setTimeout(() => {
    sim.seismicActive = true;
    $('main-window').classList.add('seismic-mode');
    document.querySelectorAll('.hud-card').forEach(c=>c.classList.add('seismic-bg'));
    $('seismic-banner').style.display='block';
    set('term-status','■ EMERGENCY OVERRIDE','var(--danger)');
    log('SYS_ALERT','ALERTA SÍSMICA REGIONAL DETECTADA (IGN). MAGNITUD ESTIMADA: 4.5','crit');
    setTimeout(()=>log('AI_CORE','Iniciando protocolo SAFE-STATE en todas las envolventes.','crit'),500);
    setTimeout(()=>{
        log('AI_ALM','Purgando agua de paneles. Bloqueando válvulas PCM.','crit');
        const b=$('alm-pcm-bar'); if(b) b.style.background='var(--danger)';
        set('alm-pcm-st','LOCKED');
    },1500);
    setTimeout(()=>{
        log('AI_GAL','Activando electro-amortiguación en subestructura de anclaje.','crit');
        set('gal-valv','CERRADAS (BLOQUEO ESTRUCTURAL)','var(--danger)');
    },2000);
    setTimeout(()=>{
        sim.seismicActive=false;
        $('main-window').classList.remove('seismic-mode');
        document.querySelectorAll('.hud-card').forEach(c=>c.classList.remove('seismic-bg'));
        $('seismic-banner').style.display='none';
        set('term-status','■ RX/TX ACTIVE','var(--ok)');
        log('SYS_ALERT','Alerta sísmica finalizada. Daños: 0. Restaurando operaciones.','act');
        set('gal-valv','ABIERTAS (CAPTACIÓN)','var(--ai)');
        const b=$('alm-pcm-bar'); if(b) b.style.background='var(--alm)';
    },15000);
},45000);

// ════════════════════════════════════════════════════════════
//  RELOJ + INIT
// ════════════════════════════════════════════════════════════
setInterval(()=>{ $('clock').textContent = new Date().toLocaleTimeString('es-ES'); },1000);
setInterval(loadAPIs, 10*60*1000);
document.addEventListener('DOMContentLoaded', ()=>{
    log('SYS','Hytherm Digital Twin v6.0 inicializado. Conectando APIs...','act');
    loadAPIs();
});
