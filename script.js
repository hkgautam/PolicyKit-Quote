// FRAUD / QUALITY SIGNALS (invisible to user)
const _signals = {
  sessionStart: Date.now(),
  fieldTimings: {},
  fieldFocusAt: {},
  pasteEvents: [],
  keystrokes: 0,
  stepTimings: { 1: Date.now() },
  userAgent: navigator.userAgent,
  platform: navigator.platform,
  screenRes: `${screen.width}x${screen.height}`,
  colorDepth: screen.colorDepth,
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  touchDevice: navigator.maxTouchPoints > 0,
  honeypot: '',       // filled by bot -> reject
  riskScore: 0,       // computed at submit
};

// Honeypot field (hidden via CSS, visible to bots)
const hp = document.createElement('input');
hp.setAttribute('type', 'text');
hp.setAttribute('name', 'website');
hp.setAttribute('tabindex', '-1');
hp.setAttribute('autocomplete', 'off');
hp.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0';
hp.addEventListener('input', () => { _signals.honeypot = hp.value; });
document.querySelector('main').appendChild(hp);

// Field timing & paste detection
['reg','name','mobile','email'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('focus', () => { _signals.fieldFocusAt[id] = Date.now(); });
  el.addEventListener('blur', () => {
    if (_signals.fieldFocusAt[id]) {
      _signals.fieldTimings[id] = Date.now() - _signals.fieldFocusAt[id];
    }
  });
  el.addEventListener('paste', () => {
    _signals.pasteEvents.push({ field: id, at: Date.now() - _signals.sessionStart });
  });
  el.addEventListener('keydown', () => { _signals.keystrokes++; });
});

function computeRiskScore() {
  let score = 0;
  if (_signals.honeypot) score += 100;  // definite bot
  const totalTime = (Date.now() - _signals.sessionStart) / 1000;
  if (totalTime < 30) score += 40;      // too fast
  if (totalTime < 15) score += 40;      // way too fast
  const pastedFields = new Set(_signals.pasteEvents.map(e => e.field));
  if (pastedFields.has('mobile') && pastedFields.has('email')) score += 20;
  if (_signals.keystrokes < 5) score += 30;
  const mobileVal = document.getElementById('mobile').value;
  if (/^(\d)\1{9}$/.test(mobileVal)) score += 50;  // 9999999999, etc.
  if (/^(1234567890|0987654321)$/.test(mobileVal)) score += 50;
  const emailVal = document.getElementById('email').value.toLowerCase();
  if (emailVal.includes('test') || emailVal.includes('fake') || emailVal.includes('spam')) score += 30;
  const ncbEl = document.querySelector('#claims-made-pills .pill.selected');
  const hasClaim = window._hasClaim;
  const ncb = window._derivedNCB || 0;
  // If they said no claims but NCB is 0 - inconsistent (shouldn't happen in new flow, but guard anyway)
  if (!hasClaim && ncb === 0) score += 15;
  _signals.riskScore = score;
  return score;
}

// VEHICLE DATA
const vehicleDB = {
  'DL09CA1234': { make: 'Maruti Suzuki', model: 'Swift', variant: 'VXi', year: '2021', fuel: 'Petrol', city: 'Delhi' },
  'MH01AB5678': { make: 'Hyundai', model: 'Creta', variant: 'SX(O)', year: '2022', fuel: 'Diesel', city: 'Mumbai' },
  'KA03XY9012': { make: 'Tata', model: 'Nexon', variant: 'XZ+', year: '2023', fuel: 'Electric (EV)', city: 'Bengaluru' },
};

const modelsByMake = {
  'Maruti Suzuki': ['Alto', 'Swift', 'Baleno', 'Dzire', 'Brezza', 'Ertiga', 'Ciaz', 'Wagon R'],
  'Hyundai': ['i10', 'i20', 'Creta', 'Venue', 'Verna', 'Alcazar', 'Tucson'],
  'Tata': ['Tiago', 'Tigor', 'Altroz', 'Nexon', 'Punch', 'Harrier', 'Safari'],
  'Honda': ['Amaze', 'City', 'Jazz', 'WR-V', 'BR-V'],
  'Toyota': ['Glanza', 'Urban Cruiser', 'Innova', 'Fortuner', 'Camry'],
  'Kia': ['Seltos', 'Sonet', 'Carnival', 'EV6'],
  'Mahindra': ['Thar', 'XUV300', 'XUV700', 'Scorpio', 'Bolero'],
  'MG': ['Hector', 'Astor', 'ZS EV', 'Gloster'],
};

const variantsByModel = {
  'Swift': ['LXi', 'VXi', 'ZXi', 'ZXi+', 'VXi AMT', 'ZXi AMT'],
  'Creta': ['E', 'EX', 'S', 'SX', 'SX(O)', 'SX Tech'],
  'Nexon': ['XE', 'XM', 'XMA', 'XZ', 'XZ+', 'XZ+ Lux'],
  'default': ['Base', 'Mid', 'Top', 'Premium'],
};

// YEAR OPTIONS
const yearSel = document.getElementById('year');
const dobYearSel = document.getElementById('dob-year');
const dobDaySel = document.getElementById('dob-day');
for (let y = new Date().getFullYear(); y >= 1980; y--) {
  const o = document.createElement('option');
  o.value = o.textContent = y;
  yearSel.appendChild(o);
}
for (let y = new Date().getFullYear() - 18; y >= 1940; y--) {
  const o = document.createElement('option');
  o.value = o.textContent = y;
  dobYearSel.appendChild(o);
}
for (let d = 1; d <= 31; d++) {
  const o = document.createElement('option');
  o.value = o.textContent = String(d).padStart(2, '0');
  dobDaySel.appendChild(o);
}

// VEHICLE LOOKUP
const regEl = document.getElementById('reg');
regEl.addEventListener('input', function() {
  this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});

function lookupVehicle() {
  const reg = regEl.value.trim();
  const pattern = /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/;

  if (!pattern.test(reg)) {
    regEl.classList.add('error');
    document.getElementById('reg-error').classList.add('show');
    return;
  }

  regEl.classList.remove('error');
  document.getElementById('reg-error').classList.remove('show');

  const btn = document.getElementById('lookup-btn');
  btn.textContent = '...';
  btn.classList.add('loading');
  btn.disabled = true;

  setTimeout(() => {
    btn.textContent = 'Look up';
    btn.classList.remove('loading');
    btn.disabled = false;

    const data = vehicleDB[reg];
    if (data) {
      showVehicleCard(data);
    } else {
      // Simulate partial lookup - show manual fields
      document.getElementById('manual-fields').classList.remove('hidden');
      document.getElementById('vehicle-card').classList.remove('show');
      document.getElementById('city-from-reg').classList.add('hidden');
    }
  }, 800);
}

function showVehicleCard(data) {
  const card = document.getElementById('vehicle-card');
  document.getElementById('vc-name').textContent = `${data.make} ${data.model} ${data.variant}`;
  document.getElementById('vc-meta').textContent = `${data.year} | ${data.fuel} | Reg: ${regEl.value}`;
  card.classList.add('show');
  document.getElementById('manual-fields').classList.add('hidden');
  document.getElementById('city-from-reg').classList.remove('hidden');
  // Pre-select city
  const cityEl = document.getElementById('city2');
  for (let o of cityEl.options) {
    if (o.value === data.city || o.text === data.city) { o.selected = true; break; }
  }
  window._vehicleData = data;
}

function populateModels() {
  const make = document.getElementById('make').value;
  const modelSel = document.getElementById('model');
  modelSel.innerHTML = '<option value="">Select model</option>';
  (modelsByMake[make] || []).forEach(m => {
    const o = document.createElement('option');
    o.value = o.textContent = m;
    modelSel.appendChild(o);
  });
  document.getElementById('variant').innerHTML = '<option value="">Select model first</option>';
}

function populateVariants() {
  const model = document.getElementById('model').value;
  const variantSel = document.getElementById('variant');
  const variants = variantsByModel[model] || variantsByModel['default'];
  variantSel.innerHTML = '<option value="">Select variant</option>';
  variants.forEach(v => {
    const o = document.createElement('option');
    o.value = o.textContent = v;
    variantSel.appendChild(o);
  });
}

// PILL SELECT
function selectPill(el, group) {
  const container = document.getElementById(group + '-pills');
  container.querySelectorAll('.pill').forEach(p => p.classList.remove('selected'));
  el.classList.add('selected');
  if (group === 'claim-free') updateDerivedNCB();
}

// NCB derivation map: claim-free years to NCB %
const NCB_MAP = { '1 year': 20, '2 years': 25, '3 years': 35, '4 years': 45, '5+ years': 50 };

function selectClaimsMade(el, hasClaim) {
  document.querySelectorAll('#claims-made-pills .pill').forEach(p => p.classList.remove('selected'));
  el.classList.add('selected');
  const yearsField = document.getElementById('claim-free-years-field');
  const display = document.getElementById('ncb-derived-display');
  if (hasClaim) {
    yearsField.classList.add('hidden');
    display.classList.remove('hidden');
    display.innerHTML = 'Your NCB: <strong>0%</strong> - NCB resets after a claim. We\'ll apply this automatically.';
    window._derivedNCB = 0;
    window._hasClaim = true;
  } else {
    yearsField.classList.remove('hidden');
    window._hasClaim = false;
    updateDerivedNCB();
  }
}

function updateDerivedNCB() {
  const selected = document.querySelector('#claim-free-pills .pill.selected');
  if (!selected) return;
  const ncb = NCB_MAP[selected.textContent] || 0;
  window._derivedNCB = ncb;
  const display = document.getElementById('ncb-derived-display');
  display.classList.remove('hidden');
  display.innerHTML = `Your NCB: <strong>${ncb}%</strong> - we'll apply this discount automatically.`;
}

// Init derived NCB on load
window._derivedNCB = 50;
window._hasClaim = false;

function selectIDV(el) {
  document.querySelectorAll('.idv-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

// STEP NAVIGATION
function updateProgress(step) {
  for (let i = 1; i <= 3; i++) {
    const sc = document.getElementById('sc' + i);
    const sl = document.getElementById('sl' + i);
    sc.className = 'step-circle' + (i === step ? ' active' : i < step ? ' done' : '');
    if (i < step) sc.textContent = 'OK';
    else sc.textContent = i;
    sl.className = 'step-label' + (i === step ? ' active' : '');
  }
  if (step > 1) { document.getElementById('conn1').classList.add('done'); }
  else { document.getElementById('conn1').classList.remove('done'); }
  if (step > 2) { document.getElementById('conn2').classList.add('done'); }
  else { document.getElementById('conn2').classList.remove('done'); }
}

function goToStep(n) {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('step' + n).classList.add('active');
  _signals.stepTimings[n] = Date.now();
  updateProgress(n);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToStep2() {
  // Validate step 1
  const reg = regEl.value.trim();
  const pattern = /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/;
  const hasVehicleCard = document.getElementById('vehicle-card').classList.contains('show');
  const hasManual = !document.getElementById('manual-fields').classList.contains('hidden');

  if (!pattern.test(reg)) {
    regEl.classList.add('error');
    document.getElementById('reg-error').classList.add('show');
    regEl.focus();
    return;
  }
  if (!hasVehicleCard && !hasManual) {
    // They typed reg but didn't look up
    lookupVehicle();
    return;
  }

  goToStep(2);
}

function goToStep3() {
  // Validate expiry date
  const expiry = document.getElementById('expiry-date').value;
  if (!expiry) {
    document.getElementById('expiry-error').classList.add('show');
    return;
  }
  document.getElementById('expiry-error').classList.remove('show');

  // Compute quote range (mock) - apply NCB discount
  const vehicle = window._vehicleData || {};
  const year = parseInt(vehicle.year || document.getElementById('year').value || 2020);
  const age = new Date().getFullYear() - year;
  const base = Math.max(6000, 18000 - age * 1200);
  const ncbDiscount = 1 - ((window._derivedNCB || 0) / 100);
  const low = Math.round(base * 0.85 * ncbDiscount / 100) * 100;
  const high = Math.round(base * 1.45 * ncbDiscount / 100) * 100;
  document.getElementById('quote-range').textContent = `Rs ${low.toLocaleString('en-IN')} - Rs ${high.toLocaleString('en-IN')}`;

  goToStep(3);
}

// SUBMIT
function validateEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function validateMobile(m) { return /^[6-9]\d{9}$/.test(m); }

function submitForm() {
  let ok = true;

  const name = document.getElementById('name').value.trim();
  if (name.length < 2) {
    document.getElementById('name-error').classList.add('show');
    ok = false;
  } else { document.getElementById('name-error').classList.remove('show'); }

  const mobile = document.getElementById('mobile').value.trim();
  if (!validateMobile(mobile)) {
    document.getElementById('mobile-error').classList.add('show');
    ok = false;
  } else { document.getElementById('mobile-error').classList.remove('show'); }

  const email = document.getElementById('email').value.trim();
  if (!validateEmail(email)) {
    document.getElementById('email-error').classList.add('show');
    ok = false;
  } else { document.getElementById('email-error').classList.remove('show'); }

  const dobD = document.getElementById('dob-day').value;
  const dobM = document.getElementById('dob-month').value;
  const dobY = document.getElementById('dob-year').value;
  if (!dobD || !dobM || !dobY) {
    document.getElementById('dob-error').classList.add('show');
    ok = false;
  } else { document.getElementById('dob-error').classList.remove('show'); }

  if (!ok) return;

  // Compute risk score
  const risk = computeRiskScore();
  const submission = {
    vehicle: window._vehicleData || {},
    contact: { name, mobile, email, dob: `${dobD}/${dobM}/${dobY}` },
    coverage: {
      expiry: document.getElementById('expiry-date').value,
      ncb: `${window._derivedNCB || 0}%`,
      claims: window._hasClaim ? 'Claim made' : 'No claims',
      idv: document.querySelector('.idv-option.selected .idv-option-text strong')?.textContent,
      prevInsurer: document.getElementById('prev-insurer').value,
    },
    _meta: {
      riskScore: risk,
      flagged: risk >= 60,
      sessionDuration: Date.now() - _signals.sessionStart,
      pasteEvents: _signals.pasteEvents,
      keystrokes: _signals.keystrokes,
      stepTimings: _signals.stepTimings,
      tz: _signals.tz,
    }
  };

  // In production: POST to /api/quotes
  // console.log('Submission:', JSON.stringify(submission, null, 2));
  // if (submission._meta.flagged) { route to manual review queue }

  const btn = document.getElementById('submit-btn');
  btn.textContent = 'Finding quotes...';
  btn.disabled = true;

  setTimeout(() => {
    document.getElementById('step3').classList.remove('active');
    const ss = document.getElementById('success-screen');
    ss.classList.add('show');
    updateProgress(4); // past all steps
    const vehicle = window._vehicleData || {};
    const year = parseInt(vehicle.year || 2020);
    const age = new Date().getFullYear() - year;
    const base = Math.max(6000, 18000 - age * 1200);
    document.getElementById('best-quote').textContent = `Rs ${Math.round(base * 0.83 / 100) * 100}`.replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,') + '/year';
    document.getElementById('quote-count').textContent = Math.floor(Math.random() * 5) + 8;
  }, 1200);
}

function setupEventHandlers() {
  document.getElementById('lookup-btn').addEventListener('click', lookupVehicle);
  document.getElementById('make').addEventListener('change', populateModels);
  document.getElementById('model').addEventListener('change', populateVariants);
  document.getElementById('step1-next').addEventListener('click', goToStep2);
  document.getElementById('step2-next').addEventListener('click', goToStep3);
  document.getElementById('submit-btn').addEventListener('click', submitForm);

  document.querySelectorAll('[data-go-step]').forEach(btn => {
    btn.addEventListener('click', () => goToStep(Number(btn.dataset.goStep)));
  });

  document.getElementById('claims-made-pills').addEventListener('click', event => {
    const pill = event.target.closest('.pill');
    if (!pill) return;
    selectClaimsMade(pill, pill.dataset.hasClaim === 'true');
  });

  document.getElementById('claim-free-pills').addEventListener('click', event => {
    const pill = event.target.closest('.pill');
    if (pill) selectPill(pill, 'claim-free');
  });

  document.querySelectorAll('.idv-options').forEach(group => {
    group.addEventListener('click', event => {
      const option = event.target.closest('.idv-option');
      if (option) selectIDV(option);
    });
  });

  // Auto-lookup on reg blur
  regEl.addEventListener('blur', function() {
    const reg = this.value.trim();
    const pattern = /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/;
    if (pattern.test(reg) && !document.getElementById('vehicle-card').classList.contains('show')) {
      lookupVehicle();
    }
  });
}

// INIT
document.getElementById('ssl-badge').classList.remove('hidden');
setupEventHandlers();
updateDerivedNCB();
updateProgress(1);


