// ════════════════════════════════════════════════════════════
//  API: REData
// ════════════════════════════════════════════════════════════
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
    return { renewable:Math.round(renewable), fossil:Math.round(fossil), total:Math.round(total),
             renewablePct: total>0?Math.round(renewable/total*100):null,
             co2: total>0?Math.round(co2sum/total):null, demand };
}
