const PLAN_CFG = {
  'Basic Care': {
    gradient: 'linear-gradient(140deg, #3b82f6 0%, #2563eb 100%)',
    accent: '--blue-500',
    icon: Shield,
    rank: 1,
    pill: 'Essential',
    pillCls: 'bg-blue-100 text-blue-700',
  },
  'Standard Care': {
    gradient: 'linear-gradient(140deg, #8b5cf6 0%, #6d28d9 100%)',
    accent: '--primary',
    icon: HeartPulse,
    rank: 2,
    pill: 'Most Popular',
    pillCls: 'bg-primary text-primary-content',
  },
  'Premium Care': {
    gradient: 'linear-gradient(140deg, #f59e0b 0%, #d97706 100%)',
    accent: '--warning',
    icon: Crown,
    rank: 3,
    pill: 'Best Protection',
    pillCls: 'bg-yellow-400 text-black font-bold',
    glow: true,
  },
  'Family Care': {
    gradient: 'linear-gradient(140deg, #10b981 0%, #059669 100%)',
    accent: '--success',
    icon: Users,
    rank: 4,
    pill: 'For Families',
    pillCls: 'bg-green-100 text-green-700',
  },
};

const BENEFIT_META = {
  doctorConsultations: { 
    icon: Stethoscope, 
    fmt: (v) => v === -1 ? <span><b>Unlimited</b> Doctor Talks</span> : <span><b>{v}</b> Doctor Visits</span> 
  },
  transportRides: { 
    icon: Truck, 
    fmt: (v) => <span><b>{v}</b> Free Emergency Rides</span> 
  },
  pharmacyDiscount: { 
    icon: Pill, 
    fmt: (v) => <span><b>{v}% Off</b> on Medicines</span> 
  },
  diagnosticDiscount: { 
    icon: FlaskConical, 
    fmt: (v) => <span><b>{v}% Off</b> Lab Tests</span> 
  },
  labTestsIncluded: { 
    icon: FlaskConical, 
    fmt: (v) => <span><b>{v}</b> Free Health Checkups</span> 
  },
  careAssistantIncluded: { 
    icon: UserCheck, 
    fmt: () => <span>Your own <b>Health Buddy</b></span> 
  },
  hasHomeSampleCollection: { 
    icon: HomeIcon, 
    fmt: () => <span>Tests done <b>at Home</b></span> 
  },
};