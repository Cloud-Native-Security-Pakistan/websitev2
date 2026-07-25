/**
 * map-render — resolves member cities to coordinates and decides pin placement,
 * including approval gating.
 *
 * Pure ES module: importable in both the browser and Node. Implementation lands
 * in Task 6.1, and is wired into js/Map.js.
 *
 * Validates (eventual): Requirements 12.2, 12.3, 12.4
 */

const NOT_IMPLEMENTED = 'map-render: not implemented yet (Task 6.1)';

/**
 * Resolve a city label to coordinates using a lookup table.
 * @param {string} _city
 * @param {Record<string, { lat: number, lng: number }>} _coordsTable
 * @returns {{ lat: number, lng: number } | null}
 */
export function resolveCity(_city, _coordsTable) {
  throw new Error(NOT_IMPLEMENTED);
}

/**
 * Build the set of pins to render: exactly one pin per record whose city
 * resolves; unresolved cities are omitted and recorded. Honors approval gating.
 * @param {object[]} _records
 * @param {Record<string, { lat: number, lng: number }>} _coordsTable
 * @param {{ requireApproval?: boolean }} [_options]
 * @returns {{ pins: object[], unresolved: string[] }}
 */
export function buildPins(_records, _coordsTable, _options) {
  throw new Error(NOT_IMPLEMENTED);
}
