'use strict';

const { nodeFetch, esc } = require('../core/utils');

/**
 * Maps a Kp-index value (0–9) to a CSS hex colour on a green→purple scale.
 * @param {number} kp
 * @returns {string} Hex colour string e.g. '#22c55e'
 */
function kpColor(kp) {
    if (kp < 2) return '#22c55e';
    if (kp < 4) return '#84cc16';
    if (kp < 5) return '#eab308';
    if (kp < 6) return '#f97316';
    if (kp < 7) return '#ef4444';
    return '#a855f7';
}

/**
 * Returns the Finnish geomagnetic storm level label for a Kp-index value.
 * @param {number} kp
 * @returns {string}
 */
function kpStormLevel(kp) {
    if (kp < 4) return 'Rauhallinen';
    if (kp < 5) return 'Epärauhallinen';
    if (kp < 6) return 'G1 – Pieni myrsky';
    if (kp < 7) return 'G2 – Kohtalainen myrsky';
    if (kp < 8) return 'G3 – Voimakas myrsky';
    if (kp < 9) return 'G4 – Ankara myrsky';
    return 'G5 – Äärimmäinen myrsky';
}

/** Finnish cities with the minimum Kp-index at which aurora is typically visible. */
const AURORA_CITIES = [
    { name: 'Utsjoki (70°N)',   minKp: 0 },
    { name: 'Rovaniemi (67°N)', minKp: 3 },
    { name: 'Oulu (65°N)',      minKp: 5 },
    { name: 'Kuopio (63°N)',    minKp: 6 },
    { name: 'Tampere (61°N)',   minKp: 7 },
    { name: 'Helsinki (60°N)',  minKp: 7.5 },
];

/**
 * Fetches the NOAA aurora forecast and renders the widget into the overlay.
 * Shows current Kp-index, gauge, 48-hour history bars, and per-city visibility.
 *
 * @param {HTMLElement} overlayDiv
 * @returns {Promise<void>}
 */
async function loadAuroraWidget(overlayDiv) {
    const el = document.createElement('div');
    el.className = 'aurora-widget';
    overlayDiv.appendChild(el);

    try {
        const [rNow, rHist] = await Promise.all([
            nodeFetch('https://services.swpc.noaa.gov/json/planetary_k_index_1m.json'),
            nodeFetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'),
        ]);

        const kp = parseFloat(JSON.parse(rNow).at(-1)[1]);
        const histArr = JSON.parse(rHist).slice(1);
        const color = kpColor(kp);
        const gaugeW = Math.min((kp / 9) * 100, 100).toFixed(1);
        const now = new Date().toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });

        const bars = histArr.slice(-16).map((r) => {
            const v = parseFloat(r[1]);
            const h = Math.max(4, Math.round((v / 9) * 100));
            return `<div style="flex:1;height:${h}%;background:${kpColor(v)};border-radius:3px 3px 0 0;align-self:flex-end;opacity:.85"></div>`;
        }).join('');

        el.innerHTML = `
          <div class="aurora-header">
            <span class="aurora-title">🌌 Revontuliennuste</span>
            <span class="aurora-time">${esc(now)}</span>
          </div>
          <div class="aurora-body">
            <div class="aurora-left">
              <div class="aurora-kp-num" style="color:${color}">${kp.toFixed(1)}</div>
              <div class="aurora-kp-sub">Kp-indeksi</div>
              <div class="aurora-storm" style="color:${color}">${esc(kpStormLevel(kp))}</div>
              <div class="aurora-gauge-track"><div class="aurora-gauge-fill" style="width:${gaugeW}%;background:${color}"></div></div>
              <div class="aurora-gauge-ticks"><span>0</span><span>3</span><span>5</span><span>7</span><span>9</span></div>
              <div class="aurora-history-label">Viimeinen 48h</div>
              <div class="aurora-bars">${bars}</div>
            </div>
            <div class="aurora-right">
              <div class="aurora-vis-title">Näkyvyys tänä yönä</div>
              ${AURORA_CITIES.map((c) => `<div class="aurora-city">
                <span class="aurora-city-name">${esc(c.name)}</span>
                <span style="color:${kp >= c.minKp ? '#22c55e' : '#223040'};font-weight:600">${kp >= c.minKp ? '✓ Mahdollinen' : '✗ Ei näy'}</span>
              </div>`).join('')}
            </div>
          </div>`;
    } catch (e) {
        el.innerHTML = `<div style="color:#334;padding:48px">Revontulidata ei saatavilla: ${esc(e.message)}</div>`;
    }
}

module.exports = { loadAuroraWidget, kpColor, kpStormLevel };
