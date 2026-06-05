/**
 * Utility functions for CNSPK Website
 */

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
 * Sanitizes an HTML string using DOMPurify if available, otherwise falls back to basic escaping.
 * @param {string} dirty - The dirty HTML string.
 * @returns {string} The sanitized HTML string.
 */
export function sanitize(dirty) {
    if (!dirty) return '';
    // Check if DOMPurify is loaded globally (from CDN in index.html)
    if (window.DOMPurify) {
        return window.DOMPurify.sanitize(dirty, {
            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'span', 'div', 'ul', 'li'],
            ALLOWED_ATTR: ['href', 'target', 'class', 'rel']
        });
    }
    // Fallback if DOMPurify isn't ready yet or failed to load
    return dirty
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Escapes a string for safe interpolation into an HTML *attribute* or as text.
 * Use this (not sanitize) when injecting values into href/src/alt/title/aria-*
 * inside a template literal — DOMPurify.sanitize() does NOT escape quotes, so a
 * value like `" onerror="alert(1)` can break out of an attribute. This always
 * entity-escapes, which is the correct behaviour for attribute contexts.
 * @param {string} str
 * @returns {string}
 */
export function escapeAttr(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Validates a URL for use in an href/src and returns a safe, escaped value.
 * Blocks dangerous schemes (javascript:, data:, vbscript:, file:) and any
 * unknown scheme; allows http(s), mailto, tel, protocol-/root-relative and
 * anchors. Returns '#' for anything rejected.
 * @param {string} url
 * @returns {string}
 */
export function safeUrl(url) {
    if (!url) return '#';
    const str = String(url).trim();
    // Reject control chars that could obfuscate a scheme.
    const stripped = str.replace(/[\u0000-\u001F\u007F\s]/g, '');
    if (/^(javascript|data|vbscript|file):/i.test(stripped)) return '#';
    // Allow explicit safe schemes, protocol-relative, root-relative, anchors, dot-paths.
    if (/^(https?:\/\/|mailto:|tel:|\/\/|\/|#|\.\.?\/)/i.test(str)) return escapeAttr(str);
    // Bare relative reference with no scheme (e.g. "events/" or "card.html").
    if (!/^[a-z][a-z0-9+.-]*:/i.test(str)) return escapeAttr(str);
    // Unknown/blocked scheme.
    return '#';
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
