// ════════════════════════════════════════════════════════════
//  SIMULATION — Hytherm v7
//  Datos dummy dinámicos para telemetría interna
// ════════════════════════════════════════════════════════════

// ── Valores base por nodo ──
const DUMMY_BASE = {
    alm: { dekton: 54.2, intT: 24.1, intRH: 38, mofPct: 72, batt: 78, dew: 10.4, irr: 820 },
    gal: { dekton: 37.8, intT: 21.6, intRH: 63, mofPct: 48, batt: 86, dew: 15.2, irr: 410 }
};

// Estado vivo (random walk suave)
const live = {
    alm: { ...DUMMY_BASE.alm },
    gal: { ...DUMMY_BASE.gal }
};

function rw(val, step, min, max) {
    return Math.min(max, Math.max(min, val + (Math.random() * step * 2 - step)));
}

const MOF_STATES = ['ACTIVO', 'CAPTANDO', 'SATURADO', 'PURGANDO'];
const BATT_STATUS = { ok: 'NOMINAL', low: 'BAJO — CARGANDO', full: 'COMPLETO' };

let tick = 0;
setInterval(() => {
    tick++;

    // ── Precio eléctrico ──
    sim.price = 0.14 + Math.sin(tick * 0.5) * 0.08 + Math.random() * 0.02;
    sim.priceIsHigh = sim.price > 0.18;
    set('global-price', `${sim.price.toFixed(3)} €/kWh`);
    const tr = $('price-trend');
    if (tr) { tr.textContent = sim.priceIsHigh ? '▲ Pico' : '▼ Valle'; tr.style.color = sim.priceIsHigh ? 'var(--danger)' : 'var(--ok)'; }

    // ── Telemetría interna dummy por nodo ──
    for (const node of ['alm', 'gal']) {
        const l = live[node];

        // Random walk suave sobre los valores base
        l.dekton = rw(l.dekton, 0.3, DUMMY_BASE[node].dekton - 4, DUMMY_BASE[node].dekton + 4);
        l.intT   = rw(l.intT,   0.08, DUMMY_BASE[node].intT - 1.5, DUMMY_BASE[node].intT + 1.5);
        l.intRH  = rw(l.intRH,  0.4,  DUMMY_BASE[node].intRH - 5,  DUMMY_BASE[node].intRH + 5);
        l.mofPct = rw(l.mofPct, 0.5,  20, 95);
        l.batt   = rw(l.batt,   0.15, 60, 98);
        l.dew    = rw(l.dew,    0.1,  DUMMY_BASE[node].dew - 2,    DUMMY_BASE[node].dew + 2);
        l.irr    = rw(l.irr,    8,    DUMMY_BASE[node].irr - 80,   DUMMY_BASE[node].irr + 80);

        const deltaT = Math.abs(l.dekton - l.intT);

        // Dekton
        set(`${node}-dekton`, l.dekton.toFixed(1));
        set(`${node}-dekton-delta`, `Gradiente ΔT: ${deltaT.toFixed(1)}`);

        // Indoor
        set(`${node}-int-t`, l.intT.toFixed(1));
        set(`${node}-int-rh`, `RH: ${Math.round(l.intRH)}%`);

        // MOF
        const mofState = l.mofPct > 80 ? 'SATURADO' : l.mofPct > 50 ? 'ACTIVO' : 'CAPTANDO';
        set(`${node}-mof`, mofState, l.mofPct > 80 ? 'var(--warn)' : 'var(--ok)');
        set(`${node}-mof-detail`, `Condensado: ${l.mofPct.toFixed(1)}%`);

        // Seebeck
        const seebeck = deltaT > 3 ? (deltaT * 0.07 * (1 + l.irr / 1200)).toFixed(1) : '0.0';
        set(`${node}-pwr`, seebeck);
        set(`${node}-pwr-sub`, `${seebeck}W ${parseFloat(seebeck) > 0.5 ? 'Generando' : 'Mínimo'}`);

        // Batería
        const battPct = Math.round(l.batt);
        const battSt = battPct >= 90 ? BATT_STATUS.full : battPct < 70 ? BATT_STATUS.low : BATT_STATUS.ok;
        const battCol = battPct < 70 ? 'var(--warn)' : 'var(--ok)';
        set(`${node}-batt`, battPct);
        set(`${node}-batt-status`, battSt, battCol);

        // Dew point
        const dewRisk = l.dew > (l.intT - 2) ? 'ALTO' : l.dew > (l.intT - 5) ? 'MODERADO' : 'BAJO';
        const dewCol  = dewRisk === 'ALTO' ? 'var(--danger)' : dewRisk === 'MODERADO' ? 'var(--warn)' : 'var(--ok)';
        set(`${node}-dew`, l.dew.toFixed(1));
        set(`${node}-dew-risk`, `Riesgo Cond.: ${dewRisk}`, dewCol);

        // PCM
        sim.data[node].pcm = Math.min(100, Math.max(0,
            sim.data[node].pcm + (sim.priceIsHigh ? -0.3 : 0.4)
        ));
        const pcm = sim.data[node].pcm;
        const pcmBar = $(`${node}-pcm-bar`);
        if (pcmBar) {
            pcmBar.style.width = `${pcm}%`;
            pcmBar.style.background = pcm < 20 ? 'var(--danger)' : pcm < 50 ? 'var(--warn)' : node === 'alm' ? 'var(--alm)' : 'var(--gal)';
        }
        set(`${node}-pcm-st`, `${Math.round(pcm)}% ${sim.priceIsHigh ? 'DISCHRG' : 'CHRG'}`);
    }

    // ── IA logs contextualizados ──
    const r = Math.random();
    const lA = live.alm, lG = live.gal;
    if (r < 0.12 && sim.priceIsHigh) {
        log('GRID_OPT', `OMIE Price HIGH (${sim.price.toFixed(3)}€). Desviando consumo a PCM.`, 'think');
    } else if (r < 0.24) {
        log('AI_ALM', `Dekton: ${lA.dekton.toFixed(1)}°C | Indoor: ${lA.intT.toFixed(1)}°C | MOF: ${lA.mofPct.toFixed(1)}%.`, 'think');
    } else if (r < 0.36) {
        log('AI_GAL', `Batería BCN: ${Math.round(lG.batt)}% | PCM: ${Math.round(sim.data.gal.pcm)}% | Dew: ${lG.dew.toFixed(1)}°C.`, 'act');
    } else if (r < 0.48) {
        log('SEEBECK', `Irradiancia ALM: ${Math.round(lA.irr)}W/m². ΔT: ${Math.abs(lA.dekton - lA.intT).toFixed(1)}°C.`, 'ai');
    } else if (r < 0.55) {
        log('AI_ALM', `Dew Point: ${lA.dew.toFixed(1)}°C. Riesgo condensación: ${lA.dew > lA.intT - 2 ? 'ALTO' : 'BAJO'}.`, 'think');
    }

}, 2000);

// ── CONFORT SLIDERS ──
function userAdjust(node, param) {
    const val = $(`${param}-${node}`).value;
    const unit = param === 't' ? '°C' : '%';
    set(`v-${param}-${node}`, `${val} ${unit}`);
    sim.targets[node][param] = parseFloat(val);
    log('USER_INPUT', `Ajuste manual ${node.toUpperCase()} → Target ${param.toUpperCase()}: ${val}${unit}`, 'act');
    setTimeout(() => {
        log(`AI_${node.toUpperCase()}`, `Recalculando matriz termodinámica... ΔT = ${Math.abs(live[node].intT - sim.targets[node].t).toFixed(1)}ºC`, 'think');
    }, 400);
    setTimeout(() => {
        log(`AI_${node.toUpperCase()}`, `Actuador: ${live[node].intT > sim.targets[node].t ? 'Cargando PCM' : 'Descargando PCM'}`, 'act');
    }, 1200);
}
