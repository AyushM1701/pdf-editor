/**
 * Parses a page range string into an array of 0-indexed page integers.
 * 
 * Supports:
 * - Single pages: "1", "5"
 * - Ranges: "1-5", "2-4"
 * - Open ranges: "5-" (from 5 to maxPages), "-3" (from 1 to 3)
 * - Comma separated lists: "1, 3, 5-7"
 * - "all" keyword: returns all pages
 * 
 * @param {string} rangeStr The page range string (1-indexed).
 * @param {number} maxPages The total number of pages in the document.
 * @returns {number[]} Array of unique, sorted 0-indexed page numbers.
 */
export function parsePageRange(rangeStr, maxPages) {
  if (!rangeStr || rangeStr.trim() === '' || rangeStr.toLowerCase().trim() === 'all') {
    return Array.from({ length: maxPages }, (_, i) => i);
  }

  const result = new Set();
  const parts = rangeStr.split(',').map(s => s.trim());

  for (const part of parts) {
    if (!part) continue;

    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      
      let start = startStr ? parseInt(startStr, 10) : 1;
      let end = endStr ? parseInt(endStr, 10) : maxPages;

      if (isNaN(start)) start = 1;
      if (isNaN(end)) end = maxPages;

      // Ensure within bounds (1 to maxPages)
      start = Math.max(1, Math.min(start, maxPages));
      end = Math.max(1, Math.min(end, maxPages));

      // Handle reversed range if user typed e.g. "5-1"
      const min = Math.min(start, end);
      const max = Math.max(start, end);

      for (let i = min; i <= max; i++) {
        result.add(i - 1);
      }
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num) && num >= 1 && num <= maxPages) {
        result.add(num - 1);
      }
    }
  }

  return Array.from(result).sort((a, b) => a - b);
}
