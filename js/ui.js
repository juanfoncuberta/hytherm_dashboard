// ════════════════════════════════════════════════════════════
//  UI RENDER FUNCTIONS — Hytherm v7
// ════════════════════════════════════════════════════════════

function renderWeather(node, om, nasa) {
    const c = om.current;
    set(`${node}-ext-t`,    c.temperature_2m?.toFixed(1)??'--');
    set(`${node}-ext-rh`,   `RH: ${c.relative_humidity_2m??'--'}%`);
    set(`${node}-wind`,     Math.round(c.wind_speed_10m??0));
    set(`${node}-wind-dir`, windDir(c.wind_direction_10m??0));
    set(`${node}-rain`,     (c.precipitation??0).toFixed(1));
    set(`${node}-pressure`, Math.round(c.surface_pressure??0));
    set(`${node}-uv`,       c.uv_index?.toFixed(1)??'--');
    set(`${node}-weather-desc`, wmoDesc(c.weather_code??0));
    if (nasa) {
        const p = nasa.properties.parameter;
        const dates = Object.keys(p.ALLSKY_SFC_SW_DWN);
        const last = dates[dates.length-1];
        set(`${node}-irr`,       Math.round(p.ALLSKY_SFC_SW_DWN[last]??0));
        set(`${node}-irr-clear`, Math.round(p.CLRSKY_SFC_SW_DWN[last]??0));
        const irr = p.ALLSKY_SFC_SW_DWN[last]??0;
        sim.data[node].irr = irr;
        const seebeck = (irr*0.016).toFixed(1);
        set(`${node}-pwr`,     seebeck);
        set(`${node}-pwr-sub`, `${seebeck}W Generando`);
    }
    const fc = $(`${node}-forecast`); if (!fc) return;
    fc.innerHTML = '';
    (om.daily?.time||[]).slice(0,7).forEach((date,i) => {
        const d = new Date(date);
        const day = d.toLocaleDateString('es-ES',{weekday:'short'}).toUpperCase();
        fc.innerHTML += `<div class="forecast-day">
            <span class="fc-day">${day}</span>
            <span class="fc-desc">${wmoDesc(om.daily.weather_code[i])}</span>
            <span class="fc-temp"><span style="color:#fff">${Math.round(om.daily.temperature_2m_max[i])}°</span>/<span style="color:var(--muted)">${Math.round(om.daily.temperature_2m_min[i])}°</span></span>
            <span class="fc-rain">${(om.daily.precipitation_sum[i]??0).toFixed(1)}mm</span>
            <span class="fc-wind">${Math.round(om.daily.wind_speed_10m_max[i]??0)}km/h</span>
        </div>`;
    });
}

function renderAEMETobs(node, obs) {
    if (!obs) return;
    if (obs.temp)     set(`${node}-ext-t`,    obs.temp.toFixed(1));
    if (obs.humidity) set(`${node}-ext-rh`,   `RH: ${Math.round(obs.humidity)}%`);
    if (obs.wind)     set(`${node}-wind`,      Math.round(obs.wind));
    if (obs.windDir)  set(`${node}-wind-dir`,  windDir(obs.windDir));
    if (obs.rain1h!=null) set(`${node}-rain`, obs.rain1h.toFixed(1));
    if (obs.pressure) set(`${node}-pressure`,  Math.round(obs.pressure));
    const badge = $(`${node}-aemet-badge`);
    if (badge) { badge.textContent = '✓ AEMET OFICIAL'; badge.style.color = 'var(--ok)'; }
}

function renderAEMETpred(node, horas) {
    const el = $(`${node}-forecast-aemet`); if (!el||!horas) return;
    const slice = horas.filter((_,i)=>i%3===0).slice(0,8);
    el.innerHTML = slice.map(h=>`
        <div class="forecast-hour">
            <span class="fh-hora">${h.hora}:00</span>
            <span style="color:var(--txt); font-size:10px">${h.cielo}</span>
            <span style="font-family:'Share Tech Mono'">${h.temp??'--'}°C</span>
            <span style="color:#60a5fa">${h.precipProb??0}%</span>
            <span style="color:var(--muted)">${Math.round(h.viento??0)}km/h</span>
        </div>`).join('');
}

function renderAEMETavisos(avisos) {
    const el = $('aemet-avisos'); if (!el) return;
    el.innerHTML = avisos.map(a=>{
        const ok = a.estado==='sin_avisos';
        return `<div class="aviso-row">
            <span style="color:${ok?'var(--ok)':'var(--warn)'}">${ok?'✓':'⚠'}</span>
            <span style="color:#94a3b8">${a.zona}</span>
            <span style="color:${ok?'var(--ok)':'var(--warn)'}; font-weight:600">${ok?'Sin avisos activos':'Aviso activo'}</span>
        </div>`;
    }).join('');
}

function renderRisk(node, d) {
    if (!d) return;
    const fwiColors = ['var(--ok)','#84cc16','var(--warn)','#f97316','var(--danger)'];
    const fwiLvl = v=>v===null?0:v<5.2?0:v<11.2?1:v<21.3?2:v<38?3:4;
    const lvl = fwiLvl(d.fwi);
    set(`${node}-fwi-val`,   d.fwi?.toFixed(1)??'--');
    set(`${node}-fwi-label`, d.fwiInfo?.l??'--', fwiColors[lvl]);
    set(`${node}-fwi-val-r`, d.fwi?.toFixed(1)??'--');
    set(`${node}-fwi-label-r`, d.fwiInfo?.l??'--', fwiColors[lvl]);
    set(`${node}-drought`,   d.droughtInfo?.l??'--', d.droughtInfo?.c);
    set(`${node}-drought-label`, d.droughtInfo?.l??'--', d.droughtInfo?.c);
    set(`${node}-drought-src`,   '~ EDO estimado (Open-Meteo)');
    set(`${node}-drought-r`,     d.droughtInfo?.l??'--', d.droughtInfo?.c);
    set(`${node}-balance-r`,     `${d.balance>0?'+':''}${d.balance} mm`);
}

function renderEnergy(e) {
    set('energy-renewable', `${(e.renewable||0).toLocaleString()} MW`);
    set('energy-fossil',    `${(e.fossil||0).toLocaleString()} MW`);
    set('energy-demand',    `${(e.demand||0).toLocaleString()} MW`);
    set('energy-co2',       `${e.co2??'--'}`);
    set('energy-ren-pct',   `${e.renewablePct??'--'}%`);
    set('global-co2',       `${e.co2??'--'} g/kWh`, e.co2<100?'var(--ok)':e.co2<250?'var(--warn)':'var(--danger)');
    set('global-ren',       `${e.renewablePct??'--'}%`);
    set('ren-bar-label',    `${e.renewablePct??'--'}%`);
    const bar = $('ren-bar');
    if (bar && e.renewablePct!=null) {
        bar.style.width = `${e.renewablePct}%`;
        bar.style.background = e.renewablePct>60?'var(--ok)':e.renewablePct>30?'var(--warn)':'var(--danger)';
    }
}

function renderGDACS(g) {
    const el = $('gdacs-alerts'); if (!el) return;
    if (!g.europe?.length) {
        el.innerHTML = '<span style="color:var(--ok)">✓ Sin alertas activas en Europa</span>'; return;
    }
    el.innerHTML = g.europe.map(a=>`
        <div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:11px">
            <span style="color:var(--warn)">⚠</span>
            <span>${a.title}</span>
            <span style="color:var(--muted);font-size:9px">${new Date(a.pubDate).toLocaleDateString('es-ES')}</span>
        </div>`).join('');
}

function renderCopernicus(d) {
    const el = $('copernicus-alerts'); if (!el) return;
    const cnt = $('copernicus-count');
    if (cnt) cnt.textContent = `${d.total} activaciones globales`;
    const items = d.europe?.length ? d.europe : d.all;
    if (!items?.length) { el.innerHTML = '<span style="color:var(--ok)">✓ Sin activaciones en Europa</span>'; return; }
    el.innerHTML = items.slice(0,8).map(a=>`
        <div class="cop-alert">
            <span class="cop-type" style="color:${a.c||'var(--warn)'}">${a.t||'EMERGENCIA'}</span>
            <div class="cop-info">
                <span class="cop-title">${a.title.slice(0,90)}${a.title.length>90?'…':''}</span>
                <span class="cop-date">${new Date(a.updated).toLocaleDateString('es-ES')}</span>
            </div>
            <a href="${a.link}" target="_blank" class="cop-link">→</a>
        </div>`).join('');
}

function renderAqueduct(node, aq) {
    set(`${node}-aq-stress`,  aq.stress.l,  aq.stress.c);
    set(`${node}-aq-deplete`, aq.deplete.l, aq.deplete.c);
    set(`${node}-aq-iav`,     aq.iav.l,     aq.iav.c);
    set(`${node}-aq-overall`, aq.overall.l, aq.overall.c);
    set(`${node}-aq-source`,  aq.src);
    set(`${node}-aq-hud`,     aq.overall.l, aq.overall.c);
}

// ── History page render ──
function renderHistoryPage() {
    const stats = History.getStats();
    set('hist-total',   stats.total);
    set('hist-1h',      stats.last1h);
    set('hist-24h',     stats.last24h);
    set('hist-sources', stats.sources);

    const sourceFilter = $('hist-source-filter')?.value || 'all';
    const nodeFilter   = $('hist-node-filter')?.value || 'all';

    const records = History.getFiltered({ source: sourceFilter, node: nodeFilter });
    const tbody = $('hist-tbody');
    if (!tbody) return;

    if (!records.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:30px;">Sin datos históricos todavía. Se irán acumulando con cada actualización de APIs.</td></tr>';
        return;
    }

    // Mostrar últimos 200, más recientes primero
    const display = records.slice().reverse().slice(0, 200);
    tbody.innerHTML = display.map(r => {
        const t = r.time.toLocaleTimeString('es-ES');
        const d = r.time.toLocaleDateString('es-ES', { day:'2-digit', month:'short' });
        const nodeClass = r.node === 'alm' ? 'alm' : r.node === 'gal' ? 'gal' : '';
        const nodeLabel = r.node === 'alm' ? 'ALM' : r.node === 'gal' ? 'COR' : 'GLOBAL';
        // Formatear datos como resumen
        const summary = Object.entries(r.data).map(([k,v]) => {
            if (typeof v === 'number') return `${k}: ${Number.isInteger(v) ? v : v.toFixed(1)}`;
            return `${k}: ${v}`;
        }).join(' | ');
        return `<tr>
            <td class="col-time">${d} ${t}</td>
            <td class="col-node ${nodeClass}">${nodeLabel}</td>
            <td style="font-weight:700;color:#fff;font-size:9px;letter-spacing:0.5px">${r.source}</td>
            <td style="color:#94a3b8;font-size:9px">${summary}</td>
            <td class="col-time">#${r.id}</td>
        </tr>`;
    }).join('');
}
