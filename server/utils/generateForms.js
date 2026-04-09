// utils/generateForms.js
import puppeteer from 'puppeteer';
import path      from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── RESOLVE HTML TEMPLATE PATHS ─────────────────────────────────────────────
// HTML files live at:  utils/html/hospital_form_managed.html
//                      utils/html/hospital_form_owner.html
//                      utils/html/doctor_form_owner.html
//                      utils/html/doctor_form_affiliated.html
const HTML_DIR = path.join(__dirname, 'html');

const HTML_MAP = {
  hospital: {
    'hospital-manager': path.join(HTML_DIR, 'hospital_form_managed.html'),
    'doctor-owner':     path.join(HTML_DIR, 'hospital_form_owner.html'),
  },
  doctor: {
    'doctor-owner':     path.join(HTML_DIR, 'doctor_form_owner.html'),
    'hospital-manager': path.join(HTML_DIR, 'doctor_form_affiliated.html'),
  },
};

// ─── SHARED PUPPETEER HELPER ──────────────────────────────────────────────────

/**
 * Launch a headless Chromium instance, open the given HTML file,
 * and print it to a PDF at `outputPath`.
 *
 * @param {string} htmlFilePath  – absolute path to the HTML template
 * @param {string} outputPath    – where to write the resulting PDF
 */
async function htmlFileToPdf(htmlFilePath, outputPath) {
  const browser = await puppeteer.launch({
    headless: 'new',          // use the new headless mode
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  try {
    const page = await browser.newPage();

    // Load the HTML file via file:// protocol so relative assets resolve
    await page.goto(`file://${htmlFilePath}`, {
      waitUntil: 'networkidle0',  // wait for fonts / QR images to load
      timeout:   30_000,
    });

    // Match the A4 dimensions used in the original HTML (794 × 1123 px at 96 dpi)
    await page.pdf({
      path:              outputPath,
      format:            'A4',
      printBackground:   true,   // render background colours & images
      margin: {
        top:    '0',
        right:  '0',
        bottom: '0',
        left:   '0',
      },
    });
  } finally {
    await browser.close();
  }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Generate the Hospital registration form PDF.
 *
 * @param {string} outputPath      – destination file path (e.g. /tmp/hospital_form.pdf)
 * @param {string} managementModel – 'hospital-manager' | 'doctor-owner'
 */
export async function generateHospitalForm(outputPath, managementModel = 'hospital-manager') {
  const htmlFile = HTML_MAP.hospital[managementModel];
  if (!htmlFile) {
    throw new Error(`Unknown hospital managementModel: "${managementModel}"`);
  }
  await htmlFileToPdf(htmlFile, outputPath);
  console.log(`✅  Hospital form (${managementModel}) → ${outputPath}`);
}

/**
 * Generate the Doctor registration form PDF.
 *
 * @param {string} outputPath      – destination file path (e.g. /tmp/doctor_form.pdf)
 * @param {string} managementModel – 'doctor-owner' | 'hospital-manager'
 */
export async function generateDoctorForm(outputPath, managementModel = 'doctor-owner') {
  const htmlFile = HTML_MAP.doctor[managementModel];
  if (!htmlFile) {
    throw new Error(`Unknown doctor managementModel: "${managementModel}"`);
  }
  await htmlFileToPdf(htmlFile, outputPath);
  console.log(`✅  Doctor form (${managementModel}) → ${outputPath}`);
}

// ─── OPTIONAL CLI ENTRY POINT ─────────────────────────────────────────────────
// Run directly:  node utils/generateForms.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    const { default: fs } = await import('fs');
    const outDir = './output';
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    await generateHospitalForm(`${outDir}/hospital_form_hospital-manager.pdf`, 'hospital-manager');
    await generateHospitalForm(`${outDir}/hospital_form_doctor-owner.pdf`,     'doctor-owner');
    await generateDoctorForm  (`${outDir}/doctor_form_doctor-owner.pdf`,       'doctor-owner');
    await generateDoctorForm  (`${outDir}/doctor_form_hospital-manager.pdf`,   'hospital-manager');

    console.log('\n🎉  All 4 forms generated in ./output/');
  })().catch(console.error);
}