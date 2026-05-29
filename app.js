let imgBrightness = 128, imgSaturation = 100, hasImage = false;
let mainChartInst = null;

const imgInput = document.getElementById('imgInput');
const imgPreview = document.getElementById('imgPreview');
const uploadName = document.getElementById('uploadName');

imgInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  uploadName.textContent = file.name;
  uploadName.style.display = 'block';
  const reader = new FileReader();
  reader.onload = ev => {
    imgPreview.src = ev.target.result;
    imgPreview.style.display = 'block';
    analyzeImage(ev.target.result);
  };
  reader.readAsDataURL(file);
});

function analyzeImage(dataUrl) {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    const maxS = 80;
    const scale = Math.min(maxS / img.width, maxS / img.height, 1);
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let r = 0, g = 0, b = 0, n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; }
    r /= n; g /= n; b /= n;
    imgBrightness = Math.round((r + g + b) / 3);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    imgSaturation = mx === 0 ? 0 : Math.round(((mx - mn) / mx) * 100);
    hasImage = true;
  };
  img.src = dataUrl;
}

function fmtK(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return Math.round(n).toString();
}

function hourMultiplier(h) {
  const curve = [0.3,0.25,0.2,0.18,0.22,0.35,0.55,0.75,0.88,0.92,0.95,0.97,1.0,0.96,0.9,0.88,0.91,0.98,1.05,1.0,0.9,0.78,0.65,0.45];
  return curve[h] || 0.5;
}

function generate24h(baseLikes, postHour) {
  return Array.from({ length: 24 }, (_, h) => {
    const m = hourMultiplier(h);
    const proximity = Math.max(0, 1 - Math.abs(h - postHour) / 8);
    const noise = 1 + (Math.random() * 0.1 - 0.05);
    return Math.round(baseLikes * m * (0.7 + proximity * 0.3) * noise);
  });
}

function contentMultiplier(type) {
  const map = { photo: 1, reel: 1.45, carousel: 1.3, story: 0.6, text: 0.75 };
  return map[type] || 1;
}

document.getElementById('runBtn').addEventListener('click', () => {
  const hour = parseInt(document.getElementById('postHour').value) || 12;
  const ctype = document.getElementById('contentType').value;
  const bright = hasImage ? imgBrightness : 128;
  const sat = hasImage ? imgSaturation : 60;

  const brightFactor = 0.4 + (bright / 255) * 1.2;
  const satFactor = 0.6 + (sat / 100) * 0.8;
  const cMul = contentMultiplier(ctype);
  const hourMul = hourMultiplier(Math.min(23, Math.max(0, hour)));
  const baseLikes = Math.round(800 + bright * 18 + sat * 22 + hourMul * 3500 + (cMul - 1) * 5000);

  const likes = Math.round(baseLikes * brightFactor * satFactor * cMul);
  const comments = Math.round(likes * 0.058);
  const shares = Math.round(likes * 0.032);
  const reach = Math.round(likes * 4.2);

  const igL = Math.round(likes * 1.0);
  const ytL = Math.round(likes * (ctype === 'reel' ? 1.85 : 0.7));
  const twL = Math.round(likes * 0.62);
  const tkL = Math.round(likes * (ctype === 'reel' ? 2.1 : 0.9));

  document.getElementById('mLikes').textContent = fmtK(likes);
  document.getElementById('mComments').textContent = fmtK(comments);
  document.getElementById('mShares').textContent = fmtK(shares);
  document.getElementById('mReach').textContent = fmtK(reach);

  const platforms = [
    { id: 'platIG', lId: 'igLikes', tId: 'igTrend', val: igL, best: ctype === 'photo' },
    { id: 'platYT', lId: 'ytLikes', tId: 'ytTrend', val: ytL, best: ctype === 'reel' },
    { id: 'platTW', lId: 'twLikes', tId: 'twTrend', val: twL, best: ctype === 'text' },
    { id: 'platTK', lId: 'tkLikes', tId: 'tkTrend', val: tkL, best: ctype === 'reel' && bright > 140 },
  ];

  platforms.forEach(p => {
    document.getElementById(p.lId).textContent = fmtK(p.val);
    const tEl = document.getElementById(p.tId);
    const pctDiff = Math.round((p.val / igL - 1) * 100);
    if (pctDiff > 0) { tEl.textContent = '▲ +' + pctDiff + '% vs avg'; tEl.className = 'pp-platform-trend pp-trend-up'; }
    else if (pctDiff < 0) { tEl.textContent = '▼ ' + pctDiff + '% vs avg'; tEl.className = 'pp-platform-trend pp-trend-down'; }
    else { tEl.textContent = '~ baseline'; tEl.className = 'pp-platform-trend'; }
    document.getElementById(p.id).classList.toggle('active', p.best);
  });

  const hrs24 = generate24h(likes, hour);
  const labels = Array.from({ length: 24 }, (_, i) => {
    if (i === 0) return '12am';
    if (i === 12) return '12pm';
    if (i < 12) return i + 'am';
    return (i - 12) + 'pm';
  });

  if (mainChartInst) mainChartInst.destroy();
  mainChartInst = new Chart(document.getElementById('mainChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Predicted Likes',
          data: hrs24,
          borderColor: '#7c6fff',
          backgroundColor: 'rgba(124,111,255,0.08)',
          borderWidth: 2,
          pointRadius: hrs24.map((_, i) => i === hour ? 6 : 2),
          pointBackgroundColor: hrs24.map((_, i) => i === hour ? '#ffd166' : '#7c6fff'),
          tension: 0.4,
          fill: true
        },
        {
          label: '7-Day Avg',
          data: hrs24.map(v => Math.round(v * 0.78)),
          borderColor: 'rgba(255,107,157,0.5)',
          borderWidth: 1,
          borderDash: [4, 3],
          pointRadius: 0,
          tension: 0.4,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1a2e',
          titleColor: '#f0eeff',
          bodyColor: '#7a7a9a',
          borderColor: '#2a2a3a',
          borderWidth: 1,
          callbacks: { label: ctx => fmtK(ctx.raw) + ' likes' }
        }
      },
      scales: {
        x: {
          ticks: { color: '#7a7a9a', font: { size: 9, family: 'Space Mono' }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
          grid: { color: 'rgba(255,255,255,0.04)' }
        },
        y: {
          ticks: { color: '#7a7a9a', font: { size: 9, family: 'Space Mono' }, callback: v => fmtK(v) },
          grid: { color: 'rgba(255,255,255,0.04)' }
        }
      }
    }
  });

  const heatEl = document.getElementById('heatmapBars');
  heatEl.innerHTML = '';
  const ranked = hrs24.map((v, i) => ({ h: i, v })).sort((a, b) => b.v - a.v);
  const maxV = ranked[0].v;
  ranked.slice(0, 8).forEach(({ h, v }, rank) => {
    const lbl = h < 12 ? (h === 0 ? '12am' : h + 'am') : (h === 12 ? '12pm' : (h - 12) + 'pm');
    const pct = Math.round((v / maxV) * 100);
    const color = rank === 0 ? '#7c6fff' : rank < 3 ? '#ff6b9d' : '#4a4a6a';
    heatEl.innerHTML += `<div class="pp-bar-row">
      <div class="pp-bar-lbl">${lbl}</div>
      <div class="pp-bar-track"><div class="pp-bar-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="pp-bar-val">${fmtK(v)}</div>
    </div>`;
  });

  const engScore = Math.min(99, Math.round(30 + (bright / 255) * 30 + (sat / 100) * 20 + hourMul * 19));
  document.getElementById('dBright').textContent = Math.round(bright);
  document.getElementById('dBrightSub').textContent = bright > 180 ? 'High contrast — great visibility' : bright > 100 ? 'Moderate — balanced lighting' : 'Low brightness — moody/dark tone';
  document.getElementById('dSat').textContent = Math.round(sat) + '%';
  document.getElementById('dSatSub').textContent = sat > 60 ? 'Vibrant — eye-catching palette' : sat > 30 ? 'Moderate colour saturation' : 'Muted/monochrome tones';
  const platNames = { photo: 'Instagram', reel: 'Instagram Reels / TikTok', carousel: 'Instagram Carousel', story: 'Instagram Stories', text: 'Twitter/X' };
  document.getElementById('dPlat').textContent = platNames[ctype] || 'Instagram';
  document.getElementById('dPlatSub').textContent = 'Based on content type + image analysis';
  document.getElementById('dEngScore').textContent = engScore + '/100';
  document.getElementById('dEngSub').textContent = engScore > 75 ? 'Excellent potential' : 'Good potential';

  const tagMap = {
    photo: ['#photography','#picoftheday','#photooftheday','#instagood','#aesthetic'],
    reel: ['#reels','#viral','#trending','#fyp','#reelsvideo'],
    carousel: ['#carousel','#swiperight','#tips','#content','#explore'],
    story: ['#stories','#daily','#moment','#lifestyle','#real'],
    text: ['#thoughts','#opinion','#trending','#discussion','#content']
  };
  const tags = tagMap[ctype] || tagMap.photo;
  document.getElementById('hashtagRow').innerHTML = tags.map(t => `<span class="pp-tag">${t}</span>`).join('');

  const liftData = [
    { lbl: 'Image brightness', val: Math.round(brightFactor * 50), max: 90 },
    { lbl: 'Colour vibrancy', val: Math.round(satFactor * 45), max: 90 },
    { lbl: 'Post timing', val: Math.round(hourMul * 75), max: 90 },
    { lbl: 'Content format', val: Math.round((cMul - 0.5) * 60), max: 90 },
  ];
  const liftEl = document.getElementById('liftBars');
  liftEl.innerHTML = '';
  liftData.forEach(({ lbl, val, max }) => {
    const pct = Math.round((val / max) * 100);
    liftEl.innerHTML += `<div class="pp-bar-row">
      <div class="pp-bar-lbl" style="width:90px">${lbl}</div>
      <div class="pp-bar-track"><div class="pp-bar-fill" style="width:${Math.min(100, pct)}%;background:#7c6fff"></div></div>
      <div class="pp-bar-val">${Math.min(100, pct)}%</div>
    </div>`;
  });

  document.getElementById('resultsArea').style.display = 'block';
  document.getElementById('resultsArea').classList.remove('pp-results-hidden');
});
