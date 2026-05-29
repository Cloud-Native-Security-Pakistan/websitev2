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
