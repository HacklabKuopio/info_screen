'use strict';

const fs = require('fs');
const path = require('path');

/**
 * @typedef {{ src: string, duration: number|null, zoom: string|null }} PlaylistItem
 * @typedef {{ interval: number, items: PlaylistItem[] }} PlaylistConfig
 */

/**
 * Reads and parses playlist.json from the app root.
 * Returns a safe fallback if the file is missing or malformed.
 * @returns {PlaylistConfig}
 */
function loadConfig() {
    try {
        return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'playlist.json'), 'utf8'));
    } catch (_) {
        return { interval: 10000, items: [] };
    }
}

/**
 * Reads the Gemini API key from the process environment.
 * Accepts both GEMINI_API_KEY and the legacy GOOGLE_API_KEY name.
 * @returns {string} Empty string if not set.
 */
function getGeminiApiKey() {
    const env = (typeof process !== 'undefined' && process && process.env) ? process.env : {};
    return env.GEMINI_API_KEY || env.GOOGLE_API_KEY || '';
}

/**
 * Normalises a raw playlist entry (string or object) into a PlaylistItem.
 * @param {string | { src?: string, url?: string, file?: string, duration?: number, zoom?: string }} item
 * @returns {PlaylistItem}
 */
function normalizeItem(item) {
    if (typeof item === 'string') return { src: item, duration: null, zoom: null };
    return {
        src: item.src || item.url || item.file,
        duration: item.duration || null,
        zoom: item.zoom || null,
    };
}

module.exports = { loadConfig, getGeminiApiKey, normalizeItem };
