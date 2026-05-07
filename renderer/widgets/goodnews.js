'use strict';

const { nodeFetch, esc, fmtDate } = require('../core/utils');
const { getGeminiApiKey } = require('../core/config');

const GOOD_NEWS_CACHE_KEY = 'goodnews_cache';
const GOOD_NEWS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/** @typedef {{ title: string, source: string, date: string }} NewsItem */

/** RSS sources scanned for good news. */
const GOOD_NEWS_SOURCES = [
    { url: 'https://hnrss.org/frontpage',                label: 'Hacker News' },
    { url: 'https://yle.fi/rss/uutiset/paauutiset',      label: 'Yle' },
    { url: 'https://yle.fi/rss/uutiset/tuoreimmat',      label: 'Yle' },
    { url: 'https://yle.fi/rss/t/18-141764/fi',          label: 'Yle' },
    { url: 'https://www.hs.fi/rss/teasers/etusivu.xml',  label: 'HS' },
    { url: 'https://www.hs.fi/rss/tuoreimmat.xml',       label: 'HS' },
    { url: 'https://www.savonsanomat.fi/feed/rss',       label: 'Savon Sanomat' },
];

/**
 * Posts a JSON body to the Gemini generateContent API and returns the raw response string.
 * Reuses nodeFetch's POST support instead of duplicating http.request boilerplate.
 *
 * @param {string} apiKey
 * @param {string} model  e.g. 'gemini-3-flash-preview'
 * @param {object} requestBody
 * @returns {Promise<string>}
 */
function geminiPost(apiKey, model, requestBody) {
    const bodyStr = JSON.stringify(requestBody);
    return nodeFetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            body: bodyStr,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': String(Buffer.byteLength(bodyStr)),
            },
        }
    );
}

/**
 * Fetches the 10 most recent headlines from each source in parallel.
 * Sources that fail are silently skipped.
 * @returns {Promise<NewsItem[]>}
 */
async function fetchAllNewsItems() {
    const results = await Promise.allSettled(
        GOOD_NEWS_SOURCES.map(async ({ url, label }) => {
            const text = await nodeFetch(url);
            const xml = new DOMParser().parseFromString(text, 'application/xml');
            return [...xml.querySelectorAll('item')].slice(0, 10).map((el) => ({
                title: el.querySelector('title')?.textContent?.trim() || '',
                source: label,
                date: fmtDate(el.querySelector('pubDate')?.textContent || ''),
            }));
        })
    );
    return results.flatMap((r) => r.status === 'fulfilled' ? r.value : []);
}

/**
 * Heuristic scorer for headlines when the Gemini API is unavailable.
 * Returns a positive score for uplifting Finnish/English words, negative for negative ones.
 * @param {string} title
 * @returns {number}
 */
function scoreGoodNewsHeadline(title) {
    const positiveWords = [
        'hyvä', 'hyvia', 'onnistui', 'onnistuminen', 'voitti', 'voitto', 'säästää', 'suojelee',
        'auttaa', 'auttavat', 'lahjoittaa', 'lahjoitus', 'kasvaa', 'paranee', 'parannus',
        'avautuu', 'uusi', 'uusia', 'ennätys', 'ennatys', 'palkinto', 'menestys', 'ila', 'ilo',
        'toivo', 'positiiv', 'rauhan', 'turvaa', 'terve', 'terveys', 'yhteisö', 'yhteiso',
    ];
    const negativeWords = [
        'sota', 'murha', 'rikos', 'onnettomuus', 'tulipalo', 'varoitus', 'sulkee', 'irtisan',
        'lakko', 'uhka', 'hyökkä', 'hyokka', 'kuole', 'riita', 'kriisi', 'pakol', 'katastrof',
    ];
    const normalized = String(title).toLowerCase();
    let score = 0;
    positiveWords.forEach((w) => { if (normalized.includes(w)) score += 2; });
    negativeWords.forEach((w) => { if (normalized.includes(w)) score -= 3; });
    return score;
}

/**
 * Picks up to 6 items with a positive heuristic score.
 * Falls back to the first 6 items if none score positively.
 * @param {NewsItem[]} items
 * @returns {NewsItem[]}
 */
function pickFallbackGoodNews(items) {
    const scored = items
        .map((item) => ({ item, score: scoreGoodNewsHeadline(item.title) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.item);
    return scored.length > 0 ? scored.slice(0, 6) : items.slice(0, 6);
}

/**
 * Sends headlines to Gemini for classification as good/positive news.
 * Falls back to the heuristic scorer if the API response is unparseable.
 *
 * @param {NewsItem[]} items
 * @param {string} apiKey
 * @returns {Promise<NewsItem[]>}
 */
async function classifyGoodNews(items, apiKey) {
    if (items.length === 0) return [];

    const titles = items.map((it, i) => `${i}: ${it.title}`).join('\n');
    const prompt = `Classify news headlines. Return ONLY a JSON array of index numbers for headlines that are positive, uplifting, joyful, heartwarming, or interesting good news. Exclude: politics, conflicts, crime, accidents, disasters, layoffs, warnings, or neutral/negative news. Only include clearly happy or good news.

Headlines:
${titles}

Respond with only a JSON array like [0, 3, 7] — no explanation.`;

    const raw = await geminiPost(apiKey, 'gemini-3-flash-preview', {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 300 },
    });

    // Extract the response text from the Gemini API envelope.
    let text = raw;
    try {
        const json = JSON.parse(raw);
        text = json?.candidates?.[0]?.content?.parts?.[0]?.text || raw;
    } catch (_) { }

    // Parse a JSON array of indices from the model's response text.
    const match = text.match(/\[[\d,\s]*]/);
    if (match) {
        try {
            const indices = JSON.parse(match[0]);
            const selected = indices
                .filter((i) => Number.isInteger(i) && i >= 0 && i < items.length)
                .map((i) => items[i]);
            if (selected.length > 0) return selected;
        } catch (_) { }
    }

    // Loose fallback: grab any bare integers from the response.
    const looseMatches = [...text.matchAll(/\b\d+\b/g)].map((m) => Number(m[0]));
    const selected = [...new Set(looseMatches)]
        .filter((i) => Number.isInteger(i) && i >= 0 && i < items.length)
        .map((i) => items[i]);
    if (selected.length > 0) return selected;

    return pickFallbackGoodNews(items);
}

/**
 * Fetches, classifies, and renders good news headlines into the overlay.
 * Results are cached in localStorage for GOOD_NEWS_CACHE_TTL (1 hour).
 *
 * @param {HTMLElement} overlayDiv
 * @returns {Promise<void>}
 */
async function loadGoodNewsWidget(overlayDiv) {
    const el = document.createElement('div');
    el.className = 'rss-feed good-news-feed';
    overlayDiv.appendChild(el);

    try {
        // Serve from cache if still fresh.
        let goodItems = null;
        try {
            const cached = JSON.parse(localStorage.getItem(GOOD_NEWS_CACHE_KEY) || 'null');
            if (cached && Date.now() - cached.timestamp < GOOD_NEWS_CACHE_TTL) {
                goodItems = cached.items;
                console.log('[goodnews] serving from cache');
            }
        } catch (_) { }

        if (!goodItems) {
            const apiKey = getGeminiApiKey();
            const allItems = await fetchAllNewsItems();
            if (!apiKey) {
                console.warn('[goodnews] GEMINI_API_KEY puuttuu, käytetään heuristista varalistaa');
                goodItems = pickFallbackGoodNews(allItems);
            } else {
                console.log('[goodnews] fetching and classifying…');
                goodItems = await classifyGoodNews(allItems, apiKey);
            }
            try {
                localStorage.setItem(GOOD_NEWS_CACHE_KEY, JSON.stringify({ items: goodItems, timestamp: Date.now() }));
            } catch (_) { }
            console.log(`[goodnews] cached ${goodItems.length} good items`);
        }

        const now = new Date().toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
        const displayItems = goodItems.length
            ? goodItems.slice(0, 6)
            : [{ title: 'Hyviä uutisia ei löytynyt juuri nyt.', source: '', date: '' }];

        el.innerHTML = `
          <div class="rss-header">
            <span class="rss-feed-title">🌟 Hyviä Uutisia</span>
            <span class="rss-clock">${esc(now)}</span>
          </div>
          <div class="rss-items">
            ${displayItems.map((i) => `<div class="rss-item">
              <div class="rss-item-title">${esc(i.title)}</div>
              ${i.source || i.date ? `<div class="rss-item-date">${esc([i.source, i.date].filter(Boolean).join(' · '))}</div>` : ''}
            </div>`).join('')}
          </div>`;
    } catch (e) {
        console.error('[goodnews]', e);
        el.innerHTML = `<div style="padding:48px;font-size:1.4rem;color:#065f46">Hyviä uutisia ei saatavilla: ${esc(e.message)}</div>`;
    }
}

module.exports = { loadGoodNewsWidget, scoreGoodNewsHeadline };
