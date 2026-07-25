/**
 * Utility functions for CNSPK Website
 */

import { sanitizeHTML, sanitizeAttribute, sanitizeURL } from './lib/sanitize.js';

// Simple robust logger for CNSPK
const log = {
    info: (...args) => console.log('[CNSPK]', ...args),
    error: (...args) => console.error('[CNSPK]', ...args),
};

/**
 * Fetches JSON data from a given path with error handling.
 * @param {string} url - The URL to fetch.
 * @returns {Promise<any>} The parsed JSON data or null on error.
 */
export async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        log.error(`Failed to fetch ${url}:`, error);
        return null;
    }
}

/**
 * Sanitizes an untrusted value before it is inserted into the DOM.
 *
 * Delegates to the shared js/lib/sanitize.js wrapper so member, session, and
 * intake values everywhere on the site pass through one hardened path: the
 * DOMPurify allowlist in the browser and a pure escaping fallback elsewhere.
 * Both paths strip executable script and event-handler attributes (Req 2.4).
 *
 * @param {string} dirty - The dirty HTML string.
 * @returns {string} The sanitized string.
 */
export function sanitize(dirty) {
    return sanitizeHTML(dirty);
}

/**
 * Sanitizes a RAW value that lands inside a quoted HTML attribute
 * (`alt="…"`, `data-username="…"`, `id="…"`).
 *
 * Pass the original value, not the output of sanitize(), so entities are
 * escaped exactly once. Entity escaping is transparent to the HTML parser, so
 * `dataset`/`getAttribute` still read the original string.
 *
 * @param {*} value - Raw untrusted value.
 * @returns {string} A value that cannot escape its attribute (Req 2.4).
 */
export function sanitizeAttr(value) {
    return sanitizeAttribute(value);
}

/**
 * Sanitizes a RAW value destined for `href` / `src`.
 *
 * Allows http/https/mailto/tel and relative URLs; anything executable
 * (`javascript:`, `data:`, …) collapses to an empty, inert value (Req 2.4).
 *
 * @param {*} value - Raw untrusted URL.
 * @returns {string} A safe URL, or '' when the value is not safe to link to.
 */
export function sanitizeUrl(value) {
    return sanitizeURL(value);
}

/**
 * Wait for DOM to be ready
 * @param {Function} fn - Callback function
 */
export function domReady(fn) {
    if (document.readyState !== 'loading') {
        fn();
    } else {
        document.addEventListener('DOMContentLoaded', fn);
    }
}

/**
 * Debounce function to limit the rate at which a function can fire.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The delay in milliseconds.
 * @returns {Function} - The debounced function.
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
