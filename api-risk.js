// ════════════════════════════════════════════════════════════
//  API: EFFIS + EDO (via Open-Meteo)
// ════════════════════════════════════════════════════════════
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
    return { fwi, fwiInfo: fwiLabel(fwi), balance:Math.round(balance), droughtInfo:droughtLabel(balance) };
}

// ════════════════════════════════════════════════════════════
//  API: GDACS
// ════════════════════════════════════════════════════════════
async function fetchGDACS() {
    const xml = await proxyFetch('https://www.gdacs.org/xml/rss.xml', true);
    const doc  = new DOMParser().parseFromString(xml,'text/xml');
    const items = [...doc.querySelectorAll('item')].slice(0,12).map(i=>({
        title: i.querySelector('title')?.textContent||'',
        pubDate: i.querySelector('pubDate')?.textContent||''
    }));
    const kw = ['Spain','Europe','Portugal','France','Atlantic','Mediterranean','Iberian'];
    const europe = items.filter(a=>kw.some(k=>a.title.includes(k)));
    return { total:items.length, europe };
}

// ════════════════════════════════════════════════════════════
//  API: COPERNICUS EMS
// ════════════════════════════════════════════════════════════
async function fetchCopernicus() {
    const xml = await proxyFetch('https://emergency.copernicus.eu/mapping/activations-rapid/feed', true);
    const doc = new DOMParser().parseFromString(xml,'text/xml');
    const entries = [...doc.querySelectorAll('entry')].slice(0,15).map(e=>({
        title:   e.querySelector('title')?.textContent?.trim()||'--',
        updated: e.querySelector('updated')?.textContent?.trim()||'--',
        link:    e.querySelector('link')?.getAttribute('href')||'#'
    }));
    const kw = ['Spain','Europe','Flood','Earthquake','Portugal','France','Fire','Wildfire','Storm','Iberian','Italy','Greece'];
    const europe = entries.filter(a=>kw.some(k=>a.title.includes(k)));
    const type = t=>{
        const s=t.toLowerCase();
        if(s.includes('flood'))  return{t:'INUNDACIÓN',c:'#60a5fa'};
        if(s.includes('fire')||s.includes('wildfire')) return{t:'INCENDIO',c:'#f97316'};
        if(s.includes('earthquake')||s.includes('seismic')) return{t:'SÍSMICO',c:'var(--danger)'};
        if(s.includes('storm')) return{t:'TORMENTA',c:'#a78bfa'};
        return{t:'EMERGENCIA',c:'var(--warn)'};
    };
    return { total:entries.length, europe:europe.map(e=>({...e,...type(e.title)})), all:entries.slice(0,5) };
}

// ════════════════════════════════════════════════════════════
//  API: WRI AQUEDUCT (referencia publicada 2023)
// ════════════════════════════════════════════════════════════
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
