'use strict';

/**
 * @typedef {import('./config').PlaylistItem} PlaylistItem
 */

const navEl = document.getElementById('nav-indicator');

/** @type {{ idx: number, items: PlaylistItem[], skip: (()=>void)|null, jumpTo: number|null }} */
const nav = { idx: 0, items: [], skip: null, jumpTo: null };

let navHideTimer = null;

/** Shows the "X / N" position overlay for 2 seconds. */
function showNavIndicator() {
    navEl.textContent = `${nav.idx + 1} / ${nav.items.length}`;
    navEl.classList.add('visible');
    clearTimeout(navHideTimer);
    navHideTimer = setTimeout(() => navEl.classList.remove('visible'), 2000);
}

/**
 * Sleeps for `ms` milliseconds, but resolves early if the user presses
 * an arrow key (which calls nav.skip). Assigns nav.skip for the duration.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleepOrSkip(ms) {
    return new Promise((resolve) => {
        const t = setTimeout(() => {
            nav.skip = null;
            resolve();
        }, ms);
        nav.skip = () => {
            clearTimeout(t);
            nav.skip = null;
            resolve();
        };
    });
}

/** @returns {{ idx: number, items: PlaylistItem[], skip: (()=>void)|null, jumpTo: number|null }} */
function getNav() { return nav; }

/**
 * Replaces the playlist items in nav state.
 * @param {PlaylistItem[]} items
 */
function setNavItems(items) { nav.items = items; }

/**
 * Returns the pending jump index and clears it atomically.
 * @returns {number|null}
 */
function consumeJump() {
    const j = nav.jumpTo;
    nav.jumpTo = null;
    return j;
}

// Arrow key navigation: right skips forward, left jumps back one item.
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' && nav.skip) {
        nav.skip();
    }
    if (e.key === 'ArrowLeft' && nav.items.length > 0) {
        nav.jumpTo = (nav.idx - 1 + nav.items.length) % nav.items.length;
        if (nav.skip) nav.skip();
    }
});

module.exports = { getNav, setNavItems, sleepOrSkip, showNavIndicator, consumeJump };
