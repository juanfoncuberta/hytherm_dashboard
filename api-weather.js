// ════════════════════════════════════════════════════════════
//  API: OPEN-METEO
// ════════════════════════════════════════════════════════════
async function fetchOpenMeteo(node) {
    const { lat, lon } = CFG.NODES[node];
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`+
        `&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,weather_code,surface_pressure,uv_index`+
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,uv_index_max`+
        `&wind_speed_unit=kmh&timezone=Europe%2FMadrid&forecast_days=7`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OM ${res.status}`);
    return await res.json();
}

// ════════════════════════════════════════════════════════════
//  API: NASA POWER
// ════════════════════════════════════════════════════════════
async function fetchNASA(node) {
    const { lat, lon } = CFG.NODES[node];
    const today = new Date();
    const end   = today.toISOString().slice(0,10).replace(/-/g,'');
    const start = new Date(today-7*86400000).toISOString().slice(0,10).replace(/-/g,'');
    const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN,CLRSKY_SFC_SW_DWN&community=RE&longitude=${lon}&latitude=${lat}&start=${start}&end=${end}&format=JSON`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`NASA ${res.status}`);
    return await res.json();
}
