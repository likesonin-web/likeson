import mongoose from 'mongoose';
const { Schema } = mongoose;

/**
 * HSN Code Model
 * ─────────────────────────────────────────────────────────────
 * Populated by bulk upload (Excel / PDF → parsed → seeded here).
 * When a pharmacist types an HSN code on the Medicine form,
 * the frontend calls GET /api/hsn/:code and auto-fills gstPercentage.
 *
 * India Pharma GST slabs (as of 2024):
 *   0%  – life-saving drugs notified by Govt (e.g. insulin)
 *   5%  – most medicines, APIs, Ayurvedic formulations
 *   12% – patent-protected drugs, certain medical devices
 *   18% – cosmetics/toiletries classified as OTC
 */

const hsnCodeSchema = new Schema(
  {
    hsnCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    // Short chapter heading, e.g. "Chapter 30 – Pharmaceutical Products"
    chapterHeading: {
      type: String,
      trim: true,
    },

    gstPercentage: {
      type: Number,
      required: true,
      enum: [0, 5, 12, 18, 28], // Valid Indian GST slabs
    },

    // IGST = CGST + SGST (both are gstPercentage / 2)
    cgstPercentage: {
      type: Number,
    },
    sgstPercentage: {
      type: Number,
    },
    igstPercentage: {
      type: Number,
    },

    // Whether this code is still active / not superseded
    isActive: {
      type: Boolean,
      default: true,
    },

    // Audit: who uploaded this batch
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    uploadSource: {
      type: String,
      enum: ['excel', 'pdf', 'manual', 'api'],
      default: 'manual',
    },
  },
  { timestamps: true }
);

// Auto-compute CGST / SGST / IGST before save
hsnCodeSchema.pre('save', async function () {
  const half = this.gstPercentage / 2;
  this.cgstPercentage = half;
  this.sgstPercentage = half;
  this.igstPercentage = this.gstPercentage;
 
});

const HsnCode = mongoose.model('HsnCode', hsnCodeSchema);
export default HsnCode;