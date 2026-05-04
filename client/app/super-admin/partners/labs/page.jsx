'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Search, RefreshCw, Plus, FlaskConical, MapPin, Phone, Mail,
  Star, ShieldCheck, Clock, Building2, Package, CheckCircle2,
  XCircle, Eye, EyeOff, Trash2, Edit3, ArrowUpRight, Wallet,
  Bell, Send, RotateCcw, BadgeCheck, Ban, PlayCircle, PauseCircle,
  FileCheck, CreditCard, TrendingUp, Activity, Zap, BarChart2,
  X, ChevronDown, Tag as TagIcon,
} from 'lucide-react';

import {
  adminFetchLabs,
  adminFetchLabById,
  adminFetchLabStats,
  adminCreateLab,
  adminUpdateLab,
  adminChangeLabStatus,
  adminSetLabPlatformFee,
  adminRemoveLabPlatformFee,
  adminAddLabTest,
  adminUpdateLabTest,
  adminDeleteLabTest,
  adminAddLabPackage,
  adminUpdateLabPackage,
  adminDeleteLabPackage,
  adminAddLabAccreditation,
  adminAddLabComplianceDoc,
  adminVerifyLabDoc,
  adminVerifyLabBank,
  adminFetchLabReviews,
  adminToggleReviewVisibility,
  adminDeleteLabReview,
  adminResendLabCredentials,
  adminSendLabNotification,
  selectAdminLabs,
  selectAdminSelectedLab,
  selectAdminStats,
  selectAdminPagination,
  selectAdminReviews,
  selectLabLoading,
  selectLabActionLoading,
} from '@/store/slices/labSlice';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_CFG = {
  approved:     { label:'Approved',     icon:CheckCircle2, color:'#10b981', bg:'rgba(16,185,129,0.1)',  border:'rgba(16,185,129,0.3)'  },
  pending:      { label:'Pending',      icon:Clock,        color:'#f59e0b', bg:'rgba(245,158,11,0.1)',  border:'rgba(245,158,11,0.3)'  },
  under_review: { label:'Under Review', icon:Eye,          color:'#6366f1', bg:'rgba(99,102,241,0.1)', border:'rgba(99,102,241,0.3)'  },
  suspended:    { label:'Suspended',    icon:PauseCircle,  color:'#ef4444', bg:'rgba(239,68,68,0.1)',  border:'rgba(239,68,68,0.3)'   },
  rejected:     { label:'Rejected',     icon:XCircle,      color:'#dc2626', bg:'rgba(220,38,38,0.1)',  border:'rgba(220,38,38,0.3)'   },
  deactivated:  { label:'Deactivated',  icon:Ban,          color:'#9ca3af', bg:'rgba(156,163,175,0.1)',border:'rgba(156,163,175,0.3)' },
};
const CHART_COLORS    = ['#7c3aed','#4f46e5','#10b981','#f59e0b','#ef4444','#6366f1'];
const LAB_TYPES       = ['Diagnostic Lab','Pathology Lab','Radiology Center','Microbiology Lab','Biochemistry Lab','Genetic Testing Lab','Molecular Lab','Immunology Lab','Multi-Specialty Lab'];
const OWNERSHIP_TYPES = ['Private','Corporate Chain','Franchise','Government','Trust / NGO'];
const ACCR_BODIES     = ['NABL','CAP','ISO','NABH','JCI','Other'];
const COMP_TYPES      = ['Lab_Registration_Certificate','PCB_NOC','Bio_Medical_Waste_License','Drug_License','GSTIN_Certificate','PAN_Card','Trade_License','MSME_Certificate','Other'];
const PAYOUT_FREQ     = ['Weekly','Bi-weekly','Monthly'];
const SAMPLE_MODES    = ['Walk-in','Home Collection','Both'];
const TABS = [
  { id:'overview',  label:'Overview',  icon:BarChart2    },
  { id:'tests',     label:'Tests',     icon:FlaskConical },
  { id:'packages',  label:'Packages',  icon:Package      },
  { id:'documents', label:'Documents', icon:FileCheck    },
  { id:'reviews',   label:'Reviews',   icon:Star         },
  { id:'financial', label:'Financial', icon:Wallet       },
];

// ─── Style atoms ─────────────────────────────────────────────────────────────

const inp = { width:'100%',borderRadius:8,border:'1px solid var(--base-300,#d1d5db)',background:'var(--base-200,#f9fafb)',padding:'9px 12px',fontSize:13,color:'var(--base-content,#111)',outline:'none',boxSizing:'border-box' };
const lbl = { fontSize:12,fontWeight:600,color:'var(--base-content,#374151)',marginBottom:4,display:'block' };

// ─── Atoms ───────────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const c = STATUS_CFG[status] ?? STATUS_CFG.pending;
  const I = c.icon;
  return <span style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'3px 9px',borderRadius:20,fontSize:11,fontWeight:700,letterSpacing:'0.04em',textTransform:'uppercase',background:c.bg,color:c.color,border:`1px solid ${c.border}` }}><I size={10} strokeWidth={2.5}/>{c.label}</span>;
};

const Chip = ({ children, color='#7c3aed' }) => (
  <span style={{ display:'inline-flex',alignItems:'center',padding:'2px 7px',borderRadius:20,fontSize:11,fontWeight:600,background:`${color}15`,color,border:`1px solid ${color}25` }}>{children}</span>
);

const Divider = ({ label }) => (
  <div style={{ display:'flex',alignItems:'center',gap:12,margin:'18px 0 10px' }}>
    <span style={{ fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--primary,#7c3aed)',whiteSpace:'nowrap' }}>{label}</span>
    <div style={{ flex:1,height:1,background:'var(--base-300,#e5e7eb)' }}/>
  </div>
);

const InfoRow = ({ label, value, icon:I }) => (
  <div style={{ display:'flex',alignItems:'flex-start',gap:8,padding:'5px 0',borderBottom:'1px solid var(--base-300,#f3f4f6)' }}>
    {I && <I size={12} strokeWidth={2} style={{ marginTop:2,flexShrink:0,color:'var(--primary,#7c3aed)' }}/>}
    <span style={{ fontSize:12,color:'var(--base-content,#6b7280)',minWidth:130,flexShrink:0 }}>{label}</span>
    <span style={{ fontSize:12,color:'var(--base-content,#111)',fontWeight:600,wordBreak:'break-all' }}>{value||'—'}</span>
  </div>
);

const StatCard = ({ label, value, icon:I, color }) => (
  <div style={{ background:'var(--base-200,#f3f4f6)',borderRadius:11,padding:'13px 16px',display:'flex',flexDirection:'column',gap:5,border:'1px solid var(--base-300,#e5e7eb)' }}>
    <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
      <span style={{ fontSize:10,color:'var(--base-content,#374151)',opacity:.6,fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em' }}>{label}</span>
      <div style={{ width:26,height:26,borderRadius:7,background:`${color}18`,display:'flex',alignItems:'center',justifyContent:'center' }}><I size={12} color={color} strokeWidth={2}/></div>
    </div>
    <div style={{ fontSize:22,fontWeight:800,color:'var(--base-content,#111)',lineHeight:1 }}>{value??'—'}</div>
  </div>
);

const Btn = ({ label, icon:I, onClick, variant='default', disabled, size='md' }) => {
  const V = {
    default:{ bg:'var(--base-200,#f3f4f6)', color:'var(--base-content,#374151)', border:'var(--base-300,#d1d5db)' },
    primary:{ bg:'rgba(124,58,237,0.1)',     color:'#7c3aed',                     border:'rgba(124,58,237,0.3)' },
    success:{ bg:'rgba(16,185,129,0.1)',     color:'#059669',                     border:'rgba(16,185,129,0.3)' },
    danger: { bg:'rgba(239,68,68,0.1)',      color:'#dc2626',                     border:'rgba(239,68,68,0.3)'  },
    warning:{ bg:'rgba(245,158,11,0.1)',     color:'#b45309',                     border:'rgba(245,158,11,0.3)' },
    solid:  { bg:'#7c3aed',                  color:'#fff',                         border:'#7c3aed'              },
  };
  const v=V[variant]; const pad=size==='sm'?'5px 10px':'7px 13px'; const fs=size==='sm'?11:12;
  return <button onClick={onClick} disabled={disabled} style={{ display:'inline-flex',alignItems:'center',gap:5,padding:pad,borderRadius:8,border:`1px solid ${v.border}`,background:v.bg,color:v.color,fontSize:fs,fontWeight:700,cursor:disabled?'not-allowed':'pointer',opacity:disabled?.5:1,transition:'all .15s',whiteSpace:'nowrap' }}>{I&&<I size={size==='sm'?11:13} strokeWidth={2.5}/>}{label}</button>;
};

// ─── Modal Shell ─────────────────────────────────────────────────────────────

const Modal = ({ open, onClose, title, width=480, children }) => {
  if (!open) return null;
  return (
    <div style={{ position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
      <motion.div initial={{ scale:.92,opacity:0 }} animate={{ scale:1,opacity:1 }} transition={{ duration:.15 }}
        style={{ background:'var(--base-100,#fff)',borderRadius:16,width:'100%',maxWidth:width,boxShadow:'0 25px 60px rgba(0,0,0,.25)',border:'1px solid var(--base-300,#e5e7eb)',maxHeight:'90vh',display:'flex',flexDirection:'column' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 22px 14px',borderBottom:'1px solid var(--base-300,#e5e7eb)',flexShrink:0 }}>
          <h3 style={{ margin:0,fontSize:16,fontWeight:800,color:'var(--base-content,#111)' }}>{title}</h3>
          <button onClick={onClose} style={{ border:'none',background:'none',cursor:'pointer',padding:4,borderRadius:6,color:'#9ca3af' }}><X size={17}/></button>
        </div>
        <div style={{ padding:'18px 22px',overflowY:'auto',flex:1 }}>{children}</div>
      </motion.div>
    </div>
  );
};

// ─── Confirm Modal ────────────────────────────────────────────────────────────

const ConfirmModal = ({ open, title, message, onConfirm, onCancel, requireReason, variant='danger' }) => {
  const [reason, setReason] = useState('');
  if (!open) return null;
  const bg = variant==='danger'?'#dc2626':variant==='success'?'#059669':'#7c3aed';
  return (
    <Modal open title={title} onClose={onCancel} width={420}>
      <p style={{ margin:'0 0 14px',fontSize:13,color:'var(--base-content,#6b7280)',lineHeight:1.6 }}>{message}</p>
      {requireReason&&<textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Enter reason (required)…" rows={3} style={{ ...inp,resize:'vertical',marginBottom:4 }}/>}
      <div style={{ display:'flex',gap:10,justifyContent:'flex-end',marginTop:14 }}>
        <Btn label="Cancel" icon={X} onClick={()=>{onCancel();setReason('');}}/>
        <button onClick={()=>{onConfirm(reason);setReason('');}} disabled={requireReason&&!reason.trim()} style={{ padding:'8px 20px',borderRadius:8,border:'none',background:bg,color:'#fff',cursor:'pointer',fontSize:13,fontWeight:700,opacity:requireReason&&!reason.trim()?.5:1 }}>Confirm</button>
      </div>
    </Modal>
  );
};

// ─── Lab Form Modal (Create & Edit) ──────────────────────────────────────────

const LabFormModal = ({ open, onClose, onSave, initial, actionLoading }) => {
  const blank = { name:'',email:'',phone:'',labName:'',labType:'Diagnostic Lab',ownershipType:'Private',description:'',websiteUrl:'',registrationNumber:'',gstin:'',panNumber:'',establishedYear:'',sampleCollectionMode:'Both',homeCollectionRadius:'',homeCollectionFee:'',avgTurnaroundHours:'',payoutFrequency:'Monthly','addr.line1':'','addr.city':'','addr.state':'','addr.pincode':'','addr.district':'',logo:null,coverImage:null };
  const [form, setForm] = useState(blank);
  const isEdit = !!initial;

  useEffect(()=>{
    if (!open) return;
    if (initial) {
      setForm({ ...blank, labName:initial.labName??'', labType:initial.labType??'Diagnostic Lab', ownershipType:initial.ownershipType??'Private', description:initial.description??'', websiteUrl:initial.websiteUrl??'', registrationNumber:initial.registrationNumber??'', gstin:initial.gstin??'', panNumber:initial.panNumber??'', establishedYear:initial.establishedYear??'', sampleCollectionMode:initial.sampleCollectionMode??'Both', homeCollectionRadius:initial.homeCollectionRadius??'', homeCollectionFee:initial.homeCollectionFee??'', avgTurnaroundHours:initial.avgTurnaroundHours??'', payoutFrequency:initial.payoutFrequency??'Monthly', 'addr.line1':initial.registeredAddress?.line1??'', 'addr.city':initial.registeredAddress?.city??'', 'addr.state':initial.registeredAddress?.state??'', 'addr.pincode':initial.registeredAddress?.pincode??'', 'addr.district':initial.registeredAddress?.district??'' });
    } else { setForm(blank); }
  },[open,initial]);

  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const required = isEdit?(!form.labName||!form['addr.line1']||!form['addr.city']):(!form.name||!form.email||!form.labName||!form['addr.line1']||!form['addr.city']);

  const submit=()=>{
    const payload={ labName:form.labName,labType:form.labType,ownershipType:form.ownershipType,description:form.description,websiteUrl:form.websiteUrl,registrationNumber:form.registrationNumber,gstin:form.gstin,panNumber:form.panNumber,establishedYear:form.establishedYear,sampleCollectionMode:form.sampleCollectionMode,homeCollectionRadius:form.homeCollectionRadius,homeCollectionFee:form.homeCollectionFee,avgTurnaroundHours:form.avgTurnaroundHours,payoutFrequency:form.payoutFrequency,registeredAddress:{ line1:form['addr.line1'],city:form['addr.city'],state:form['addr.state'],pincode:form['addr.pincode'],district:form['addr.district'] } };
    if (!isEdit){ payload.name=form.name; payload.email=form.email; payload.phone=form.phone; }
    if (form.logo)       payload.logo=form.logo;
    if (form.coverImage) payload.coverImage=form.coverImage;
    onSave(payload);
  };

  const F=({ lbl:l, k, type='text', placeholder='', opts })=>(
    <div style={{ marginBottom:11 }}>
      <label style={lbl}>{l}</label>
      {opts ? <select value={form[k]} onChange={e=>set(k,e.target.value)} style={inp}>{opts.map(o=><option key={o}>{o}</option>)}</select>
             : <input type={type} value={form[k]} onChange={e=>set(k,e.target.value)} placeholder={placeholder} style={inp}/>}
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title={isEdit?`Edit — ${initial?.labName}`:'Create New Lab'} width={640}>
      {!isEdit&&<>
        <Divider label="Account Details"/>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}><F lbl="Contact Name *" k="name" placeholder="Dr. John Doe"/><F lbl="Email *" k="email" type="email" placeholder="lab@example.com"/></div>
        <F lbl="Phone" k="phone" placeholder="+919876543210"/>
      </>}
      <Divider label="Lab Identity"/>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}><F lbl="Lab Name *" k="labName" placeholder="ABC Diagnostics"/><F lbl="Lab Type *" k="labType" opts={LAB_TYPES}/></div>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}><F lbl="Ownership Type" k="ownershipType" opts={OWNERSHIP_TYPES}/><F lbl="Established Year" k="establishedYear" type="number" placeholder="2018"/></div>
      <div style={{ marginBottom:11 }}><label style={lbl}>Description</label><textarea value={form.description} onChange={e=>set('description',e.target.value)} rows={2} placeholder="Brief description…" style={{ ...inp,resize:'vertical' }}/></div>
      <F lbl="Website URL" k="websiteUrl" placeholder="https://example.com"/>
      <Divider label="Legal"/>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12 }}><F lbl="Registration No." k="registrationNumber" placeholder="AP-LAB-XXXX"/><F lbl="GSTIN" k="gstin" placeholder="27AABCU9603R1ZX"/><F lbl="PAN Number" k="panNumber" placeholder="AABCU9603R"/></div>
      <Divider label="Address"/>
      <F lbl="Address Line 1 *" k="addr.line1" placeholder="12 Main Road"/>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}><F lbl="City *" k="addr.city" placeholder="Nellore"/><F lbl="District" k="addr.district" placeholder="Nellore District"/></div>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}><F lbl="State *" k="addr.state" placeholder="Andhra Pradesh"/><F lbl="Pincode" k="addr.pincode" placeholder="524001"/></div>
      <Divider label="Operations"/>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}><F lbl="Sample Collection Mode" k="sampleCollectionMode" opts={SAMPLE_MODES}/><F lbl="Payout Frequency" k="payoutFrequency" opts={PAYOUT_FREQ}/></div>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12 }}><F lbl="Home Radius (km)" k="homeCollectionRadius" type="number" placeholder="10"/><F lbl="Home Fee (₹)" k="homeCollectionFee" type="number" placeholder="100"/><F lbl="Avg TAT (hrs)" k="avgTurnaroundHours" type="number" placeholder="12"/></div>
      <Divider label="Images"/>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
        <div><label style={lbl}>Logo</label><input type="file" accept="image/*" onChange={e=>set('logo',e.target.files[0])} style={{ fontSize:12,color:'var(--base-content,#374151)' }}/></div>
        <div><label style={lbl}>Cover Image</label><input type="file" accept="image/*" onChange={e=>set('coverImage',e.target.files[0])} style={{ fontSize:12,color:'var(--base-content,#374151)' }}/></div>
      </div>
      <div style={{ display:'flex',gap:10,justifyContent:'flex-end',marginTop:16,paddingTop:14,borderTop:'1px solid var(--base-300,#e5e7eb)' }}>
        <Btn label="Cancel" icon={X} onClick={onClose}/>
        <Btn label={actionLoading?'Saving…':(isEdit?'Save Changes':'Create Lab')} icon={isEdit?Edit3:Plus} variant="solid" onClick={submit} disabled={required||actionLoading}/>
      </div>
    </Modal>
  );
};

// ─── Test Form Modal ──────────────────────────────────────────────────────────

const TestFormModal = ({ open, onClose, onSave, initial, actionLoading }) => {
  const blank = { testCode:'',testName:'',category:'',sampleType:'',turnaroundHours:'',mrpPrice:'',partnerPrice:'',homeCollectionAvailable:'false',reportTemplate:null };
  const [form, setForm] = useState(blank);
  const isEdit = !!initial;
  useEffect(()=>{ if(open) setForm(initial?{ ...blank,testCode:initial.testCode??'',testName:initial.testName??'',category:initial.category??'',sampleType:initial.sampleType??'',turnaroundHours:initial.turnaroundHours??'',mrpPrice:initial.mrpPrice??'',partnerPrice:initial.partnerPrice??'',homeCollectionAvailable:initial.homeCollectionAvailable?'true':'false' }:blank); },[open,initial]);
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  return (
    <Modal open={open} onClose={onClose} title={isEdit?'Edit Test':'Add Test'} width={520}>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
        <div style={{ marginBottom:11 }}><label style={lbl}>Test Code</label><input value={form.testCode} onChange={e=>set('testCode',e.target.value)} placeholder="CBC-001" style={inp}/></div>
        <div style={{ marginBottom:11 }}><label style={lbl}>Test Name *</label><input value={form.testName} onChange={e=>set('testName',e.target.value)} placeholder="Complete Blood Count" style={inp}/></div>
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
        <div style={{ marginBottom:11 }}><label style={lbl}>Category</label><input value={form.category} onChange={e=>set('category',e.target.value)} placeholder="Haematology" style={inp}/></div>
        <div style={{ marginBottom:11 }}><label style={lbl}>Sample Type</label><input value={form.sampleType} onChange={e=>set('sampleType',e.target.value)} placeholder="Blood" style={inp}/></div>
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12 }}>
        <div style={{ marginBottom:11 }}><label style={lbl}>MRP (₹) *</label><input type="number" value={form.mrpPrice} onChange={e=>set('mrpPrice',e.target.value)} placeholder="350" style={inp}/></div>
        <div style={{ marginBottom:11 }}><label style={lbl}>Partner (₹)</label><input type="number" value={form.partnerPrice} onChange={e=>set('partnerPrice',e.target.value)} placeholder="260" style={inp}/></div>
        <div style={{ marginBottom:11 }}><label style={lbl}>TAT (hrs)</label><input type="number" value={form.turnaroundHours} onChange={e=>set('turnaroundHours',e.target.value)} placeholder="6" style={inp}/></div>
      </div>
      <div style={{ marginBottom:11 }}>
  <label style={lbl}>Discounted (₹)</label>
  <input type="number" value={form.discountedPrice??''} 
    onChange={e=>set('discountedPrice',e.target.value)} placeholder="310" style={inp}/>
</div>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
        <div style={{ marginBottom:11 }}><label style={lbl}>Home Collection</label><select value={form.homeCollectionAvailable} onChange={e=>set('homeCollectionAvailable',e.target.value)} style={inp}><option value="true">Available</option><option value="false">Not Available</option></select></div>
        <div style={{ marginBottom:11 }}><label style={lbl}>Report Template</label><input type="file" accept=".pdf,image/*" onChange={e=>set('reportTemplate',e.target.files[0])} style={{ fontSize:12,color:'var(--base-content,#374151)' }}/></div>
      </div>
      <div style={{ display:'flex',gap:10,justifyContent:'flex-end',paddingTop:14,borderTop:'1px solid var(--base-300,#e5e7eb)' }}>
        <Btn label="Cancel" icon={X} onClick={onClose}/>
        <Btn label={actionLoading?'Saving…':(isEdit?'Update':'Add Test')} icon={isEdit?Edit3:Plus} variant="solid" onClick={()=>onSave({...form,homeCollectionAvailable:form.homeCollectionAvailable==='true'})} disabled={!form.testName||!form.mrpPrice||actionLoading}/>
      </div>
    </Modal>
  );
};

// ─── Package Form Modal ───────────────────────────────────────────────────────

const PkgFormModal = ({ open, onClose, onSave, initial, actionLoading }) => {
  const blank = { packageCode:'',packageName:'',description:'',mrpPrice:'',partnerPrice:'',validUntil:'' };
  const [form, setForm] = useState(blank);
  const isEdit = !!initial;
  useEffect(()=>{ if(open) setForm(initial?{ packageCode:initial.packageCode??'',packageName:initial.packageName??'',description:initial.description??'',mrpPrice:initial.mrpPrice??'',partnerPrice:initial.partnerPrice??'',validUntil:initial.validUntil?new Date(initial.validUntil).toISOString().split('T')[0]:'' }:blank); },[open,initial]);
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  return (
    <Modal open={open} onClose={onClose} title={isEdit?'Edit Package':'Add Package'} width={500}>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
        <div style={{ marginBottom:11 }}><label style={lbl}>Package Code</label><input value={form.packageCode} onChange={e=>set('packageCode',e.target.value)} placeholder="PKG-001" style={inp}/></div>
        <div style={{ marginBottom:11 }}><label style={lbl}>Package Name *</label><input value={form.packageName} onChange={e=>set('packageName',e.target.value)} placeholder="Aarogyam Basic" style={inp}/></div>
      </div>
      <div style={{ marginBottom:11 }}><label style={lbl}>Description</label><textarea value={form.description} onChange={e=>set('description',e.target.value)} rows={2} style={{ ...inp,resize:'vertical' }}/></div>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12 }}>
        <div style={{ marginBottom:11 }}><label style={lbl}>MRP (₹) *</label><input type="number" value={form.mrpPrice} onChange={e=>set('mrpPrice',e.target.value)} placeholder="2499" style={inp}/></div>
        <div style={{ marginBottom:11 }}><label style={lbl}>Partner (₹)</label><input type="number" value={form.partnerPrice} onChange={e=>set('partnerPrice',e.target.value)} placeholder="1850" style={inp}/></div>
        <div style={{ marginBottom:11 }}><label style={lbl}>Valid Until</label><input type="date" value={form.validUntil} onChange={e=>set('validUntil',e.target.value)} style={inp}/></div>
      </div>
      <div style={{ display:'flex',gap:10,justifyContent:'flex-end',paddingTop:14,borderTop:'1px solid var(--base-300,#e5e7eb)' }}>
        <Btn label="Cancel" icon={X} onClick={onClose}/>
        <Btn label={actionLoading?'Saving…':(isEdit?'Update':'Add Package')} icon={isEdit?Edit3:Plus} variant="solid" onClick={()=>onSave(form)} disabled={!form.packageName||!form.mrpPrice||actionLoading}/>
      </div>
    </Modal>
  );
};

// ─── Accreditation Modal ──────────────────────────────────────────────────────

const AccrModal = ({ open, onClose, onSave, actionLoading }) => {
  const [form, setForm] = useState({ body:'NABL',certificateNo:'',issuedOn:'',validUntil:'',certificate:null });
  useEffect(()=>{ if(open) setForm({ body:'NABL',certificateNo:'',issuedOn:'',validUntil:'',certificate:null }); },[open]);
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  return (
    <Modal open={open} onClose={onClose} title="Add Accreditation" width={460}>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
        <div style={{ marginBottom:11 }}><label style={lbl}>Body *</label><select value={form.body} onChange={e=>set('body',e.target.value)} style={inp}>{ACCR_BODIES.map(b=><option key={b}>{b}</option>)}</select></div>
        <div style={{ marginBottom:11 }}><label style={lbl}>Certificate No.</label><input value={form.certificateNo} onChange={e=>set('certificateNo',e.target.value)} placeholder="MC-4821" style={inp}/></div>
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
        <div style={{ marginBottom:11 }}><label style={lbl}>Issued On</label><input type="date" value={form.issuedOn} onChange={e=>set('issuedOn',e.target.value)} style={inp}/></div>
        <div style={{ marginBottom:11 }}><label style={lbl}>Valid Until</label><input type="date" value={form.validUntil} onChange={e=>set('validUntil',e.target.value)} style={inp}/></div>
      </div>
      <div style={{ marginBottom:11 }}><label style={lbl}>Certificate Document</label><input type="file" accept=".pdf,image/*" onChange={e=>set('certificate',e.target.files[0])} style={{ fontSize:12,color:'var(--base-content,#374151)' }}/></div>
      <div style={{ display:'flex',gap:10,justifyContent:'flex-end',paddingTop:14,borderTop:'1px solid var(--base-300,#e5e7eb)' }}>
        <Btn label="Cancel" icon={X} onClick={onClose}/>
        <Btn label={actionLoading?'Saving…':'Add Accreditation'} icon={Plus} variant="solid" onClick={()=>onSave(form)} disabled={actionLoading}/>
      </div>
    </Modal>
  );
};

// ─── Compliance Doc Modal ─────────────────────────────────────────────────────

const CompModal = ({ open, onClose, onSave, actionLoading }) => {
  const [form, setForm] = useState({ docType:'Lab_Registration_Certificate',docNumber:'',issuedOn:'',validUntil:'',remarks:'',document:null });
  useEffect(()=>{ if(open) setForm({ docType:'Lab_Registration_Certificate',docNumber:'',issuedOn:'',validUntil:'',remarks:'',document:null }); },[open]);
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  return (
    <Modal open={open} onClose={onClose} title="Add Compliance Document" width={480}>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
        <div style={{ marginBottom:11 }}><label style={lbl}>Document Type *</label><select value={form.docType} onChange={e=>set('docType',e.target.value)} style={inp}>{COMP_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
        <div style={{ marginBottom:11 }}><label style={lbl}>Document Number</label><input value={form.docNumber} onChange={e=>set('docNumber',e.target.value)} placeholder="AP-LAB-2019-04812" style={inp}/></div>
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
        <div style={{ marginBottom:11 }}><label style={lbl}>Issued On</label><input type="date" value={form.issuedOn} onChange={e=>set('issuedOn',e.target.value)} style={inp}/></div>
        <div style={{ marginBottom:11 }}><label style={lbl}>Valid Until</label><input type="date" value={form.validUntil} onChange={e=>set('validUntil',e.target.value)} style={inp}/></div>
      </div>
      <div style={{ marginBottom:11 }}><label style={lbl}>Remarks</label><textarea value={form.remarks} onChange={e=>set('remarks',e.target.value)} rows={2} style={{ ...inp,resize:'vertical' }}/></div>
      <div style={{ marginBottom:11 }}><label style={lbl}>Document File</label><input type="file" accept=".pdf,image/*" onChange={e=>set('document',e.target.files[0])} style={{ fontSize:12,color:'var(--base-content,#374151)' }}/></div>
      <div style={{ display:'flex',gap:10,justifyContent:'flex-end',paddingTop:14,borderTop:'1px solid var(--base-300,#e5e7eb)' }}>
        <Btn label="Cancel" icon={X} onClick={onClose}/>
        <Btn label={actionLoading?'Saving…':'Add Document'} icon={Plus} variant="solid" onClick={()=>onSave(form)} disabled={actionLoading}/>
      </div>
    </Modal>
  );
};

// ─── Notification Modal ───────────────────────────────────────────────────────

const NotifModal = ({ open, onSend, onClose }) => {
  const [form, setForm] = useState({ title:'',body:'',sendEmail:false });
  useEffect(()=>{ if(open) setForm({title:'',body:'',sendEmail:false}); },[open]);
  return (
    <Modal open={open} onClose={onClose} title="Send Notification" width={460}>
      <div style={{ marginBottom:11 }}><label style={lbl}>Title *</label><input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="Notification title" style={inp}/></div>
      <div style={{ marginBottom:11 }}><label style={lbl}>Message *</label><textarea value={form.body} onChange={e=>setForm(p=>({...p,body:e.target.value}))} rows={4} placeholder="Body message…" style={{ ...inp,resize:'vertical' }}/></div>
      <label style={{ display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:'pointer',marginBottom:14 }}><input type="checkbox" checked={form.sendEmail} onChange={e=>setForm(p=>({...p,sendEmail:e.target.checked}))}/>Also send via Email</label>
      <div style={{ display:'flex',gap:10,justifyContent:'flex-end',paddingTop:14,borderTop:'1px solid var(--base-300,#e5e7eb)' }}>
        <Btn label="Cancel" icon={X} onClick={onClose}/>
        <Btn label="Send" icon={Send} variant="solid" onClick={()=>onSend(form)} disabled={!form.title.trim()||!form.body.trim()}/>
      </div>
    </Modal>
  );
};

// ─── Platform Fee Modal ───────────────────────────────────────────────────────

const FeeModal = ({ open, current, onSave, onRemove, onClose }) => {
  const [type,setType]=useState('percentage'); const [value,setValue]=useState('');
  useEffect(()=>{ if(open){ setType(current?.type??'percentage'); setValue(current?.value??''); } },[open,current]);
  return (
    <Modal open={open} onClose={onClose} title="Platform Fee Override" width={400}>
      {current&&<p style={{ margin:'0 0 12px',fontSize:12,color:'#6b7280' }}>Current: <strong>{current.type} — {current.type==='percentage'?`${current.value}%`:`₹${current.value}`}</strong></p>}
      <div style={{ display:'flex',gap:8,marginBottom:13 }}>
        {['percentage','fixed'].map(t=><button key={t} onClick={()=>setType(t)} style={{ flex:1,padding:'8px',borderRadius:8,border:`1px solid ${type===t?'#7c3aed':'var(--base-300,#d1d5db)'}`,background:type===t?'rgba(124,58,237,0.08)':'transparent',color:type===t?'#7c3aed':'var(--base-content,#374151)',cursor:'pointer',fontSize:13,fontWeight:600 }}>{t==='percentage'?'% Percentage':'₹ Fixed'}</button>)}
      </div>
      <div style={{ marginBottom:11 }}><label style={lbl}>Value</label><input type="number" value={value} onChange={e=>setValue(e.target.value)} placeholder={type==='percentage'?'12':'100'} style={inp}/></div>
      <div style={{ display:'flex',gap:8,justifyContent:'flex-end',paddingTop:14,borderTop:'1px solid var(--base-300,#e5e7eb)' }}>
        {current&&<Btn label="Remove Override" icon={Trash2} variant="danger" onClick={onRemove}/>}
        <Btn label="Cancel" icon={X} onClick={onClose}/>
        <Btn label="Save" icon={CheckCircle2} variant="solid" onClick={()=>onSave({type,value:Number(value)})} disabled={!value}/>
      </div>
    </Modal>
  );
};

// ─── Left Panel ───────────────────────────────────────────────────────────────

const LabListPanel = ({ labs, selectedId, onSelect, loading, pagination, onPageChange, onSearch, searchVal, onFilter, filterStatus, onCreateLab }) => (
  <div style={{ display:'flex',flexDirection:'column',height:'100%' }}>
    <div style={{ padding:'12px 12px 10px',borderBottom:'1px solid var(--base-300,#e5e7eb)',display:'flex',flexDirection:'column',gap:8 }}>
      <Btn label="Create Lab" icon={Plus} variant="solid" onClick={onCreateLab}/>
      <div style={{ position:'relative' }}>
        <Search size={13} style={{ position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:'#9ca3af' }}/>
        <input value={searchVal} onChange={e=>onSearch(e.target.value)} placeholder="Search labs…" style={{ ...inp,paddingLeft:27,paddingTop:7,paddingBottom:7 }}/>
      </div>
      <select value={filterStatus} onChange={e=>onFilter(e.target.value)} style={{ ...inp,paddingTop:7,paddingBottom:7 }}>
        <option value="">All Statuses</option>
        {Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
      </select>
    </div>
    <div style={{ padding:'5px 12px',fontSize:11,color:'#9ca3af',fontWeight:700,letterSpacing:'0.04em' }}>{pagination?.total??labs.length} LABS</div>
    <div style={{ flex:1,overflowY:'auto' }}>
      {loading&&!labs.length?<div style={{ padding:32,textAlign:'center',color:'#9ca3af',fontSize:13 }}>Loading…</div>:labs.length===0?<div style={{ padding:32,textAlign:'center',color:'#9ca3af',fontSize:13 }}>No labs found.</div>:labs.map(lab=>{
        const sel=lab._id===selectedId; const cfg=STATUS_CFG[lab.status]??STATUS_CFG.pending;
        return (
          <motion.div key={lab._id} onClick={()=>onSelect(lab._id)} whileHover={{ x:2 }}
            style={{ padding:'10px 12px',cursor:'pointer',borderBottom:'1px solid var(--base-300,#f3f4f6)',background:sel?'rgba(124,58,237,0.05)':'transparent',borderLeft:sel?'3px solid #7c3aed':'3px solid transparent',transition:'all .15s' }}>
            <div style={{ display:'flex',alignItems:'flex-start',gap:8 }}>
              <div style={{ width:32,height:32,borderRadius:8,overflow:'hidden',flexShrink:0,background:'rgba(124,58,237,0.1)',display:'flex',alignItems:'center',justifyContent:'center' }}>
                {lab.logoUrl?<img src={lab.logoUrl} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/>:<FlaskConical size={14} color="#7c3aed" strokeWidth={2}/>}
              </div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:12,fontWeight:700,color:'var(--base-content,#111)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{lab.labName}</div>
                <div style={{ fontSize:10,color:'#9ca3af',marginTop:1 }}>{lab.labCode??'—'} · {lab.labType}</div>
                <div style={{ display:'flex',alignItems:'center',gap:4,marginTop:3 }}>
                  <span style={{ display:'inline-flex',alignItems:'center',gap:2,padding:'1px 6px',borderRadius:20,fontSize:9,fontWeight:700,background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.border}` }}><cfg.icon size={8} strokeWidth={2.5}/>{cfg.label}</span>
                  {lab.isVerified&&<span style={{ display:'inline-flex',alignItems:'center',gap:2,padding:'1px 5px',borderRadius:20,fontSize:9,fontWeight:700,background:'rgba(16,185,129,0.1)',color:'#059669',border:'1px solid rgba(16,185,129,0.3)' }}><BadgeCheck size={8} strokeWidth={2.5}/>✓</span>}
                </div>
              </div>
              <div style={{ display:'flex',alignItems:'center',gap:2,color:'#9ca3af',flexShrink:0 }}><Star size={9} strokeWidth={2}/><span style={{ fontSize:10 }}>{lab.averageRating?.toFixed(1)??'—'}</span></div>
            </div>
            {lab.registeredAddress?.city&&<div style={{ display:'flex',alignItems:'center',gap:3,marginTop:4,paddingLeft:40 }}><MapPin size={8} color="#9ca3af"/><span style={{ fontSize:10,color:'#9ca3af' }}>{lab.registeredAddress.city}, {lab.registeredAddress.state}</span></div>}
          </motion.div>
        );
      })}
    </div>
    {pagination?.totalPages>1&&<div style={{ padding:'8px 12px',borderTop:'1px solid var(--base-300,#e5e7eb)',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
      <Btn label="Prev" icon={ChevronDown} size="sm" onClick={()=>onPageChange(pagination.page-1)} disabled={pagination.page<=1}/>
      <span style={{ fontSize:11,color:'#9ca3af' }}>{pagination.page}/{pagination.totalPages}</span>
      <Btn label="Next" icon={ChevronDown} size="sm" onClick={()=>onPageChange(pagination.page+1)} disabled={pagination.page>=pagination.totalPages}/>
    </div>}
  </div>
);

// ─── Overview Tab ─────────────────────────────────────────────────────────────

const OverviewTab = ({ lab, onEdit }) => {
  const addr = lab.registeredAddress;
  const ratingDist = [1,2,3,4,5].map(n=>({ name:`${n}★`,count:lab.reviews?.filter(r=>Math.round(r.rating)===n).length??0 }));
  const monthlyData=(()=>{ const map={}; (lab.reviews??[]).forEach(r=>{ const k=new Date(r.createdAt).toLocaleDateString('en-IN',{month:'short',year:'2-digit'}); map[k]=(map[k]??0)+1; }); return Object.entries(map).slice(-6).map(([month,count])=>({month,count})); })();
  return (
    <div style={{ padding:22 }}>
      <div style={{ display:'flex',alignItems:'center',gap:14,marginBottom:18,padding:'14px 18px',background:'linear-gradient(135deg,rgba(124,58,237,0.06),rgba(79,70,229,0.03))',borderRadius:13,border:'1px solid rgba(124,58,237,0.12)' }}>
        <div style={{ width:56,height:56,borderRadius:12,overflow:'hidden',background:'rgba(124,58,237,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
          {lab.logoUrl?<img src={lab.logoUrl} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/>:<FlaskConical size={24} color="#7c3aed"/>}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:18,fontWeight:800,color:'var(--base-content,#111)' }}>{lab.labName}</div>
          <div style={{ fontSize:11,color:'#9ca3af',margin:'2px 0' }}>{lab.labCode} · {lab.labType} · {lab.ownershipType}</div>
          <div style={{ display:'flex',flexWrap:'wrap',gap:5,marginTop:5 }}>
            <StatusBadge status={lab.status}/>{lab.isVerified&&<Chip color="#059669">Verified</Chip>}{lab.isFeatured&&<Chip color="#d97706">Featured</Chip>}{lab.isActive&&<Chip color="#6366f1">Active</Chip>}
          </div>
        </div>
        <div style={{ display:'flex',flexDirection:'column',alignItems:'flex-end',gap:7,flexShrink:0 }}>
          <div style={{ textAlign:'right' }}><div style={{ fontSize:24,fontWeight:800,color:'#7c3aed',lineHeight:1 }}>{lab.averageRating?.toFixed(1)??'—'}</div><div style={{ fontSize:11,color:'#9ca3af' }}>{lab.totalReviews??0} reviews</div></div>
          <Btn label="Edit Lab" icon={Edit3} variant="primary" size="sm" onClick={onEdit}/>
        </div>
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))',gap:9,marginBottom:18 }}>
        <StatCard label="Active Tests"  value={lab.labTests?.filter(t=>t.isActive).length??0}    icon={FlaskConical} color="#7c3aed"/>
        <StatCard label="Packages"      value={lab.labPackages?.filter(p=>p.isActive).length??0}  icon={Package}     color="#4f46e5"/>
        <StatCard label="Branches"      value={lab.branches?.filter(b=>b.isActive).length??0}     icon={Building2}   color="#10b981"/>
        <StatCard label="Commission"    value={`${lab.commissionRate??0}%`}                        icon={TrendingUp}  color="#f59e0b"/>
     
<StatCard 
  label="Total Active Margin" 
  value={`₹${lab.labTests?.filter(t=>t.isActive&&t.partnerPrice).reduce((s,t)=>s+((t.discountedPrice??t.mrpPrice)-t.partnerPrice),0)??0}`}
  icon={TrendingUp} color="#10b981"/>
      </div>
      <Divider label="Lab Information"/>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 22px',marginBottom:14 }}>
        <InfoRow label="Registration No." value={lab.registrationNumber} icon={FileCheck}/>
        <InfoRow label="GSTIN"            value={lab.gstin}              icon={TagIcon}/>
        <InfoRow label="PAN"              value={lab.panNumber}          icon={CreditCard}/>
        <InfoRow label="Est. Year"        value={lab.establishedYear}    icon={Clock}/>
        <InfoRow label="Sample Mode"      value={lab.sampleCollectionMode} icon={Activity}/>
        <InfoRow label="Home Radius"      value={lab.homeCollectionRadius?`${lab.homeCollectionRadius} km`:null} icon={MapPin}/>
        <InfoRow label="Home Fee"         value={lab.homeCollectionFee?`₹${lab.homeCollectionFee}`:null} icon={Wallet}/>
        <InfoRow label="Avg TAT"          value={lab.avgTurnaroundHours?`${lab.avgTurnaroundHours}h`:null} icon={Clock}/>
        <InfoRow label="Payout Freq."     value={lab.payoutFrequency}    icon={Zap}/>
        <InfoRow label="Website"          value={lab.websiteUrl}         icon={ArrowUpRight}/>
      </div>
      {addr&&<><Divider label="Address"/><div style={{ padding:'9px 13px',background:'var(--base-200,#f9fafb)',borderRadius:9,fontSize:13,color:'var(--base-content,#374151)',lineHeight:1.8 }}>{[addr.line1,addr.line2,addr.city,addr.district,addr.state,addr.pincode].filter(Boolean).join(', ')}</div></>}
      {lab.user&&<><Divider label="Account"/><div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 22px' }}><InfoRow label="Name" value={lab.user.name} icon={BadgeCheck}/><InfoRow label="Email" value={lab.user.email} icon={Mail}/><InfoRow label="Phone" value={lab.user.phone} icon={Phone}/><InfoRow label="Last Login" value={lab.user.lastLoginAt?new Date(lab.user.lastLoginAt).toLocaleString('en-IN'):null} icon={Clock}/></div></>}
      {lab.contactPersons?.length>0&&<><Divider label="Contact Persons"/>{lab.contactPersons.map(c=><div key={c._id} style={{ padding:'10px 13px',background:'var(--base-200,#f9fafb)',borderRadius:9,display:'flex',alignItems:'flex-start',gap:9,marginBottom:7 }}><div style={{ width:32,height:32,borderRadius:8,background:'rgba(124,58,237,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}><span style={{ fontSize:12,fontWeight:800,color:'#7c3aed' }}>{c.name?.charAt(0)}</span></div><div><div style={{ fontSize:13,fontWeight:700,color:'var(--base-content,#111)' }}>{c.name} {c.isPrimary&&<Chip color="#7c3aed">Primary</Chip>}</div><div style={{ fontSize:11,color:'#9ca3af' }}>{c.designation}</div><div style={{ display:'flex',gap:10,marginTop:3 }}>{c.phone&&<span style={{ fontSize:11,color:'#6b7280',display:'flex',alignItems:'center',gap:3 }}><Phone size={9}/>{c.phone}</span>}{c.email&&<span style={{ fontSize:11,color:'#6b7280',display:'flex',alignItems:'center',gap:3 }}><Mail size={9}/>{c.email}</span>}</div></div></div>)}</>}
      {lab.timing?.length>0&&<><Divider label="Operating Hours"/><div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:7 }}>{lab.timing.map(t=><div key={t.day} style={{ padding:'7px 10px',background:t.isClosed?'rgba(239,68,68,0.05)':'rgba(16,185,129,0.05)',borderRadius:7,border:`1px solid ${t.isClosed?'rgba(239,68,68,0.15)':'rgba(16,185,129,0.15)'}` }}><div style={{ fontSize:10,fontWeight:700,color:'var(--base-content,#374151)' }}>{t.day}</div><div style={{ fontSize:11,color:t.isClosed?'#ef4444':'#059669',fontWeight:600 }}>{t.isClosed?'Closed':`${t.openTime} – ${t.closeTime}`}</div></div>)}</div></>}
      {monthlyData.length>0&&<><Divider label="Review Trend"/><div style={{ height:160 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={monthlyData}><defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7c3aed" stopOpacity={.28}/><stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/><XAxis dataKey="month" tick={{ fontSize:11 }}/><YAxis allowDecimals={false} tick={{ fontSize:11 }}/><Tooltip contentStyle={{ fontSize:12,borderRadius:8 }}/><Area type="monotone" dataKey="count" stroke="#7c3aed" fill="url(#rg)" strokeWidth={2} name="Reviews"/></AreaChart></ResponsiveContainer></div></>}
      {ratingDist.some(r=>r.count>0)&&<><Divider label="Rating Distribution"/><div style={{ height:140 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={ratingDist} barSize={24}><CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/><XAxis dataKey="name" tick={{ fontSize:11 }}/><YAxis allowDecimals={false} tick={{ fontSize:11 }}/><Tooltip contentStyle={{ fontSize:12,borderRadius:8 }}/><Bar dataKey="count" name="Reviews" radius={[4,4,0,0]}>{ratingDist.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}</Bar></BarChart></ResponsiveContainer></div></>}
      {lab.tags?.length>0&&<><Divider label="Tags"/><div style={{ display:'flex',flexWrap:'wrap',gap:5 }}>{lab.tags.map(t=><Chip key={t} color="#6366f1">{t}</Chip>)}</div></>}
    </div>
  );
};

// ─── Tests Tab ────────────────────────────────────────────────────────────────

const TestsTab = ({ lab, dispatch, actionLoading }) => {
  const [search,setSearch]=useState('');
  const [confirm,setConfirm]=useState(null);
  const [showForm,setShowForm]=useState(false);
  const [editTarget,setEditTarget]=useState(null);
  const tests=(lab.labTests??[]).filter(t=>!search||t.testName?.toLowerCase().includes(search.toLowerCase())||t.category?.toLowerCase().includes(search.toLowerCase()));
  const save=form=>{ editTarget?dispatch(adminUpdateLabTest({id:lab._id,testId:editTarget._id,...form})):dispatch(adminAddLabTest({id:lab._id,...form})); setShowForm(false); setEditTarget(null); };
  return (
    <div style={{ padding:22 }}>
      <div style={{ display:'flex',alignItems:'center',gap:9,marginBottom:14 }}>
        <div style={{ position:'relative',flex:1 }}><Search size={12} style={{ position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:'#9ca3af' }}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tests…" style={{ ...inp,paddingLeft:26,paddingTop:7,paddingBottom:7 }}/></div>
        <span style={{ fontSize:12,color:'#9ca3af',whiteSpace:'nowrap' }}>{tests.length} tests</span>
        <Btn label="Add Test" icon={Plus} variant="solid" size="sm" onClick={()=>{setEditTarget(null);setShowForm(true);}}/>
      </div>
      <div style={{ display:'flex',flexDirection:'column',gap:7 }}>
        {tests.map(t=>(
          <motion.div key={t._id} initial={{ opacity:0,y:4 }} animate={{ opacity:1,y:0 }}
            style={{ padding:'11px 13px',background:'var(--base-200,#f9fafb)',borderRadius:9,border:'1px solid var(--base-300,#e5e7eb)',opacity:t.isActive?1:.55 }}>
            <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:9 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex',alignItems:'center',gap:6,flexWrap:'wrap' }}>
                  <span style={{ fontSize:13,fontWeight:700,color:'var(--base-content,#111)' }}>{t.testName}</span>
                  {t.testCode&&<Chip color="#9ca3af">{t.testCode}</Chip>}{!t.isActive&&<Chip color="#ef4444">Inactive</Chip>}
                </div>
                <div style={{ display:'flex',gap:9,marginTop:3,flexWrap:'wrap' }}>
                  {t.category&&<span style={{ fontSize:11,color:'#9ca3af' }}>{t.category}</span>}{t.sampleType&&<span style={{ fontSize:11,color:'#9ca3af' }}>{t.sampleType}</span>}{t.turnaroundHours&&<span style={{ fontSize:11,color:'#9ca3af' }}>{t.turnaroundHours}h TAT</span>}{t.homeCollectionAvailable&&<Chip color="#10b981">Home</Chip>}
                </div>
              </div>
              <div style={{ textAlign:'right',flexShrink:0 }}><div style={{ fontSize:14,fontWeight:800,color:'#7c3aed' }}>₹{t.mrpPrice}</div>{t.partnerPrice&&<div style={{ fontSize:10,color:'#9ca3af' }}>Partner: ₹{t.partnerPrice}</div>}</div>
              {(t.mrpPrice && t.partnerPrice) && (
  <div style={{ fontSize:10, color:'#10b981', fontWeight:700 }}>
    Margin: ₹{(t.discountedPrice ?? t.mrpPrice) - t.partnerPrice}
  </div>
)}
            </div>
            <div style={{ display:'flex',gap:6,marginTop:8,justifyContent:'flex-end' }}>
              <Btn label="Edit" icon={Edit3} size="sm" variant="primary" onClick={()=>{setEditTarget(t);setShowForm(true);}}/>
              <Btn label={t.isActive?'Deactivate':'Activate'} icon={t.isActive?PauseCircle:PlayCircle} size="sm" variant={t.isActive?'warning':'success'} onClick={()=>dispatch(adminUpdateLabTest({id:lab._id,testId:t._id,isActive:!t.isActive}))}/>
              <Btn label="Remove" icon={Trash2} size="sm" variant="danger" onClick={()=>setConfirm({testId:t._id})}/>
            </div>
          </motion.div>
        ))}
        {tests.length===0&&<div style={{ textAlign:'center',padding:32,color:'#9ca3af',fontSize:13 }}>No tests found.</div>}
      </div>
      <TestFormModal open={showForm} onClose={()=>{setShowForm(false);setEditTarget(null);}} onSave={save} initial={editTarget} actionLoading={actionLoading}/>
      <ConfirmModal open={!!confirm} title="Deactivate Test" message="Soft-deactivate this test?" variant="danger"
        onConfirm={()=>{dispatch(adminDeleteLabTest({id:lab._id,testId:confirm.testId}));setConfirm(null);}} onCancel={()=>setConfirm(null)}/>
    </div>
  );
};

// ─── Packages Tab ─────────────────────────────────────────────────────────────

const PackagesTab = ({ lab, dispatch, actionLoading }) => {
  const [confirm,setConfirm]=useState(null); const [showForm,setShowForm]=useState(false); const [editTarget,setEditTarget]=useState(null);
  const save=form=>{ editTarget?dispatch(adminUpdateLabPackage({id:lab._id,pkgId:editTarget._id,...form})):dispatch(adminAddLabPackage({id:lab._id,...form})); setShowForm(false); setEditTarget(null); };
  return (
    <div style={{ padding:22 }}>
      <div style={{ display:'flex',justifyContent:'flex-end',marginBottom:12 }}><Btn label="Add Package" icon={Plus} variant="solid" size="sm" onClick={()=>{setEditTarget(null);setShowForm(true);}}/></div>
      <div style={{ display:'flex',flexDirection:'column',gap:9 }}>
        {(lab.labPackages??[]).map(p=>(
          <motion.div key={p._id} initial={{ opacity:0,y:4 }} animate={{ opacity:1,y:0 }}
            style={{ padding:'12px 13px',background:'var(--base-200,#f9fafb)',borderRadius:11,border:'1px solid var(--base-300,#e5e7eb)',opacity:p.isActive?1:.55 }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex',alignItems:'center',gap:6,flexWrap:'wrap' }}><span style={{ fontSize:13,fontWeight:700,color:'var(--base-content,#111)' }}>{p.packageName}</span>{p.packageCode&&<Chip color="#6366f1">{p.packageCode}</Chip>}{!p.isActive&&<Chip color="#ef4444">Inactive</Chip>}</div>
                {p.description&&<p style={{ margin:'3px 0 0',fontSize:12,color:'#6b7280',lineHeight:1.5 }}>{p.description}</p>}
                {p.validUntil&&<div style={{ fontSize:11,color:'#9ca3af',marginTop:2 }}>Valid: {new Date(p.validUntil).toLocaleDateString('en-IN')}</div>}
              </div>
              <div style={{ textAlign:'right',flexShrink:0 }}><div style={{ fontSize:15,fontWeight:800,color:'#7c3aed' }}>₹{p.mrpPrice}</div>{p.partnerPrice&&<div style={{ fontSize:10,color:'#9ca3af' }}>Partner: ₹{p.partnerPrice}</div>}</div>
            </div>
            <div style={{ display:'flex',gap:6,marginTop:8,justifyContent:'flex-end' }}>
              <Btn label="Edit" icon={Edit3} size="sm" variant="primary" onClick={()=>{setEditTarget(p);setShowForm(true);}}/>
              <Btn label={p.isActive?'Deactivate':'Activate'} icon={p.isActive?PauseCircle:PlayCircle} size="sm" variant={p.isActive?'warning':'success'} onClick={()=>dispatch(adminUpdateLabPackage({id:lab._id,pkgId:p._id,isActive:!p.isActive}))}/>
              <Btn label="Remove" icon={Trash2} size="sm" variant="danger" onClick={()=>setConfirm({pkgId:p._id})}/>
            </div>
          </motion.div>
        ))}
        {!(lab.labPackages??[]).length&&<div style={{ textAlign:'center',padding:32,color:'#9ca3af',fontSize:13 }}>No packages configured.</div>}
      </div>
      <PkgFormModal open={showForm} onClose={()=>{setShowForm(false);setEditTarget(null);}} onSave={save} initial={editTarget} actionLoading={actionLoading}/>
      <ConfirmModal open={!!confirm} title="Deactivate Package" message="Soft-deactivate this package?" variant="danger"
        onConfirm={()=>{dispatch(adminDeleteLabPackage({id:lab._id,pkgId:confirm.pkgId}));setConfirm(null);}} onCancel={()=>setConfirm(null)}/>
    </div>
  );
};

// ─── Documents Tab ────────────────────────────────────────────────────────────

const DocRow = ({ doc, type, onVerify }) => (
  <div style={{ padding:'10px 13px',background:'var(--base-200,#f9fafb)',borderRadius:9,border:`1px solid ${doc.isVerified?'rgba(16,185,129,0.2)':'var(--base-300,#e5e7eb)'}`,marginBottom:7 }}>
    <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:9 }}>
      <div style={{ flex:1 }}>
        <div style={{ display:'flex',alignItems:'center',gap:6,flexWrap:'wrap' }}><span style={{ fontSize:13,fontWeight:700,color:'var(--base-content,#111)' }}>{doc.docType??doc.body}</span>{doc.isVerified?<Chip color="#059669">Verified</Chip>:<Chip color="#f59e0b">Pending</Chip>}</div>
        {(doc.docNumber||doc.certificateNo)&&<div style={{ fontSize:11,color:'#9ca3af',marginTop:2 }}>#{doc.docNumber??doc.certificateNo}</div>}
        <div style={{ display:'flex',gap:9,marginTop:3,flexWrap:'wrap' }}>
          {doc.issuedOn&&<span style={{ fontSize:11,color:'#9ca3af' }}>Issued: {new Date(doc.issuedOn).toLocaleDateString('en-IN')}</span>}
          {doc.validUntil&&<span style={{ fontSize:11,color:new Date(doc.validUntil)<new Date()?'#ef4444':'#9ca3af' }}>Expires: {new Date(doc.validUntil).toLocaleDateString('en-IN')}</span>}
        </div>
        {doc.remarks&&<div style={{ fontSize:11,color:'#6b7280',marginTop:2,fontStyle:'italic' }}>{doc.remarks}</div>}
      </div>
      <div style={{ display:'flex',flexDirection:'column',gap:5,alignItems:'flex-end' }}>
        {doc.documentUrl&&<a href={doc.documentUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize:11,color:'#7c3aed',textDecoration:'none',display:'flex',alignItems:'center',gap:3,fontWeight:600 }}><ArrowUpRight size={11}/>View</a>}
        {!doc.isVerified&&<Btn label="Verify" icon={ShieldCheck} size="sm" variant="success" onClick={()=>onVerify(doc._id,type)}/>}
      </div>
    </div>
  </div>
);

const DocumentsTab = ({ lab, dispatch, actionLoading }) => {
  const [showAccr,setShowAccr]=useState(false); const [showComp,setShowComp]=useState(false);
  const verify=(docId,collection)=>dispatch(adminVerifyLabDoc({id:lab._id,docId,docCollection:collection}));
  return (
    <div style={{ padding:22 }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}><Divider label="Accreditations"/><Btn label="Add" icon={Plus} size="sm" variant="primary" onClick={()=>setShowAccr(true)}/></div>
      {(lab.accreditations??[]).length>0?lab.accreditations.map(a=><DocRow key={a._id} doc={a} type="accreditations" onVerify={verify}/>):<div style={{ fontSize:13,color:'#9ca3af',paddingBottom:8 }}>No accreditations on file.</div>}
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}><Divider label="Compliance Documents"/><Btn label="Add" icon={Plus} size="sm" variant="primary" onClick={()=>setShowComp(true)}/></div>
      {(lab.complianceDocs??[]).length>0?lab.complianceDocs.map(d=><DocRow key={d._id} doc={d} type="complianceDocs" onVerify={verify}/>):<div style={{ fontSize:13,color:'#9ca3af',paddingBottom:8 }}>No compliance docs on file.</div>}
      <Divider label="Bank Details"/>
      {lab.bankDetails?(
        <div style={{ padding:'12px 15px',background:'var(--base-200,#f9fafb)',borderRadius:11,border:`1px solid ${lab.bankDetails.isVerified?'rgba(16,185,129,0.2)':'var(--base-300,#e5e7eb)'}` }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
            <div><div style={{ fontSize:14,fontWeight:700,marginBottom:7,color:'var(--base-content,#111)' }}>{lab.bankDetails.accountHolderName} <span style={{ marginLeft:5 }}>{lab.bankDetails.isVerified?<Chip color="#059669">Verified</Chip>:<Chip color="#f59e0b">Unverified</Chip>}</span></div>
              <InfoRow label="Bank" value={lab.bankDetails.bankName} icon={Building2}/><InfoRow label="IFSC" value={lab.bankDetails.ifscCode} icon={TagIcon}/><InfoRow label="Branch" value={lab.bankDetails.branchName} icon={MapPin}/><InfoRow label="Type" value={lab.bankDetails.accountType} icon={CreditCard}/>{lab.bankDetails.upiId&&<InfoRow label="UPI" value={lab.bankDetails.upiId} icon={Zap}/>}
            </div>
            {!lab.bankDetails.isVerified&&<Btn label="Verify Bank" icon={ShieldCheck} variant="success" onClick={()=>dispatch(adminVerifyLabBank(lab._id))}/>}
          </div>
        </div>
      ):<div style={{ fontSize:13,color:'#9ca3af' }}>No bank details provided.</div>}
      <AccrModal  open={showAccr} onClose={()=>setShowAccr(false)} actionLoading={actionLoading} onSave={f=>{dispatch(adminAddLabAccreditation({id:lab._id,...f}));setShowAccr(false);}}/>
      <CompModal  open={showComp} onClose={()=>setShowComp(false)} actionLoading={actionLoading} onSave={f=>{dispatch(adminAddLabComplianceDoc({id:lab._id,...f}));setShowComp(false);}}/>
    </div>
  );
};

// ─── Reviews Tab ──────────────────────────────────────────────────────────────

const ReviewsTab = ({ lab, reviews, dispatch }) => {
  useEffect(()=>{ if(lab?._id) dispatch(adminFetchLabReviews(lab._id)); },[lab?._id,dispatch]);
  const all=reviews?.length?reviews:(lab.reviews??[]);
  return (
    <div style={{ padding:22 }}>
      <div style={{ display:'flex',alignItems:'center',gap:14,padding:'11px 14px',background:'linear-gradient(135deg,rgba(124,58,237,0.05),rgba(79,70,229,0.02))',borderRadius:11,marginBottom:16,border:'1px solid rgba(124,58,237,0.1)' }}>
        <div style={{ textAlign:'center' }}><div style={{ fontSize:28,fontWeight:800,color:'#7c3aed' }}>{lab.averageRating?.toFixed(1)??'—'}</div><div style={{ fontSize:10,color:'#9ca3af' }}>Avg</div></div>
        <div style={{ flex:1 }}>{[5,4,3,2,1].map(n=>{ const count=all.filter(r=>Math.round(r.rating)===n).length; const pct=all.length?(count/all.length)*100:0; return(<div key={n} style={{ display:'flex',alignItems:'center',gap:6,marginBottom:3 }}><span style={{ fontSize:10,color:'#9ca3af',width:12,textAlign:'right' }}>{n}</span><Star size={9} color="#f59e0b" fill="#f59e0b"/><div style={{ flex:1,height:5,borderRadius:3,background:'var(--base-300,#e5e7eb)',overflow:'hidden' }}><div style={{ width:`${pct}%`,height:'100%',background:'#f59e0b',borderRadius:3,transition:'width .4s' }}/></div><span style={{ fontSize:10,color:'#9ca3af',width:16 }}>{count}</span></div>); })}</div>
        <div style={{ textAlign:'center' }}><div style={{ fontSize:19,fontWeight:800,color:'var(--base-content,#111)' }}>{lab.totalReviews??0}</div><div style={{ fontSize:10,color:'#9ca3af' }}>Total</div></div>
      </div>
      <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
        {all.map(r=>(
          <motion.div key={r._id} initial={{ opacity:0 }} animate={{ opacity:1 }}
            style={{ padding:'10px 13px',background:'var(--base-200,#f9fafb)',borderRadius:9,border:'1px solid var(--base-300,#e5e7eb)',opacity:r.isVisible?1:.5 }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex',alignItems:'center',gap:6 }}><div style={{ display:'flex',gap:2 }}>{[1,2,3,4,5].map(n=><Star key={n} size={11} fill={n<=r.rating?'#f59e0b':'none'} color={n<=r.rating?'#f59e0b':'#d1d5db'}/>)}</div>{!r.isVisible&&<Chip color="#9ca3af">Hidden</Chip>}<span style={{ fontSize:11,color:'#9ca3af' }}>{new Date(r.createdAt).toLocaleDateString('en-IN')}</span></div>
                {r.comment&&<p style={{ margin:'4px 0 0',fontSize:13,color:'var(--base-content,#374151)',lineHeight:1.5 }}>{r.comment}</p>}
                {r.user?.name&&<div style={{ fontSize:11,color:'#9ca3af',marginTop:2 }}>— {r.user.name}</div>}
              </div>
              <div style={{ display:'flex',gap:5,flexShrink:0 }}>
                <Btn label={r.isVisible?'Hide':'Show'} icon={r.isVisible?EyeOff:Eye} size="sm" variant="warning" onClick={()=>dispatch(adminToggleReviewVisibility({id:lab._id,reviewId:r._id}))}/>
                <Btn label="Delete" icon={Trash2} size="sm" variant="danger" onClick={()=>dispatch(adminDeleteLabReview({id:lab._id,reviewId:r._id}))}/>
              </div>
            </div>
          </motion.div>
        ))}
        {all.length===0&&<div style={{ textAlign:'center',padding:32,color:'#9ca3af',fontSize:13 }}>No reviews yet.</div>}
      </div>
    </div>
  );
};

// ─── Financial Tab ────────────────────────────────────────────────────────────

const FinancialTab = ({ lab, dispatch }) => {
  const [showFee,setShowFee]=useState(false);
  return (
    <div style={{ padding:22 }}>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:11,marginBottom:18 }}>
        <StatCard label="Commission Rate"  value={`${lab.commissionRate??0}%`}  icon={TrendingUp} color="#7c3aed"/>
        <StatCard label="Payout Frequency" value={lab.payoutFrequency??'—'}     icon={Clock}      color="#4f46e5"/>
        <StatCard label="Fee Type"         value={lab.platformFee?.type??'Global Default'} icon={CreditCard} color="#10b981"/>
        <StatCard label="Fee Value"        value={lab.platformFee?(lab.platformFee.type==='percentage'?`${lab.platformFee.value}%`:`₹${lab.platformFee.value}`):'—'} icon={Wallet} color="#f59e0b"/>
      </div>
      <Divider label="Platform Fee Override"/>
      <div style={{ padding:'13px 16px',background:'var(--base-200,#f9fafb)',borderRadius:11,border:'1px solid var(--base-300,#e5e7eb)',marginBottom:18 }}>
        <p style={{ margin:'0 0 10px',fontSize:13,color:'#6b7280',lineHeight:1.6 }}>{lab.platformFee?`Custom override: ${lab.platformFee.type} — ${lab.platformFee.type==='percentage'?`${lab.platformFee.value}%`:`₹${lab.platformFee.value}`}. Remove to revert to global config.`:'No override. Using global pricing config.'}</p>
        <Btn label={lab.platformFee?'Edit Override':'Set Override'} icon={Edit3} variant="primary" onClick={()=>setShowFee(true)}/>
      </div>
      <Divider label="Status Log"/>
      <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
        {(lab.statusLog??[]).slice().reverse().map(log=>{ const cfg=STATUS_CFG[log.toStatus]??{}; return(<div key={log._id} style={{ padding:'8px 11px',background:'var(--base-200,#f9fafb)',borderRadius:7,border:'1px solid var(--base-300,#e5e7eb)',display:'flex',alignItems:'flex-start',gap:8 }}><div style={{ width:6,height:6,borderRadius:'50%',background:cfg.color??'#9ca3af',marginTop:4,flexShrink:0 }}/><div style={{ flex:1 }}><div style={{ fontSize:12,fontWeight:700,color:'var(--base-content,#111)' }}>{log.fromStatus??'(new)'} → {log.toStatus}</div>{log.reason&&<div style={{ fontSize:11,color:'#9ca3af',marginTop:1 }}>{log.reason}</div>}<div style={{ fontSize:11,color:'#9ca3af',marginTop:1 }}>{new Date(log.changedAt).toLocaleString('en-IN')}</div></div></div>); })}
        {!lab.statusLog?.length&&<div style={{ fontSize:13,color:'#9ca3af' }}>No status changes logged.</div>}
      </div>
      <FeeModal open={showFee} current={lab.platformFee}
        onSave={({type,value})=>{dispatch(adminSetLabPlatformFee({id:lab._id,type,value}));setShowFee(false);}}
        onRemove={()=>{dispatch(adminRemoveLabPlatformFee(lab._id));setShowFee(false);}}
        onClose={()=>setShowFee(false)}/>
    </div>
  );
};

// ─── Control Panel ────────────────────────────────────────────────────────────

const ControlPanel = ({ lab, dispatch, isSuperAdmin, onNotif }) => {
  const [modal,setModal]=useState(null);
  const SA = {
    pending:      [{ action:'under_review',label:'Mark Under Review',icon:Eye,variant:'primary' },{ action:'reject',label:'Reject',icon:XCircle,variant:'danger',reason:true }],
    under_review: [...(isSuperAdmin?[{ action:'approve',label:'Approve Lab',icon:CheckCircle2,variant:'success' }]:[]),{ action:'reject',label:'Reject',icon:XCircle,variant:'danger',reason:true }],
    approved:     [{ action:'suspend',label:'Suspend',icon:PauseCircle,variant:'danger',reason:true },{ action:'deactivate',label:'Deactivate',icon:Ban,variant:'warning' }],
    suspended:    [{ action:'reactivate',label:'Reactivate',icon:PlayCircle,variant:'success' }],
    rejected:     [{ action:'under_review',label:'Re-Review',icon:RotateCcw,variant:'primary' }],
    deactivated:  [{ action:'reactivate',label:'Reactivate',icon:PlayCircle,variant:'success' }],
  };
  const actions=SA[lab.status]??[];
  return (
    <>
      <div style={{ padding:'12px 16px',background:'var(--base-100,#fff)',borderTop:'1px solid var(--base-300,#e5e7eb)',flexShrink:0 }}>
        <div style={{ fontSize:10,fontWeight:700,color:'#9ca3af',letterSpacing:'.07em',textTransform:'uppercase',marginBottom:8 }}>Actions</div>
        <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
          {actions.map(a=><Btn key={a.action} label={a.label} icon={a.icon} variant={a.variant} onClick={()=>setModal({action:a.action,requireReason:!!a.reason})}/>)}
          <Btn label="Send Notification" icon={Bell} variant="primary" onClick={onNotif}/>
          {isSuperAdmin&&<Btn label="Resend Credentials" icon={Send} variant="warning" onClick={()=>setModal({action:'__resend',requireReason:false})}/>}
        </div>
      </div>
      <ConfirmModal
        open={!!modal&&modal.action!=='__resend'}
        title={`Confirm: ${modal?.action}`}
        message={`Are you sure you want to ${modal?.action} this lab?`}
        requireReason={modal?.requireReason}
        variant={['approve','reactivate'].includes(modal?.action)?'success':'danger'}
        onConfirm={reason=>{dispatch(adminChangeLabStatus({id:lab._id,action:modal.action,reason}));setModal(null);}}
        onCancel={()=>setModal(null)}/>
      <ConfirmModal
        open={!!modal&&modal.action==='__resend'}
        title="Resend Credentials"
        message="Generate a new password and email it to the lab partner?"
        variant="warning"
        onConfirm={()=>{dispatch(adminResendLabCredentials(lab._id));setModal(null);}}
        onCancel={()=>setModal(null)}/>
    </>
  );
};

// ─── Right Panel ──────────────────────────────────────────────────────────────

const LabDetailPanel = ({ lab, loading, dispatch, isSuperAdmin, reviews, actionLoading, onRefresh }) => {
  const [activeTab,setActiveTab]=useState('overview');
  const [showNotif,setShowNotif]=useState(false);
  const [showEdit, setShowEdit] =useState(false);
  useEffect(()=>{ setActiveTab('overview'); },[lab?._id]);

  if (loading&&!lab) return <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:10,color:'#9ca3af' }}><div style={{ width:30,height:30,borderRadius:'50%',border:'3px solid rgba(124,58,237,0.2)',borderTopColor:'#7c3aed',animation:'spin .8s linear infinite' }}/><span style={{ fontSize:13 }}>Loading…</span></div>;
  if (!lab) return <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:9,color:'#9ca3af' }}><FlaskConical size={44} strokeWidth={1} color="rgba(124,58,237,0.22)"/><div style={{ fontSize:14,fontWeight:600,color:'var(--base-content,#374151)' }}>Select a lab to view details</div><div style={{ fontSize:12 }}>Choose from the list on the left</div></div>;

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      <div style={{ display:'flex',gap:2,padding:'8px 13px 0',borderBottom:'1px solid var(--base-300,#e5e7eb)',background:'var(--base-100,#fff)',overflowX:'auto',flexShrink:0 }}>
        {TABS.map(tab=>{ const I=tab.icon; const isA=activeTab===tab.id; return <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{ display:'flex',alignItems:'center',gap:5,padding:'7px 12px',border:'none',background:'transparent',cursor:'pointer',fontSize:12,fontWeight:isA?700:500,whiteSpace:'nowrap',color:isA?'#7c3aed':'var(--base-content,#6b7280)',borderBottom:isA?'2px solid #7c3aed':'2px solid transparent',transition:'all .15s',marginBottom:-1 }}><I size={12} strokeWidth={isA?2.5:2}/>{tab.label}</button>; })}
      </div>
      <div style={{ flex:1,overflowY:'auto' }}>
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity:0,y:5 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-5 }} transition={{ duration:.12 }}>
            {activeTab==='overview'  && <OverviewTab  lab={lab} onEdit={()=>setShowEdit(true)}/>}
            {activeTab==='tests'     && <TestsTab     lab={lab} dispatch={dispatch} actionLoading={actionLoading}/>}
            {activeTab==='packages'  && <PackagesTab  lab={lab} dispatch={dispatch} actionLoading={actionLoading}/>}
            {activeTab==='documents' && <DocumentsTab lab={lab} dispatch={dispatch} actionLoading={actionLoading}/>}
            {activeTab==='reviews'   && <ReviewsTab   lab={lab} reviews={reviews}   dispatch={dispatch}/>}
            {activeTab==='financial' && <FinancialTab lab={lab} dispatch={dispatch}/>}
          </motion.div>
        </AnimatePresence>
      </div>
      <ControlPanel lab={lab} dispatch={dispatch} isSuperAdmin={isSuperAdmin} onNotif={()=>setShowNotif(true)}/>
      <NotifModal open={showNotif} onSend={f=>{dispatch(adminSendLabNotification({id:lab._id,...f}));setShowNotif(false);}} onClose={()=>setShowNotif(false)}/>
      <LabFormModal open={showEdit} onClose={()=>setShowEdit(false)} initial={lab} actionLoading={actionLoading}
        onSave={payload=>{ dispatch(adminUpdateLab({id:lab._id,...payload})).then(()=>{ setShowEdit(false); onRefresh(); }); }}/>
    </div>
  );
};

// ─── Stats Header ─────────────────────────────────────────────────────────────

const StatsHeader = ({ stats }) => {
  if (!stats) return null;
  const items=[
    { label:'Total',     value:stats.totalLabs,              icon:FlaskConical, color:'#7c3aed' },
    { label:'Active',    value:stats.activeLabs,             icon:Activity,     color:'#10b981' },
    { label:'Featured',  value:stats.featuredLabs,           icon:Zap,          color:'#f59e0b' },
    { label:'Approved',  value:stats.byStatus?.approved??0,  icon:CheckCircle2, color:'#059669' },
    { label:'Pending',   value:stats.byStatus?.pending??0,   icon:Clock,        color:'#f59e0b' },
    { label:'Suspended', value:stats.byStatus?.suspended??0, icon:PauseCircle,  color:'#ef4444' },
  ];
  return (
    <div style={{ display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:8,padding:'11px 16px',borderBottom:'1px solid var(--base-300,#e5e7eb)',flexShrink:0 }}>
      {items.map(item=>(
        <div key={item.label} style={{ background:'var(--base-200,#f9fafb)',borderRadius:8,padding:'8px 11px',border:'1px solid var(--base-300,#e5e7eb)' }}>
          <div style={{ display:'flex',alignItems:'center',gap:4,marginBottom:3 }}><item.icon size={10} color={item.color} strokeWidth={2.5}/><span style={{ fontSize:9,color:'#9ca3af',fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em' }}>{item.label}</span></div>
          <div style={{ fontSize:18,fontWeight:800,color:'var(--base-content,#111)' }}>{item.value??0}</div>
        </div>
      ))}
    </div>
  );
};

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function LabManagement() {
  const dispatch      = useDispatch();
  const user          = useSelector(s => s.user?.user) ?? null;
  const labs          = useSelector(selectAdminLabs);
  const selectedLab   = useSelector(selectAdminSelectedLab);
  const stats         = useSelector(selectAdminStats);
  const pagination    = useSelector(selectAdminPagination);
  const reviews       = useSelector(selectAdminReviews);
  const loading       = useSelector(selectLabLoading);
  const actionLoading = useSelector(selectLabActionLoading);
  const isSuperAdmin  = user?.role === 'superadmin';

  const [page,           setPage]          = useState(1);
  const [filterStatus,   setFilterStatus]  = useState('');
  const [selectedId,     setSelectedId]    = useState(null);
  const [searchDebounce, setSearchDebounce]= useState('');
  const [search,         setSearch]        = useState('');
  const [showCreate,     setShowCreate]    = useState(false);

  useEffect(()=>{ dispatch(adminFetchLabStats()); },[dispatch]);

  useEffect(()=>{
    const p={ page,limit:20 };
    if (search)       p.search=search;
    if (filterStatus) p.status=filterStatus;
    dispatch(adminFetchLabs(p));
  },[dispatch,page,search,filterStatus]);

  useEffect(()=>{ const t=setTimeout(()=>{ setSearch(searchDebounce); setPage(1); },380); return()=>clearTimeout(t); },[searchDebounce]);

  const handleSelect=useCallback(id=>{ setSelectedId(id); dispatch(adminFetchLabById(id)); },[dispatch]);

  const handleRefresh=()=>{
    dispatch(adminFetchLabStats());
    const p={ page,limit:20 };
    if (search)       p.search=search;
    if (filterStatus) p.status=filterStatus;
    dispatch(adminFetchLabs(p));
    if (selectedId) dispatch(adminFetchLabById(selectedId));
  };

  const handleCreate=payload=>{
    dispatch(adminCreateLab(payload)).then(res=>{ if(!res.error){ setShowCreate(false); handleRefresh(); } });
  };

  return (
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*,*::before,*::after{box-sizing:border-box}::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(124,58,237,.2);border-radius:4px}::-webkit-scrollbar-thumb:hover{background:rgba(124,58,237,.4)}`}</style>

      <div style={{ display:'flex',flexDirection:'column',height:'100vh',background:'var(--base-100,#fff)',color:'var(--base-content,#111)',fontFamily:'var(--font-family-poppins,"Poppins",system-ui,sans-serif)',overflow:'hidden' }}>

        {/* Header */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 16px',borderBottom:'1px solid var(--base-300,#e5e7eb)',background:'var(--base-100,#fff)',flexShrink:0,gap:12 }}>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <div style={{ width:32,height:32,borderRadius:8,background:'linear-gradient(135deg,#7c3aed,#4f46e5)',display:'flex',alignItems:'center',justifyContent:'center' }}><FlaskConical size={16} color="#fff" strokeWidth={2.5}/></div>
            <div><h1 style={{ margin:0,fontSize:16,fontWeight:800,color:'var(--base-content,#111)' }}>Lab Management</h1><div style={{ fontSize:10,color:'#9ca3af' }}>{isSuperAdmin?'Superadmin':'Admin'} · {user?.name??'Administrator'}</div></div>
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            {actionLoading&&<div style={{ display:'flex',alignItems:'center',gap:5,fontSize:12,color:'#7c3aed' }}><div style={{ width:12,height:12,borderRadius:'50%',border:'2px solid rgba(124,58,237,.2)',borderTopColor:'#7c3aed',animation:'spin .7s linear infinite' }}/>Processing…</div>}
            <Btn label="Refresh" icon={RefreshCw} onClick={handleRefresh}/>
          </div>
        </div>

        <StatsHeader stats={stats}/>

        {/* Split */}
        <div style={{ flex:1,display:'flex',overflow:'hidden' }}>
          <div style={{ width:294,flexShrink:0,borderRight:'1px solid var(--base-300,#e5e7eb)',display:'flex',flexDirection:'column',overflow:'hidden' }}>
            <LabListPanel labs={labs} selectedId={selectedId} onSelect={handleSelect} loading={loading} pagination={pagination}
              onPageChange={setPage} onSearch={setSearchDebounce} searchVal={searchDebounce}
              onFilter={s=>{setFilterStatus(s);setPage(1);}} filterStatus={filterStatus} onCreateLab={()=>setShowCreate(true)}/>
          </div>
          <div style={{ flex:1,display:'flex',flexDirection:'column',overflow:'hidden' }}>
            <LabDetailPanel lab={selectedLab} loading={loading} dispatch={dispatch} isSuperAdmin={isSuperAdmin}
              reviews={reviews} actionLoading={actionLoading} onRefresh={handleRefresh}/>
          </div>
        </div>
      </div>

      {/* Create Lab Modal (outside layout so it overlays correctly) */}
      <LabFormModal open={showCreate} onClose={()=>setShowCreate(false)} onSave={handleCreate} actionLoading={actionLoading}/>
    </>
  );
}