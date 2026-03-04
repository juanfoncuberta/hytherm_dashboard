// ════════════════════════════════════════════════════════════
//  API: AEMET
// ════════════════════════════════════════════════════════════
async function aemetFetch(endpoint) {
    const url = `https://opendata.aemet.es/opendata/api${endpoint}?api_key=${CFG.AEMET_API_KEY}`;
    const s1 = JSON.parse(await proxyFetch(url));
    if (s1.estado !== 200) throw new Error(`AEMET ${s1.estado}`);
    return JSON.parse(await proxyFetch(s1.datos));
}

async function fetchAEMETobs(node) {
    const data = await aemetFetch(`/observacion/convencional/datos/estacion/${CFG.NODES[node].estacion}`);
    const obs = data[data.length-1];
    return {
        temp:     parseFloat(obs.ta??obs.temp??0),
        humidity: parseFloat(obs.hr??0),
        wind:     parseFloat(obs.vv??0)*3.6,
        windDir:  parseFloat(obs.dv??0),
        pressure: parseFloat(obs.pres??0),
        rain1h:   parseFloat(obs.prec??0)
    };
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
