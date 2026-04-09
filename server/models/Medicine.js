import mongoose from 'mongoose';
const { Schema } = mongoose;

 

// ─── Sub-schemas ────────────────────────────────────────────

const saltCompositionSchema = new Schema(
  {
    ingredient: { type: String, required: true, trim: true },
    strength: { type: String, required: true, trim: true }, // e.g. "500mg", "10mg/5ml"
    unit: { type: String, trim: true },                     // e.g. "mg", "mcg", "IU"
  },
  { _id: false }
);

const inventorySchema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'PharmacyStore',
  
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    stockQuantity: { type: Number, default: 0, min: 0 },
    reservedQuantity: { type: Number, default: 0, min: 0 }, // held for pending orders
    reorderLevel: { type: Number, default: 10 },            // trigger low-stock alert below this

    batchNumber: { type: String, trim: true },
    manufacturingDate: { type: Date },
    expiryDate: { type: Date, required: true },

    // Store-specific price override (falls back to Medicine.mrp if absent)
    pricePerUnit: { type: Number, min: 0 },

    // Location inside the store (aisle / rack / shelf)
    location: { type: String, trim: true },

    isLowStock: { type: Boolean, default: false },
    isExpired: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }, // set false to soft-delete a store's stock
  },
  { timestamps: true }
);

// Auto-flag low stock & expiry before saving an inventory entry
inventorySchema.pre('save', async function () {
  this.isLowStock = this.stockQuantity <= this.reorderLevel;
  this.isExpired = this.expiryDate ? this.expiryDate < new Date() : false;
    
});

// ─── Main Schema ────────────────────────────────────────────

const medicineSchema = new Schema(
  {
    // ── Basic Product Info ───────────────────────────────────
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    brandName: {
      type: String,
      required: true,
      trim: true,
    },
    genericName: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: { type: String, trim: true },

    // ── Classification ───────────────────────────────────────
    category: {
      type: String,
      enum: [
        'Tablet',
        'Capsule',
        'Syrup',
        'Suspension',
        'Solution',
        'Injection',
        'Infusion',
        'Ointment',
        'Cream',
        'Gel',
        'Lotion',
        'Drops',         // Eye / Ear / Nasal
        'Inhaler',
        'Nasal Spray',
        'Patch',
        'Suppository',
        'Powder',
        'Granules',
        'Lozenge',
        'Implant',
        'Others',
      ],
      required: true,
    },

    // Drug form helps distinguish Tablet vs Dispersible Tablet vs Chewable Tablet
    drugForm: { type: String, trim: true },

    // ── Medical Metadata ─────────────────────────────────────
    dosage: {
      type: String,
      required: true,
      trim: true, // e.g. "500mg", "5mg/ml"
    },
    routeOfAdministration: {
      type: String,
      enum: [
        'Oral',
        'Intravenous',
        'Intramuscular',
        'Subcutaneous',
        'Topical',
        'Inhalation',
        'Rectal',
        'Vaginal',
        'Ophthalmic',
        'Otic',
        'Nasal',
        'Sublingual',
        'Transdermal',
        'Others',
      ],
    },
    therapeuticClass: { type: String, trim: true }, // e.g. "Antibiotics", "NSAIDs", "Antidiabetics"
    pharmacologicalClass: { type: String, trim: true }, // e.g. "Beta-lactam", "Proton-pump inhibitor"
    atcCode: { type: String, trim: true },              // WHO ATC classification code

    indications: [String],
    contraindications: [String],
    sideEffects: [String],
    interactions: [String],           // Drug-drug / drug-food interactions
    warnings: [String],               // Black-box / special warnings

    // ── Regulatory & Safety ──────────────────────────────────
    isPrescriptionRequired: { type: Boolean, default: true },

    /**
     * India Drugs & Cosmetics Act Schedules:
     *  H   – Prescription-only (most Rx drugs)
     *  H1  – Prescription + special recording (e.g. 3rd-gen cephalosporins, fluoroquinolones)
     *  X   – Narcotic / psychotropic (requires DEA-equivalent licence)
     *  G   – Caution label required (sold under medical supervision)
     *  J   – Diseases for which no drug may be advertised to public
     *  C   – Biological products requiring refrigeration
     *  C1  – Biological requiring stricter conditions
     *  None – OTC
     */
    schedule: {
      type: String,
      enum: ['H', 'H1', 'X', 'G', 'J', 'C', 'C1', 'None'],
      default: 'None',
    },

    // Controlled substances need a licence number
    narcoticLicenceRequired: { type: Boolean, default: false },

    saltComposition: [saltCompositionSchema],

    // ── Storage ──────────────────────────────────────────────
    storageConditions: {
      temperature: {
        min: { type: Number },         // °C
        max: { type: Number },
        label: { type: String, trim: true }, // "Store below 25°C", "Refrigerate (2–8°C)"
      },
      lightSensitive: { type: Boolean, default: false },
      moistureSensitive: { type: Boolean, default: false },
      requiresColdChain: { type: Boolean, default: false },
    },

    // ── HSN / GST ────────────────────────────────────────────
    /**
     * Reference to HsnCode collection.
     * Upload flow:
     *   1. Admin uploads Excel/PDF → /api/hsn/upload bulk-creates HsnCode docs.
     *   2. Pharmacist enters HSN code on medicine form.
     *   3. Frontend calls GET /api/hsn/:code → returns { gstPercentage }.
     *   4. gstPercentage is auto-filled; both fields are saved here.
     *
     * We store the gstPercentage snapshot so reads don't need a populate.
     */
    hsnCode: {
      type: Schema.Types.ObjectId,
      ref: 'HsnCode',
    },
    // Snapshot – auto-populated via pre-save hook below
    gstPercentage: {
      type: Number,
      enum: [0, 5, 12, 18, 28],
      default: 5, // Most medicines attract 5% GST in India
    },
    cgstPercentage: { type: Number },
    sgstPercentage: { type: Number },
    igstPercentage: { type: Number },

    // ── Inventory (per-store) ─────────────────────────────────
    inventory: [inventorySchema],

    // ── Packaging & Pricing ──────────────────────────────────
    packaging: {
      type: String,
      required: true,
      trim: true, // e.g. "Strip of 10 Tablets", "Bottle of 200ml"
    },
    packSize: { type: Number },        // numeric pack size for calculations
    packUnit: { type: String, trim: true }, // "Tablets", "ml", "g"

    mrp: { type: Number, required: true, min: 0 },
    ptr: { type: Number, min: 0 },    // Price to Retailer
    pts: { type: Number, min: 0 },    // Price to Stockist

    // ── Regulatory IDs ───────────────────────────────────────
    regulatoryInfo: {
      cdscoDrugLicenceNo: { type: String, trim: true }, // Central Drugs Standard Control Organisation
      stateLicenceNo: { type: String, trim: true },
      importLicenceNo: { type: String, trim: true },    // For imported drugs
      fdaApprovalNo: { type: String, trim: true },      // If US-origin
    },

    // ── Media & Search ───────────────────────────────────────
    images: [
      {
        url: { type: String, required: true },
        altText: { type: String, trim: true },
        isPrimary: { type: Boolean, default: false },
      },
    ],
    searchKeywords: [String],

    // ── Manufacturer / Supplier ──────────────────────────────
    manufacturer: { type: String, required: true, trim: true },
    manufacturerAddress: { type: String, trim: true },
    countryOfOrigin: { type: String, trim: true, default: 'India' },
   

    // ── Status ───────────────────────────────────────────────
    isDiscontinued: { type: Boolean, default: false },
    discontinuedReason: { type: String, trim: true },
    isApproved: { type: Boolean, default: false }, // Admin approval before listing
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },

    // ── Audit ────────────────────────────────────────────────
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// ─── Virtuals ────────────────────────────────────────────────

// Available stock across all stores (sum)
medicineSchema.virtual('totalStock').get(function () {
  return (this.inventory ?? []).reduce((sum, inv) => sum + (inv.stockQuantity || 0), 0);
});

// True if at least one store has non-expired, in-stock inventory
medicineSchema.virtual('isAvailable').get(function () {
  const now = new Date();
  return (this.inventory ?? []).some(
    (inv) => inv.stockQuantity > 0 && inv.expiryDate > now && inv.isActive
  );
});

// ─── Hooks ───────────────────────────────────────────────────

/**
 * Before saving a Medicine, if hsnCode is provided and gstPercentage
 * hasn't been manually set via the HSN lookup, attempt to populate it.
 * The recommended flow is: frontend fetches GST from /api/hsn/:code
 * and sends both hsnCode (ObjectId) and gstPercentage in the payload.
 * This hook acts as a safety net for server-side saves.
 */
medicineSchema.pre('save', async function () {
  // Sync GST breakdown
  if (this.isModified('gstPercentage')) {
    const half = this.gstPercentage / 2;
    this.cgstPercentage = half;
    this.sgstPercentage = half;
    this.igstPercentage = this.gstPercentage;
  }

  // Auto-generate slug if not present
  if (!this.slug && this.name) {
    const base = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    this.slug = `${base}-${Date.now()}`;
  }

   
});

// ─── Indexes ─────────────────────────────────────────────────

medicineSchema.index({ 'inventory.storeId': 1 });
medicineSchema.index({ 'inventory.expiryDate': 1 }); // for expiry alerts
medicineSchema.index({ hsnCode: 1 });
medicineSchema.index({ isDiscontinued: 1, isApproved: 1 });
medicineSchema.index({
  name: 'text',
  brandName: 'text',
  genericName: 'text',
  searchKeywords: 'text',
});

const Medicine = mongoose.model('Medicine', medicineSchema);
export default Medicine;