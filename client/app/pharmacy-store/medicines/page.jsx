"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  PackagePlus,
  PackageMinus,
  AlertTriangle,
  Clock,
  BarChart3,
  Layers,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Minus,
  Eye,
  Edit2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Info,
  HelpCircle,
  BookOpen,
  Truck,
  ShoppingCart,
  Warehouse,
  Tag,
  Calendar,
  Hash,
  DollarSign,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Send,
  Bell,
  FileText,
  Zap,
  Shield,
  ClipboardList,
  RotateCcw,
  Move,
  BoxSelect,
  Boxes,
} from "lucide-react";

import {
  fetchMedicines,
  fetchMedicineInventoryDetail,
  fetchMedicineStock,
  addStock,
  deductStock,
  updateMedicineInventory,
  fetchInventoryBatches,
  updateBatch,
  fetchExpiryAlerts,
  fetchLowStock,
  requestStock,
  fetchInventoryMovements,
  fetchInventorySummary,
  fetchSuppliers,
  fetchPurchaseOrders,
  createPurchaseOrder,
  fetchPurchaseOrder,
  updatePurchaseOrderStatus,
  receivePurchaseOrderStock,
  fetchAnalyticsOverview,
  fetchTopMedicines,
  fetchInventoryValue,
  clearError,
  clearSuccess,
} from "../../../store/slices/pharmacy/pharmacyStoreSlice";

// ── Animation variants ────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: "easeOut" } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18 } },
};

const slideIn = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

const stagger = {
  show: { transition: { staggerChildren: 0.07 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.22 } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
};

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",   label: "Overview",      icon: BarChart3 },
  { id: "medicines",  label: "Medicines",     icon: Package },
  { id: "batches",    label: "Batches",       icon: Layers },
  { id: "movements",  label: "Movements",     icon: Activity },
  { id: "suppliers",  label: "Suppliers",     icon: Truck },
  { id: "purchase",   label: "Purchase Orders", icon: ShoppingCart },
  { id: "alerts",     label: "Alerts",        icon: Bell },
  { id: "help",       label: "Help",          icon: HelpCircle },
];

const MOVEMENT_TYPES = [
  "Purchase", "Sale", "Reservation", "Release",
  "Adjustment_Add", "Adjustment_Sub", "Damage",
  "Expiry", "Return", "Transfer_In", "Transfer_Out",
];

const MOVEMENT_ICONS = {
  Purchase:       { icon: ArrowUpRight,  cls: "text-success" },
  Sale:           { icon: ArrowDownRight,cls: "text-error"   },
  Reservation:    { icon: BoxSelect,     cls: "text-warning" },
  Release:        { icon: RotateCcw,     cls: "text-info"    },
  Adjustment_Add: { icon: Plus,          cls: "text-success" },
  Adjustment_Sub: { icon: Minus,         cls: "text-error"   },
  Damage:         { icon: AlertTriangle, cls: "text-warning" },
  Expiry:         { icon: Clock,         cls: "text-error"   },
  Return:         { icon: RotateCcw,     cls: "text-info"    },
  Transfer_In:    { icon: Move,          cls: "text-success" },
  Transfer_Out:   { icon: Move,          cls: "text-error"   },
};

const DATE_FILTERS = [
  { value: "today",      label: "Today" },
  { value: "last7days",  label: "Last 7 Days" },
  { value: "last30days", label: "Last 30 Days" },
  { value: "custom",     label: "Custom Range" },
];

// ── Shared UI Atoms ───────────────────────────────────────────────────────────

function Spinner({ size = "md" }) {
  return <span className={`loading loading-spinner loading-${size}`} />;
}

function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center justify-center py-20 gap-4 text-center"
    >
      <div className="bg-primary/10 rounded-full p-5">
        <Icon className="w-10 h-10 text-primary" />
      </div>
      <div>
        <p className="font-montserrat font-bold text-sm text-base-content">{title}</p>
        <p className="text-base-content/50 text-xs mt-1 max-w-xs">{body}</p>
      </div>
      {action}
    </motion.div>
  );
}

function SectionHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <h2 className="font-montserrat font-extrabold text-xl text-base-content">{title}</h2>
        {subtitle && <p className="text-base-content/50 text-xs mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, trend, color = "primary", loading }) {
  return (
    <motion.div variants={fadeUp} className="stat-card">
      <div className="flex items-start justify-between">
        <div className={`bg-${color}/10 rounded-xl p-2.5`}>
          <Icon className={`w-5 h-5 text-${color}`} />
        </div>
        {trend !== undefined && (
          <span className={`badge badge-xs ${trend >= 0 ? "badge-success" : "badge-error"}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      {loading ? (
        <div className="skeleton h-8 w-20 mt-3 rounded" />
      ) : (
        <p className="stat-card-value mt-3">{value ?? "—"}</p>
      )}
      <p className="stat-card-label">{label}</p>
    </motion.div>
  );
}

function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button
        className="btn btn-ghost btn-sm btn-circle"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-xs text-base-content/60">
        {page} / {totalPages}
      </span>
      <button
        className="btn btn-ghost btn-sm btn-circle"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function Modal({ open, onClose, title, children, maxW = "max-w-2xl" }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-neutral/60 backdrop-blur-soft"
            onClick={onClose}
          />
          <motion.div
            variants={scaleIn}
            initial="hidden"
            animate="show"
            exit="exit"
            className={`relative bg-base-100 rounded-[var(--r-box)] shadow-depth-lg w-full ${maxW} max-h-[90vh] overflow-y-auto`}
          >
            <div className="flex items-center justify-between p-5 border-b border-base-300 sticky top-0 bg-base-100 z-10">
              <h3 className="font-montserrat font-bold text-sm">{title}</h3>
              <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function FormField({ label, required, error, children, hint }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="label">
        <span className="label-text">
          {label} {required && <span className="text-error">*</span>}
        </span>
      </label>
      {children}
      {hint && <p className="text-[10px] text-base-content/40">{hint}</p>}
      {error && <p className="text-[10px] text-error">{error}</p>}
    </div>
  );
}

// ── OVERVIEW TAB ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const dispatch = useDispatch();
  const { inventorySummary, inventoryValue, topMedicines, analyticsOverview, loading } = useSelector(
    (s) => s.pharmacyStore
  );

  useEffect(() => {
    dispatch(fetchInventorySummary());
    dispatch(fetchInventoryValue());
    dispatch(fetchTopMedicines({ dateFilter: "last30days", limit: 10 }));
    dispatch(fetchAnalyticsOverview({ dateFilter: "today" }));
  }, [dispatch]);

  const sum = inventorySummary || {};
  const val = inventoryValue   || {};

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
      {/* Stat strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total SKUs"        value={sum.totalSKUs}          icon={Boxes}     color="primary" loading={loading.inventorySummary} />
        <StatCard label="Total Units"       value={sum.totalUnits?.toLocaleString()} icon={Package} color="secondary" loading={loading.inventorySummary} />
        <StatCard label="Inventory Value"   value={val.totalSellValue ? `₹${val.totalSellValue?.toLocaleString()}` : "—"} icon={DollarSign} color="accent" loading={loading.inventoryValue} />
        <StatCard label="Low Stock Items"   value={sum.lowStockCount}      icon={AlertTriangle} color="warning" loading={loading.inventorySummary} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Out of Stock"      value={sum.outOfStockCount}    icon={PackageMinus} color="error"   loading={loading.inventorySummary} />
        <StatCard label="Expiring Soon"     value={sum.expiringSoonCount}  icon={Clock}        color="warning" loading={loading.inventorySummary} />
        <StatCard label="MRP Value"         value={val.totalMRPValue ? `₹${val.totalMRPValue?.toLocaleString()}` : "—"} icon={Tag} color="info" loading={loading.inventoryValue} />
        <StatCard label="Cost Value"        value={val.totalCostValue ? `₹${val.totalCostValue?.toLocaleString()}` : "—"} icon={TrendingDown} color="secondary" loading={loading.inventoryValue} />
      </div>

      {/* Thresholds note */}
      {sum.lowStockThreshold && (
        <div className="alert alert-info text-xs">
          <Info className="w-4 h-4 shrink-0" />
          <span>
            Low stock threshold: <strong>{sum.lowStockThreshold} units</strong>. Expiry alert window:{" "}
            <strong>{sum.expiryAlertDays} days</strong>.
          </span>
        </div>
      )}

      {/* Top medicines */}
      {topMedicines?.length > 0 && (
        <div>
          <SectionHeader title="Top Medicines (30 Days)" subtitle="By revenue generated" />
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Medicine</th>
                    <th>Qty Sold</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topMedicines.map((m, i) => (
                    <tr key={m._id || i}>
                      <td className="text-base-content/40 font-mono text-[10px]">{i + 1}</td>
                      <td>
                        <div className="font-semibold text-xs">{m.brandName || m.name}</div>
                      </td>
                      <td className="text-xs">{m.totalQty?.toLocaleString()}</td>
                      <td className="text-xs font-semibold text-success">
                        ₹{m.totalRevenue?.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── MEDICINES TAB ─────────────────────────────────────────────────────────────

function MedicinesTab() {
  const dispatch = useDispatch();
  const { medicines, medicinesPagination, loading, errors, success, medicineInventoryDetail, medicineStockDetail } =
    useSelector((s) => s.pharmacyStore);

  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState("");
  const [category, setCategory]   = useState("");
  const [lowStock, setLowStock]   = useState(false);
  const [expiring, setExpiring]   = useState(false);
  const [outOfStock, setOutOfStock] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  const [detailMed, setDetailMed]     = useState(null);
  const [showAddStock, setShowAddStock]   = useState(false);
  const [showDeduct, setShowDeduct]       = useState(false);
  const [showUpdateInv, setShowUpdateInv] = useState(false);
  const [showRequestStock, setShowRequestStock] = useState(false);
  const [selectedMed, setSelectedMed] = useState(null);

  const searchTimer = useRef(null);

  const load = useCallback(() => {
    dispatch(fetchMedicines({ page, limit: 20, search, category, lowStock, expiringSoon: expiring }));
  }, [dispatch, page, search, category, lowStock, expiring]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (success.addStock || success.deductStock || success.updateMedicineInventory || success.requestStock) {
      load();
      setShowAddStock(false);
      setShowDeduct(false);
      setShowUpdateInv(false);
      setShowRequestStock(false);
      ["addStock","deductStock","updateMedicineInventory","requestStock"].forEach((k) =>
        dispatch(clearSuccess(k))
      );
    }
  }, [success, load, dispatch]);

  const handleSearch = (val) => {
    setSearchInput(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setSearch(val); setPage(1); }, 400);
  };

  const openDetail = (inv) => {
    setDetailMed(inv);
    dispatch(fetchMedicineInventoryDetail(inv.medicineId?._id || inv.medicineId));
    dispatch(fetchMedicineStock(inv.medicineId?._id || inv.medicineId));
  };

  const openAction = (inv, action) => {
    setSelectedMed(inv);
    if (action === "add")     setShowAddStock(true);
    if (action === "deduct")  setShowDeduct(true);
    if (action === "update")  setShowUpdateInv(true);
    if (action === "request") setShowRequestStock(true);
  };

  const stockBadge = (inv) => {
    if (inv.isOutOfStock) return <span className="badge badge-error badge-sm">Out of Stock</span>;
    if (inv.isLowStock)   return <span className="badge badge-warning badge-sm">Low Stock</span>;
    return <span className="badge badge-success badge-sm">In Stock</span>;
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
            <input
              className="input-field pl-9"
              placeholder="Search by name, brand, generic…"
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              className={`btn btn-sm ${lowStock ? "btn-warning" : "btn-ghost"}`}
              onClick={() => { setLowStock(!lowStock); setPage(1); }}
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Low Stock
            </button>
            <button
              className={`btn btn-sm ${expiring ? "btn-error" : "btn-ghost"}`}
              onClick={() => { setExpiring(!expiring); setPage(1); }}
            >
              <Clock className="w-3.5 h-3.5" /> Expiring
            </button>
            <button
              className="btn btn-ghost btn-sm btn-circle"
              onClick={load}
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading.medicines ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {errors.medicines && (
        <div className="alert alert-error text-xs">
          <AlertTriangle className="w-4 h-4" /> {errors.medicines.message}
        </div>
      )}

      {/* Table */}
      {loading.medicines && medicines.length === 0 ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : medicines.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No medicines found"
          body="Try adjusting filters or search terms."
          action={<button className="btn btn-primary btn-sm" onClick={load}>Refresh</button>}
        />
      ) : (
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Category</th>
                    <th>Stock</th>
                    <th>MRP / Sell</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {medicines.map((inv) => {
                    const med = inv.medicineId || {};
                    return (
                      <motion.tr key={inv._id} variants={slideIn} layout>
                        <td>
                          <div>
                            <p className="font-semibold text-xs">{med.brandName || med.name}</p>
                            <p className="text-[10px] text-base-content/40">{med.genericName}</p>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-secondary badge-xs">{med.category}</span>
                        </td>
                        <td>
                          <div className="text-xs">
                            <span className="font-semibold">{inv.availableStock ?? 0}</span>
                            <span className="text-base-content/40"> / {inv.stockQuantity ?? 0}</span>
                          </div>
                          <p className="text-[10px] text-base-content/40">avail / total</p>
                        </td>
                        <td>
                          <p className="text-[10px] text-base-content/40 line-through">₹{inv.mrp}</p>
                          <p className="text-xs font-semibold text-success">₹{inv.finalPrice}</p>
                        </td>
                        <td>{stockBadge(inv)}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button
                              className="btn btn-ghost btn-xs btn-circle"
                              title="View details"
                              onClick={() => openDetail(inv)}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              className="btn btn-success btn-xs"
                              title="Add stock"
                              onClick={() => openAction(inv, "add")}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              className="btn btn-error btn-xs"
                              title="Deduct stock"
                              onClick={() => openAction(inv, "deduct")}
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <button
                              className="btn btn-ghost btn-xs btn-circle"
                              title="Edit inventory"
                              onClick={() => openAction(inv, "update")}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              className="btn btn-ghost btn-xs btn-circle"
                              title="Request restock"
                              onClick={() => openAction(inv, "request")}
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination
            page={page}
            totalPages={medicinesPagination.totalPages}
            onPage={(p) => { setPage(p); }}
          />
        </motion.div>
      )}

      {/* Detail Modal */}
      <Modal
        open={!!detailMed}
        onClose={() => setDetailMed(null)}
        title="Medicine Inventory Detail"
        maxW="max-w-3xl"
      >
        {loading.medicineInventoryDetail ? (
          <div className="flex justify-center py-10"><Spinner size="lg" /></div>
        ) : medicineInventoryDetail ? (
          <MedicineDetailView data={medicineInventoryDetail} />
        ) : null}
      </Modal>

      {/* Add Stock Modal */}
      <Modal
        open={showAddStock}
        onClose={() => setShowAddStock(false)}
        title={`Add Stock — ${selectedMed?.medicineId?.brandName || ""}`}
      >
        <AddStockForm
          medicineId={selectedMed?.medicineId?._id || selectedMed?.medicineId}
          onClose={() => setShowAddStock(false)}
        />
      </Modal>

      {/* Deduct Stock Modal */}
      <Modal
        open={showDeduct}
        onClose={() => setShowDeduct(false)}
        title={`Deduct Stock — ${selectedMed?.medicineId?.brandName || ""}`}
      >
        <DeductStockForm
          medicineId={selectedMed?.medicineId?._id || selectedMed?.medicineId}
          maxQty={selectedMed?.availableStock || 0}
          onClose={() => setShowDeduct(false)}
        />
      </Modal>

      {/* Update Inventory Modal */}
      <Modal
        open={showUpdateInv}
        onClose={() => setShowUpdateInv(false)}
        title={`Update Inventory — ${selectedMed?.medicineId?.brandName || ""}`}
      >
        <UpdateInventoryForm
          medicineId={selectedMed?.medicineId?._id || selectedMed?.medicineId}
          current={selectedMed}
          onClose={() => setShowUpdateInv(false)}
        />
      </Modal>

      {/* Request Stock Modal */}
      <Modal
        open={showRequestStock}
        onClose={() => setShowRequestStock(false)}
        title={`Request Restock — ${selectedMed?.medicineId?.brandName || ""}`}
      >
        <RequestStockForm
          medicineId={selectedMed?.medicineId?._id || selectedMed?.medicineId}
          onClose={() => setShowRequestStock(false)}
        />
      </Modal>
    </div>
  );
}

// ── MedicineDetailView ────────────────────────────────────────────────────────

function MedicineDetailView({ data }) {
  const { inventory, batches } = data;
  if (!inventory) return <p className="text-xs text-base-content/50">No inventory record.</p>;

  const med = inventory.medicineId || {};

  return (
    <div className="space-y-6">
      {/* Identity */}
      <div className="bg-primary/5 rounded-[var(--r-box)] p-4 border border-primary/20">
        <h4 className="font-montserrat font-bold text-base">{med.brandName || med.name}</h4>
        <p className="text-xs text-base-content/50">{med.genericName}</p>
        <div className="flex gap-2 mt-2 flex-wrap">
          <span className="badge badge-secondary badge-sm">{med.category}</span>
          {inventory.isLowStock   && <span className="badge badge-warning badge-sm">Low Stock</span>}
          {inventory.isOutOfStock && <span className="badge badge-error badge-sm">Out of Stock</span>}
        </div>
      </div>

      {/* Stock */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Total Stock",     value: inventory.stockQuantity   },
          { label: "Available",       value: inventory.availableStock  },
          { label: "Reserved",        value: inventory.reservedStock   },
          { label: "Damaged",         value: inventory.damagedStock    },
          { label: "Returned",        value: inventory.returnedStock   },
          { label: "Reorder Level",   value: inventory.reorderLevel    },
        ].map(({ label, value }) => (
          <div key={label} className="stat-card py-3">
            <p className="text-xl font-black font-montserrat text-primary">{value ?? 0}</p>
            <p className="stat-card-label">{label}</p>
          </div>
        ))}
      </div>

      {/* Pricing */}
      <div>
        <p className="label-text mb-2">Pricing</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {[
            { label: "MRP",        value: `₹${inventory.mrp}` },
            { label: "Sell Price", value: `₹${inventory.sellingPrice}` },
            { label: "Discount",   value: `${inventory.discountPercent}%` },
            { label: "Final",      value: `₹${inventory.finalPrice}`, bold: true },
          ].map(({ label, value, bold }) => (
            <div key={label} className="bg-base-200 rounded-[var(--r-field)] p-3">
              <p className={`${bold ? "font-bold text-success" : ""} text-base`}>{value}</p>
              <p className="text-[10px] text-base-content/40 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Batches */}
      {batches?.length > 0 && (
        <div>
          <p className="label-text mb-2">Batches ({batches.length})</p>
          <div className="space-y-2">
            {batches.map((b) => (
              <div
                key={b._id}
                className="flex items-center justify-between bg-base-200 rounded-[var(--r-field)] px-4 py-2.5 text-xs"
              >
                <div>
                  <span className="font-semibold">{b.batchNumber}</span>
                  <span className="text-base-content/40 ml-2">
                    Exp: {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString("en-IN") : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span>{b.remainingQuantity} units</span>
                  {b.isNearExpiry && <span className="badge badge-warning badge-xs">Near Expiry</span>}
                  <span className={`badge badge-xs ${b.status === "Active" ? "badge-success" : "badge-error"}`}>
                    {b.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── AddStockForm ──────────────────────────────────────────────────────────────

function AddStockForm({ medicineId, onClose }) {
  const dispatch = useDispatch();
  const { suppliers, loading, success, errors } = useSelector((s) => s.pharmacyStore);

  const [form, setForm] = useState({
    stockQuantity: "", batchNumber: "", expiryDate: "", manufacturingDate: "",
    mrp: "", sellingPrice: "", discountPercent: "0",
    purchasePrice: "", purchaseInvoiceNo: "", purchaseInvoiceDate: "",
    supplierId: "", rackLocation: "",
  });
  const [errs, setErrs] = useState({});

  useEffect(() => {
    dispatch(fetchSuppliers({ limit: 100 }));
  }, [dispatch]);

  useEffect(() => {
    if (success.addStock) onClose();
  }, [success.addStock, onClose]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.stockQuantity || +form.stockQuantity <= 0) e.stockQuantity = "Must be > 0";
    if (!form.batchNumber)   e.batchNumber  = "Required";
    if (!form.expiryDate)    e.expiryDate   = "Required";
    if (!form.mrp || +form.mrp <= 0) e.mrp = "Must be > 0";
    if (!form.sellingPrice || +form.sellingPrice <= 0) e.sellingPrice = "Must be > 0";
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    dispatch(addStock({
      medicineId,
      stockQuantity:      +form.stockQuantity,
      batchNumber:        form.batchNumber,
      expiryDate:         form.expiryDate,
      mrp:                +form.mrp,
      sellingPrice:       +form.sellingPrice,
      discountPercent:    +form.discountPercent,
      manufacturingDate:  form.manufacturingDate || undefined,
      purchasePrice:      form.purchasePrice ? +form.purchasePrice : undefined,
      purchaseInvoiceNo:  form.purchaseInvoiceNo || undefined,
      purchaseInvoiceDate:form.purchaseInvoiceDate || undefined,
      supplierId:         form.supplierId || undefined,
      rackLocation:       form.rackLocation || undefined,
    }));
  };

  return (
    <div className="space-y-4">
      {errors.addStock && (
        <div className="alert alert-error text-xs">
          <AlertTriangle className="w-4 h-4" /> {errors.addStock.message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Quantity" required error={errs.stockQuantity}>
          <input className="input-field" type="number" min="1" value={form.stockQuantity} onChange={set("stockQuantity")} />
        </FormField>
        <FormField label="Batch Number" required error={errs.batchNumber}>
          <input className="input-field" value={form.batchNumber} onChange={set("batchNumber")} />
        </FormField>
        <FormField label="Expiry Date" required error={errs.expiryDate}>
          <input className="input-field" type="date" value={form.expiryDate} onChange={set("expiryDate")} />
        </FormField>
        <FormField label="Manufacturing Date">
          <input className="input-field" type="date" value={form.manufacturingDate} onChange={set("manufacturingDate")} />
        </FormField>
        <FormField label="MRP (₹)" required error={errs.mrp}>
          <input className="input-field" type="number" min="0" step="0.01" value={form.mrp} onChange={set("mrp")} />
        </FormField>
        <FormField label="Selling Price (₹)" required error={errs.sellingPrice}>
          <input className="input-field" type="number" min="0" step="0.01" value={form.sellingPrice} onChange={set("sellingPrice")} />
        </FormField>
        <FormField label="Discount (%)">
          <input className="input-field" type="number" min="0" max="100" value={form.discountPercent} onChange={set("discountPercent")} />
        </FormField>
        <FormField label="Purchase Price (₹)" hint="Internal only — not shown to customers">
          <input className="input-field" type="number" min="0" step="0.01" value={form.purchasePrice} onChange={set("purchasePrice")} />
        </FormField>
        <FormField label="Invoice No.">
          <input className="input-field" value={form.purchaseInvoiceNo} onChange={set("purchaseInvoiceNo")} />
        </FormField>
        <FormField label="Invoice Date">
          <input className="input-field" type="date" value={form.purchaseInvoiceDate} onChange={set("purchaseInvoiceDate")} />
        </FormField>
        <FormField label="Supplier">
          <select className="input-field" value={form.supplierId} onChange={set("supplierId")}>
            <option value="">— Select supplier —</option>
            {suppliers.map((s) => (
              <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
            ))}
          </select>
        </FormField>
        <FormField label="Rack Location" hint="e.g. Aisle-3 / Rack-B / Shelf-2">
          <input className="input-field" value={form.rackLocation} onChange={set("rackLocation")} />
        </FormField>
      </div>

      <div className="flex gap-3 pt-2 justify-end">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        <button
          className="btn btn-primary btn-sm"
          onClick={submit}
          disabled={loading.addStock}
        >
          {loading.addStock ? <Spinner size="xs" /> : <PackagePlus className="w-4 h-4" />}
          Add Stock
        </button>
      </div>
    </div>
  );
}

// ── DeductStockForm ───────────────────────────────────────────────────────────

function DeductStockForm({ medicineId, maxQty, onClose }) {
  const dispatch = useDispatch();
  const { loading, success, errors } = useSelector((s) => s.pharmacyStore);

  const [form, setForm] = useState({
    quantity: "", batchNumber: "", reason: "", movementType: "Adjustment_Sub",
  });
  const [errs, setErrs] = useState({});

  useEffect(() => { if (success.deductStock) onClose(); }, [success.deductStock, onClose]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.quantity || +form.quantity <= 0) e.quantity = "Must be > 0";
    if (+form.quantity > maxQty) e.quantity = `Max available: ${maxQty}`;
    setErrs(e);
    return !Object.keys(e).length;
  };

  const submit = () => {
    if (!validate()) return;
    dispatch(deductStock({
      medicineId,
      quantity:     +form.quantity,
      movementType: form.movementType,
      batchNumber:  form.batchNumber || undefined,
      reason:       form.reason || undefined,
    }));
  };

  return (
    <div className="space-y-4">
      {errors.deductStock && (
        <div className="alert alert-error text-xs">
          <AlertTriangle className="w-4 h-4" /> {errors.deductStock.message}
        </div>
      )}

      <div className="alert alert-warning text-xs">
        <AlertTriangle className="w-4 h-4" />
        Available stock: <strong>{maxQty} units</strong>. FEFO batch auto-selected if no batch specified.
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Quantity" required error={errs.quantity}>
          <input className="input-field" type="number" min="1" max={maxQty} value={form.quantity} onChange={set("quantity")} />
        </FormField>
        <FormField label="Movement Type" required>
          <select className="input-field" value={form.movementType} onChange={set("movementType")}>
            {["Adjustment_Sub","Damage","Expiry","Transfer_Out"].map((t) => (
              <option key={t} value={t}>{t.replace("_", " ")}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Batch Number" hint="Leave blank to auto-select FEFO">
          <input className="input-field" value={form.batchNumber} onChange={set("batchNumber")} placeholder="Optional" />
        </FormField>
        <FormField label="Reason">
          <input className="input-field" value={form.reason} onChange={set("reason")} placeholder="e.g. damaged on shelf" />
        </FormField>
      </div>

      <div className="flex gap-3 pt-2 justify-end">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-error btn-sm" onClick={submit} disabled={loading.deductStock}>
          {loading.deductStock ? <Spinner size="xs" /> : <PackageMinus className="w-4 h-4" />}
          Deduct Stock
        </button>
      </div>
    </div>
  );
}

// ── UpdateInventoryForm ───────────────────────────────────────────────────────

function UpdateInventoryForm({ medicineId, current, onClose }) {
  const dispatch = useDispatch();
  const { loading, success, errors } = useSelector((s) => s.pharmacyStore);

  const [form, setForm] = useState({
    mrp:           current?.mrp           ?? "",
    sellingPrice:  current?.sellingPrice  ?? "",
    discountPercent: current?.discountPercent ?? "",
    reorderLevel:  current?.reorderLevel  ?? "",
    minimumStock:  current?.minimumStock  ?? "",
    maximumStock:  current?.maximumStock  ?? "",
    rackLocation:  current?.rackLocation  ?? "",
    isActive:      current?.isActive      ?? true,
  });

  useEffect(() => { if (success.updateMedicineInventory) onClose(); }, [success.updateMedicineInventory, onClose]);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const submit = () => {
    dispatch(updateMedicineInventory({
      medicineId,
      ...Object.fromEntries(
        Object.entries(form).map(([k, v]) =>
          typeof v === "string" && v !== "" && !isNaN(v) ? [k, +v] : [k, v]
        )
      ),
    }));
  };

  return (
    <div className="space-y-4">
      {errors.updateMedicineInventory && (
        <div className="alert alert-error text-xs">
          <AlertTriangle className="w-4 h-4" /> {errors.updateMedicineInventory.message}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <FormField label="MRP (₹)">
          <input className="input-field" type="number" min="0" step="0.01" value={form.mrp} onChange={set("mrp")} />
        </FormField>
        <FormField label="Selling Price (₹)">
          <input className="input-field" type="number" min="0" step="0.01" value={form.sellingPrice} onChange={set("sellingPrice")} />
        </FormField>
        <FormField label="Discount (%)">
          <input className="input-field" type="number" min="0" max="100" value={form.discountPercent} onChange={set("discountPercent")} />
        </FormField>
        <FormField label="Reorder Level" hint="Alert triggers at this quantity">
          <input className="input-field" type="number" min="0" value={form.reorderLevel} onChange={set("reorderLevel")} />
        </FormField>
        <FormField label="Min Stock">
          <input className="input-field" type="number" min="0" value={form.minimumStock} onChange={set("minimumStock")} />
        </FormField>
        <FormField label="Max Stock">
          <input className="input-field" type="number" min="1" value={form.maximumStock} onChange={set("maximumStock")} />
        </FormField>
        <FormField label="Rack Location" hint="e.g. Aisle-3 / Rack-B">
          <input className="input-field" value={form.rackLocation} onChange={set("rackLocation")} />
        </FormField>
        <FormField label="Active">
          <label className="label cursor-pointer gap-3 justify-start">
            <input
              type="checkbox"
              className="checkbox checkbox-primary"
              checked={form.isActive}
              onChange={set("isActive")}
            />
            <span className="label-text">{form.isActive ? "Active" : "Inactive"}</span>
          </label>
        </FormField>
      </div>
      <div className="flex gap-3 pt-2 justify-end">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={loading.updateMedicineInventory}>
          {loading.updateMedicineInventory ? <Spinner size="xs" /> : <Check className="w-4 h-4" />}
          Save Changes
        </button>
      </div>
    </div>
  );
}

// ── RequestStockForm ──────────────────────────────────────────────────────────

function RequestStockForm({ medicineId, onClose }) {
  const dispatch = useDispatch();
  const { suppliers, loading, success, errors } = useSelector((s) => s.pharmacyStore);
  const [form, setForm] = useState({ requiredQuantity: "", urgency: "Medium", supplierId: "", notes: "" });
  const [errs, setErrs] = useState({});

  useEffect(() => { dispatch(fetchSuppliers({ limit: 100 })); }, [dispatch]);
  useEffect(() => { if (success.requestStock) onClose(); }, [success.requestStock, onClose]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = () => {
    const e = {};
    if (!form.requiredQuantity || +form.requiredQuantity <= 0) e.requiredQuantity = "Must be > 0";
    setErrs(e);
    if (Object.keys(e).length) return;
    dispatch(requestStock({
      medicineId,
      requiredQuantity: +form.requiredQuantity,
      urgency:    form.urgency,
      supplierId: form.supplierId || undefined,
      notes:      form.notes     || undefined,
    }));
  };

  return (
    <div className="space-y-4">
      {errors.requestStock && (
        <div className="alert alert-error text-xs">
          <AlertTriangle className="w-4 h-4" /> {errors.requestStock.message}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Required Quantity" required error={errs.requiredQuantity}>
          <input className="input-field" type="number" min="1" value={form.requiredQuantity} onChange={set("requiredQuantity")} />
        </FormField>
        <FormField label="Urgency">
          <select className="input-field" value={form.urgency} onChange={set("urgency")}>
            {["Low","Medium","High","Critical"].map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Preferred Supplier">
          <select className="input-field" value={form.supplierId} onChange={set("supplierId")}>
            <option value="">— Any supplier —</option>
            {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </FormField>
        <FormField label="Notes">
          <input className="input-field" value={form.notes} onChange={set("notes")} placeholder="Optional context for admin" />
        </FormField>
      </div>
      <div className="flex gap-3 pt-2 justify-end">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={loading.requestStock}>
          {loading.requestStock ? <Spinner size="xs" /> : <Send className="w-4 h-4" />}
          Submit Request
        </button>
      </div>
    </div>
  );
}

// ── BATCHES TAB ───────────────────────────────────────────────────────────────

function BatchesTab() {
  const dispatch = useDispatch();
  const { inventoryBatches, batchesPagination, loading, errors, success } =
    useSelector((s) => s.pharmacyStore);

  const [page, setPage]       = useState(1);
  const [status, setStatus]   = useState("");
  const [nearExpiry, setNearExpiry] = useState(false);
  const [editBatch, setEditBatch]   = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const searchTimer = useRef(null);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    dispatch(fetchInventoryBatches({ page, limit: 20, status: status || undefined, nearExpiry, search: search || undefined }));
  }, [dispatch, page, status, nearExpiry, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (success.updateBatch) { load(); setEditBatch(null); dispatch(clearSuccess("updateBatch")); } }, [success.updateBatch]);

  const handleSearch = (val) => {
    setSearchInput(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setSearch(val); setPage(1); }, 400);
  };

  const daysLeft = (date) => {
    if (!date) return null;
    return Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
  };

  const expiryBadge = (b) => {
    const d = daysLeft(b.expiryDate);
    if (d === null) return null;
    if (d < 0)   return <span className="badge badge-error badge-xs">Expired</span>;
    if (d <= 30) return <span className="badge badge-error badge-xs">{d}d left</span>;
    if (d <= 90) return <span className="badge badge-warning badge-xs">{d}d left</span>;
    return <span className="badge badge-success badge-xs">{d}d left</span>;
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
            <input
              className="input-field pl-9"
              placeholder="Search by medicine name…"
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <select className="input-field max-w-[140px]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            {["Active","Exhausted","Expired","Recalled","Quarantine","Damaged"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            className={`btn btn-sm ${nearExpiry ? "btn-warning" : "btn-ghost"}`}
            onClick={() => { setNearExpiry(!nearExpiry); setPage(1); }}
          >
            <Clock className="w-3.5 h-3.5" /> Near Expiry
          </button>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={load}>
            <RefreshCw className={`w-4 h-4 ${loading.inventoryBatches ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {errors.inventoryBatches && (
        <div className="alert alert-error text-xs"><AlertTriangle className="w-4 h-4" /> {errors.inventoryBatches.message}</div>
      )}

      {loading.inventoryBatches && inventoryBatches.length === 0 ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : inventoryBatches.length === 0 ? (
        <EmptyState icon={Layers} title="No batches found" body="Try changing filters." />
      ) : (
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Batch No.</th>
                    <th>Medicine</th>
                    <th>Expiry</th>
                    <th>Remaining</th>
                    <th>Status</th>
                    <th>FEFO Priority</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryBatches.map((b) => {
                    const med = b.medicineId || {};
                    return (
                      <tr key={b._id}>
                        <td className="font-mono text-[10px] font-semibold">{b.batchNumber}</td>
                        <td>
                          <p className="font-semibold text-xs">{med.brandName || med.name}</p>
                          <p className="text-[10px] text-base-content/40">{med.category}</p>
                        </td>
                        <td>
                          <p className="text-xs">{b.expiryDate ? new Date(b.expiryDate).toLocaleDateString("en-IN") : "—"}</p>
                          {expiryBadge(b)}
                        </td>
                        <td className="font-semibold text-xs">{b.remainingQuantity ?? 0}</td>
                        <td>
                          <span className={`badge badge-xs ${b.status === "Active" ? "badge-success" : b.status === "Expired" ? "badge-error" : "badge-warning"}`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="font-mono text-[10px] text-base-content/40">{b.fifoPriority}</td>
                        <td>
                          <button className="btn btn-ghost btn-xs btn-circle" title="Edit batch" onClick={() => setEditBatch(b)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={page} totalPages={batchesPagination.totalPages} onPage={setPage} />
        </motion.div>
      )}

      {/* Edit Batch Modal */}
      <Modal open={!!editBatch} onClose={() => setEditBatch(null)} title="Update Batch">
        {editBatch && <EditBatchForm batch={editBatch} onClose={() => setEditBatch(null)} />}
      </Modal>
    </div>
  );
}

function EditBatchForm({ batch, onClose }) {
  const dispatch = useDispatch();
  const { loading, errors } = useSelector((s) => s.pharmacyStore);
  const [form, setForm] = useState({
    expiryDate:      batch.expiryDate ? new Date(batch.expiryDate).toISOString().split("T")[0] : "",
    status:          batch.status,
    damagedQuantity: batch.damagedQuantity ?? 0,
    returnedQuantity:batch.returnedQuantity ?? 0,
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = () => dispatch(updateBatch({ batchId: batch._id, ...form }));

  return (
    <div className="space-y-4">
      {errors.updateBatch && (
        <div className="alert alert-error text-xs"><AlertTriangle className="w-4 h-4" /> {errors.updateBatch.message}</div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Expiry Date">
          <input className="input-field" type="date" value={form.expiryDate} onChange={set("expiryDate")} />
        </FormField>
        <FormField label="Status">
          <select className="input-field" value={form.status} onChange={set("status")}>
            {["Active","Exhausted","Expired","Recalled","Quarantine","Damaged"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Damaged Qty" hint="Cumulative total damaged units in this batch">
          <input className="input-field" type="number" min="0" value={form.damagedQuantity} onChange={set("damagedQuantity")} />
        </FormField>
        <FormField label="Returned Qty">
          <input className="input-field" type="number" min="0" value={form.returnedQuantity} onChange={set("returnedQuantity")} />
        </FormField>
      </div>
      <div className="flex gap-3 pt-2 justify-end">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={loading.updateBatch}>
          {loading.updateBatch ? <Spinner size="xs" /> : <Check className="w-4 h-4" />}
          Update Batch
        </button>
      </div>
    </div>
  );
}

// ── MOVEMENTS TAB ─────────────────────────────────────────────────────────────

function MovementsTab() {
  const dispatch = useDispatch();
  const { inventoryMovements, movementsPagination, loading, errors } = useSelector((s) => s.pharmacyStore);

  const [page, setPage]             = useState(1);
  const [movementType, setMovType]  = useState("");
  const [dateFilter, setDateFilter] = useState("last30days");
  const [startDate, setStartDate]   = useState("");
  const [endDate, setEndDate]       = useState("");

  const load = useCallback(() => {
    dispatch(fetchInventoryMovements({
      page, limit: 20,
      movementType: movementType || undefined,
      dateFilter,
      startDate: startDate || undefined,
      endDate:   endDate   || undefined,
    }));
  }, [dispatch, page, movementType, dateFilter, startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <select className="input-field max-w-[180px]" value={movementType} onChange={(e) => { setMovType(e.target.value); setPage(1); }}>
            <option value="">All Movement Types</option>
            {MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
          </select>
          <select className="input-field max-w-[160px]" value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}>
            {DATE_FILTERS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          {dateFilter === "custom" && (
            <>
              <input className="input-field max-w-[150px]" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <input className="input-field max-w-[150px]" type="date" value={endDate}   onChange={(e) => setEndDate(e.target.value)} />
            </>
          )}
          <button className="btn btn-ghost btn-sm btn-circle" onClick={load}>
            <RefreshCw className={`w-4 h-4 ${loading.inventoryMovements ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {errors.inventoryMovements && (
        <div className="alert alert-error text-xs"><AlertTriangle className="w-4 h-4" /> {errors.inventoryMovements.message}</div>
      )}

      {loading.inventoryMovements && inventoryMovements.length === 0 ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : inventoryMovements.length === 0 ? (
        <EmptyState icon={Activity} title="No movements found" body="Adjust date range or movement type filter." />
      ) : (
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Medicine</th>
                    <th>Batch</th>
                    <th>Qty Changed</th>
                    <th>Stock Before / After</th>
                    <th>Reference</th>
                    <th>Performed By</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryMovements.map((m) => {
                    const { icon: Icon, cls } = MOVEMENT_ICONS[m.movementType] || { icon: Activity, cls: "" };
                    return (
                      <tr key={m._id}>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <Icon className={`w-4 h-4 ${cls}`} />
                            <span className="text-[10px] font-semibold">{m.movementType?.replace("_", " ")}</span>
                          </div>
                        </td>
                        <td className="text-xs">
                          {m.medicineId?.brandName || m.medicineId?.name || "—"}
                        </td>
                        <td className="font-mono text-[10px]">{m.batchId?.batchNumber || "—"}</td>
                        <td className={`font-bold text-xs ${cls}`}>
                          {["Purchase","Adjustment_Add","Release","Transfer_In","Return"].includes(m.movementType) ? "+" : "-"}
                          {m.quantityChanged}
                        </td>
                        <td className="text-[10px] text-base-content/50">
                          {m.previousStock} → {m.newStock}
                        </td>
                        <td className="text-[10px]">{m.referenceModel} {m.reason ? `— ${m.reason}` : ""}</td>
                        <td className="text-[10px]">{m.performedBy?.name || "—"}</td>
                        <td className="text-[10px] text-base-content/40">
                          {m.createdAt ? new Date(m.createdAt).toLocaleDateString("en-IN") : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={page} totalPages={movementsPagination.totalPages} onPage={setPage} />
        </motion.div>
      )}
    </div>
  );
}

// ── SUPPLIERS TAB ─────────────────────────────────────────────────────────────

function SuppliersTab() {
  const dispatch = useDispatch();
  const { suppliers, suppliersPagination, loading, errors } = useSelector((s) => s.pharmacyStore);

  const [page, setPage]         = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch]     = useState("");
  const [activeOnly, setActive] = useState(true);
  const searchTimer = useRef(null);

  const load = useCallback(() => {
    dispatch(fetchSuppliers({ page, limit: 20, search: search || undefined, isActive: activeOnly }));
  }, [dispatch, page, search, activeOnly]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (val) => {
    setSearchInput(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setSearch(val); setPage(1); }, 400);
  };

  return (
    <div className="space-y-6">
      <div className="alert alert-info text-xs">
        <Shield className="w-4 h-4 shrink-0" />
        Supplier creation/edit requires Admin privileges. Contact your admin to add new suppliers.
      </div>

      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
            <input className="input-field pl-9" placeholder="Search suppliers…" value={searchInput} onChange={(e) => handleSearch(e.target.value)} />
          </div>
          <button className={`btn btn-sm ${activeOnly ? "btn-success" : "btn-ghost"}`} onClick={() => { setActive(!activeOnly); setPage(1); }}>
            Active Only
          </button>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={load}>
            <RefreshCw className={`w-4 h-4 ${loading.suppliers ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {errors.suppliers && (
        <div className="alert alert-error text-xs"><AlertTriangle className="w-4 h-4" /> {errors.suppliers.message}</div>
      )}

      {loading.suppliers && suppliers.length === 0 ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : suppliers.length === 0 ? (
        <EmptyState icon={Truck} title="No suppliers found" body="No suppliers match your search." />
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <motion.div key={s._id} variants={fadeUp} className="card p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-montserrat font-bold text-base">{s.name}</p>
                  <p className="text-[10px] font-mono text-primary">{s.code}</p>
                </div>
                <span className={`badge badge-xs ${s.isActive ? "badge-success" : "badge-error"}`}>
                  {s.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="space-y-1 text-xs text-base-content/60">
                <p><span className="font-semibold text-base-content">Email:</span> {s.contact?.email}</p>
                <p><span className="font-semibold text-base-content">Phone:</span> {s.contact?.phone}</p>
                <p><span className="font-semibold text-base-content">GST:</span> {s.legal?.gstNumber}</p>
                <p><span className="font-semibold text-base-content">DL No:</span> {s.legal?.dlNumber}</p>
                {s.address?.city && (
                  <p><span className="font-semibold text-base-content">City:</span> {s.address.city}</p>
                )}
              </div>
              {s.metrics?.rating > 0 && (
                <div className="flex items-center gap-2">
                  <div className="progress-bar flex-1">
                    <div className="progress-bar-fill" style={{ width: `${(s.metrics.rating / 5) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-base-content/50">{s.metrics.rating}/5</span>
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}
      <Pagination page={page} totalPages={suppliersPagination.totalPages} onPage={setPage} />
    </div>
  );
}

// ── PURCHASE ORDERS TAB ───────────────────────────────────────────────────────

function PurchaseOrdersTab() {
  const dispatch = useDispatch();
  const { purchaseOrders, purchaseOrdersPagination, currentPurchaseOrder, suppliers, medicines, loading, errors, success } =
    useSelector((s) => s.pharmacyStore);

  const [page, setPage]         = useState(1);
  const [status, setStatus]     = useState("");
  const [dateFilter, setDF]     = useState("last30days");
  const [showCreate, setCreate] = useState(false);
  const [showDetail, setDetail] = useState(false);
  const [showReceive, setReceive] = useState(false);

  const load = useCallback(() => {
    dispatch(fetchPurchaseOrders({ page, limit: 20, status: status || undefined, dateFilter }));
  }, [dispatch, page, status, dateFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (success.createPurchaseOrder) { load(); setCreate(false); dispatch(clearSuccess("createPurchaseOrder")); }
    if (success.updatePurchaseOrder) { load(); dispatch(clearSuccess("updatePurchaseOrder")); }
    if (success.receivePurchaseOrder){ load(); setReceive(false); dispatch(clearSuccess("receivePurchaseOrder")); }
  }, [success, load, dispatch]);

  const openDetail = (po) => {
    dispatch(fetchPurchaseOrder(po._id));
    setDetail(true);
  };

  const statusColor = (s) => ({
    Draft:             "badge-secondary",
    Sent:              "badge-info",
    Partially_Received:"badge-warning",
    Received:          "badge-success",
    Cancelled:         "badge-error",
    Returned:          "badge-error",
  }[s] || "badge-secondary");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <select className="input-field max-w-[180px]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          {["Draft","Sent","Partially_Received","Received","Cancelled"].map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
        <select className="input-field max-w-[160px]" value={dateFilter} onChange={(e) => { setDF(e.target.value); setPage(1); }}>
          {DATE_FILTERS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm btn-circle" onClick={load}>
          <RefreshCw className={`w-4 h-4 ${loading.purchaseOrders ? "animate-spin" : ""}`} />
        </button>
        <div className="sm:ml-auto">
          <button className="btn btn-primary btn-sm" onClick={() => setCreate(true)}>
            <Plus className="w-4 h-4" /> Create PO
          </button>
        </div>
      </div>

      {errors.purchaseOrders && (
        <div className="alert alert-error text-xs"><AlertTriangle className="w-4 h-4" /> {errors.purchaseOrders.message}</div>
      )}

      {loading.purchaseOrders && purchaseOrders.length === 0 ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : purchaseOrders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No purchase orders"
          body="Create your first PO to start receiving stock."
          action={<button className="btn btn-primary btn-sm" onClick={() => setCreate(true)}><Plus className="w-4 h-4" /> Create PO</button>}
        />
      ) : (
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Supplier</th>
                    <th>Status</th>
                    <th>Items</th>
                    <th>Grand Total</th>
                    <th>Expected Delivery</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrders.map((po) => (
                    <tr key={po._id}>
                      <td className="font-mono text-[10px] font-semibold">{po.poNumber}</td>
                      <td className="text-xs">{po.supplierId?.name || "—"}</td>
                      <td><span className={`badge badge-xs ${statusColor(po.status)}`}>{po.status?.replace("_"," ")}</span></td>
                      <td className="text-xs">{po.items?.length ?? 0}</td>
                      <td className="font-semibold text-xs">₹{po.financials?.grandTotal?.toLocaleString()}</td>
                      <td className="text-[10px] text-base-content/50">
                        {po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString("en-IN") : "—"}
                      </td>
                      <td className="text-[10px] text-base-content/40">
                        {po.createdAt ? new Date(po.createdAt).toLocaleDateString("en-IN") : "—"}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button className="btn btn-ghost btn-xs btn-circle" title="View PO" onClick={() => openDetail(po)}>
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {po.status === "Sent" && (
                            <button
                              className="btn btn-success btn-xs"
                              onClick={() => { dispatch(fetchPurchaseOrder(po._id)); setReceive(true); }}
                            >
                              <Download className="w-3 h-3" /> Receive
                            </button>
                          )}
                          {["Draft","Sent"].includes(po.status) && (
                            <button
                              className="btn btn-error btn-xs"
                              onClick={() => dispatch(updatePurchaseOrderStatus({ poId: po._id, status: "Cancelled" }))}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                          {po.status === "Draft" && (
                            <button
                              className="btn btn-info btn-xs"
                              onClick={() => dispatch(updatePurchaseOrderStatus({ poId: po._id, status: "Sent" }))}
                            >
                              <Send className="w-3 h-3" /> Send
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={page} totalPages={purchaseOrdersPagination.totalPages} onPage={setPage} />
        </motion.div>
      )}

      {/* Create PO Modal */}
      <Modal open={showCreate} onClose={() => setCreate(false)} title="Create Purchase Order" maxW="max-w-3xl">
        <CreatePOForm onClose={() => setCreate(false)} />
      </Modal>

      {/* Detail Modal */}
      <Modal open={showDetail} onClose={() => setDetail(false)} title="Purchase Order Detail" maxW="max-w-3xl">
        {loading.purchaseOrderDetail ? (
          <div className="flex justify-center py-10"><Spinner size="lg" /></div>
        ) : currentPurchaseOrder ? (
          <PODetailView po={currentPurchaseOrder} />
        ) : null}
      </Modal>

      {/* Receive Stock Modal */}
      <Modal open={showReceive} onClose={() => setReceive(false)} title="Receive PO Stock" maxW="max-w-3xl">
        {currentPurchaseOrder ? (
          <ReceivePOForm po={currentPurchaseOrder} onClose={() => setReceive(false)} />
        ) : (
          <div className="flex justify-center py-10"><Spinner size="lg" /></div>
        )}
      </Modal>
    </div>
  );
}

function CreatePOForm({ onClose }) {
  const dispatch = useDispatch();
  const { suppliers, medicines, loading, errors } = useSelector((s) => s.pharmacyStore);

  const [supplierId, setSupplierId] = useState("");
  const [expectedDeliveryDate, setEDD] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([{ medicineId: "", requestedQuantity: "", unitPrice: "" }]);
  const [errs, setErrs] = useState({});

  useEffect(() => {
    dispatch(fetchSuppliers({ limit: 100 }));
    dispatch(fetchMedicines({ limit: 100 }));
  }, [dispatch]);

  const addItem = () => setItems((i) => [...i, { medicineId: "", requestedQuantity: "", unitPrice: "" }]);
  const removeItem = (idx) => setItems((i) => i.filter((_, j) => j !== idx));
  const setItem = (idx, k) => (e) =>
    setItems((arr) => arr.map((it, j) => j === idx ? { ...it, [k]: e.target.value } : it));

  const validate = () => {
    const e = {};
    if (!supplierId) e.supplierId = "Required";
    items.forEach((it, i) => {
      if (!it.medicineId)      e[`med${i}`] = "Required";
      if (!it.requestedQuantity || +it.requestedQuantity <= 0) e[`qty${i}`] = "Must be > 0";
      if (!it.unitPrice || +it.unitPrice <= 0) e[`price${i}`] = "Must be > 0";
    });
    setErrs(e);
    return !Object.keys(e).length;
  };

  const submit = () => {
    if (!validate()) return;
    dispatch(createPurchaseOrder({
      supplierId,
      items: items.map((it) => ({
        medicineId:        it.medicineId,
        requestedQuantity: +it.requestedQuantity,
        unitPrice:         +it.unitPrice,
      })),
      expectedDeliveryDate: expectedDeliveryDate || undefined,
      notes: notes || undefined,
    }));
  };

  return (
    <div className="space-y-5">
      {errors.createPurchaseOrder && (
        <div className="alert alert-error text-xs"><AlertTriangle className="w-4 h-4" /> {errors.createPurchaseOrder.message}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Supplier" required error={errs.supplierId}>
          <select className="input-field" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">— Select Supplier —</option>
            {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </FormField>
        <FormField label="Expected Delivery Date">
          <input className="input-field" type="date" value={expectedDeliveryDate} onChange={(e) => setEDD(e.target.value)} />
        </FormField>
      </div>

      <FormField label="Notes">
        <input className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes for this PO" />
      </FormField>

      {/* Items */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="label-text">Line Items</p>
          <button className="btn btn-ghost btn-xs" onClick={addItem}><Plus className="w-3 h-3" /> Add Item</button>
        </div>
        <div className="space-y-3">
          {items.map((it, idx) => (
            <div key={idx} className="bg-base-200 rounded-[var(--r-field)] p-3 grid grid-cols-3 gap-3 relative">
              {items.length > 1 && (
                <button
                  className="absolute top-2 right-2 btn btn-ghost btn-xs btn-circle"
                  onClick={() => removeItem(idx)}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              <FormField label="Medicine" required error={errs[`med${idx}`]}>
                <select className="input-field" value={it.medicineId} onChange={setItem(idx, "medicineId")}>
                  <option value="">— Select —</option>
                  {medicines.map((m) => {
                    const med = m.medicineId || m;
                    return <option key={med._id} value={med._id}>{med.brandName || med.name}</option>;
                  })}
                </select>
              </FormField>
              <FormField label="Quantity" required error={errs[`qty${idx}`]}>
                <input className="input-field" type="number" min="1" value={it.requestedQuantity} onChange={setItem(idx, "requestedQuantity")} />
              </FormField>
              <FormField label="Unit Price (₹)" required error={errs[`price${idx}`]}>
                <input className="input-field" type="number" min="0" step="0.01" value={it.unitPrice} onChange={setItem(idx, "unitPrice")} />
              </FormField>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2 justify-end">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={loading.createPurchaseOrder}>
          {loading.createPurchaseOrder ? <Spinner size="xs" /> : <ShoppingCart className="w-4 h-4" />}
          Create PO
        </button>
      </div>
    </div>
  );
}

function PODetailView({ po }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 text-xs">
        {[
          { label: "PO Number",  value: po.poNumber },
          { label: "Status",     value: po.status?.replace("_"," ") },
          { label: "Supplier",   value: po.supplierId?.name },
          { label: "Grand Total",value: `₹${po.financials?.grandTotal?.toLocaleString()}` },
          { label: "Expected",   value: po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString("en-IN") : "—" },
          { label: "Received At",value: po.receivedAt ? new Date(po.receivedAt).toLocaleDateString("en-IN") : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-base-200 rounded-[var(--r-field)] p-3">
            <p className="text-[10px] text-base-content/40">{label}</p>
            <p className="font-semibold mt-0.5">{value || "—"}</p>
          </div>
        ))}
      </div>

      {po.notes && (
        <div className="alert alert-info text-xs"><Info className="w-4 h-4" /> {po.notes}</div>
      )}

      <div>
        <p className="label-text mb-2">Line Items</p>
        <div className="space-y-2">
          {po.items?.map((it, i) => {
            const med = it.medicineId || {};
            return (
              <div key={i} className="flex items-center justify-between bg-base-200 rounded-[var(--r-field)] px-4 py-2.5 text-xs">
                <div>
                  <p className="font-semibold">{med.brandName || med.name}</p>
                  <p className="text-[10px] text-base-content/40">{med.category}</p>
                </div>
                <div className="text-right">
                  <p>Req: {it.requestedQuantity} | Rcvd: {it.receivedQuantity}</p>
                  <p className="text-[10px] text-base-content/40">₹{it.unitPrice}/unit · Total ₹{it.totalPrice?.toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ReceivePOForm({ po, onClose }) {
  const dispatch = useDispatch();
  const { loading, errors } = useSelector((s) => s.pharmacyStore);

  const [items, setItems] = useState(
    (po.items || []).map((it) => ({
      medicineId:        it.medicineId?._id || it.medicineId,
      medicineName:      it.medicineId?.brandName || it.medicineId?.name || "Unknown",
      receivedQuantity:  it.requestedQuantity - (it.receivedQuantity || 0),
      batchNumber:       "",
      expiryDate:        "",
      manufacturingDate: "",
      mrp:               "",
      sellingPrice:      "",
    }))
  );

  const set = (idx, k) => (e) =>
    setItems((arr) => arr.map((it, j) => j === idx ? { ...it, [k]: e.target.value } : it));

  const submit = () => {
    dispatch(receivePurchaseOrderStock({
      poId: po._id,
      items: items
        .filter((it) => +it.receivedQuantity > 0 && it.batchNumber && it.expiryDate)
        .map((it) => ({
          medicineId:        it.medicineId,
          receivedQuantity:  +it.receivedQuantity,
          batchNumber:       it.batchNumber,
          expiryDate:        it.expiryDate,
          manufacturingDate: it.manufacturingDate || undefined,
          mrp:               it.mrp ? +it.mrp : undefined,
          sellingPrice:      it.sellingPrice ? +it.sellingPrice : undefined,
        })),
    }));
  };

  return (
    <div className="space-y-5">
      {errors.receivePurchaseOrder && (
        <div className="alert alert-error text-xs"><AlertTriangle className="w-4 h-4" /> {errors.receivePurchaseOrder.message}</div>
      )}
      <div className="alert alert-info text-xs">
        <Info className="w-4 h-4 shrink-0" />
        Fill batch details for each item. Skip items not yet received (set qty to 0).
      </div>
      <div className="space-y-4">
        {items.map((it, idx) => (
          <div key={idx} className="bg-base-200 rounded-[var(--r-box)] p-4 space-y-3">
            <p className="font-semibold text-xs">{it.medicineName}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <FormField label="Received Qty" required>
                <input className="input-field" type="number" min="0" value={it.receivedQuantity} onChange={set(idx, "receivedQuantity")} />
              </FormField>
              <FormField label="Batch Number" required>
                <input className="input-field" value={it.batchNumber} onChange={set(idx, "batchNumber")} />
              </FormField>
              <FormField label="Expiry Date" required>
                <input className="input-field" type="date" value={it.expiryDate} onChange={set(idx, "expiryDate")} />
              </FormField>
              <FormField label="Mfg. Date">
                <input className="input-field" type="date" value={it.manufacturingDate} onChange={set(idx, "manufacturingDate")} />
              </FormField>
              <FormField label="MRP (₹)">
                <input className="input-field" type="number" min="0" step="0.01" value={it.mrp} onChange={set(idx, "mrp")} />
              </FormField>
              <FormField label="Selling Price (₹)">
                <input className="input-field" type="number" min="0" step="0.01" value={it.sellingPrice} onChange={set(idx, "sellingPrice")} />
              </FormField>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-3 pt-2 justify-end">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-success btn-sm" onClick={submit} disabled={loading.receivePurchaseOrder}>
          {loading.receivePurchaseOrder ? <Spinner size="xs" /> : <Download className="w-4 h-4" />}
          Receive Stock
        </button>
      </div>
    </div>
  );
}

// ── ALERTS TAB ────────────────────────────────────────────────────────────────

function AlertsTab() {
  const dispatch = useDispatch();
  const { expiryAlerts, expiryAlertsMeta, lowStockItems, lowStockMeta, loading, errors } =
    useSelector((s) => s.pharmacyStore);

  const [activeAlert, setActive] = useState("expiry");
  const [days, setDays]   = useState(30);
  const [threshold, setThreshold] = useState(5);

  useEffect(() => {
    dispatch(fetchExpiryAlerts({ days }));
    dispatch(fetchLowStock({ threshold }));
  }, [dispatch, days, threshold]);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div
          className={`stat-card cursor-pointer border-2 transition-all ${activeAlert === "expiry" ? "border-warning" : "border-transparent"}`}
          onClick={() => setActive("expiry")}
        >
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-warning" />
            <p className="font-montserrat font-bold text-warning">Expiring Soon</p>
          </div>
          <p className="stat-card-value text-warning">{expiryAlertsMeta.count}</p>
          <p className="stat-card-label">within {expiryAlertsMeta.alertDays} days</p>
        </div>
        <div
          className={`stat-card cursor-pointer border-2 transition-all ${activeAlert === "low" ? "border-error" : "border-transparent"}`}
          onClick={() => setActive("low")}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-error" />
            <p className="font-montserrat font-bold text-error">Low Stock</p>
          </div>
          <p className="stat-card-value text-error">{lowStockMeta.count}</p>
          <p className="stat-card-label">below {lowStockMeta.threshold} units</p>
        </div>
      </div>

      {/* Controls */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {activeAlert === "expiry" && (
            <div className="flex items-center gap-2">
              <label className="label-text">Alert window:</label>
              <select className="input-field w-32" value={days} onChange={(e) => setDays(+e.target.value)}>
                {[30,60,90].map((d) => <option key={d} value={d}>{d} days</option>)}
              </select>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => dispatch(fetchExpiryAlerts({ days, sendEmail: true }))}
              >
                <Send className="w-3.5 h-3.5" /> Email Alert
              </button>
            </div>
          )}
          {activeAlert === "low" && (
            <div className="flex items-center gap-2">
              <label className="label-text">Threshold:</label>
              <input className="input-field w-24" type="number" min="1" value={threshold} onChange={(e) => setThreshold(+e.target.value)} />
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => dispatch(fetchLowStock({ threshold, sendEmail: true }))}
              >
                <Send className="w-3.5 h-3.5" /> Email Alert
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lists */}
      <AnimatePresence mode="wait">
        {activeAlert === "expiry" && (
          <motion.div key="expiry" variants={fadeUp} initial="hidden" animate="show" exit="exit">
            {loading.expiryAlerts ? (
              <div className="flex justify-center py-20"><Spinner size="lg" /></div>
            ) : expiryAlerts.length === 0 ? (
              <EmptyState icon={Clock} title="No expiring medicines" body={`No batches expiring within ${days} days.`} />
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Batch No.</th>
                        <th>Medicine</th>
                        <th>Category</th>
                        <th>Qty</th>
                        <th>Expiry Date</th>
                        <th>Days Left</th>
                        <th>Supplier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expiryAlerts.map((b) => (
                        <tr key={b.batchId}>
                          <td className="font-mono text-[10px]">{b.batchNumber}</td>
                          <td>
                            <p className="font-semibold text-xs">{b.brandName || b.name}</p>
                          </td>
                          <td><span className="badge badge-xs badge-secondary">{b.category}</span></td>
                          <td className="text-xs">{b.stockQuantity}</td>
                          <td className="text-xs">{b.expiryDate ? new Date(b.expiryDate).toLocaleDateString("en-IN") : "—"}</td>
                          <td>
                            <span className={`badge badge-xs ${(b.daysLeft ?? 999) <= 30 ? "badge-error" : "badge-warning"}`}>
                              {b.daysLeft}d
                            </span>
                          </td>
                          <td className="text-[10px] text-base-content/50">{b.supplier || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeAlert === "low" && (
          <motion.div key="low" variants={fadeUp} initial="hidden" animate="show" exit="exit">
            {loading.lowStock ? (
              <div className="flex justify-center py-20"><Spinner size="lg" /></div>
            ) : lowStockItems.length === 0 ? (
              <EmptyState icon={AlertTriangle} title="All stocked up" body="No items below threshold." />
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th>Category</th>
                        <th>Available</th>
                        <th>Reserved</th>
                        <th>Reorder Level</th>
                        <th>MRP</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStockItems.map((inv) => (
                        <tr key={inv.inventoryId}>
                          <td>
                            <p className="font-semibold text-xs">{inv.brandName || inv.name}</p>
                          </td>
                          <td><span className="badge badge-xs badge-secondary">{inv.category}</span></td>
                          <td className="font-bold text-error text-xs">{inv.availableStock}</td>
                          <td className="text-xs">{inv.reservedStock}</td>
                          <td className="text-xs">{inv.reorderLevel}</td>
                          <td className="text-xs">₹{inv.mrp}</td>
                          <td>
                            {inv.isOutOfStock
                              ? <span className="badge badge-error badge-xs">Out of Stock</span>
                              : <span className="badge badge-warning badge-xs">Low</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── HELP TAB ──────────────────────────────────────────────────────────────────

const HELP_SECTIONS = [
  {
    icon: Package,
    title: "Medicine Inventory",
    color: "primary",
    items: [
      {
        q: "What does 'Available Stock' mean vs 'Total Stock'?",
        a: "Total Stock = all physical units in store. Available Stock = Total − Reserved. Reserved units are held for pending/confirmed orders not yet picked. Only available stock can be sold.",
      },
      {
        q: "How do I search for a medicine?",
        a: "Use the search bar in the Medicines tab. It searches brand name, generic name, and medicine name. Filter by Low Stock or Expiring to quickly find problem items.",
      },
      {
        q: "What does 'Reorder Level' mean?",
        a: "When available stock falls to or below the reorder level, the medicine is flagged as 'Low Stock' and you get an alert. Set it to the minimum comfortable buffer for each medicine.",
      },
      {
        q: "Can I update pricing without adding stock?",
        a: "Yes. Use the Edit (pencil) button on any medicine in the Medicines tab. You can update MRP, selling price, discount, reorder level, rack location, and active status independently.",
      },
    ],
  },
  {
    icon: Layers,
    title: "Batches & FEFO",
    color: "secondary",
    items: [
      {
        q: "What is FEFO?",
        a: "First Expire First Out — when you deduct stock without specifying a batch, the system automatically picks the batch with the earliest expiry date first. This minimises wastage.",
      },
      {
        q: "How do I add a new batch?",
        a: "In the Medicines tab, click the green '+' (Add Stock) button next to any medicine. Every stock entry creates or updates a MedicineBatch record with its own expiry, batch number, and quantity.",
      },
      {
        q: "What happens when a batch expires?",
        a: "The system auto-flags it as 'Expired' on save. Expired batches don't count toward available stock. Use the Alerts tab to catch expiring batches before they expire.",
      },
      {
        q: "Why can't I deduct more than available stock?",
        a: "Available = Total − Reserved. Reserved stock is held for active orders. Deducting reserved stock would make those orders unfulfillable. Cancel the reservations first if needed.",
      },
    ],
  },
  {
    icon: Activity,
    title: "Inventory Movements",
    color: "accent",
    items: [
      {
        q: "What are inventory movements?",
        a: "Every stock change is logged as an immutable movement record — think of it as a ledger. Purchase = stock in. Sale = stock out. Damage, Expiry, Adjustment = corrections. Movements cannot be deleted.",
      },
      {
        q: "How do I view movements for one medicine?",
        a: "In the Movements tab, the medicineId filter is available in the API. Currently the tab shows all movements; filter by Movement Type to narrow down (e.g. only 'Damage' movements).",
      },
      {
        q: "What is Transfer In / Transfer Out?",
        a: "When stock moves between your store and a warehouse or another branch. This is logged automatically during transfer operations.",
      },
    ],
  },
  {
    icon: ShoppingCart,
    title: "Purchase Orders",
    color: "info",
    items: [
      {
        q: "Purchase Order workflow — end to end?",
        a: "1. Create PO (Draft) → 2. Send to supplier (Sent) → 3. Receive stock when goods arrive (Partially Received / Received). On receiving, MedicineInventory and MedicineBatch are updated automatically.",
      },
      {
        q: "Can I receive partial quantities?",
        a: "Yes. In the Receive Stock modal, set received quantity for each item. Items not yet delivered can stay at 0. The PO moves to 'Partially_Received' until all items are received.",
      },
      {
        q: "What happens when I click 'Send' on a Draft PO?",
        a: "Status changes from Draft → Sent. This signals the supplier has been notified. You cannot add or remove items after sending.",
      },
      {
        q: "Can I cancel a PO?",
        a: "Yes, Draft and Sent POs can be cancelled. Click the red X on the PO row. Received POs cannot be cancelled.",
      },
    ],
  },
  {
    icon: Truck,
    title: "Suppliers",
    color: "warning",
    items: [
      {
        q: "Why can't I add/edit suppliers here?",
        a: "Supplier management requires Admin role. Contact your platform admin to create or edit supplier records. Pharmacy staff have read-only access to the supplier list.",
      },
      {
        q: "What is the supplier rating?",
        a: "A 0–5 rating reflecting average fulfillment performance. It is computed by the platform admin. Higher rating = more reliable supplier.",
      },
    ],
  },
  {
    icon: Bell,
    title: "Alerts",
    color: "error",
    items: [
      {
        q: "How do I get expiry alerts by email?",
        a: "In the Alerts tab, select 'Expiring Soon', set the alert window (30/60/90 days), then click 'Email Alert'. The system sends the list to your registered pharmacy email.",
      },
      {
        q: "How do I set up low stock alerts?",
        a: "Set the Reorder Level on each medicine (via Update Inventory). When available stock hits that level, the system flags it. In the Alerts tab, click 'Email Alert' to receive the list by email.",
      },
      {
        q: "What threshold should I use for low stock?",
        a: "A good rule: average daily sales × lead time (days from order to delivery). E.g. sell 10 strips/day, delivery takes 3 days → reorder at 30 strips minimum.",
      },
    ],
  },
  {
    icon: BarChart3,
    title: "Overview & Analytics",
    color: "success",
    items: [
      {
        q: "What is Inventory Value?",
        a: "Sell Value = available units × final selling price (what you'd earn if everything sold). MRP Value = all units × MRP. Cost Value = all units × purchase price (what you paid). All exclude reserved/damaged stock where applicable.",
      },
      {
        q: "Top Medicines shows last 30 days — can I change the range?",
        a: "The overview always shows last 30 days. For custom date analytics, use the Financials section (Revenue tab) which supports custom date ranges.",
      },
    ],
  },
];

function HelpTab() {
  const [openIdx, setOpen] = useState(null);
  const [openQ, setOpenQ]  = useState(null);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {/* Hero */}
      <motion.div variants={fadeUp} className="bg-gradient-to-br from-primary/10 to-secondary/5 border border-primary/20 rounded-[var(--r-box)] p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-primary/20 rounded-full p-3">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-montserrat font-black text-xl text-base-content">Medicine & Inventory Guide</h3>
            <p className="text-base-content/50 text-xs">Everything you need to manage your pharmacy stock.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { icon: Package,     label: "Medicines",  desc: "View, add & update inventory" },
            { icon: Layers,      label: "Batches",    desc: "FEFO batch tracking" },
            { icon: ShoppingCart,label: "Purchase",   desc: "Supplier orders & receiving" },
            { icon: Bell,        label: "Alerts",     desc: "Expiry & low stock" },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="bg-base-100 rounded-[var(--r-field)] p-3 border border-base-300">
              <Icon className="w-5 h-5 text-primary mb-1.5" />
              <p className="font-semibold text-xs">{label}</p>
              <p className="text-[10px] text-base-content/40">{desc}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* FAQ Sections */}
      {HELP_SECTIONS.map((section, si) => {
        const SIcon = section.icon;
        const isOpen = openIdx === si;
        return (
          <motion.div key={si} variants={fadeUp} className="card overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-5 hover:bg-base-200 transition-colors"
              onClick={() => setOpen(isOpen ? null : si)}
            >
              <div className="flex items-center gap-3">
                <div className={`bg-${section.color}/10 rounded-xl p-2`}>
                  <SIcon className={`w-5 h-5 text-${section.color}`} />
                </div>
                <span className="font-montserrat font-bold text-base">{section.title}</span>
                <span className="badge badge-xs badge-secondary">{section.items.length} topics</span>
              </div>
              {isOpen ? <ChevronUp className="w-4 h-4 text-base-content/40" /> : <ChevronDown className="w-4 h-4 text-base-content/40" />}
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 space-y-2 border-t border-base-300">
                    {section.items.map((item, qi) => {
                      const key   = `${si}-${qi}`;
                      const qOpen = openQ === key;
                      return (
                        <div key={qi} className="border border-base-300 rounded-[var(--r-field)] overflow-hidden">
                          <button
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-base-200 transition-colors text-left"
                            onClick={() => setOpenQ(qOpen ? null : key)}
                          >
                            <span className="font-semibold text-xs">{item.q}</span>
                            {qOpen ? <ChevronUp className="w-4 h-4 shrink-0 text-base-content/40" /> : <ChevronDown className="w-4 h-4 shrink-0 text-base-content/40" />}
                          </button>
                          <AnimatePresence>
                            {qOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 py-3 bg-base-200 text-xs text-base-content/70 border-t border-base-300">
                                  {item.a}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}

      {/* Quick reference card */}
      <motion.div variants={fadeUp} className="card p-5">
        <h4 className="font-montserrat font-bold text-base mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-accent" /> Quick Reference — Movement Types
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {MOVEMENT_TYPES.map((t) => {
            const { icon: Icon, cls } = MOVEMENT_ICONS[t] || { icon: Activity, cls: "" };
            const descriptions = {
              Purchase:       "Stock received from supplier or PO",
              Sale:           "Stock deducted when order delivered",
              Reservation:    "Stock held for confirmed order",
              Release:        "Reservation freed on order cancel",
              Adjustment_Add: "Manual correction — found stock",
              Adjustment_Sub: "Manual correction — lost/pilfered",
              Damage:         "Stock marked as physically damaged",
              Expiry:         "Stock expired and written off",
              Return:         "Customer return received",
              Transfer_In:    "Received from another branch/warehouse",
              Transfer_Out:   "Sent to another branch/warehouse",
            };
            return (
              <div key={t} className="flex items-start gap-2 text-xs py-2 px-3 bg-base-200 rounded-[var(--r-field)]">
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cls}`} />
                <div>
                  <p className="font-semibold">{t.replace("_", " ")}</p>
                  <p className="text-[10px] text-base-content/40">{descriptions[t]}</p>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Workflow diagram */}
      <motion.div variants={fadeUp} className="card p-5">
        <h4 className="font-montserrat font-bold text-base mb-4 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-info" /> Stock Lifecycle
        </h4>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 text-xs">
          {[
            { label: "Supplier ships",   icon: Truck,       color: "text-primary"   },
            { label: "Create PO",        icon: FileText,    color: "text-secondary" },
            { label: "Receive Stock",    icon: Download,    color: "text-success"   },
            { label: "Inventory updated",icon: Package,     color: "text-info"      },
            { label: "Order placed",     icon: ShoppingCart,color: "text-warning"   },
            { label: "Stock reserved",   icon: BoxSelect,   color: "text-accent"    },
            { label: "Delivered",        icon: Check,       color: "text-success"   },
          ].map(({ label, icon: Icon, color }, i, arr) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div className={`bg-base-200 rounded-full p-2`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <span className="text-[10px] text-base-content/60 text-center max-w-[70px]">{label}</span>
              </div>
              {i < arr.length - 1 && (
                <ChevronRight className="w-4 h-4 text-base-content/20 shrink-0 -mt-4 hidden sm:block" />
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── ROOT COMPONENT ────────────────────────────────────────────────────────────

export default function MedicinesManagement() {
  const [activeTab, setActiveTab] = useState("overview");
  const { errors } = useSelector((s) => s.pharmacyStore);
  const dispatch = useDispatch();

  const TAB_COMPONENTS = {
    overview:  <OverviewTab />,
    medicines: <MedicinesTab />,
    batches:   <BatchesTab />,
    movements: <MovementsTab />,
    suppliers: <SuppliersTab />,
    purchase:  <PurchaseOrdersTab />,
    alerts:    <AlertsTab />,
    help:      <HelpTab />,
  };

  return (
    <div className="min-h-screen bg-base-100">
      {/* Page Header */}
      <div className="border-b border-base-300 bg-base-100 sticky top-0 z-30">
        <div className="container-custom py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-xl p-2.5">
                <Warehouse className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="font-montserrat font-black text-xl text-base-content">
                  Medicine Management
                </h1>
                <p className="text-base-content/40 text-[10px]">Inventory · Batches · Suppliers · POs · Alerts</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 overflow-x-auto pb-1 scrollbar-thin">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-[var(--r-selector)] text-xs font-semibold whitespace-nowrap transition-all
                  ${activeTab === id
                    ? "bg-primary text-primary-content shadow-primary"
                    : "text-base-content/60 hover:text-base-content hover:bg-base-200"
                  }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container-custom py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            {TAB_COMPONENTS[activeTab]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}