'use strict';

const { sizeEl } = require('../core/sizing');
const { mediaType, COOKIE_CONSENT_JS } = require('../core/utils');

const poolDiv = document.getElementById('pool');
const overlayDiv = document.getElementById('overlay');

/** @type {Record<string, Electron.WebviewTag>} src → webview element */
const pool = {};

/** @type {Electron.WebviewTag|null} */
let activeWv = null;

/**
 * Adds a URL or YouTube item to the preload pool (creates a hidden webview).
 * No-ops if the item type is not 'url'/'youtube', or if already pooled.
 * @param {import('../core/config').PlaylistItem} item
 */
function addToPool(item) {
    const type = mediaType(item.src);
    if (type !== 'url' && type !== 'youtube') return;
    if (pool[item.src]) return;

    const wv = /** @type {Electron.WebviewTag} */ (document.createElement('webview'));
    sizeEl(wv);
    wv.setAttribute('partition', 'persist:signage');
    wv.setAttribute('allowfullscreen', 'true');
    wv.setAttribute('allowpopups', 'false');

    let src = item.src;
    if (type === 'youtube') {
        try {
            const u = new URL(item.src);
            u.searchParams.set('autoplay', '1');
            src = u.toString();
        } catch (_) { }
        wv.setAttribute(
            'useragent',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        );
    }

    wv.addEventListener('did-finish-load', () => {
        sizeEl(wv);
        if (item.zoom) {
            wv.executeJavaScript(`document.body.style.zoom='${item.zoom}'`).catch(() => { });
        }
        wv.executeJavaScript(COOKIE_CONSENT_JS).catch(() => { });
    });

    poolDiv.appendChild(wv);
    wv.src = src;
    pool[item.src] = wv;
    console.log('[pool] loading', src);
}

/** Hides the currently active webview and clears the overlay. */
function hideAll() {
    if (activeWv) {
        activeWv.classList.remove('active');
        activeWv = null;
    }
    overlayDiv.classList.remove('active');
    overlayDiv.innerHTML = '';
}

/**
 * Makes the pooled webview for this item visible.
 * @param {import('../core/config').PlaylistItem} item
 */
function showPoolItem(item) {
    hideAll();
    const wv = pool[item.src];
    if (!wv) return;
    wv.classList.add('active');
    activeWv = wv;
}

// Reload all webviews every 5 minutes to keep content fresh.
setInterval(() => {
    Object.entries(pool).forEach(([src, wv]) => {
        console.log('[pool] reloading', src);
        try { wv.reload(); } catch (_) { }
    });
}, 5 * 60 * 1000);

module.exports = { addToPool, hideAll, showPoolItem, overlayDiv };
