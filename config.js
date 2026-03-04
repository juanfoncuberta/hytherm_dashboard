// ════════════════════════════════════════════════════════════
//  HYTHERM CORE v6.0 — CONFIG
// ════════════════════════════════════════════════════════════
const CFG = {
    AEMET_API_KEY: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJqZm9uY3ViZXJ0YUBtaWIuaXNkaS5lcyIsImp0aSI6IjY4MmJmMmY4LTMzMDctNDExNi1hMTNhLWQ0ZDI5ZGI2Nzc2OSIsImlzcyI6IkFFTUVUIiwiaWF0IjoxNzcyNjQ5NTA1LCJ1c2VySWQiOiI2ODJiZjJmOC0zMzA3LTQxMTYtYTEzYS1kNGQyOWRiNjc3NjkiLCJyb2xlIjoiIn0.5pE5WJOxJcrIgj1dR7CnHwsRAjBJdUV6bn94ch2OFbE',
    ELECTRICITYMAPS_API_KEY: '', // añadir cuando llegue
    NODES: {
        alm: { lat: 36.8381, lon: -2.4597, label: 'ALMERÍA',  estacion: '6325O', municipio: '04013', zona: '61' },
        gal: { lat: 43.3623, lon: -8.4115, label: 'A CORUÑA', estacion: '1387',  municipio: '15030', zona: '72' }
    }
};

const PROXY     = 'https://api.allorigins.win/get?url=';
const PROXY_RAW = 'https://api.allorigins.win/raw?url=';
