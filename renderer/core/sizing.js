'use strict';

/**
 * Returns the current viewport dimensions.
 * @returns {{ w: number, h: number }}
 */
function viewport() {
    return { w: window.innerWidth, h: window.innerHeight };
}

/**
 * Sets an element's width/height/minWidth/minHeight to fill the viewport.
 * @param {HTMLElement} el
 */
function sizeEl(el) {
    const { w, h } = viewport();
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.minWidth = w + 'px';
    el.style.minHeight = h + 'px';
}

/** Resizes all webviews in the pool to the current viewport. */
function sizeAll() {
    document.querySelectorAll('#pool webview').forEach(sizeEl);
}

// Keeps webviews correctly sized whenever the window is resized.
window.addEventListener('resize', sizeAll);

module.exports = { viewport, sizeEl, sizeAll };
