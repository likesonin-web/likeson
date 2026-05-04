"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  FlaskConical, Star, MapPin, Clock, Home, Shield, Phone,
  Mail, Globe, ArrowLeft, Microscope, Package, Award,
  CheckCircle, X, Search, Building2, FileText, AlertCircle,
  Loader2, TestTube, Calendar, Navigation, Sparkles, ExternalLink,
  Share2, MessageSquare, Users, Activity
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import {
  fetchPublicLabById,
  fetchPublicLabTests,
  fetchPublicLabPackages,
  fetchPublicLabReviews,
  fetchCustomerLabById,
  submitLabReview,
  selectSelectedLab,
  selectPublicTests,
  selectPublicPackages,
  selectPublicReviews,
  selectReviewsPagination,
  selectLabLoading,
  selectLabActionLoading,
} from "@/store/slices/labSlice";
import Container from "@/components/ui/Container";
// ─── Helpers ──────────────────────────────────────────────────────────────────

const StarRow = ({ rating = 0, total = 0, size = 13 }) => (
  <div className="flex items-center gap-1.5">
    <div className="flex">
      {[1,2,3,4,5].map((i) => (
        <Star key={i} size={size}
          className={i <= Math.round(rating)
            ? "fill-[var(--warning)] text-[var(--warning)]"
            : "fill-[var(--base-300)] text-[var(--base-300)]"}
        />
      ))}
    </div>
    <span className="text-xs font-bold text-[var(--base-content)]">{rating?.toFixed(1)}</span>
    {total > 0 && <span className="text-[11px] text-[var(--base-content)]/45">({total})</span>}
  </div>
);

const InfoChip = ({ icon: Icon, label, value, accent }) => (
  <div className={`flex items-start gap-2.5 p-3 rounded-xl border ${
    accent
      ? "bg-[color-mix(in_srgb,var(--primary),transparent_92%)] border-[color-mix(in_srgb,var(--primary),transparent_72%)]"
      : "bg-[var(--base-200)] border-[var(--base-300)]"
  }`}>
    <Icon size={14} className={`${accent ? "text-[var(--primary)]" : "text-[var(--base-content)]/45"} mt-0.5 flex-shrink-0`} />
    <div>
      <p className="text-[10px] text-[var(--base-content)]/40 uppercase tracking-wider font-bold">{label}</p>
      <p className="text-xs font-semibold text-[var(--base-content)] mt-0.5">{value || "—"}</p>
    </div>
  </div>
);

const SectionTitle = ({ icon: Icon, title, count }) => (
  <div className="flex items-center gap-2.5 mb-4">
    <div className="w-8 h-8 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center">
      <Icon size={15} className="text-[var(--primary)]" />
    </div>
    <h2 className="font-montserrat font-extrabold text-base text-[var(--base-content)]">{title}</h2>
    {count != null && (
      <span className="badge badge-primary text-[10px]">{count}</span>
    )}
  </div>
);

// ─── Test Card ────────────────────────────────────────────────────────────────

const TestCard = ({ test }) => (
  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
    className="group p-4 rounded-xl border border-[var(--base-300)] bg-[var(--base-100)] hover:border-[var(--primary)]/45 hover:shadow-sm transition-all duration-200">
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-[var(--base-content)] group-hover:text-[var(--primary)] transition-colors truncate">{test.testName}</p>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {test.category && <span className="text-[10px] text-[var(--base-content)]/50 bg-[var(--base-200)] px-2 py-0.5 rounded-full">{test.category}</span>}
          {test.sampleType && <span className="text-[10px] text-[var(--base-content)]/50 flex items-center gap-1"><TestTube size={8}/> {test.sampleType}</span>}
          {test.turnaroundHours && <span className="text-[10px] text-[var(--base-content)]/50 flex items-center gap-1"><Clock size={8}/> {test.turnaroundHours}h</span>}
        </div>
        {test.homeCollectionAvailable && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-[var(--success)]">
            <Home size={8}/> Home collection available
          </div>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        {test.partnerPrice && test.partnerPrice < test.mrpPrice && (
          <p className="text-[10px] line-through text-[var(--base-content)]/30">₹{test.mrpPrice}</p>
        )}
        <p className="font-extrabold text-base text-[var(--primary)]">₹{test.partnerPrice ?? test.mrpPrice}</p>
        {test.partnerPrice && test.partnerPrice < test.mrpPrice && (
          <p className="text-[10px] text-[var(--success)] font-bold">
            {Math.round(((test.mrpPrice - test.partnerPrice) / test.mrpPrice) * 100)}% off
          </p>
        )}
      </div>
    </div>
    {test.testCode && <p className="text-[9px] text-[var(--base-content)]/25 mt-2 font-mono">#{test.testCode}</p>}
  </motion.div>
);

// ─── Package Card ─────────────────────────────────────────────────────────────

const PackageCard = ({ pkg }) => (
  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
    className="group p-4 rounded-xl border border-[var(--base-300)] bg-gradient-to-br from-[var(--primary)]/4 to-[var(--secondary)]/4 hover:border-[var(--primary)]/45 hover:shadow-sm transition-all duration-200">
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <Package size={12} className="text-[var(--accent)]"/>
          <p className="font-bold text-sm text-[var(--base-content)] group-hover:text-[var(--primary)] transition-colors truncate">{pkg.packageName}</p>
        </div>
        {pkg.description && <p className="text-xs text-[var(--base-content)]/50 leading-relaxed line-clamp-2">{pkg.description}</p>}
        {pkg.tests?.length > 0 && <p className="text-[10px] text-[var(--base-content)]/40 mt-1.5 flex items-center gap-1"><TestTube size={8}/> {pkg.tests.length} tests included</p>}
        {pkg.validUntil && (
          <p className="text-[10px] text-[var(--warning)] mt-1 flex items-center gap-1">
            <Calendar size={8}/> Valid till {new Date(pkg.validUntil).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}
          </p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        {pkg.partnerPrice && pkg.partnerPrice < pkg.mrpPrice && (
          <p className="text-[10px] line-through text-[var(--base-content)]/30">₹{pkg.mrpPrice}</p>
        )}
        <p className="font-extrabold text-base text-[var(--primary)]">₹{pkg.partnerPrice ?? pkg.mrpPrice}</p>
        {pkg.partnerPrice && pkg.partnerPrice < pkg.mrpPrice && (
          <p className="text-[10px] text-[var(--success)] font-bold">{Math.round(((pkg.mrpPrice - pkg.partnerPrice)/pkg.mrpPrice)*100)}% off</p>
        )}
      </div>
    </div>
  </motion.div>
);

// ─── Review Card ──────────────────────────────────────────────────────────────

const ReviewCard = ({ review, index }) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
    className="p-4 rounded-xl border border-[var(--base-300)] bg-[var(--base-100)]">
    <div className="flex items-start justify-between mb-2">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center text-[var(--primary-content)] text-xs font-extrabold">
          {review.user?.name?.[0]?.toUpperCase() ?? "U"}
        </div>
        <div>
          <p className="text-sm font-bold text-[var(--base-content)]">{review.user?.name ?? "Anonymous"}</p>
          <p className="text-[10px] text-[var(--base-content)]/38">{new Date(review.createdAt).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</p>
        </div>
      </div>
      <StarRow rating={review.rating} size={11} />
    </div>
    {review.comment && <p className="text-xs text-[var(--base-content)]/60 leading-relaxed pl-10">{review.comment}</p>}
  </motion.div>
);

// ─── Review Form ──────────────────────────────────────────────────────────────

const ReviewForm = ({ labId, onSubmit }) => {
  const dispatch      = useDispatch();
  const actionLoading = useSelector(selectLabActionLoading);
  const [rating,  setRating]  = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const labels = ["","Poor","Fair","Good","Very Good","Excellent"];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) return;
    const res = await dispatch(submitLabReview({ id: labId, rating, comment }));
    if (!res.error) { setRating(0); setComment(""); onSubmit?.(); }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-xl border border-[var(--primary)]/22 bg-[color-mix(in_srgb,var(--primary),transparent_95%)]">
      <p className="font-bold text-sm text-[var(--base-content)] mb-3">Write a Review</p>
      <div className="flex gap-1 mb-3 items-center">
        {[1,2,3,4,5].map((i) => (
          <button key={i} type="button" onMouseEnter={()=>setHovered(i)} onMouseLeave={()=>setHovered(0)} onClick={()=>setRating(i)}>
            <Star size={22} className={`transition-all ${i<=(hovered||rating)?"fill-[var(--warning)] text-[var(--warning)] scale-110":"fill-[var(--base-300)] text-[var(--base-300)]"}`}/>
          </button>
        ))}
        {rating > 0 && <span className="ml-2 text-xs font-bold text-[var(--warning)]">{labels[rating]}</span>}
      </div>
      <textarea value={comment} onChange={(e)=>setComment(e.target.value)} rows={3}
        placeholder="Share your experience (optional)…"
        className="input-field w-full text-xs resize-none mb-3" />
      <button type="submit" disabled={!rating || actionLoading}
        className="btn-primary-cta text-xs px-5 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
        {actionLoading && <Loader2 size={12} className="animate-spin"/>}
        Submit Review
      </button>
    </form>
  );
};

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = ["overview","tests","packages","reviews"];
const TAB_LABELS = { overview:"Overview", tests:"Tests", packages:"Packages", reviews:"Reviews" };
const TAB_ICONS  = { overview:Activity, tests:TestTube, packages:Package, reviews:MessageSquare };

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LabDetailPage() {
  const { id }  = useParams();
  const router  = useRouter();
  const dispatch = useDispatch();

  const lab        = useSelector(selectSelectedLab);
  const tests      = useSelector(selectPublicTests);
  const packages   = useSelector(selectPublicPackages);
  const reviews    = useSelector(selectPublicReviews);
  const reviewPag  = useSelector(selectReviewsPagination);
  const loading    = useSelector(selectLabLoading);
  const user       = useSelector((s) => s.user?.user) ?? null;
  const isCustomer = user?.role === "customer";

  const [activeTab,      setActiveTab]      = useState("overview");
  const [testSearch,     setTestSearch]     = useState("");
  const [reviewPage,     setReviewPage]     = useState(1);
  const [showReviewForm, setShowReviewForm] = useState(false);

  useEffect(() => {
    if (!id) return;
    if (isCustomer) dispatch(fetchCustomerLabById(id));
    else            dispatch(fetchPublicLabById(id));
    dispatch(fetchPublicLabTests({ id, params: {} }));
    dispatch(fetchPublicLabPackages({ id, params: {} }));
    dispatch(fetchPublicLabReviews({ id, params: { page: 1, limit: 10 } }));
  }, [dispatch, id, isCustomer]);

  useEffect(() => {
    if (id && activeTab === "reviews") {
      dispatch(fetchPublicLabReviews({ id, params: { page: reviewPage, limit: 10 } }));
    }
  }, [dispatch, id, reviewPage, activeTab]);

  const filteredTests  = tests.filter((t) => t.isActive && (!testSearch || t.testName.toLowerCase().includes(testSearch.toLowerCase())));
  const activePackages = packages.filter((p) => p.isActive);

  if (loading && !lab) return (
    <div data-theme="lab" className="min-h-screen flex items-center justify-center bg-[var(--base-100)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center">
          <FlaskConical size={26} className="text-[var(--primary)] animate-bounce"/>
        </div>
        <Loader2 size={18} className="animate-spin text-[var(--primary)]"/>
        <p className="text-xs text-[var(--base-content)]/40">Loading lab details…</p>
      </div>
    </div>
  );

  if (!lab) return (
    <div data-theme="lab" className="min-h-screen flex items-center justify-center bg-[var(--base-100)]">
      <div className="text-center">
        <AlertCircle size={28} className="text-[var(--error)] mx-auto mb-3"/>
        <p className="font-bold text-[var(--base-content)]">Lab not found</p>
        <button onClick={() => router.back()} className="btn-secondary mt-4 text-xs px-5 py-2">Go Back</button>
      </div>
    </div>
  );

  return (
    <div data-theme="lab" className="min-h-screen bg-[var(--base-100)]">
     <Container className="">
      {/* Cover */}
      <div className="relative h-52 md:h-64 overflow-hidden">
        {lab.coverImageUrl
          ? <img src={lab.coverImageUrl} alt="" className="w-full h-full object-cover"/>
          : (
            <div className="w-full h-full bg-gradient-to-br from-[var(--primary)]/18 via-[var(--secondary)]/10 to-[var(--accent)]/12 relative overflow-hidden flex items-center justify-center">
              {[100,180,260,340].map((s,i) => (
                <motion.div key={i} className="absolute rounded-full border border-[var(--primary)]/12"
                  style={{width:s,height:s}}
                  animate={{scale:[1,1.05,1],opacity:[0.5,0.2,0.5]}}
                  transition={{duration:3+i,repeat:Infinity,delay:i*0.4}}/>
              ))}
              <FlaskConical size={50} className="text-[var(--primary)]/28 relative z-10"/>
            </div>
          )
        }
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--base-100)] to-transparent"/>
        <button onClick={() => router.back()}
          className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--base-100)]/80 backdrop-blur-sm text-xs font-bold text-[var(--base-content)] hover:bg-[var(--base-100)] transition-colors border border-[var(--base-300)]">
          <ArrowLeft size={12}/> Back
        </button>
        <button className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-[var(--base-100)]/80 backdrop-blur-sm flex items-center justify-center border border-[var(--base-300)]">
          <Share2 size={12} className="text-[var(--base-content)]/55"/>
        </button>
      </div>

      {/* Header card */}
      <div className="container-custom -mt-8 relative z-10">
        <motion.div initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{duration:0.42}}
          className="card p-5 md:p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden border-2 border-[var(--base-300)] bg-[var(--base-200)] flex items-center justify-center flex-shrink-0">
              {lab.logoUrl
                ? <img src={lab.logoUrl} alt="" className="w-full h-full object-cover"/>
                : <Microscope size={26} className="text-[var(--primary)]"/>
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h1 className="font-montserrat font-extrabold text-xl md:text-2xl text-[var(--base-content)] leading-tight">{lab.labName}</h1>
                    {lab.isVerified && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--success)]/14 text-[var(--success)] text-[10px] font-bold border border-[var(--success)]/22">
                        <Shield size={8}/> NABL
                      </span>
                    )}
                    {lab.isFeatured && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent)]/14 text-[var(--accent)] text-[10px] font-bold border border-[var(--accent)]/22">
                        <Sparkles size={8}/> Featured
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--base-content)]/45">{lab.labType} · {lab.ownershipType}</p>
                  {lab.labCode && <p className="text-[10px] text-[var(--base-content)]/25 font-mono mt-0.5">{lab.labCode}</p>}
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  lab.isActive
                    ? "bg-[color-mix(in_srgb,var(--success),transparent_88%)] text-[var(--success)] border-[color-mix(in_srgb,var(--success),transparent_65%)]"
                    : "bg-[color-mix(in_srgb,var(--warning),transparent_88%)] text-[var(--warning)] border-[color-mix(in_srgb,var(--warning),transparent_65%)]"
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${lab.isActive ? "bg-[var(--success)] animate-pulse" : "bg-[var(--warning)]"}`}/>
                  {lab.isActive ? "Open" : "Closed"}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <StarRow rating={lab.averageRating} total={lab.totalReviews} size={13}/>
                <div className="flex items-center gap-1 text-xs text-[var(--base-content)]/45">
                  <MapPin size={10} className="text-[var(--error)]"/>
                  {lab.registeredAddress?.city}, {lab.registeredAddress?.state}
                </div>
              </div>
            </div>
          </div>

          {/* Quick info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            <InfoChip icon={Activity} label="Collection" value={lab.sampleCollectionMode} accent/>
            {(lab.homeCollectionRadius ?? 0) > 0 && <InfoChip icon={Home} label="Home Radius" value={`${lab.homeCollectionRadius} km`} accent/>}
            {lab.avgTurnaroundHours && <InfoChip icon={Clock} label="Avg TAT" value={`${lab.avgTurnaroundHours} hours`}/>}
            {(lab.homeCollectionFee ?? 0) > 0 && <InfoChip icon={Navigation} label="Home Fee" value={`₹${lab.homeCollectionFee}`}/>}
          </div>

        {isCustomer && (
  <div className="flex gap-3 mt-5">
    <Link
      href={`/book-appointment?type=diagnostic_center&lab=${id}`}
      className="btn-primary-cta text-xs px-6 py-2.5 flex items-center gap-2 flex-1 justify-center"
    >
      <TestTube size={13}/> Book a Test
    </Link>
    <Link
      href={`/book-appointment?type=diagnostic_home&lab=${id}`}
      className="btn-secondary text-xs px-5 py-2.5 flex items-center gap-2"
    >
      <Home size={13}/> Home Collection
    </Link>
  </div>
)}
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-30 bg-[var(--base-100)]/92 backdrop-blur-strong border-b border-[var(--base-200)] mt-4">
        <div className="container-custom">
          <div className="flex overflow-x-auto scrollbar-none">
            {TABS.map((tab) => {
              const Icon = TAB_ICONS[tab];
              const active = activeTab === tab;
              return (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`relative flex items-center gap-1.5 px-4 py-3 text-xs font-bold whitespace-nowrap transition-all ${
                    active ? "text-[var(--primary)]" : "text-[var(--base-content)]/48 hover:text-[var(--base-content)]"
                  }`}>
                  <Icon size={13}/>
                  {TAB_LABELS[tab]}
                  {tab === "tests"    && filteredTests.length > 0    && <span className="badge badge-primary text-[9px] ml-0.5">{filteredTests.length}</span>}
                  {tab === "packages" && activePackages.length > 0   && <span className="badge badge-primary text-[9px] ml-0.5">{activePackages.length}</span>}
                  {tab === "reviews"  && lab.totalReviews > 0        && <span className="badge badge-primary text-[9px] ml-0.5">{lab.totalReviews}</span>}
                  {active && <motion.div layoutId="tabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary)] rounded-full"/>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container-custom py-6">
        <AnimatePresence mode="wait">

          {activeTab === "overview" && (
            <motion.div key="ov" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
              className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-4">
                {lab.description && (
                  <div className="card p-5">
                    <SectionTitle icon={FileText} title="About"/>
                    <p className="text-sm text-[var(--base-content)]/62 leading-relaxed">{lab.description}</p>
                  </div>
                )}
                {lab.accreditations?.length > 0 && (
                  <div className="card p-5">
                    <SectionTitle icon={Award} title="Accreditations" count={lab.accreditations.length}/>
                    <div className="flex flex-wrap gap-2">
                      {lab.accreditations.map((acc) => (
                        <div key={acc._id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--success)]/28 bg-[color-mix(in_srgb,var(--success),transparent_92%)]">
                          <Award size={13} className="text-[var(--success)]"/>
                          <div>
                            <p className="text-xs font-bold text-[var(--success)]">{acc.body}</p>
                            {acc.isVerified && <p className="text-[9px] text-[var(--success)]/65 flex items-center gap-0.5"><CheckCircle size={7}/> Verified</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {lab.timing?.length > 0 && (
                  <div className="card p-5">
                    <SectionTitle icon={Clock} title="Operating Hours"/>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {lab.timing.map((t) => (
                        <div key={t.day} className={`flex items-center justify-between p-2.5 rounded-xl text-xs ${
                          t.isClosed
                            ? "bg-[var(--error)]/7 border border-[var(--error)]/18 text-[var(--error)]"
                            : "bg-[var(--base-200)] border border-[var(--base-300)] text-[var(--base-content)]"
                        }`}>
                          <span className="font-bold">{t.day.slice(0,3)}</span>
                          <span className={t.isClosed ? "font-bold" : "text-[var(--base-content)]/55"}>
                            {t.isClosed ? "Closed" : `${t.openTime} – ${t.closeTime}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {lab.reportDeliveryModes?.length > 0 && (
                  <div className="card p-5">
                    <SectionTitle icon={FileText} title="Report Delivery"/>
                    <div className="flex flex-wrap gap-2">
                      {lab.reportDeliveryModes.map((m) => <span key={m} className="badge badge-info text-xs">{m}</span>)}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="card p-5">
                  <SectionTitle icon={MapPin} title="Location"/>
                  <div className="space-y-1 text-xs text-[var(--base-content)]/60">
                    <p>{lab.registeredAddress?.line1}</p>
                    {lab.registeredAddress?.line2 && <p>{lab.registeredAddress.line2}</p>}
                    <p>{lab.registeredAddress?.city}, {lab.registeredAddress?.district}</p>
                    <p>{lab.registeredAddress?.state} – {lab.registeredAddress?.pincode}</p>
                  </div>
                  {lab.registeredAddress?.location?.coordinates?.[0] !== 0 && (
                    <a href={`https://maps.google.com/?q=${lab.registeredAddress.location.coordinates[1]},${lab.registeredAddress.location.coordinates[0]}`}
                      target="_blank" rel="noopener noreferrer"
                      className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] hover:underline">
                      <ExternalLink size={10}/> Open in Maps
                    </a>
                  )}
                </div>
                {lab.contactPersons?.length > 0 && (
                  <div className="card p-5">
                    <SectionTitle icon={Users} title="Contact"/>
                    <div className="space-y-3">
                      {lab.contactPersons.map((cp) => (
                        <div key={cp._id} className="text-xs">
                          <p className="font-bold text-[var(--base-content)]">{cp.name}</p>
                          {cp.designation && <p className="text-[var(--base-content)]/42">{cp.designation}</p>}
                          {cp.phone && (
                            <a href={`tel:${cp.phone}`} className="flex items-center gap-1 mt-1 text-[var(--primary)] hover:underline">
                              <Phone size={9}/> {cp.phone}
                            </a>
                          )}
                          {cp.email && (
                            <a href={`mailto:${cp.email}`} className="flex items-center gap-1 mt-0.5 text-[var(--primary)] hover:underline">
                              <Mail size={9}/> {cp.email}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {lab.websiteUrl && (
                  <a href={lab.websiteUrl} target="_blank" rel="noopener noreferrer"
                    className="card p-4 flex items-center gap-2.5 hover:border-[var(--primary)] transition-colors group">
                    <Globe size={15} className="text-[var(--primary)]"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[var(--base-content)] group-hover:text-[var(--primary)] transition-colors">Visit Website</p>
                      <p className="text-[10px] text-[var(--base-content)]/35 truncate">{lab.websiteUrl}</p>
                    </div>
                    <ExternalLink size={11} className="text-[var(--base-content)]/28"/>
                  </a>
                )}
                {lab.tags?.length > 0 && (
                  <div className="card p-4">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--base-content)]/38 font-bold mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {lab.tags.map((tag) => <span key={tag} className="badge badge-primary text-[10px]">{tag}</span>)}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "tests" && (
            <motion.div key="tests" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center"><TestTube size={15} className="text-[var(--primary)]"/></div>
                  <h2 className="font-montserrat font-extrabold text-base text-[var(--base-content)]">Available Tests</h2>
                  <span className="badge badge-primary text-[10px]">{filteredTests.length}</span>
                </div>
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--base-content)]/38"/>
                  <input value={testSearch} onChange={(e) => setTestSearch(e.target.value)} placeholder="Search tests…"
                    className="input-field text-xs py-1.5 pl-7 pr-3 w-40"/>
                </div>
              </div>
              {filteredTests.length === 0
                ? <div className="text-center py-14"><TestTube size={26} className="text-[var(--base-content)]/18 mx-auto mb-2"/><p className="text-sm text-[var(--base-content)]/40 font-bold">{testSearch ? "No matching tests" : "No tests listed"}</p></div>
                : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{filteredTests.map((t) => <TestCard key={t._id} test={t}/>)}</div>
              }
            </motion.div>
          )}

          {activeTab === "packages" && (
            <motion.div key="pkgs" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}>
              <SectionTitle icon={Package} title="Test Packages" count={activePackages.length}/>
              {activePackages.length === 0
                ? <div className="text-center py-14"><Package size={26} className="text-[var(--base-content)]/18 mx-auto mb-2"/><p className="text-sm text-[var(--base-content)]/40 font-bold">No packages listed</p></div>
                : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{activePackages.map((p) => <PackageCard key={p._id} pkg={p}/>)}</div>
              }
            </motion.div>
          )}

          {activeTab === "reviews" && (
            <motion.div key="revs" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}>
              {/* Summary */}
              <div className="card p-5 mb-5">
                <div className="flex items-start gap-6 flex-wrap">
                  <div className="text-center min-w-20">
                    <div className="font-montserrat font-extrabold text-5xl text-[var(--primary)]">{lab.averageRating?.toFixed(1)}</div>
                    <StarRow rating={lab.averageRating} size={15}/>
                    <p className="text-[11px] text-[var(--base-content)]/40 mt-1">{lab.totalReviews} total</p>
                  </div>
                  <div className="flex-1 min-w-40">
                    {[5,4,3,2,1].map((r) => {
                      const cnt = reviews.filter((rv) => Math.round(rv.rating) === r).length;
                      const pct = reviews.length > 0 ? (cnt/reviews.length)*100 : 0;
                      return (
                        <div key={r} className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] text-[var(--base-content)]/45 w-3 font-bold">{r}</span>
                          <Star size={8} className="fill-[var(--warning)] text-[var(--warning)]"/>
                          <div className="flex-1 h-1.5 rounded-full bg-[var(--base-300)] overflow-hidden">
                            <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{delay:0.2,duration:0.5}}
                              className="h-full rounded-full bg-[var(--warning)]"/>
                          </div>
                          <span className="text-[10px] text-[var(--base-content)]/35 w-5 text-right">{cnt}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {isCustomer && (
                <div className="mb-4">
                  {!showReviewForm
                    ? <button onClick={() => setShowReviewForm(true)}
                        className="btn-secondary w-full text-xs py-2.5 flex items-center justify-center gap-2">
                        <MessageSquare size={12}/> Write a Review
                      </button>
                    : <ReviewForm labId={id} onSubmit={() => {
                        setShowReviewForm(false);
                        dispatch(fetchPublicLabReviews({ id, params: { page: 1, limit: 10 } }));
                      }}/>
                  }
                </div>
              )}

              {reviews.length === 0
                ? <div className="text-center py-12"><MessageSquare size={24} className="text-[var(--base-content)]/15 mx-auto mb-2"/><p className="text-sm text-[var(--base-content)]/38 font-bold">No reviews yet</p></div>
                : <div className="space-y-3">{reviews.map((rv,i) => <ReviewCard key={rv._id} review={rv} index={i}/>)}</div>
              }

              {reviewPag && reviewPag.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-5">
                  <button disabled={reviewPage<=1} onClick={() => setReviewPage((p) => p-1)}
                    className="px-3 py-1.5 rounded-lg border border-[var(--base-300)] text-xs font-bold disabled:opacity-30 hover:border-[var(--primary)] transition-all">← Prev</button>
                  <span className="text-xs text-[var(--base-content)]/45">{reviewPage} / {reviewPag.totalPages}</span>
                  <button disabled={reviewPage>=reviewPag.totalPages} onClick={() => setReviewPage((p) => p+1)}
                    className="px-3 py-1.5 rounded-lg border border-[var(--base-300)] text-xs font-bold disabled:opacity-30 hover:border-[var(--primary)] transition-all">Next →</button>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
      </Container>
    </div>
  );
}