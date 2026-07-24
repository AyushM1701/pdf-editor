/**
 * @typedef {Object} LocalPDFMetadata
 * @property {string} title
 * @property {string} author
 * @property {string} subject
 */

/**
 * @typedef {Object} ExtractionResponsePayload
 * @property {string} object_key
 * @property {string} document_type
 * @property {number} classification_confidence
 * @property {Array<{name: string, value: string, confidence: number}>} fields
 * @property {Array<object>} pages
 * @property {Array<object>} warnings
 * @property {string|null} summary
 */

export function normalizeMetadata(metadata = {}) {
  return {
    title: typeof metadata.title === 'string' ? metadata.title.trim() : '',
    author: typeof metadata.author === 'string' ? metadata.author.trim() : '',
    subject: typeof metadata.subject === 'string' ? metadata.subject.trim() : '',
  };
}

export function hasMeaningfulMetadata(metadata = {}) {
  return Object.values(normalizeMetadata(metadata)).some(Boolean);
}

export function validateExtractionResponse(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('The extraction API returned an invalid response payload.');
  }

  if (typeof payload.document_type !== 'string') {
    throw new Error('The extraction API response is missing document_type.');
  }

  if (
    typeof payload.classification_confidence !== 'number' ||
    Number.isNaN(payload.classification_confidence)
  ) {
    throw new Error(
      'The extraction API response is missing classification_confidence.',
    );
  }

  if (!Array.isArray(payload.fields) || !Array.isArray(payload.pages)) {
    throw new Error('The extraction API response does not match the expected schema.');
  }

  return payload;
}
