// ════════════════════════════════════════════════════════════
//  SENSORS — Hytherm v7
//  Carga CSVs con fallback: Google Sheets pub → proxy GDrive → local
//  Cache en memoria, importa historico a History
// ════════════════════════════════════════════════════════════

const Sensors = (() => {
    let data = { alm: [], gal: [] };
    let current = { alm: null, gal: null };
    let _cached = false;
    let _cacheTimestamp = null;

    // ── URLS: pon aqui tus URLs de Google Sheets "Publicar en la web" como CSV
    //    Si no tienes, deja vacio y usara el fallback de proxy GDrive o local
    const GSHEETS_PUB = {
        alm: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTc6A_vmY3k_7bOhOqZC4LCpx200LFcnHlfGgh6rNmdEbQgXj84BX2NMQA6GLYgVtVuEjToydEXP0dE/pub?output=csv',  // Pega aqui: https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?output=csv
        gal: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQr_G5drqy6ci_flJtjQSRhspDoRDGKab0MffFbG6T-yC_QuDVpKNNrJOtaBjk83DBUFtbDW8ZQV6IR/pub?output=csv'   // Pega aqui: https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?output=csv
    };

    // Fallback: Google Drive direct download via proxy
    const GDRIVE_IDS = {
        alm: '1Q0MBF5F2vcs_rMDLcyLxIGf-2xocf8lv',
        gal: '1pttm1ag7KyuZ-ouS2536EX9PNsRDkeFl'
    };

    // Fallback local
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

    // Intentar descargar CSV con fallback
    async function fetchCSV(node) {
        var label = node === 'alm' ? 'ALMERIA' : 'A CORUNA';

        // 1) Google Sheets publicado (sin CORS, directo)
        if (GSHEETS_PUB[node]) {
            try {
                log('SENSORS', label + ': Intentando Google Sheets pub...', 'api');
                var r1 = await fetch(GSHEETS_PUB[node]);
                if (r1.ok) {
                    var t1 = await r1.text();
                    if (t1 && t1.indexOf('timestamp') !== -1) return t1;
                }
            } catch(e) { /* fallback */ }
        }

        // 2) Google Drive via proxy allorigins
        try {
            log('SENSORS', label + ': Intentando Google Drive via proxy...', 'api');
            var driveUrl = 'https://drive.google.com/uc?export=download&id=' + GDRIVE_IDS[node];
            var r2 = await fetch(PROXY_RAW + encodeURIComponent(driveUrl));
            if (r2.ok) {
                var t2 = await r2.text();
                if (t2 && t2.indexOf('timestamp') !== -1) return t2;
            }
        } catch(e) { /* fallback */ }

        // 3) Google Drive via proxy corsproxy.io
        try {
            log('SENSORS', label + ': Intentando proxy alternativo...', 'api');
            var driveUrl2 = 'https://drive.google.com/uc?export=download&id=' + GDRIVE_IDS[node];
            var r3 = await fetch('https://corsproxy.io/?' + encodeURIComponent(driveUrl2));
            if (r3.ok) {
                var t3 = await r3.text();
                if (t3 && t3.indexOf('timestamp') !== -1) return t3;
            }
        } catch(e) { /* fallback */ }

        // 4) Archivo local
        try {
            log('SENSORS', label + ': Cargando CSV local...', 'api');
            var r4 = await fetch(LOCAL_PATHS[node]);
            if (r4.ok) {
                var t4 = await r4.text();
                if (t4 && t4.indexOf('timestamp') !== -1) return t4;
            }
        } catch(e) { /* nada */ }

        throw new Error('No se pudo obtener CSV de ninguna fuente');
    }

    async function load(forceRefresh) {
        if (_cached && !forceRefresh) {
            log('SENSORS', 'Usando cache (' + (data.alm.length + data.gal.length) + ' registros). Cargado: ' + _cacheTimestamp.toLocaleTimeString('es-ES'), 'api');
            Feed.add('SENSORS', 'Cache activa: ' + data.alm.length + ' ALM + ' + data.gal.length + ' GAL', 'ok');
            applyToHUD('alm');
            applyToHUD('gal');
            _syncSimState();
            return;
        }

        log('SENSORS', forceRefresh ? 'Refrescando CSVs...' : 'Carga inicial de sensoria...', 'api');
        Feed.add('SENSORS', 'Descargando CSVs...', 'load');

        for (var ni = 0; ni < 2; ni++) {
            var node = ni === 0 ? 'alm' : 'gal';
            try {
                var text = await fetchCSV(node);
                var parsed = parseCSV(text);
                if (!parsed.length) throw new Error('CSV vacio');

                data[node] = parsed;
                current[node] = parsed[parsed.length - 1];

                var label = node === 'alm' ? 'ALMERIA' : 'A CORUNA';
                var firstTs = parsed[0].timestamp || '?';
                var lastTs = current[node].timestamp || '?';

                log('SENSORS', label + ' OK: ' + parsed.length + ' registros. ' + firstTs + ' -> ' + lastTs, 'api');
                Feed.add('SENSORS', label + ': ' + parsed.length + ' registros (' + firstTs.split(' ')[0] + ' -> ' + lastTs.split(' ')[0] + ')', 'ok');

                _importToHistory(node, parsed);

            } catch (e) {
                log('SENSORS', 'Error CSV ' + node + ': ' + e.message, 'warn');
                Feed.add('SENSORS', 'Error CSV ' + node + ': ' + e.message, 'err');
                Notif.warning('Sensoria no disponible',
                    'No se pudo cargar CSV de ' + (node === 'alm' ? 'Almeria' : 'A Coruna') + '. ' + (_cached ? 'Usando cache.' : 'Valores por defecto.'),
                    { source: 'SENSORS' });
            }
        }

        applyToHUD('alm');
        applyToHUD('gal');
        _syncSimState();

        _cached = true;
        _cacheTimestamp = new Date();

        var total = data.alm.length + data.gal.length;
        Notif.info('Sensoria Cargada',
            total + ' registros en cache. ALM: ' + data.alm.length + ' | GAL: ' + data.gal.length,
            { source: 'SENSORS', autoDismiss: true, dismissMs: 15000 });
    }

    function _importToHistory(node, rows) {
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            History.addRaw({
                id: History.getAll().length + 1,
                time: new Date(row.timestamp),
                source: 'SENSORS',
                node: node,
                data: {
                    dekton: row.dekton_surface_temp_C,
                    indoor_temp: row.indoor_temp_C,
                    indoor_rh: row.indoor_rh_pct,
                    mof: row.mof_state,
                    condensado: row.mof_condensado_L,
                    seebeck: row.seebeck_power_W,
                    battery: row.battery_pct,
                    batt_status: row.battery_status,
                    dew_point: row.dew_point_C,
                    cond_risk: row.condensation_risk,
                    pcm: row.pcm_melt_fraction_pct,
                    pcm_mode: row.pcm_mode,
                    reflectivity: row.reflectivity_level,
                    evap: row.evap_cooling_status,
                    ext_temp: row.ext_temp_C,
                    ext_rh: row.ext_rh_pct,
                    wind: row.wind_kmh,
                    irradiance: row.irradiance_Wm2,
                    uv: row.uv_index,
                    pressure: row.pressure_hPa,
                    rain: row.precipitation_mm,
                    clouds: row.cloud_cover_pct
                }
            });
        }
    }

    function _syncSimState() {
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
    }

    function applyToHUD(node) {
        var d = current[node];
        if (!d) return;

        set(node + '-dekton', d.dekton_surface_temp_C.toFixed(1));
        set(node + '-dekton-delta', 'Gradiente \u0394T: ' + Math.abs(d.dekton_surface_temp_C - d.indoor_temp_C).toFixed(1));
        set(node + '-int-t', d.indoor_temp_C.toFixed(1));
        set(node + '-int-rh', 'RH: ' + Math.round(d.indoor_rh_pct) + '%');
        set(node + '-mof', d.mof_state);
        set(node + '-mof-detail', 'Condensado: ' + d.mof_condensado_L.toFixed(1) + 'L');
        set(node + '-pwr', d.seebeck_power_W.toFixed(1));
        set(node + '-pwr-sub', d.seebeck_power_W.toFixed(1) + 'W ' + (d.seebeck_power_W > 0.5 ? 'Generando' : 'Minimo'));
        set(node + '-batt', Math.round(d.battery_pct));
        set(node + '-batt-status', d.battery_status);
        set(node + '-dew', d.dew_point_C.toFixed(1));
        set(node + '-dew-risk', 'Riesgo Cond.: ' + d.condensation_risk);

        var battEl = $(node + '-batt-status');
        if (battEl) {
            if (d.battery_pct > 70) battEl.style.color = 'var(--ok)';
            else if (d.battery_pct > 40) battEl.style.color = 'var(--ai)';
            else battEl.style.color = 'var(--warn)';
        }

        var dewRiskEl = $(node + '-dew-risk');
        if (dewRiskEl) {
            if (d.condensation_risk === 'Alto') dewRiskEl.style.color = 'var(--danger)';
            else if (d.condensation_risk === 'Medio') dewRiskEl.style.color = 'var(--warn)';
            else dewRiskEl.style.color = 'var(--ok)';
        }

        var pcm = d.pcm_melt_fraction_pct;
        var pcmBar = $(node + '-pcm-bar');
        if (pcmBar) {
            pcmBar.style.width = pcm + '%';
            pcmBar.style.background = pcm < 20 ? 'var(--danger)' : pcm < 50 ? 'var(--warn)' : node === 'alm' ? 'var(--alm)' : 'var(--gal)';
        }
        set(node + '-pcm-st', Math.round(pcm) + '% ' + d.pcm_mode);

        set(node + '-ref', d.reflectivity_level);
        var refEl = $(node + '-ref');
        if (refEl) {
            if (d.reflectivity_level && d.reflectivity_level.indexOf('ALTA') !== -1) refEl.style.color = 'var(--ai)';
            else if (d.reflectivity_level && d.reflectivity_level.indexOf('MEDIA') !== -1) refEl.style.color = 'var(--ok)';
            else refEl.style.color = 'var(--muted)';
        }

        set(node + '-evap', d.evap_cooling_status);
        var evapEl = $(node + '-evap');
        if (evapEl) evapEl.style.color = d.evap_cooling_status === 'ACTIVO' ? 'var(--ok)' : 'var(--muted)';
    }

    return {
        load: load,
        applyToHUD: applyToHUD,
        getCurrent: function(node) { return current[node]; },
        getData: function(node) { return data[node]; },
        isCached: function() { return _cached; },
        getCacheTime: function() { return _cacheTimestamp; }
    };
})();
