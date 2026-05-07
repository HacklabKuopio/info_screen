'use strict';

const { loadConfig, normalizeItem } = require('./core/config');
const { getNav, setNavItems, sleepOrSkip, showNavIndicator, consumeJump } = require('./core/nav');
const { addToPool, hideAll, showPoolItem, overlayDiv } = require('./pool/pool');
const { mediaType } = require('./core/utils');
const { loadRssWidget }      = require('./widgets/rss');
const { loadAuroraWidget }   = require('./widgets/aurora');
const { loadEventsWidget }   = require('./widgets/events');
const { loadGoodNewsWidget } = require('./widgets/goodnews');

/**
 * Renders a widget-type playlist item into the overlay and makes the overlay visible.
 * @param {import('./core/config').PlaylistItem} item
 * @returns {Promise<void>}
 */
async function showWidget(item) {
    hideAll();
    const type = mediaType(item.src);
    if (type === 'rss')      await loadRssWidget(overlayDiv, item);
    if (type === 'aurora')   await loadAuroraWidget(overlayDiv);
    if (type === 'events')   await loadEventsWidget(overlayDiv);
    if (type === 'goodnews') await loadGoodNewsWidget(overlayDiv);
    overlayDiv.classList.add('active');
}

/** Main playlist loop. Re-reads config on every iteration to support hot-reload of playlist.json. */
async function run() {
    let config = loadConfig();
    setNavItems(config.items.map(normalizeItem));

    const nav = getNav();

    if (nav.items.length === 0) {
        document.body.innerHTML = '<p style="color:#555;font-family:sans-serif;margin:40px;font-size:1.2rem">No playlist — run <code>npm start</code> to launch in Electron.</p>';
        return;
    }

    // Preload all URL/YouTube items into the webview pool immediately.
    nav.items.forEach(addToPool);

    while (true) {
        // Re-read config each loop so changes to playlist.json take effect on the next item.
        try {
            config = loadConfig();
            setNavItems(config.items.map(normalizeItem));
            nav.items.forEach(addToPool);
        } catch (_) { }

        const item = nav.items[nav.idx];
        showNavIndicator();

        const type = mediaType(item.src);
        try {
            if (type === 'url' || type === 'youtube') {
                showPoolItem(item);
            } else {
                await showWidget(item);
            }
        } catch (e) {
            console.error('Error showing item:', item.src, e.message);
        }

        await sleepOrSkip(item.duration || config.interval || 10000);

        const jump = consumeJump();
        if (jump !== null) {
            nav.idx = jump;
        } else {
            nav.idx = (nav.idx + 1) % nav.items.length;
        }
    }
}

run().catch(console.error);
