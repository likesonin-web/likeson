/**
 * hsnUpload.service.js
 * ─────────────────────────────────────────────────────────────
 * Handles bulk upload of HSN → GST data from Excel or PDF files.
 *
 * Expected Excel columns (case-insensitive):
 *   HSN Code | Description | Chapter Heading | GST %
 *
 * Usage (in your Express route):
 *   import { uploadHsnFromExcel, uploadHsnFromPdf } from './hsnUpload.service.js';
 *   router.post('/hsn/upload', upload.single('file'), async (req, res) => {
 *     const result = await uploadHsnFromExcel(req.file.buffer, req.user._id);
 *     res.json(result);
 *   });
 */

import xlsx from 'xlsx';
import pdfParse from 'pdf-parse';
import HsnCode from '../models/hsnCode.model.js';

// ─── Excel Upload ─────────────────────────────────────────────

/**
 * Parse an Excel/CSV buffer and upsert HsnCode documents.
 * @param {Buffer} buffer  - File buffer from multer
 * @param {ObjectId} userId - Who is uploading
 * @param {'excel'|'pdf'|'manual'} source
 * @returns {{ inserted: number, updated: number, errors: string[] }}
 */
export async function uploadHsnFromExcel(buffer, userId, source = 'excel') {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: '',
  });

  return _upsertRows(rows, userId, source);
}

// ─── PDF Upload ───────────────────────────────────────────────

/**
 * Parse a PDF buffer, extract HSN table rows, and upsert HsnCode documents.
 * This uses a simple line-by-line heuristic. For complex PDFs you may need
 * a custom parser or a service like AWS Textract.
 *
 * Expected PDF line format:
 *   3004    Medicaments for retail sale    Chapter 30    5
 */
export async function uploadHsnFromPdf(buffer, userId) {
  const data = await pdfParse(buffer);
  const lines = data.text.split('\n').map((l) => l.trim()).filter(Boolean);

  const rows = [];
  for (const line of lines) {
    // Attempt to parse lines that start with a 4–8 digit HSN code
    const match = line.match(
      /^(\d{4,8})\s+(.+?)\s+(Chapter\s+\d+[^0-9]*?)?\s+(\d{1,2})\s*%?$/i
    );
    if (match) {
      rows.push({
        'HSN Code': match[1].trim(),
        Description: match[2].trim(),
        'Chapter Heading': match[3] ? match[3].trim() : '',
        'GST %': match[4].trim(),
      });
    }
  }

  if (rows.length === 0) {
    throw new Error(
      'Could not extract any HSN rows from the PDF. ' +
      'Please use the Excel template for reliable uploads.'
    );
  }

  return _upsertRows(rows, userId, 'pdf');
}

// ─── Shared upsert logic ──────────────────────────────────────

const VALID_GST_SLABS = [0, 5, 12, 18, 28];

const COLUMN_ALIASES = {
  hsnCode: ['hsn code', 'hsncode', 'hsn', 'code'],
  description: ['description', 'desc', 'product description', 'item description'],
  chapterHeading: ['chapter heading', 'chapter', 'heading'],
  gstPercentage: ['gst %', 'gst%', 'gst percentage', 'tax %', 'rate', 'igst %'],
};

function normalizeRow(raw) {
  const lower = {};
  for (const [k, v] of Object.entries(raw)) {
    lower[k.toLowerCase().trim()] = String(v).trim();
  }

  const get = (aliases) => {
    for (const alias of aliases) {
      if (lower[alias] !== undefined) return lower[alias];
    }
    return '';
  };

  return {
    hsnCode: get(COLUMN_ALIASES.hsnCode).toUpperCase(),
    description: get(COLUMN_ALIASES.description),
    chapterHeading: get(COLUMN_ALIASES.chapterHeading),
    gstPercentage: parseFloat(get(COLUMN_ALIASES.gstPercentage)) || null,
  };
}

async function _upsertRows(rows, userId, source) {
  let inserted = 0;
  let updated = 0;
  const errors = [];

  for (const raw of rows) {
    const row = normalizeRow(raw);

    if (!row.hsnCode) {
      errors.push(`Skipped row – missing HSN code: ${JSON.stringify(raw)}`);
      continue;
    }

    if (!VALID_GST_SLABS.includes(row.gstPercentage)) {
      errors.push(
        `Skipped ${row.hsnCode} – invalid GST slab: ${row.gstPercentage}. ` +
        `Allowed: ${VALID_GST_SLABS.join(', ')}`
      );
      continue;
    }

    try {
      const existing = await HsnCode.findOne({ hsnCode: row.hsnCode });

      if (existing) {
        existing.description = row.description || existing.description;
        existing.chapterHeading = row.chapterHeading || existing.chapterHeading;
        existing.gstPercentage = row.gstPercentage;
        existing.uploadedBy = userId;
        existing.uploadSource = source;
        await existing.save();
        updated++;
      } else {
        await HsnCode.create({
          ...row,
          uploadedBy: userId,
          uploadSource: source,
        });
        inserted++;
      }
    } catch (err) {
      errors.push(`Error on ${row.hsnCode}: ${err.message}`);
    }
  }

  return { inserted, updated, errors };
}

// ─── Lookup helper (used by Medicine controller) ──────────────

/**
 * Given an HSN code string, return the matching HsnCode doc (or null).
 * Frontend calls GET /api/hsn/:code which uses this.
 *
 * @param {string} code
 * @returns {Promise<HsnCode|null>}
 */
export async function lookupHsn(code) {
  return HsnCode.findOne({ hsnCode: code.toUpperCase().trim(), isActive: true });
}