# Hytherm Dashboard — Cosentino

Dashboard de monitorización en tiempo real para el sistema **Hytherm** de Cosentino. Visualiza datos climáticos, energéticos y de riesgo en tiempo real para los nodos de **Almería** y **A Coruña**.

## 🚀 Demo

Publicado en GitHub Pages: `https://TU_USUARIO.github.io/hytherm_dashboard`

## 📡 APIs integradas

### Fase 1 — Sin API Key (activas)
| API | Datos | Estado |
|-----|-------|--------|
| [Open-Meteo](https://open-meteo.com) | Temperatura, humedad, viento, lluvia, previsión 7d | ✅ Activa |
| [NASA POWER](https://power.larc.nasa.gov) | Irradiancia solar W/m² | ✅ Activa |
| [REData (Red Eléctrica)](https://www.ree.es/es/apidatos) | Balance eléctrico nacional, renovables %, CO₂ estimado | ✅ Activa |
| [EFFIS via Open-Meteo](https://effis.jrc.ec.europa.eu) | Índice FWI de riesgo de incendio forestal | ✅ Activa |
| [EDO estimado](https://edo.jrc.ec.europa.eu) | Índice de sequía (balance hídrico 30d) | ✅ Activa |
| [GDACS](https://www.gdacs.org) | Alertas globales de desastres naturales | ✅ Activa |

### Fase 2 — Con API Key (pendiente configuración)
| API | Datos | Registro |
|-----|-------|----------|
| [AEMET OpenData](https://opendata.aemet.es) | Datos oficiales España, alertas meteorológicas | [Registro gratuito](https://opendata.aemet.es/centrodedescargas/altaUsuario) |
| [ENTSO-E](https://transparency.entsoe.eu) | Precio mayorista €/MWh, demanda real | [Registro gratuito](https://transparency.entsoe.eu/usrm/user/createPublicUser) |
| [Electricitymaps](https://electricitymaps.com) | Intensidad CO₂ gCO₂/kWh por zona | [Plan gratuito](https://api-portal.electricitymaps.com/) |

### Fase 3 — Pendiente (proxy necesario)
- **Copernicus EMS** — Alertas sísmicas e inundaciones
- **WRI Aqueduct** — Estrés hídrico por cuenca
- **EDO completo** — Índice oficial de sequía Europa

## ⚙️ Configuración

1. Clona el repositorio
2. Abre `config.js` y rellena las API keys que tengas:
```js
const HYTHERM_CONFIG = {
    AEMET_API_KEY: 'TU_CLAVE_AEMET',
    ENTSOE_API_KEY: 'TU_CLAVE_ENTSOE',
    ELECTRICITYMAPS_API_KEY: 'TU_CLAVE_ELECTRICITYMAPS',
    // ...
};
```
3. Abre `index.html` en el navegador o publica en GitHub Pages

## 🌐 Publicar en GitHub Pages

1. Ve a **Settings → Pages** en tu repositorio
2. En **Source**, selecciona `Deploy from a branch`
3. Selecciona la rama `main` y carpeta `/root`
4. Guarda — en ~2 minutos estará disponible en `https://TU_USUARIO.github.io/hytherm_dashboard`

## 📁 Estructura

```
hytherm_dashboard/
├── index.html          # Dashboard principal
├── config.js           # API keys (editar aquí)
├── css/
│   └── style.css       # Estilos
├── js/
│   ├── api-weather.js  # Open-Meteo + NASA POWER
│   ├── api-energy.js   # REData + ENTSO-E + Electricitymaps
│   ├── api-risk.js     # EFFIS + GDACS + EDO
│   ├── ui.js           # Actualización del DOM
│   └── main.js         # Orquestación principal
└── README.md
```

## 🔄 Actualización de datos

Los datos se actualizan automáticamente cada **10 minutos**. El precio de la electricidad fluctúa en tiempo real.

---

Desarrollado para el proyecto **Vital Shell — Advanced AI Twin** de Cosentino.
