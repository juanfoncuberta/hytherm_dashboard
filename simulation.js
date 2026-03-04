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
//  Ahora usa el Centro de Notificaciones en lugar de
//  sacudir la interfaz. Sin zumbidos ni animación shake.
// ════════════════════════════════════════════════════════════
setTimeout(() => {
    sim.seismicActive = true;

    // Highlight visual sutil en tarjetas (sin shake)
    document.querySelectorAll('.hud-card').forEach(c => c.classList.add('seismic-bg'));

    // Terminal status
    set('term-status','■ EMERGENCY OVERRIDE','var(--danger)');

    // Terminal logs (se mantienen para el log técnico)
    log('SYS_ALERT','ALERTA SÍSMICA REGIONAL DETECTADA (IGN). MAGNITUD ESTIMADA: 4.5','crit');

    // === NOTIFICACIÓN PRINCIPAL EN EL CENTRO ===
    NotificationCenter.critical(
        'Alerta Sísmica Regional',
        'Sismo detectado por IGN. Magnitud estimada: 4.5. Protocolo SAFE-STATE iniciado automáticamente en todas las envolventes.',
        { source: 'IGN / SYS_ALERT' }
    );

    setTimeout(() => {
        log('AI_CORE','Iniciando protocolo SAFE-STATE en todas las envolventes.','crit');
        NotificationCenter.warning(
            'Protocolo SAFE-STATE',
            'IA Core ejecutando secuencia de protección en Almería y A Coruña.',
            { source: 'AI_CORE' }
        );
    }, 500);

    setTimeout(() => {
        log('AI_ALM','Purgando agua de paneles. Bloqueando válvulas PCM.','crit');
        const b = $('alm-pcm-bar'); if(b) b.style.background = 'var(--danger)';
        set('alm-pcm-st','LOCKED');
        NotificationCenter.warning(
            'ALM — PCM Bloqueado',
            'Purga de agua en paneles completada. Válvulas PCM en estado LOCKED.',
            { source: 'AI_ALM' }
        );
    }, 1500);

    setTimeout(() => {
        log('AI_GAL','Activando electro-amortiguación en subestructura de anclaje.','crit');
        set('gal-valv','CERRADAS (BLOQUEO ESTRUCTURAL)','var(--danger)');
        NotificationCenter.warning(
            'GAL — Bloqueo Estructural',
            'Electro-amortiguación activada. Válvulas de drenaje/captación cerradas por seguridad.',
            { source: 'AI_GAL' }
        );
    }, 2000);

    // Resolución del evento
    setTimeout(() => {
        sim.seismicActive = false;
        document.querySelectorAll('.hud-card').forEach(c => c.classList.remove('seismic-bg'));
        set('term-status','■ RX/TX ACTIVE','var(--ok)');
        log('SYS_ALERT','Alerta sísmica finalizada. Daños: 0. Restaurando operaciones.','act');
        set('gal-valv','ABIERTAS (CAPTACIÓN)','var(--ai)');
        const b = $('alm-pcm-bar'); if(b) b.style.background = 'var(--alm)';

        NotificationCenter.success(
            'Alerta Sísmica Finalizada',
            'Sin daños detectados. Operaciones restauradas en ambos nodos. PCM y válvulas vuelven a estado nominal.',
            { source: 'SYS_ALERT' }
        );
    }, 15000);
}, 45000);
