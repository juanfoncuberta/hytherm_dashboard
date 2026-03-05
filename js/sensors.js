// ════════════════════════════════════════════════════════════
//  SENSORS — Hytherm v7
//  Carga CSVs locales. Sin proxies, sin Google Drive.
// ════════════════════════════════════════════════════════════

const Sensors = (() => {
    let data = { alm: [], gal: [] };
    let current = { alm: null, gal: null };
    let _cached = false;
    let _cacheTimestamp = null;

    // Rutas locales a los archivos
    const LOCAL_PATHS = {
        alm: 'data/hytherm_almeria_sensores.csv',
        gal: 'data/hytherm_coruna_sensores.csv'
    };

    const TEXT_FIELDS = ['timestamp','mof_state','battery_status','condensation_risk',
                         'pcm_mode','reflectivity_level','evap_cooling_status'];

    function parseCSV(text) {
        var lines = text.trim().replace(/\r/g, '').split('\n');
        var headers = lines[0].split(',').map(function(h) { return h.trim(); });
        var rows = [];
        for (var i = 1; i < lines.length; i++) {
            var vals = lines[i].split(',');
            if (vals.length < headers.length) continue;
            var row = {};
            for (var j = 0; j < headers.length; j++) {
                var h = headers[j];
                var v = (vals[j] || '').trim();
                if (TEXT_FIELDS.indexOf(h) !== -1) {
                    row[h] = v;
                } else {
                    var n = parseFloat(v);
                    row[h] = isNaN(n) ? v : n;
                }
            }
            rows.push(row);
        }
        return rows;
    }

    // Única función de fetch: Directo al archivo local
    async function fetchCSV(node) {
        var label = node === 'alm' ? 'ALMERIA' : 'A CORUNA';
        try {
            log('SENSORS', label + ': Cargando CSV local desde ' + LOCAL_PATHS[node], 'api');
            var res = await fetch(LOCAL_PATHS[node]);
            if (!res.ok) throw new Error(`HTTP ${res.status} al leer el archivo local.`);
            var text = await res.text();
            if (text && text.indexOf('timestamp') !== -1) return text;
            throw new Error('El archivo no tiene el formato correcto (falta la columna timestamp)');
        } catch(e) {
            throw new Error('Error local: ' + e.message + ' (Asegúrate de usar Live Server o un servidor local)');
        }
    }

    async function load(forceRefresh) {
        if (_cached && !forceRefresh) {
            log('SENSORS', 'Usando cache local (' + (data.alm.length + data.gal.length) + ' registros).', 'api');
            if (typeof Feed !== 'undefined') Feed.add('SENSORS', 'Cache activa: ' + data.alm.length + ' ALM + ' + data.gal.length + ' GAL', 'ok');
            applyToHUD('alm');
            applyToHUD('gal');
            _syncSimState();
            return;
        }

        log('SENSORS', 'Leyendo sensoria desde archivos CSV locales...', 'api');
        if (typeof Feed !== 'undefined') Feed.add('SENSORS', 'Leyendo archivos locales...', 'load');

        for (var ni = 0; ni < 2; ni++) {
            var node = ni === 0 ? 'alm' : 'gal';
            try {
                var text = await fetchCSV(node);
                var parsed = parseCSV(text);
                if (!parsed.length) throw new Error('CSV local vacío');

                data[node] = parsed;
                current[node] = parsed[parsed.length - 1];

                var label = node === 'alm' ? 'ALMERIA' : 'A CORUNA';
                var firstTs = parsed[0].timestamp || '?';
                var lastTs = current[node].timestamp || '?';

                log('SENSORS', label + ' OK: ' + parsed.length + ' registros leídos.', 'api');
                if (typeof Feed !== 'undefined') Feed.add('SENSORS', label + ': ' + parsed.length + ' registros', 'ok');

                _importToHistory(node, parsed);

            } catch (e) {
                log('SENSORS', 'Error leyendo ' + node + ': ' + e.message, 'warn');
                if (typeof Feed !== 'undefined') Feed.add('SENSORS', 'Error CSV ' + node + ': ' + e.message, 'err');
            }
        }

        applyToHUD('alm');
        applyToHUD('gal');
        _syncSimState();

        _cached = true;
        _cacheTimestamp = new Date();
    }

    function _importToHistory(node, rows) {
        if (typeof History === 'undefined') return;
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            History.addRaw({
                id: History.getAll().length + 1, time: new Date(row.timestamp), source: 'SENSORS', node: node,
                data: {
                    dekton: row.dekton_surface_temp_C, indoor_temp: row.indoor_temp_C, indoor_rh: row.indoor_rh_pct,
                    mof: row.mof_state, condensado: row.mof_condensado_L, seebeck: row.seebeck_power_W,
                    battery: row.battery_pct, batt_status: row.battery_status, dew_point: row.dew_point_C,
                    cond_risk: row.condensation_risk, pcm: row.pcm_melt_fraction_pct, pcm_mode: row.pcm_mode,
                    reflectivity: row.reflectivity_level, evap: row.evap_cooling_status
                }
            });
        }
    }

    function _syncSimState() {
        if (typeof sim === 'undefined') return;
        if (current.alm) {
            sim.data.alm.intT = current.alm.indoor_temp_C;
            sim.data.alm.pcm  = current.alm.pcm_melt_fraction_pct;
        }
        if (current.gal) {
            sim.data.gal.intT = current.gal.indoor_temp_C;
            sim.data.gal.pcm  = current.gal.pcm_melt_fraction_pct;
        }
    }

    function applyToHUD(node) {
        var d = current[node];
        if (!d) return;

        set(node + '-dekton', d.dekton_surface_temp_C.toFixed(1));
        set(node + '-dekton-delta', 'Gradiente ΔT: ' + Math.abs(d.dekton_surface_temp_C - d.indoor_temp_C).toFixed(1));
        set(node + '-int-t', d.indoor_temp_C.toFixed(1));
        set(node + '-int-rh', 'RH: ' + Math.round(d.indoor_rh_pct) + '%');
        set(node + '-mof', d.mof_state);
        set(node + '-mof-detail', 'Condensado: ' + d.mof_condensado_L.toFixed(1) + 'L');
        set(node + '-pwr', d.seebeck_power_W.toFixed(1));
        set(node + '-pwr-sub', d.seebeck_power_W.toFixed(1) + 'W (' + d.battery_status + ')');
        set(node + '-batt', Math.round(d.battery_pct));
        set(node + '-batt-status', d.battery_status);
        set(node + '-dew', d.dew_point_C.toFixed(1));
        set(node + '-dew-risk', 'Riesgo Cond.: ' + d.condensation_risk);

        var pcm = d.pcm_melt_fraction_pct;
        var pcmBar = $(node + '-pcm-bar');
        if (pcmBar) {
            pcmBar.style.width = pcm + '%';
            pcmBar.style.background = pcm < 20 ? 'var(--danger)' : pcm < 50 ? 'var(--warn)' : node === 'alm' ? 'var(--alm)' : 'var(--gal)';
        }
        set(node + '-pcm-st', Math.round(pcm) + '% ' + d.pcm_mode);
        set(node + '-ref', d.reflectivity_level);
        set(node + '-evap', d.evap_cooling_status);
    }

    return { load, applyToHUD, getCurrent: n => current[n], getData: n => data[n] };
})();