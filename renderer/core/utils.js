'use strict';

// Cookie consent JS injected into every webview after page load.
// Tries to click "reject all" first, falls back to "accept all", retries twice on delay.
const COOKIE_CONSENT_JS = `
  (function () {
    function tryDismiss() {
      const els = [...document.querySelectorAll('button,[role="button"]')];
      const btn = els.find(e => /vain välttämättömät|reject all|only (necessary|essential)|decline all|ablehnen|weiger/i.test(e.textContent))
               || els.find(e => /hyväksy kaikki|accept all|alle akzeptieren|tout accepter|agree to all/i.test(e.textContent));
      if (btn) { btn.click(); return true; } return false;
    }
    if (!tryDismiss()) { setTimeout(tryDismiss, 1500); setTimeout(tryDismiss, 4000); }
  })();
`;

/**
 * Escapes a value for safe insertion into innerHTML.
 * @param {unknown} s
 * @returns {string}
 */
function esc(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Formats a date string as a localized Finnish short date+time.
 * @param {string} s - ISO or RFC date string
 * @returns {string}
 */
function fmtDate(s) {
    try {
        return new Date(s).toLocaleString('fi-FI', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch (_) {
        return s;
    }
}

/**
 * Returns true if the URL is a YouTube watch or short URL.
 * @param {string} src
 * @returns {boolean}
 */
function isYouTubeUrl(src) {
    try {
        const h = new URL(src).hostname.toLowerCase();
        return h === 'youtu.be' || h.endsWith('youtube.com');
    } catch (_) {
        return false;
    }
}

/**
 * Classifies a playlist item src string into a display type.
 * @param {string} src
 * @returns {'aurora'|'events'|'goodnews'|'youtube'|'rss'|'url'|'image'|'video'}
 */
function mediaType(src) {
    if (src.startsWith('aurora:')) return 'aurora';
    if (src.startsWith('events:')) return 'events';
    if (src.startsWith('goodnews:')) return 'goodnews';
    if (/^https?:\/\//i.test(src)) {
        try {
            const u = new URL(src);
            if (isYouTubeUrl(src)) return 'youtube';
            if (
                /\.(rss|atom)(\?|$)/i.test(u.pathname) ||
                u.pathname.includes('/rss') ||
                u.hostname.startsWith('feeds.') ||
                u.hostname.includes('rss')
            ) return 'rss';
        } catch (_) { }
        return 'url';
    }
    if (/\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(src)) return 'image';
    if (/\.(mp4|webm|ogg|mov|avi)$/i.test(src)) return 'video';
    return 'url';
}

/**
 * Fetches a URL via Node's http/https module. Follows one redirect.
 * Supports optional POST body and custom headers.
 *
 * @param {string} url
 * @param {{ method?: string, body?: string, headers?: Record<string, string> }} [options]
 * @returns {Promise<string>} Raw response body as a UTF-8 string
 */
function nodeFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const mod = require(url.startsWith('https') ? 'https' : 'http');
        const method = options.method || 'GET';
        const body = options.body || null;

        const reqOptions = {
            method,
            headers: {
                'User-Agent': 'Mozilla/5.0',
                Accept: 'application/rss+xml,application/xml,text/xml,*/*',
                'Accept-Encoding': 'identity',
                ...(options.headers || {}),
            },
        };

        const req = mod.request(new URL(url), reqOptions, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                resolve(nodeFetch(new URL(res.headers.location, url).toString(), options));
                return;
            }
            let data = '';
            res.setEncoding('utf8');
            res.on('data', (c) => { data += c; });
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

module.exports = { esc, fmtDate, isYouTubeUrl, mediaType, nodeFetch, COOKIE_CONSENT_JS };
