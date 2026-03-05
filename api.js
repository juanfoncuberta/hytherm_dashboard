// ════════════════════════════════════════════════════════════
//  API FUNCTIONS — Hytherm v7
//  Cada API registra sus datos en History + Feed
// ════════════════════════════════════════════════════════════

// ── OPEN-METEO ──
async function fetchOpenMeteo(node) {
    const { lat, lon } = CFG.NODES[node];
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`+
        `&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,weather_code,surface_pressure,uv_index`+
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,uv_index_max`+
        `&wind_speed_unit=kmh&timezone=Europe%2FMadrid&forecast_days=7`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OM ${res.status}`);
    const data = await res.json();

    // Guardar en historial
    const c = data.current;
    History.add('OPEN_METEO', node, {
        temp: c.temperature_2m,
        humidity: c.relative_humidity_2m,
        wind: c.wind_speed_10m,
        windDir: c.wind_direction_10m,
        precip: c.precipitation,
        pressure: c.surface_pressure,
        uv: c.uv_index,
        weatherCode: c.weather_code
    });
    Feed.add('OPEN_METEO', `${CFG.NODES[node].label} → ${c.temperature_2m}°C | RH ${c.relative_humidity_2m}% | Viento ${Math.round(c.wind_speed_10m)}km/h`);

    return data;
}

// ── NASA POWER ──
async function fetchNASA(node) {
    const { lat, lon } = CFG.NODES[node];
    const today = new Date();
    const end   = today.toISOString().slice(0,10).replace(/-/g,'');
    const start = new Date(today-7*86400000).toISOString().slice(0,10).replace(/-/g,'');
    const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN,CLRSKY_SFC_SW_DWN&community=RE&longitude=${lon}&latitude=${lat}&start=${start}&end=${end}&format=JSON`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`NASA ${res.status}`);
    const data = await res.json();

    const p = data.properties.parameter;
    const dates = Object.keys(p.ALLSKY_SFC_SW_DWN);
    const last = dates[dates.length - 1];
    const irr = p.ALLSKY_SFC_SW_DWN[last] ?? 0;
    const irrClear = p.CLRSKY_SFC_SW_DWN[last] ?? 0;

    History.add('NASA', node, { irradiance: irr, irradianceClear: irrClear });
    Feed.add('NASA', `${CFG.NODES[node].label} → Irradiancia: ${Math.round(irr)}W/m² | Cielo claro: ${Math.round(irrClear)}W/m²`);

    return data;
}

// ── REData ──
async function fetchREData() {
    const now   = new Date();
    const start = new Date(now-2*3600000).toISOString().slice(0,16);
    const end   = now.toISOString().slice(0,16);
    const urlG = `https://apidatos.ree.es/es/datos/generacion/estructura-generacion?start_date=${start}&end_date=${end}&time_trunc=hour`;
    const urlD = `https://apidatos.ree.es/es/datos/demanda/demanda-tiempo-real?start_date=${start}&end_date=${end}&time_trunc=hour`;
    const [rG, rD] = await Promise.all([fetch(urlG), fetch(urlD)]);
    const co2f = {'Hidráulica':4,'Nuclear':12,'Carbón':820,'Ciclo combinado':490,'Eólica':11,'Solar fotovoltaica':41,'Solar térmica':22,'Cogeneración':200,'Importación saldo':350};
    const renewSrc = ['Hidráulica','Eólica','Solar fotovoltaica','Solar térmica','Otras renovables'];
    let renewable=0, fossil=0, co2sum=0, demand=null;
    if (rG.ok) {
        const g = await rG.json();
        (g?.included||[]).forEach(item => {
            const name = item.attributes?.title||'';
            const vals = item.attributes?.values||[];
            if (!vals.length) return;
            const mw = vals[vals.length-1]?.value||0;
            if (renewSrc.some(r=>name.includes(r))) renewable+=mw; else fossil+=mw;
            co2sum += mw*(co2f[name]||200);
        });
    }
    if (rD.ok) {
        const d = await rD.json();
        const inc = d?.included?.[0];
        if (inc?.attributes?.values?.length) demand = inc.attributes.values[inc.attributes.values.length-1].value;
    }
    const total = renewable+fossil;
    const result = {
        renewable: Math.round(renewable), fossil: Math.round(fossil), total: Math.round(total),
        renewablePct: total>0 ? Math.round(renewable/total*100) : null,
        co2: total>0 ? Math.round(co2sum/total) : null, demand
    };

    History.add('REDATA', 'global', {
        renewable: result.renewable, fossil: result.fossil,
        renewablePct: result.renewablePct, co2: result.co2, demand: result.demand
    });
    Feed.add('REDATA', `Renovables: ${result.renewablePct}% (${result.renewable}MW) | CO₂: ${result.co2} g/kWh | Demanda: ${Math.round(demand||0)}MW`);

    return result;
}

// ── EFFIS + EDO ──
async function fetchEFFIS(node) {
    const {lat,lon} = CFG.NODES[node];
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=fire_danger_index,precipitation_sum,et0_fao_evapotranspiration&timezone=Europe%2FMadrid&forecast_days=3&past_days=30`;
    const res = await fetch(url); if (!res.ok) return null;
    const d = await res.json();
    const fwi = d?.daily?.fire_danger_index?.[30]??null;
    const fwiLabel = v => v===null?{l:'N/D',c:'var(--muted)'}:v<5.2?{l:'BAJO',c:'var(--ok)'}:v<11.2?{l:'MODERADO',c:'#84cc16'}:v<21.3?{l:'ALTO',c:'var(--warn)'}:v<38?{l:'MUY ALTO',c:'#f97316'}:{l:'EXTREMO',c:'var(--danger)'};
    const precip = (d?.daily?.precipitation_sum||[]).slice(0,30).reduce((a,b)=>a+(b||0),0);
    const et0    = (d?.daily?.et0_fao_evapotranspiration||[]).slice(0,30).reduce((a,b)=>a+(b||0),0);
    const balance = precip-et0;
    const droughtLabel = v=>v>20?{l:'Normal',c:'var(--ok)'}:v>-10?{l:'Leve',c:'#84cc16'}:v>-40?{l:'Moderada',c:'var(--warn)'}:v>-80?{l:'Severa',c:'#f97316'}:{l:'Extrema',c:'var(--danger)'};
    const result = { fwi, fwiInfo: fwiLabel(fwi), balance:Math.round(balance), droughtInfo:droughtLabel(balance) };

    History.add('EFFIS', node, { fwi, fwiLevel: result.fwiInfo.l, balance, droughtLevel: result.droughtInfo.l });
    Feed.add('EFFIS', `${CFG.NODES[node].label} → FWI: ${fwi?.toFixed(1)} (${result.fwiInfo.l}) | Balance hídrico: ${Math.round(balance)}mm`);

    return result;
}

// ── GDACS ──
// async function fetchGDACS() {
//     const xml = await proxyFetch('https://www.gdacs.org/xml/rss.xml', true);
//     const doc  = new DOMParser().parseFromString(xml,'text/xml');
//     const items = [...doc.querySelectorAll('item')].slice(0,12).map(i=>({
//         title: i.querySelector('title')?.textContent||'',
//         pubDate: i.querySelector('pubDate')?.textContent||''
//     }));
//     const kw = ['Spain','Europe','Portugal','France','Atlantic','Mediterranean','Iberian'];
//     const europe = items.filter(a=>kw.some(k=>a.title.includes(k)));

//     History.add('GDACS', 'global', { totalAlerts: items.length, europeAlerts: europe.length });
//     Feed.add('GDACS', `${items.length} alertas globales | ${europe.length} en Europa`);

//     return { total:items.length, europe };
// }

async function fetchGDACS() {
    const url = 'https://www.gdacs.org/xml/rss.xml';
    let xml = '';
    
    try {
        // Intento 1: AllOrigins en modo JSON (no RAW) para evitar bloqueos de cabeceras
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (!data.contents) throw new Error("Respuesta vacía de AllOrigins");
        xml = data.contents;
    } catch (e) {
        // Intento 2: Fallback a corsproxy.io
        log('API_GDACS', 'Fallo AllOrigins, intentando proxy alternativo...', 'warn');
        const res2 = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
        if (!res2.ok) throw new Error(`Ambos proxies fallaron para GDACS`);
        xml = await res2.text();
    }

    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const items = [...doc.querySelectorAll('item')].slice(0, 12).map(i => ({
        title: i.querySelector('title')?.textContent || '',
        pubDate: i.querySelector('pubDate')?.textContent || ''
    }));
    
    const kw = ['Spain', 'Europe', 'Portugal', 'France', 'Atlantic', 'Mediterranean', 'Iberian'];
    const europe = items.filter(a => kw.some(k => a.title.includes(k)));

    History.add('GDACS', 'global', { totalAlerts: items.length, europeAlerts: europe.length });
    Feed.add('GDACS', `${items.length} alertas globales | ${europe.length} en Europa`);

    return { total: items.length, europe };
}

// ── AEMET ──
// async function aemetFetch(endpoint) {
//     const url = `https://opendata.aemet.es/opendata/api${endpoint}?api_key=${CFG.AEMET_API_KEY}`;
//     const s1 = JSON.parse(await proxyFetch(url));
//     if (s1.estado !== 200) throw new Error(`AEMET ${s1.estado}`);
//     return JSON.parse(await proxyFetch(s1.datos));
// }

async function aemetFetch(endpoint) {
    const url = `https://opendata.aemet.es/opendata/api${endpoint}?api_key=${CFG.AEMET_API_KEY}`;
    
    // 1. Fetch directo a AEMET (sin proxyFetch)
    const res1 = await fetch(url);
    if (!res1.ok) throw new Error(`AEMET API Error: ${res1.status}`);
    
    const s1 = await res1.json();
    if (s1.estado !== 200 && s1.estado !== 201) throw new Error(`AEMET Estado ${s1.estado}: ${s1.descripcion}`);
    
    // 2. Fetch directo a la URL de descarga (también soporta CORS)
    const resDatos = await fetch(s1.datos);
    if (!resDatos.ok) throw new Error(`AEMET Descarga Error: ${resDatos.status}`);
    
    return await resDatos.json();
}
async function fetchAEMETobs(node) {
    const data = await aemetFetch(`/observacion/convencional/datos/estacion/${CFG.NODES[node].estacion}`);
    const obs = data[data.length-1];
    const result = {
        temp:     parseFloat(obs.ta??obs.temp??0),
        humidity: parseFloat(obs.hr??0),
        wind:     parseFloat(obs.vv??0)*3.6,
        windDir:  parseFloat(obs.dv??0),
        pressure: parseFloat(obs.pres??0),
        rain1h:   parseFloat(obs.prec??0)
    };

    History.add('AEMET', node, {
        temp: result.temp, humidity: result.humidity,
        wind: result.wind, pressure: result.pressure, rain1h: result.rain1h
    });
    Feed.add('AEMET', `${CFG.NODES[node].label} OFICIAL → ${result.temp.toFixed(1)}°C | RH ${Math.round(result.humidity)}% | ${Math.round(result.wind)}km/h`);

    return result;
}

async function fetchAEMETpred(node) {
    const data = await aemetFetch(`/prediccion/especifica/municipio/horaria/${CFG.NODES[node].municipio}`);
    if (!data?.[0]) return null;
    const dias = data[0].prediccion.dia||[];
    let horas = [];
    dias.forEach(dia => {
        (dia.temperatura||[]).forEach((t,i) => {
            horas.push({
                hora: t.periodo,
                temp: parseFloat(t.value),
                precipProb: parseFloat(dia.probPrecipitacion?.[i]?.value??0),
                viento:     parseFloat(dia.vientoAndRachaMax?.[i]?.velocidad?.[0]?.value??0),
                cielo:      dia.estadoCielo?.[i]?.descripcion??'--'
            });
        });
    });
    return horas.slice(0,48);
}

async function fetchAEMETavisos() {
    const zonas = [CFG.NODES.alm.zona, CFG.NODES.gal.zona];
    const results = [];
    for (const z of zonas) {
        try {
            const url = `https://opendata.aemet.es/opendata/api/avisos_cap/ultimoelaborado/area/${z}?api_key=${CFG.AEMET_API_KEY}`;
            const s1 = JSON.parse(await proxyFetch(url));
            results.push({ zona: z==='61'?'Andalucía':'Galicia', estado: s1.estado===200?'aviso':'sin_avisos' });
        } catch { results.push({ zona: z==='61'?'Andalucía':'Galicia', estado:'error' }); }
    }
    return results;
}

// ── COPERNICUS EMS ──
// async function fetchCopernicus() {
//     const xml = await proxyFetch('https://emergency.copernicus.eu/mapping/activations-rapid/feed', true);
//     const doc = new DOMParser().parseFromString(xml,'text/xml');
//     const entries = [...doc.querySelectorAll('entry')].slice(0,15).map(e=>({
//         title:   e.querySelector('title')?.textContent?.trim()||'--',
//         updated: e.querySelector('updated')?.textContent?.trim()||'--',
//         link:    e.querySelector('link')?.getAttribute('href')||'#'
//     }));
//     const kw = ['Spain','Europe','Flood','Earthquake','Portugal','France','Fire','Wildfire','Storm','Iberian','Italy','Greece'];
//     const europe = entries.filter(a=>kw.some(k=>a.title.includes(k)));
//     const type = t=>{
//         const s=t.toLowerCase();
//         if(s.includes('flood'))  return{t:'INUNDACIÓN',c:'#60a5fa'};
//         if(s.includes('fire')||s.includes('wildfire')) return{t:'INCENDIO',c:'#f97316'};
//         if(s.includes('earthquake')||s.includes('seismic')) return{t:'SÍSMICO',c:'var(--danger)'};
//         if(s.includes('storm')) return{t:'TORMENTA',c:'#a78bfa'};
//         return{t:'EMERGENCIA',c:'var(--warn)'};
//     };

//     History.add('COPERNICUS', 'global', { totalActivations: entries.length, europeActivations: europe.length });
//     Feed.add('COPERNICUS', `${entries.length} activaciones | ${europe.length} en Europa`);

//     return { total:entries.length, europe:europe.map(e=>({...e,...type(e.title)})), all:entries.slice(0,5) };
// }

async function fetchCopernicus() {
    const url = 'https://emergency.copernicus.eu/mapping/activations-rapid/feed';
    let xml = '';
    
    try {
        // Intento 1: corsproxy.io suele leer mejor los XML puros de Copernicus
        const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        xml = await res.text();
    } catch (e) {
        // Intento 2: Fallback a AllOrigins en formato JSON seguro
        log('API_COP', 'Fallo corsproxy, intentando AllOrigins...', 'warn');
        const res2 = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
        const data = await res2.json();
        if (!data.contents) throw new Error("Respuesta vacía de proxies");
        xml = data.contents;
    }

    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const entries = [...doc.querySelectorAll('entry')].slice(0, 15).map(e => ({
        title: e.querySelector('title')?.textContent?.trim() || '--',
        updated: e.querySelector('updated')?.textContent?.trim() || '--',
        link: e.querySelector('link')?.getAttribute('href') || '#'
    }));
    
    const kw = ['Spain', 'Europe', 'Flood', 'Earthquake', 'Portugal', 'France', 'Fire', 'Wildfire', 'Storm', 'Iberian', 'Italy', 'Greece'];
    const europe = entries.filter(a => kw.some(k => a.title.includes(k)));
    
    const type = t => {
        const s = t.toLowerCase();
        if (s.includes('flood')) return { t: 'INUNDACIÓN', c: '#60a5fa' };
        if (s.includes('fire') || s.includes('wildfire')) return { t: 'INCENDIO', c: '#f97316' };
        if (s.includes('earthquake') || s.includes('seismic')) return { t: 'SÍSMICO', c: 'var(--danger)' };
        if (s.includes('storm')) return { t: 'TORMENTA', c: '#a78bfa' };
        return { t: 'EMERGENCIA', c: 'var(--warn)' };
    };

    History.add('COPERNICUS', 'global', { totalActivations: entries.length, europeActivations: europe.length });
    Feed.add('COPERNICUS', `${entries.length} activaciones | ${europe.length} en Europa`);

    return { total: entries.length, europe: europe.map(e => ({ ...e, ...type(e.title) })), all: entries.slice(0, 5) };
}

// ── WRI AQUEDUCT ──
function getAqueduct(node) {
    if (node==='alm') return {
        stress:{l:'EXTREMADAMENTE ALTO',c:'var(--danger)'},
        deplete:{l:'EXTREMADAMENTE ALTO',c:'var(--danger)'},
        iav:{l:'MUY ALTO',c:'#f97316'},
        overall:{l:'EXTREMADAMENTE ALTO',c:'var(--danger)'},
        src:'Ref. WRI Aqueduct 4.0 (2023)'
    };
    return {
        stress:{l:'BAJO-MEDIO',c:'var(--ok)'},
        deplete:{l:'BAJO-MEDIO',c:'var(--ok)'},
        iav:{l:'MEDIO-ALTO',c:'#84cc16'},
        overall:{l:'BAJO-MEDIO',c:'var(--ok)'},
        src:'Ref. WRI Aqueduct 4.0 (2023)'
    };
}
