/**
 * securePdf.js
 * Likeson Healthcare — PDF Security Wrapper (qpdf CLI)
 *
 * Applies:
 * - Owner password  (from env PDF_OWNER_PASSWORD, fallback to generated secret)
 * - No user password (PDF opens freely)
 * - Permissions: print allowed, all else DENIED (no copy, no edit, no annotate)
 * - 256-bit AES encryption (PDF 2.0 / qpdf --encrypt aes256)
 */

import { execFile }  from 'child_process';
import { promisify } from 'util';
import fs             from 'fs';
import os             from 'os';
import path           from 'path';
import crypto         from 'crypto';

const execFileAsync = promisify(execFile);

// ─── Owner password ───────────────────────────────────────────────────────────
// Set PDF_OWNER_PASSWORD in .env for a fixed password.
// If not set, a random 32-char hex is generated per-process (secure enough —
// owner password is never shown to users, only used to lock permissions).
const OWNER_PASSWORD = process.env.PDF_OWNER_PASSWORD
  || crypto.randomBytes(16).toString('hex');

/**
 * securePdf(inputBuffer) → Promise<Buffer>
 *
 * Takes a raw PDF buffer, runs it through qpdf with security settings,
 * returns the secured PDF buffer. Uses temp files; always cleans up.
 *
 * Permissions granted:  print (full quality)
 * Permissions denied:   modify, copy-text, annotate, form-fill, accessibility-override
 */
const securePdf = async (inputBuffer) => {
  const tmpDir  = os.tmpdir();
  const uid     = crypto.randomBytes(8).toString('hex');
  const inPath  = path.join(tmpDir, `rx-in-${uid}.pdf`);
  const outPath = path.join(tmpDir, `rx-out-${uid}.pdf`);

  try {
    // Write input buffer to temp file
    await fs.promises.writeFile(inPath, inputBuffer);

    // ── qpdf encryption flags ──────────────────────────────────────────────
    // --encrypt <user-pw> <owner-pw> <key-bits>
    //   user-pw  = "" (no password to open)
    //   owner-pw = OWNER_PASSWORD (required to change permissions)
    //   key-bits = 256 (AES-256)
    //
    // Permissions (everything OFF except print):
    //   --print=full          → allow printing at full quality
    //   --modify=none         → block all document modification
    //   --extract=n           → block text/image extraction (copy)
    //   --annotate=n          → block adding/editing annotations & form fields
    //   --assemble=n          → block page insert/delete/rotate
    //   --cleartext-metadata=n → encrypt metadata too
    // ──────────────────────────────────────────────────────────────────────

    const args = [
      inPath,
      outPath,
      '--encrypt', '', OWNER_PASSWORD, '256',
      '--print=full',
      '--modify=none',
      '--extract=n',
      '--annotate=n',
      '--assemble=n',
      '--',   // end of encrypt options
    ];

    try {
      await execFileAsync('qpdf', args, { timeout: 30_000 });
    } catch (execError) {
      // Catch the specific missing executable error
      if (execError.code === 'ENOENT') {
        throw new Error(
          'PDF Encryption failed: The "qpdf" command-line tool is not installed or not found in your system PATH. ' +
          'Please install it on the server (e.g., run `sudo apt install qpdf` on Ubuntu/Debian or `brew install qpdf` on macOS).'
        );
      }
      // If it fails for another reason (like a timeout or bad args), throw that instead
      throw execError;
    }

    // Read secured PDF back into buffer
    const securedBuffer = await fs.promises.readFile(outPath);
    return securedBuffer;

  } finally {
    // Always clean up temp files — fire-and-forget, no throw on failure
    fs.unlink(inPath,  () => {});
    fs.unlink(outPath, () => {});
  }
};

export default securePdf;