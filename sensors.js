// ════════════════════════════════════════════════════════════
//  SENSORS — Hytherm v7
//  Carga CSVs de sensoría interna y aplica datos al HUD
//  Los CSVs se sirven localmente desde /data/
// ════════════════════════════════════════════════════════════

const Sensors = (() => {
    let data = { alm: [], gal: [] };
    let current = { alm: null, gal: null };

    const CSV_PATHS = {
        alm: 'https://drive.google.com/uc?export=download&id=1Q0MBF5F2vcs_rMDLcyLxIGf-2xocf8lv',
        gal: 'https://drive.google.com/uc?export=download&id=1pttm1ag7KyuZ-ouS2536EX9PNsRDkeFl'
    };

    // ── Parsear CSV ──
    function parseCSV(text) {
        const lines = text.trim().replace(/\r/g, '').split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const rows = [];
        // Campos que siempre son texto (no parsear como número)
        const textFields = ['timestamp','mof_state','battery_status','condensation_risk','pcm_mode','reflectivity_level','evap_cooling_status'];
        
        for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split(',');
            if (vals.length < headers.length) continue;
            const row = {};
            headers.forEach((h, j) => {
                const v = (vals[j] || '').trim();
                if (textFields.includes(h)) {
                    row[h] = v;
                } else {
                    const n = parseFloat(v);
                    row[h] = isNaN(n) ? v : n;
                }
            });
            rows.push(row);
        }
        return rows;
    }

    // ── Cargar ambos CSVs ──
    async function load() {
        log('SENSORS', 'Cargando sensoría interna desde CSVs...', 'api');
        Feed.add('SENSORS', 'Cargando datos históricos de sensoría...', 'load');

        for (const node of ['alm', 'gal']) {
            try {
                const csvUrl = CSV_PATHS[node];
                const res = await fetch(`${PROXY_RAW}${encodeURIComponent(csvUrl)}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const text = await res.text();
                data[node] = parseCSV(text);

                if (!data[node].length) {
                    throw new Error('CSV vacío o sin filas válidas');
                }

                // Último registro = estado actual
                current[node] = data[node][data[node].length - 1];

                const label = node === 'alm' ? 'ALMERÍA' : 'A CORUÑA';
                const firstTs = data[node][0].timestamp || '?';
                const lastTs  = current[node].timestamp || '?';
                log('SENSORS', `${label} → ${data[node].length} registros cargados. Último: ${lastTs}`, 'api');
                Feed.add('SENSORS', `${label}: ${data[node].length} registros (${firstTs.split(' ')[0]} → ${lastTs.split(' ')[0]})`, 'ok');

                // Guardar en historial
                History.add('SENSORS', node, {
                    records: data[node].length,
                    latest: current[node].timestamp,
                    dekton: current[node].dekton_surface_temp_C,
                    indoor: current[node].indoor_temp_C,
                    battery: current[node].battery_pct
                });

            } catch (e) {
                log('SENSORS', `Error cargando CSV ${node}: ${e.message}`, 'warn');
                Feed.add('SENSORS', `Error CSV ${node}: ${e.message}`, 'err');
                Notif.warning('Sensoría no disponible',
                    `No se pudo cargar el CSV de ${node === 'alm' ? 'Almería' : 'A Coruña'}. Usando valores por defecto.`,
                    { source: 'SENSORS' });
            }
        }

        // Aplicar al HUD
        applyToHUD('alm');
        applyToHUD('gal');

        // Actualizar estado global de simulación con datos reales
        if (current.alm) {
            sim.data.alm.extT = current.alm.ext_temp_C;
            sim.data.alm.intT = current.alm.indoor_temp_C;
            sim.data.alm.pcm  = current.alm.pcm_melt_fraction_pct;
            sim.data.alm.irr  = current.alm.irradiance_Wm2;
        }
        if (current.gal) {
            sim.data.gal.extT = current.gal.ext_temp_C;
            sim.data.gal.intT = current.gal.indoor_temp_C;
            sim.data.gal.pcm  = current.gal.pcm_melt_fraction_pct;
            sim.data.gal.irr  = current.gal.irradiance_Wm2;
        }

        Notif.info('Sensoría Cargada',
            `ALM: ${data.alm.length} registros | GAL: ${data.gal.length} registros. Telemetría interna activa.`,
            { source: 'SENSORS', autoDismiss: true, dismissMs: 15000 });
    }

    // ── Aplicar último registro al HUD de un nodo ──
    function applyToHUD(node) {
        const d = current[node];
        if (!d) return;

        // Telemetría interna
        set(`${node}-dekton`, d.dekton_surface_temp_C?.toFixed(1));
        set(`${node}-dekton-delta`, `Gradiente ΔT: ${Math.abs(d.dekton_surface_temp_C - d.indoor_temp_C).toFixed(1)}`);
        set(`${node}-int-t`, d.indoor_temp_C?.toFixed(1));
        set(`${node}-int-rh`, `RH: ${Math.round(d.indoor_rh_pct)}%`);
        set(`${node}-mof`, d.mof_state);
        set(`${node}-mof-detail`, `Condensado: ${d.mof_condensado_L?.toFixed(1)}L`);
        set(`${node}-pwr`, d.seebeck_power_W?.toFixed(1));
        set(`${node}-pwr-sub`, `${d.seebeck_power_W?.toFixed(1)}W ${d.seebeck_power_W > 0.5 ? 'Generando' : 'Mínimo'}`);
        set(`${node}-batt`, Math.round(d.battery_pct));
        set(`${node}-batt-status`, d.battery_status);
        set(`${node}-dew`, d.dew_point_C?.toFixed(1));
        set(`${node}-dew-risk`, `Riesgo Cond.: ${d.condensation_risk}`);

        // Colorear batería
        const battEl = $(`${node}-batt-status`);
        if (battEl) {
            if (d.battery_pct > 70) battEl.style.color = 'var(--ok)';
            else if (d.battery_pct > 40) battEl.style.color = 'var(--ai)';
            else battEl.style.color = 'var(--warn)';
        }

        // Colorear condensación
        const dewRiskEl = $(`${node}-dew-risk`);
        if (dewRiskEl) {
            if (d.condensation_risk === 'Alto') dewRiskEl.style.color = 'var(--danger)';
            else if (d.condensation_risk === 'Medio') dewRiskEl.style.color = 'var(--warn)';
            else dewRiskEl.style.color = 'var(--ok)';
        }

        // Actuadores
        // PCM
        const pcm = d.pcm_melt_fraction_pct;
        const pcmBar = $(`${node}-pcm-bar`);
        if (pcmBar) {
            pcmBar.style.width = `${pcm}%`;
            pcmBar.style.background = pcm < 20 ? 'var(--danger)' : pcm < 50 ? 'var(--warn)' : node === 'alm' ? 'var(--alm)' : 'var(--gal)';
        }
        set(`${node}-pcm-st`, `${Math.round(pcm)}% ${d.pcm_mode}`);

        // Reflectividad
        set(`${node}-ref`, d.reflectivity_level);
        const refEl = $(`${node}-ref`);
        if (refEl) {
            if (d.reflectivity_level?.includes('ALTA')) refEl.style.color = 'var(--ai)';
            else if (d.reflectivity_level?.includes('MEDIA')) refEl.style.color = 'var(--ok)';
            else refEl.style.color = 'var(--muted)';
        }

        // Evaporativo
        set(`${node}-evap`, d.evap_cooling_status);
        const evapEl = $(`${node}-evap`);
        if (evapEl) evapEl.style.color = d.evap_cooling_status === 'ACTIVO' ? 'var(--ok)' : 'var(--muted)';
    }

    // ── Obtener dato actual de un nodo ──
    function getCurrent(node) { return current[node]; }
    function getData(node) { return data[node]; }
    function getAll() { return data; }

    return { load, applyToHUD, getCurrent, getData, getAll };
})();
