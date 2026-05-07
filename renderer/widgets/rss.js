'use strict';

const { nodeFetch, esc, fmtDate } = require('../core/utils');

/**
 * @typedef {import('../core/config').PlaylistItem} PlaylistItem
 */

/**
 * Fetches an RSS/Atom feed and renders it into the overlay element.
 * Displays the 5 most recent items with title, description snippet, and date.
 *
 * @param {HTMLElement} overlayDiv
 * @param {PlaylistItem} item
 * @returns {Promise<void>}
 */
async function loadRssWidget(overlayDiv, item) {
    const text = await nodeFetch(item.src);
    const xml = new DOMParser().parseFromString(text, 'application/xml');

    const feedTitle = xml.querySelector('channel > title')?.textContent?.trim() || 'News';
    const entries = [...xml.querySelectorAll('item')].slice(0, 5).map((el) => {
        const raw = el.querySelector('description')?.textContent || '';
        const tmp = document.createElement('div');
        tmp.innerHTML = raw;
        const desc = tmp.textContent.trim();
        return {
            title: el.querySelector('title')?.textContent?.trim() || '',
            desc: desc.length > 220 ? desc.slice(0, 220) + '…' : desc,
            date: fmtDate(el.querySelector('pubDate')?.textContent || ''),
        };
    });

    const now = new Date().toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
    const el = document.createElement('div');
    el.className = 'rss-feed';
    el.innerHTML = `
        <div class="rss-header">
          <span class="rss-feed-title">${esc(feedTitle)}</span>
          <span class="rss-clock">${esc(now)}</span>
        </div>
        <div class="rss-items">
          ${entries.map((i) => `<div class="rss-item">
            <div class="rss-item-title">${esc(i.title)}</div>
            ${i.desc ? `<div class="rss-item-desc">${esc(i.desc)}</div>` : ''}
            ${i.date ? `<div class="rss-item-date">${esc(i.date)}</div>` : ''}
          </div>`).join('')}
        </div>`;
    overlayDiv.appendChild(el);
}

module.exports = { loadRssWidget };
