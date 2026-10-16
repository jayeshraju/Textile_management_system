/**
 * Utility module for generating Fabric Passport QR Code content.
 * Supports:
 * 1. Direct Item Information (Text): Scans directly to item specifications & details on any camera/scanner WITHOUT opening a website.
 * 2. Structured JSON Spec: For industrial handheld scanners and ERP systems.
 * 3. Canonical Web URL: For browser navigation when explicitly desired.
 */

// Fallback LAN IP for local Wi-Fi testing
export const DEFAULT_LAN_IP = '192.168.1.100';

/**
 * Builds human-readable item detail text for the QR code.
 * When scanned by a phone camera or handheld scanner, this displays the roll's
 * complete specifications, grade, order info, and status without redirecting to a web page.
 * @param {object} roll - FabricRoll data object
 * @returns {string} Multi-line formatted specification text
 */
export const buildRollInfoText = (roll) => {
  if (!roll) return '';

  const rollId = roll.rollId || 'UNKNOWN';
  const orderNumber = roll.order?.orderNumber || 'Unassigned';
  const buyer = roll.order?.buyer || 'Standard Buyer';
  const fabricType = roll.order?.fabricType || 'Textile Fabric';
  const metres = roll.quantityMetres != null
    ? `${Number(roll.quantityMetres).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} Metres`
    : 'N/A';
  const stage = roll.stage || 'GREY';
  const quality = roll.qualityStatus || 'PENDING';
  const dispatch = roll.dispatchStatus || 'NOT_DISPATCHED';
  const workcenter = roll.machine?.code
    ? `${roll.machine.code} (${roll.machine.name || ''})`
    : 'Staging / Manual QA Area';

  const inspectionsCount = roll.inspections?.length || 0;
  const lastInsp = inspectionsCount > 0 ? roll.inspections[inspectionsCount - 1] : null;

  const lines = [
    `--- LOOMIQ FABRIC PASSPORT ---`,
    `Roll ID: ${rollId}`,
    `Fabric: ${fabricType}`,
    `Length: ${metres}`,
    `Quality Gate: ${quality}`,
    `Current Stage: ${stage}`,
    `Dispatch State: ${dispatch}`,
    `Order No: ${orderNumber}`,
    `Buyer: ${buyer}`,
    `Workcenter: ${workcenter}`,
    lastInsp ? `Last QC: ${lastInsp.result} (${lastInsp.defects?.length || 0} defects)` : `Inspections: 0 recorded`,
    `Traceability: LoomIQ Certified Digital Passport`,
  ];

  return lines.join('\n');
};

/**
 * Builds structured JSON specification for industrial barcode scanners / ERP readers.
 * @param {object} roll - FabricRoll data object
 * @returns {string} Compact JSON string
 */
export const buildRollJsonSpec = (roll) => {
  if (!roll) return '{}';
  return JSON.stringify({
    passport: 'LoomIQ-FabricRoll',
    rollId: roll.rollId,
    fabric: roll.order?.fabricType || 'Textile Fabric',
    metres: roll.quantityMetres,
    order: roll.order?.orderNumber || null,
    buyer: roll.order?.buyer || null,
    stage: roll.stage,
    qualityStatus: roll.qualityStatus,
    dispatchStatus: roll.dispatchStatus,
    machine: roll.machine?.code || null,
    inspectionsCount: roll.inspections?.length || 0,
  }, null, 2);
};

/**
 * Builds the canonical public URL for a given fabric roll QR passport.
 * @param {string} rollId - The unique roll identifier (e.g. 'FR-2026-000001')
 * @param {string} [customBaseUrl] - Optional base URL override
 * @returns {string} Fully qualified URL string
 */
export const buildRollUrl = (rollId, customBaseUrl) => {
  if (!rollId || typeof rollId !== 'string') {
    return '';
  }

  const envUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_PUBLIC_APP_URL;
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';

  const base = (customBaseUrl || envUrl || origin || 'http://localhost:5173').trim();
  const cleanBase = base.replace(/\/+$/, '');
  const normalizedRollId = rollId.trim().toUpperCase();
  return `${cleanBase}/rolls/${encodeURIComponent(normalizedRollId)}`;
};

/**
 * Checks if the current URL origin is a local loopback address (useful for dev QR warning)
 */
export const isLocalhostOrigin = (urlStr) => {
  if (!urlStr) return false;
  try {
    const parsed = new URL(urlStr);
    return (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '0.0.0.0'
    );
  } catch {
    return false;
  }
};
