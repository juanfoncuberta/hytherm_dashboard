// ════════════════════════════════════════════════════════════
//  SIMULATION — Hytherm v7
//  Usa datos reales de CSV + ruido leve para simular "vivo"
//  Evento sísmico sin shake, solo notificaciones
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

    // ── Actualizar sensoría con datos reales + ruido ──
    for (const node of ['alm', 'gal']) {
        const d = Sensors.getCurrent(node);
        if (!d) continue;

        // Exterior: pequeño ruido sobre dato real
        const extT = sim.data[node].extT + (Math.random()*0.2 - 0.1);
        set(`${node}-ext-t`, extT.toFixed(1));

        // Dekton: ruido leve
        const dekton = d.dekton_surface_temp_C + (Math.random()*0.4 - 0.2);
        set(`${node}-dekton`, dekton.toFixed(1));
        set(`${node}-dekton-delta`, `Gradiente ΔT: ${Math.abs(dekton - d.indoor_temp_C).toFixed(1)}`);

        // Indoor: muy estable, mínimo ruido
        const intT = d.indoor_temp_C + (Math.random()*0.1 - 0.05);
        set(`${node}-int-t`, intT.toFixed(1));

        // PCM: evoluciona según precio
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

        // Seebeck: proporcional a gradiente real
        const deltaT = Math.abs(dekton - intT);
        const seebeck = deltaT > 3 ? deltaT * 0.07 * (1 + d.irradiance_Wm2 / 1200) : 0;
        set(`${node}-pwr`, seebeck.toFixed(1));
        set(`${node}-pwr-sub`, `${seebeck.toFixed(1)}W ${seebeck > 0.5 ? 'Generando' : 'Mínimo'}`);
    }

    // IA logs contextualizados con datos reales
    const r = Math.random();
    const almD = Sensors.getCurrent('alm');
    const galD = Sensors.getCurrent('gal');

    if (r < 0.12 && sim.priceIsHigh) {
        log('GRID_OPT', `OMIE Price HIGH (${sim.price.toFixed(3)}€). Desviando consumo a PCM.`, 'think');
    } else if (r < 0.24 && almD) {
        log('AI_ALM', `Dekton: ${almD.dekton_surface_temp_C.toFixed(1)}°C | Indoor: ${almD.indoor_temp_C.toFixed(1)}°C. MOF: ${almD.mof_state}.`, 'think');
    } else if (r < 0.36 && galD) {
        log('AI_GAL', `Batería GAL: ${Math.round(galD.battery_pct)}% (${galD.battery_status}). PCM: ${Math.round(galD.pcm_melt_fraction_pct)}%.`, 'act');
    } else if (r < 0.48 && almD && almD.irradiance_Wm2 > 0) {
        const sbk = (almD.irradiance_Wm2 * 0.016).toFixed(1);
        log('SEEBECK', `Irradiancia ALM: ${Math.round(almD.irradiance_Wm2)}W/m². Generando ${sbk}W.`, 'ai');
    } else if (r < 0.55 && almD) {
        log('AI_ALM', `Dew Point: ${almD.dew_point_C.toFixed(1)}°C. Riesgo condensación: ${almD.condensation_risk}.`, 'think');
    }

}, 2000);

// ── CONFORT SLIDERS ──
function userAdjust(node, param) {
    const val = $(`${param}-${node}`).value;
    const unit = param==='t'?'°C':'%';
    set(`v-${param}-${node}`, `${val} ${unit}`);
    sim.targets[node][param] = parseFloat(val);
    log('USER_INPUT', `Ajuste manual ${node.toUpperCase()} → Target ${param.toUpperCase()}: ${val}${unit}`, 'act');
    setTimeout(() => {
        log(`AI_${node.toUpperCase()}`, `Recalculando matriz termodinámica... ΔT = ${Math.abs(sim.data[node].extT - sim.targets[node].t).toFixed(1)}ºC`, 'think');
    }, 400);
    setTimeout(() => {
        log(`AI_${node.toUpperCase()}`, `Actuador: ${sim.data[node].intT > sim.targets[node].t ? 'Cargando PCM' : 'Descargando PCM'}`, 'act');
    }, 1200);
}

// ════════════════════════════════════════════════════════════
//  EVENTO SÍSMICO — Demo a los 45s
// ════════════════════════════════════════════════════════════
setTimeout(() => {
    sim.seismicActive = true;
    document.querySelectorAll('.hud-card').forEach(c => c.classList.add('seismic-highlight'));
    set('term-status', '■ EMERGENCY OVERRIDE', 'var(--danger)');
    log('SYS_ALERT', 'ALERTA SÍSMICA REGIONAL DETECTADA (IGN). MAGNITUD ESTIMADA: 4.5', 'crit');
    Notif.critical('Alerta Sísmica Regional',
        'Sismo detectado por IGN. Magnitud estimada: 4.5. Protocolo SAFE-STATE iniciado.',
        { source: 'IGN' });

    setTimeout(() => {
        log('AI_CORE', 'Iniciando protocolo SAFE-STATE en todas las envolventes.', 'crit');
        Notif.warning('Protocolo SAFE-STATE', 'IA Core ejecutando secuencia de protección.', { source: 'AI_CORE' });
    }, 500);
    setTimeout(() => {
        log('AI_ALM', 'Purgando agua de paneles. Bloqueando válvulas PCM.', 'crit');
        const b = $('alm-pcm-bar'); if (b) b.style.background = 'var(--danger)';
        set('alm-pcm-st', 'LOCKED');
        Notif.warning('ALM — PCM Bloqueado', 'Purga completada. Válvulas PCM en LOCKED.', { source: 'AI_ALM' });
    }, 1500);
    setTimeout(() => {
        log('AI_GAL', 'Activando electro-amortiguación en subestructura.', 'crit');
        set('gal-valv', 'CERRADAS (BLOQUEO ESTRUCTURAL)', 'var(--danger)');
        Notif.warning('GAL — Bloqueo Estructural', 'Válvulas cerradas por seguridad.', { source: 'AI_GAL' });
    }, 2000);

    setTimeout(() => {
        sim.seismicActive = false;
        document.querySelectorAll('.hud-card').forEach(c => c.classList.remove('seismic-highlight'));
        set('term-status', '■ RX/TX ACTIVE', 'var(--ok)');
        log('SYS_ALERT', 'Alerta sísmica finalizada. Daños: 0. Restaurando operaciones.', 'act');
        set('gal-valv', 'ABIERTAS (CAPTACIÓN)', 'var(--ai)');
        const b = $('alm-pcm-bar'); if (b) b.style.background = 'var(--alm)';
        Notif.success('Alerta Sísmica Finalizada', 'Sin daños. Operaciones restauradas.', { source: 'SYS' });
    }, 15000);
}, 45000);
