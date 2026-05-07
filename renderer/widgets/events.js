'use strict';

const fs = require('fs');
const path = require('path');
const { esc } = require('../core/utils');

/**
 * @typedef {{
 *   name: string,
 *   start: Date,
 *   end: Date,
 *   endDate?: string,
 *   daysToStart: number,
 *   daysToEnd: number
 * }} ResolvedEvent
 */

/**
 * Returns a Finnish countdown label and a CSS colour for the event's urgency tier.
 * @param {ResolvedEvent} ev
 * @returns {{ text: string, color: string }}
 */
function countdown(ev) {
    if (ev.daysToStart <= 0 && ev.daysToEnd >= 0) {
        return ev.daysToEnd === 0
            ? { text: 'Tänään – viimeinen päivä', color: '#0f766e' }
            : { text: `Käynnissä · ${ev.daysToEnd} pv jäljellä`, color: '#0f766e' };
    }
    if (ev.daysToStart === 0) return { text: 'Tänään!', color: '#0f766e' };
    if (ev.daysToStart === 1) return { text: 'Huomenna', color: '#1d4ed8' };
    if (ev.daysToStart <= 7) return { text: `${ev.daysToStart} päivän päästä`, color: '#92400e' };
    return { text: `${ev.daysToStart} päivän päästä`, color: '#334155' };
}

/**
 * Formats an event's date range as a localized Finnish string.
 * Single-day events include the year; multi-day ranges show day.month–day.month.
 * @param {ResolvedEvent} ev
 * @returns {string}
 */
function fmtEvDate(ev) {
    const o = { day: 'numeric', month: 'numeric' };
    return ev.endDate && ev.start.getTime() !== ev.end.getTime()
        ? `${ev.start.toLocaleDateString('fi-FI', o)}–${ev.end.toLocaleDateString('fi-FI', o)}`
        : ev.start.toLocaleDateString('fi-FI', { ...o, year: 'numeric' });
}

/**
 * Reads events.json from the app root and renders upcoming events into the overlay.
 * Shows up to 7 future or currently-running events sorted by start date.
 *
 * @param {HTMLElement} overlayDiv
 * @returns {Promise<void>}
 */
async function loadEventsWidget(overlayDiv) {
    const el = document.createElement('div');
    el.className = 'events-widget';
    overlayDiv.appendChild(el);

    try {
        const data = JSON.parse(
            fs.readFileSync(path.join(__dirname, '..', '..', 'events.json'), 'utf8')
        );

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const events = /** @type {ResolvedEvent[]} */ (
            (data.events || [])
                .map((ev) => {
                    const start = new Date(ev.date);
                    start.setHours(0, 0, 0, 0);
                    const end = new Date(ev.endDate || ev.date);
                    end.setHours(0, 0, 0, 0);
                    return {
                        ...ev,
                        start,
                        end,
                        daysToStart: Math.round((start - today) / 86400000),
                        daysToEnd: Math.round((end - today) / 86400000),
                    };
                })
                .filter((ev) => ev.daysToEnd >= 0)
                .sort((a, b) => a.start - b.start)
                .slice(0, 7)
        );

        const now = new Date().toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });

        el.innerHTML = `
          <div class="events-header">
            <span class="events-title">📅 ${esc(data.title || 'Tapahtumat')}</span>
            <span class="events-time">${now}</span>
          </div>
          <div class="events-list">
            ${events.map((ev) => {
                const cd = countdown(ev);
                return `<div class="ev-row">
              <div>
                <div class="ev-name">${esc(ev.name)}</div>
                <div class="ev-countdown" style="color:${cd.color}">${esc(cd.text)}</div>
              </div>
              <div class="ev-date">${esc(fmtEvDate(ev))}</div>
            </div>`;
            }).join('') || '<div style="color:#213b57;background:#fff;border:2px solid #d2e0ee;border-radius:16px;padding:26px 30px;font-size:1.75rem;font-weight:600">Ei tulevia tapahtumia</div>'}
          </div>`;
    } catch (e) {
        el.innerHTML = `<div style="color:#7f1d1d;background:#fff3f3;border:2px solid #fecaca;border-radius:16px;padding:40px;font-size:1.6rem;font-weight:600">events.json ei saatavilla: ${esc(e.message)}</div>`;
    }
}

module.exports = { loadEventsWidget, countdown, fmtEvDate };
