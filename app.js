let dataset = [];
let barChart, lineChart, pieChart, yearLevelChart;

// helper: safe number parse
function number(x){ return isNaN(parseFloat(x)) ? 0 : parseFloat(x); }

// -------------------------
// Recommendation generator
// -------------------------
function generateRecommendationList(record) {
  const recs = [];
  const ai = parseFloat(record.AI_Dependency_Index || 0);
  const mot = parseFloat(record.Motivation_Score || 0);
  const env = parseFloat(record.Environment_Score || 0);
  const gwa = parseFloat(record.Prior_GWA || 0);

  if (ai > 6) recs.push('High AI dependency detected; recommend reduced AI reliance and skill-building assignments.');
  if (mot < 4) recs.push('Low motivation indicators; consider supportive coaching or task restructuring.');
  if (env > 5) recs.push('High environmental dependency; promote more independent tasks.');
  if (!isNaN(gwa) && gwa > 2.0) recs.push('Academic performance below optimum; consider guided study plans.');
  if (recs.length === 0) recs.push('No significant concerns detected. Maintain balanced and guided use of AI tools.');
  return recs;
}

// -------------------------
// PDF Metrics block renderer
// -------------------------
function addMetricsBlock(doc, margin, startY, record) {
  let y = startY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Student Metrics Overview", margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const risk = (parseFloat(record.High_Risk_Flag) === 1 || parseFloat(record.AI_Dependency_Index) > 5.5) ? "HIGH" : "LOW";

  const metrics = [
    ["AI Dependency Index:", record.AI_Dependency_Index],
    ["Risk Classification:", risk],
    ["Motivation Score:", record.Motivation_Score],
    ["Environment Score:", record.Environment_Score],
    ["Reading Dependency:", record.Reading_Dependency_Score],
    ["Writing Dependency:", record.Writing_Dependency_Score],
    ["Numeracy Dependency:", record.Numeracy_Dependency_Score],
    ["Performance_Level:", record.Prior_GWA]
  ];

  metrics.forEach(([label, value]) => {
    doc.text(`${label} ${value ?? "N/A"}`, margin, y);
    y += 6;
  });

  return y + 5;
}

// -------------------------
// CSV / Backend loader
// -------------------------
async function loadCSV() {
  const BACKEND_URL = "/api";
  try {
    const res = await fetch(`${BACKEND_URL}/students`);
    if (!res.ok) throw new Error('Failed to fetch data from backend');
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error loading data from backend:', error);

    // fallback to local data.csv
    try {
      console.log('Falling back to local data.csv');
      const res = await fetch('data.csv');
      const text = await res.text();
      const rows = text.trim().split('\n');
      const headers = rows[0].split(',');
      const data = rows.slice(1).map(r=>{
        const cols = r.split(',');
        const obj = {};
        headers.forEach((h,i)=> obj[h]=cols[i]);
        return obj;
      });
      return data;
    } catch (e) {
      console.error('Failed to load fallback CSV:', e);
      return [];
    }
  }
}

// -------------------------
// UI helpers - dropdown/cards
// -------------------------
function calcAvgGrade(data){
  const vals = data.map(d=>number(d.Prior_GWA));
  if (vals.length === 0) return '—';
  return (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2);
}

function buildDropdown(data){
  const sel = document.getElementById('studentSelect');
  if (!sel) return;
  sel.innerHTML = '';
  data.forEach(d=>{
    const opt = document.createElement('option');
    opt.value = d.Student_ID;
    opt.text = `${d.Student_ID} — ${d.College}`;
    sel.appendChild(opt);
  });
}

async function updateCards(data){
  const aiEl = document.getElementById('aiIndex');
  const riskEl = document.getElementById('riskStatus');
  const avgEl = document.getElementById('avgGrade');
  const totalEl = document.getElementById('totalResp');

  if (aiEl) aiEl.innerText = data.AI_Dependency_Index || '—';

  let risk = 'LOW';
  try {
    const BACKEND_URL = "http://127.0.0.1:8000";
    const predRes = await fetch(`${BACKEND_URL}/predict/${data.Student_ID}`);
    if (predRes.ok) {
      const predData = await predRes.json();
      risk = predData.predicted_risk ? 'HIGH' : 'LOW';
    } else {
      risk = (number(data.High_Risk_Flag)===1 || number(data.AI_Dependency_Index)>5.5) ? 'HIGH' : 'LOW';
    }
  } catch (error) {
    console.error('Error fetching prediction:', error);
    risk = (number(data.High_Risk_Flag)===1 || number(data.AI_Dependency_Index)>5.5) ? 'HIGH' : 'LOW';
  }

  if (riskEl) riskEl.innerText = risk;
  if (avgEl) avgEl.innerText = calcAvgGrade(dataset);
  if (totalEl) totalEl.innerText = dataset.length;
}
function renderBar(data) {
  const canvas = document.getElementById('barChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const reading = Number(data.Reading_Dependency_Score);
  const writing = Number(data.Writing_Dependency_Score);
  const numeracy = Number(data.Numeracy_Dependency_Score);

  if (barChart) barChart.destroy();

  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Reading', 'Writing', 'Numeracy'],
      datasets: [
        {
          label: 'Reading',
          data: [reading, null, null],
          backgroundColor: '#2563eb',   // blue
          borderRadius: 6
        },
        {
          label: 'Writing',
          data: [null, writing, null],
          backgroundColor: '#ef4444',   // red
          borderRadius: 6
        },
        {
          label: 'Numeracy',
          data: [null, null, numeracy],
          backgroundColor: '#f97316',   // orange
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'top' }
      }
    }
  });
}

function renderLine(){
  const canvas = document.getElementById('lineChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const collegeAbbrevMap = {
    'College of Arts and Sciences': 'CAS',
    'College of Business Administration and Accountancy': 'CBAA',
    'College of Computer Studies': 'CCS',
    'College of Criminal Justice Education': 'CCJE',
    'College of Engineering': 'COE',
    'College of Industrial Technology': 'CIT',
    'College of Hospitality Management and Tourism': 'CHMT',
    'College of Teacher Education': 'CTE'
  };
  const collegeOrder = ['CAS', 'CBAA', 'CCS', 'CCJE', 'COE', 'CIT', 'CHMT', 'CTE'];
  const abbrevToOrder = {};
  collegeOrder.forEach((abbrev, index) => { abbrevToOrder[abbrev] = index; });

  const collegeGroups = {};
  dataset.forEach(d => {
    const college = d.College;
    if (!collegeGroups[college]) {
      collegeGroups[college] = { count: 0, aiSum: 0 };
    }
    collegeGroups[college].count++;
    collegeGroups[college].aiSum += number(d.AI_Dependency_Index);
  });

  const getAbbrev = (label) => {
    if (collegeAbbrevMap[label]) { return collegeAbbrevMap[label]; }
    const lowerLabel = (label||'').toLowerCase();
    if (lowerLabel.includes('arts') && lowerLabel.includes('sciences')) return 'CAS';
    if (lowerLabel.includes('business') || lowerLabel.includes('accountancy')) return 'CBAA';
    if (lowerLabel.includes('computer studies')) return 'CCS';
    if (lowerLabel.includes('criminal justice')) return 'CCJE';
    if (lowerLabel.includes('engineering')) return 'COE';
    if (lowerLabel.includes('information technology') || lowerLabel.includes('industrial technology') || (lowerLabel.includes('technology') && !lowerLabel.includes('computer') && !lowerLabel.includes('teacher'))) return 'CIT';
    if (lowerLabel.includes('hospitality') || lowerLabel.includes('tourism')) return 'CHMT';
    if (lowerLabel.includes('teacher education')) return 'CTE';
    const words = (label||'').replace('College of ', '').split(' ');
    if (words.length === 1) {
      const word = words[0].toLowerCase();
      if (word === 'it' || word.includes('technology')) return 'CIT';
      return words[0].substring(0, 4);
    }
    const abbrev = words.map(w => w[0]).join('');
    if (abbrev.startsWith('CIT') || abbrev === 'IT') return 'CIT';
    return abbrev.substring(0, 3);
  };

  const fullLabels = Object.keys(collegeGroups).sort((a, b) => {
    const abbrevA = getAbbrev(a);
    const abbrevB = getAbbrev(b);
    const orderA = abbrevToOrder[abbrevA] !== undefined ? abbrevToOrder[abbrevA] : 999;
    const orderB = abbrevToOrder[abbrevB] !== undefined ? abbrevToOrder[abbrevB] : 999;
    return orderA - orderB;
  });

  const avgAIs = fullLabels.map(c => collegeGroups[c].aiSum / collegeGroups[c].count);
  const labels = fullLabels.map(label => {
    const abbrev = getAbbrev(label);
    return abbrev === 'IT' ? 'CIT' : abbrev;
  });

  const pointColors = ['#ef4444','#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#84cc16'];

  if(lineChart) lineChart.destroy();

  lineChart = new Chart(ctx, {
    type: 'line',
    data: { labels: labels, datasets: [{ label: 'Average AI Dependency Score', data: avgAIs, borderColor: '#93c5fd', backgroundColor: '#93c5fd', borderWidth: 3, pointRadius: 5, pointBackgroundColor: pointColors.slice(0, avgAIs.length), pointBorderColor: '#ffffff', pointBorderWidth: 2, pointHoverRadius: 7, fill: false, tension: 0.1 }]},
    options: { responsive: true, maintainAspectRatio: true }
  });
}
function renderPieChart() {
  const canvas = document.getElementById('pieChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let highRisk = 0;
  let lowRisk = 0;

  dataset.forEach(d => {
    const risk =
      Number(d.High_Risk_Flag) === 1 ||
      Number(d.AI_Dependency_Index) > 5.5
        ? 'HIGH'
        : 'LOW';

    if (risk === 'HIGH') highRisk++;
    else lowRisk++;
  });

  highRisk = Number(highRisk);
  lowRisk = Number(lowRisk);
  const total = highRisk + lowRisk;

  if (pieChart) pieChart.destroy();

  // Create gradients
  const redGradient = ctx.createLinearGradient(0, 0, 600, 0);
  redGradient.addColorStop(0, '#ef4444');
  redGradient.addColorStop(1, '#dc2626');

  const greenGradient = ctx.createLinearGradient(0, 0, 600, 0);
  greenGradient.addColorStop(0, '#10b981');
  greenGradient.addColorStop(1, '#059669');

  // Plugin for percentage labels
  const barLabels = {
    id: 'barLabels',
    afterDatasetsDraw(chart) {
      const { ctx, data } = chart;

      ctx.save();
      ctx.font = 'bold 14px Inter';
      ctx.fillStyle = '#111';

      chart.getDatasetMeta(0).data.forEach((bar, index) => {
        const value = data.datasets[0].data[index];
        const pct = ((value / total) * 100).toFixed(1) + '%';

        const xPos = bar.x + 10;
        const yPos = bar.y + 4;

        ctx.fillText(pct, xPos, yPos);
      });

      ctx.restore();
    }
  };

  pieChart = new Chart(ctx, {
    type: 'bar',
    plugins: [barLabels],
    data: {
      labels: ['High Risk', 'Low Risk'],
      datasets: [
        {
          label: 'Respondents',
          data: [highRisk, lowRisk],
          backgroundColor: [redGradient, greenGradient],
          borderRadius: 8,
          borderWidth: 1,
          borderColor: ['#b91c1c', '#047857']
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',

      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const value = context.raw;
              const pct = ((value / total) * 100).toFixed(1);
              return `${context.label}: ${value} (${pct}%)`;
            }
          }
        }
      },

      scales: {
        x: {
          beginAtZero: true,
          grid: {
            color: '#e5e7eb'
          }
        },
        y: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

function renderYearLevelChart(){
  const canvas = document.getElementById('yearLevelChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function normalizeYearLevel(year) {
    if (!year || year === '') return 'Unknown';
    const yearStr = String(year).trim();
    if (/^[1-4]$/.test(yearStr)) {
      const num = parseInt(yearStr);
      return ['1st Year','2nd Year','3rd Year','4th Year'][num-1];
    }
    const lower = yearStr.toLowerCase();
    if (lower.includes('1st') || lower.includes('first') || lower === '1') return '1st Year';
    if (lower.includes('2nd') || lower.includes('second') || lower === '2') return '2nd Year';
    if (lower.includes('3rd') || lower.includes('third') || lower === '3') return '3rd Year';
    if (lower.includes('4th') || lower.includes('fourth') || lower === '4') return '4th Year';
    return yearStr;
  }

  const yearGroups = {};
  dataset.forEach(d => {
    const year = normalizeYearLevel(d.Year_Level);
    if (!yearGroups[year]) { yearGroups[year] = { count: 0, aiSum: 0 }; }
    yearGroups[year].count++; yearGroups[year].aiSum += number(d.AI_Dependency_Index);
  });

  const yearOrder = ['1st Year','2nd Year','3rd Year','4th Year','Unknown'];
  const sortedYears = yearOrder.filter(y => yearGroups[y] && yearGroups[y].count > 0);
  if (sortedYears.length === 0) {
    const allYears = Object.keys(yearGroups).filter(y => yearGroups[y].count > 0);
    sortedYears.push(...allYears.sort());
  }
  if (sortedYears.length === 0) {
    if(yearLevelChart) yearLevelChart.destroy();
    yearLevelChart = new Chart(ctx, {
      type: 'line',
      data: { labels: ['No Data'], datasets: [{ label: 'Average AI Dependency Score', data: [0], borderColor: '#f59e0b', backgroundColor: '#fef3c7', borderWidth: 3, pointRadius: 6 }]},
      options: { responsive: true, maintainAspectRatio: true }
    });
    return;
  }

  const avgAIs = sortedYears.map(y => yearGroups[y].aiSum / yearGroups[y].count);

  if(yearLevelChart) yearLevelChart.destroy();
  yearLevelChart = new Chart(ctx, {
    type: 'line',
    data: { labels: sortedYears, datasets: [{ label: 'Average AI Dependency Score', data: avgAIs, borderColor: '#f59e0b', backgroundColor: '#fef3c7', borderWidth: 3, pointRadius: 6, fill: true, tension: 0.3 }]},
    options: { responsive: true, maintainAspectRatio: true }
  });
}

function generateRecommendations(data){
  const ai = number(data.AI_Dependency_Index);
  const mot = number(data.Motivation_Score);
  const env = number(data.Environment_Score);
  let recs = [];
  if(ai>6){ recs.push('High AI reliance detected — recommend writing workshops and guided assignments to rebuild skill.'); }
  if(mot<4){ recs.push('Low autonomous motivation — consider autonomy-supportive tasks and formative feedback.'); }
  if(env>5){ recs.push('Strong peer reliance — promote collaborative but independent tasks; monitor group dependency.'); }
  if(recs.length===0) recs.push('No immediate concerns; encourage balanced AI use only.');
  const recoEl = document.getElementById('recoText');
  if(recoEl) recoEl.innerHTML = '<ul><li>'+recs.join('</li><li>')+'</li></ul>';
}

document.getElementById('loadBtn').addEventListener('click', async ()=>{
  const sel = document.getElementById('studentSelect');
  const id = sel.value;
  const record = dataset.find(d=>d.Student_ID===id);
  if(!record) return;
  await updateCards(record);
  renderBar(record);
  renderLine();
  generateRecommendations(record);
});

// -------------------------
// Chart capture for PDF (high-res) and proportional insertion
// -------------------------
async function captureChartToImage(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  // Attempt to use the canvas' intrinsic size (pixel width/height)
  const cw = canvas.width || canvas.offsetWidth;
  const ch = canvas.height || canvas.offsetHeight;
  const scale = 2; // scale up for better resolution

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = cw * scale;
  tempCanvas.height = ch * scale;

  const ctx = tempCanvas.getContext('2d');

  // draw white background for charts that have transparent parts
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

  // draw source canvas scaled
  ctx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);

  return {
    img: tempCanvas.toDataURL("image/png", 1.0),
    width: tempCanvas.width,
    height: tempCanvas.height
  };
}

function addChartToPDF(doc, chartData, x, y, maxWidth) {
  if (!chartData) return 0;
  const img = chartData.img;
  const cw = chartData.width;
  const ch = chartData.height;

  // compute proportional size
  const scale = Math.min(1, maxWidth / cw);
  const displayWidth = cw * scale;
  const displayHeight = ch * scale;

  doc.addImage(img, "PNG", x, y, displayWidth, displayHeight);

  return displayHeight;
}

// -------------------------
// generateReport - Selected Student PDF
// -------------------------
async function generateReport() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 20;

  const sel = document.getElementById('studentSelect');
  if (!sel) { alert('Student selector missing'); return; }
  const id = sel.value;
  const record = dataset.find(d => d.Student_ID === id);
  if (!record) { alert('Please select a student first'); return; }

  const btn = document.getElementById('downloadSelectedPDF');
  const oldLabel = btn ? btn.innerText : null;
  if (btn) { btn.innerText = 'Generating...'; btn.disabled = true; }

  try {
    // Header
    doc.setFillColor(11, 91, 215);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('IntelliGrade Student Report', margin, 26);

    // Student info
    y = 48;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Student Information', margin, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.text(`Student ID: ${record.Student_ID}`, margin, y); y += 6;
    doc.text(`College: ${record.College}`, margin, y); y += 6;
    doc.text(`Year Level: ${record.Year_Level || 'N/A'}`, margin, y); y += 6;
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y); y += 10;

    // Metrics block
    y = addMetricsBlock(doc, margin, y, record);
    y += 6;

    // Recommendations
    doc.setFont('helvetica','bold'); doc.setFontSize(14);
    doc.text('Recommendations', margin, y); y += 8;
    doc.setFont('helvetica','normal'); doc.setFontSize(11);
    const recs = generateRecommendationList(record);
    recs.forEach(r => { 
      doc.text(`• ${r}`, margin, y); 
      y += 6;
      if (y > pageHeight - 80) { doc.addPage(); y = 20; }
    });
    y += 8;

    // Capture charts
    const barImg = await captureChartToImage('barChart');
    const lineImg = await captureChartToImage('lineChart');
    const pieImg = await captureChartToImage('pieChart');
    const yearImg = await captureChartToImage('yearLevelChart');

    const maxWidth = pageWidth - margin * 2;

    // Helper to add chart with page-break check
    const addChartWithBreak = (chartData) => {
      if (!chartData) return;
      const needed = (chartData.height * Math.min(1, maxWidth/chartData.width)) + 10;
      if (y + needed > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
      const used = addChartToPDF(doc, chartData, margin, y, maxWidth);
      y += used + 10;
    };

    addChartWithBreak(barImg);
    addChartWithBreak(lineImg);
    addChartWithBreak(pieImg);
    addChartWithBreak(yearImg);

    // Finalize & save
    doc.save(`Student_Report_${record.Student_ID}.pdf`);
  } catch (err) {
    console.error('generateReport error', err);
    alert('Failed to generate PDF.');
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = oldLabel; }
  }
}

// -------------------------
// generateSummaryReport - Group PDF (metrics + recs + charts)
// -------------------------
async function generateSummaryReport() {
  if (!dataset || dataset.length === 0) { alert('No dataset loaded'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 20;

  try {
    // Header
    doc.setFillColor(11, 91, 215);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('IntelliGrade Summary Report', margin, 26);

    // Summary metrics
    y = 48;
    doc.setTextColor(0,0,0);
    doc.setFont('helvetica','bold'); doc.setFontSize(14);
    doc.text('Summary Metrics', margin, y); y += 10;
    doc.setFont('helvetica','normal'); doc.setFontSize(11);

    const avgAI = (dataset.reduce((a,b)=> a + number(b.AI_Dependency_Index||0), 0) / dataset.length) || 0;
    const avgMot = (dataset.reduce((a,b)=> a + number(b.Motivation_Score||0), 0) / dataset.length) || 0;
    const avgEnv = (dataset.reduce((a,b)=> a + number(b.Environment_Score||0), 0) / dataset.length) || 0;
    const avgGWA = (dataset.reduce((a,b)=> a + number(b.Prior_GWA||0), 0) / dataset.length) || 0;

    doc.text(`Total Respondents: ${dataset.length}`, margin, y); y += 8;
    doc.text(`Average AI Dependency Index: ${avgAI.toFixed(2)}`, margin, y); y += 6;
    doc.text(`Average Motivation Score: ${avgMot.toFixed(2)}`, margin, y); y += 6;
    doc.text(`Average Environment Score: ${avgEnv.toFixed(2)}`, margin, y); y += 6;
    doc.text(`Average GWA: ${avgGWA.toFixed(2)}`, margin, y); y += 10;

    // High risk count
    const highCount = dataset.filter(d => (number(d.High_Risk_Flag) === 1 || number(d.AI_Dependency_Index) > 5.5)).length;
    doc.text(`High Risk Students: ${highCount}`, margin, y); y += 10;

    // General recommendations
    doc.setFont('helvetica','bold'); doc.setFontSize(14);
    doc.text('General Recommendations', margin, y); y += 8;
    doc.setFont('helvetica','normal'); doc.setFontSize(11);

    if (avgAI > 6) { doc.text('• High AI dependency across groups detected; reinforce skill-based assessments.', margin, y); y += 6; }
    if (avgMot < 4) { doc.text('• Motivation is trending low; promote autonomy-supportive teaching practices.', margin, y); y += 6; }
    if (avgEnv > 5) { doc.text('• Strong peer reliance; ensure collaborative tasks encourage independent work.', margin, y); y += 6; }
    if (!(avgAI > 6) && !(avgMot < 4) && !(avgEnv > 5)) {
      doc.text('• Overall indicators stable; maintain current academic support strategies.', margin, y); y += 6;
    }
    y += 8;

    // Charts (capture current chart canvases)
    const barImg = await captureChartToImage('barChart');
    const lineImg = await captureChartToImage('lineChart');
    const pieImg = await captureChartToImage('pieChart');
    const yearImg = await captureChartToImage('yearLevelChart');

    doc.setFont('helvetica','bold'); doc.setFontSize(14);
    doc.text('Summary Charts', margin, y); y += 10;

    const maxWidth = pageWidth - margin * 2;
    const addChartWithBreak = (chartData, title) => {
      if (!chartData) return;
      const displayHeight = chartData.height * Math.min(1, maxWidth/chartData.width);
      if (y + displayHeight + 20 > pageHeight) { doc.addPage(); y = 20; }
      doc.setFont('helvetica','bold'); doc.setFontSize(12);
      doc.text(title, margin, y); y += 8;
      addChartToPDF(doc, chartData, margin, y, maxWidth);
      y += displayHeight + 12;
    };
    function ensurePageSpace(doc, neededHeight, margin, currentY) {
  const pageHeight = doc.internal.pageSize.height;

  // If the component won't fit, add new page
  if (currentY + neededHeight + 10 > pageHeight) {
    doc.addPage();
    return margin;
  }
  return currentY;
}

    addChartWithBreak(barImg, 'Dependency Domains');
    addChartWithBreak(lineImg, 'Dependency Score Per College');
    addChartWithBreak(pieImg, 'Risk Distribution');
    addChartWithBreak(yearImg, 'AI Dependency by Year Level');

    // Save file
    doc.save(`IntelliGrade_Summary_Report.pdf`);
  } catch (err) {
    console.error('generateSummaryReport error', err);
    alert('Failed to generate summary PDF.');
  }
}

// -------------------------
// initialize: load dataset and build UI
// -------------------------
(async function init() {
  try {
    dataset = await loadCSV();
    if (!Array.isArray(dataset)) dataset = [];
    buildDropdown(dataset);
    renderLine();
    renderPieChart();
    renderYearLevelChart();

    // preselect first student if present
    const sel = document.getElementById('studentSelect');
    if (sel && sel.options.length > 0) sel.selectedIndex = 0;

    // update cards for first record
    if (dataset.length > 0) {
      await updateCards(dataset[0]);
      renderBar(dataset[0]);
      generateRecommendations(dataset[0]);
    }
  } catch (err) {
    console.error('Failed to initialize dashboard', err);
  }
})();

// -------------------------
// UI Controls: Dashboard, Reports modal, Settings modal
// -------------------------

// Dashboard refresh (nav button assumed present with id "dashboardBtn"; safe guard if not)
const dashboardBtn = document.getElementById('dashboardBtn');
if (dashboardBtn) {
  dashboardBtn.addEventListener('click', ()=> location.reload());
}

// REPORTS modal open/close and buttons
const reportModal = document.getElementById('reportModal');
const reportsBtn = document.getElementById('reportsBtn');
const closeReportModal = document.getElementById('closeReportModal');

if (reportsBtn) {
  reportsBtn.addEventListener('click', () => {
    if (reportModal) reportModal.classList.remove('hidden');
  });
}
if (closeReportModal) {
  closeReportModal.addEventListener('click', () => {
    reportModal.classList.add('hidden');
  });
}

// Download Selected Student (PDF)
const downloadSelectedBtn = document.getElementById('downloadSelectedPDF');
if (downloadSelectedBtn) {
  downloadSelectedBtn.addEventListener('click', async () => {
    // close modal first (optional)
    if (reportModal) reportModal.classList.add('hidden');
    await generateReport();
  });
}

// Download All Students (CSV)
const downloadCSVBtn = document.getElementById('downloadCSV');
if (downloadCSVBtn) {
  downloadCSVBtn.addEventListener('click', () => {
    if (!dataset || dataset.length === 0) { alert('No dataset loaded'); return; }

    let csv = "";
    const headers = Object.keys(dataset[0]).join(",");
    csv += headers + "\n";

    dataset.forEach(row => {
      // ensure values don't include newlines/commas that break CSV - simple escaping
      const vals = Object.values(row).map(v => {
        if (v === null || v === undefined) return '';
        const s = String(v).replace(/\n/g,' ').replace(/\r/g,' ');
        return /,|"|\n/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
      });
      csv += vals.join(",") + "\n";
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'all_students.csv';
    a.click();
    URL.revokeObjectURL(url);
    if (reportModal) reportModal.classList.add('hidden');
  });
}

// Download Summary PDF
const downloadSummaryBtn = document.getElementById('downloadSummaryPDF');
if (downloadSummaryBtn) {
  downloadSummaryBtn.addEventListener('click', async () => {
    if (reportModal) reportModal.classList.add('hidden');
    await generateSummaryReport();
  });
}

// -------------------------
// SETTINGS modal controls
// -------------------------
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsModal = document.getElementById('closeSettingsModal');
const saveSettings = document.getElementById('saveSettings');

if (settingsBtn) {
  settingsBtn.addEventListener('click', () => {
    if (settingsModal) settingsModal.classList.remove('hidden');
  });
}
if (closeSettingsModal) {
  closeSettingsModal.addEventListener('click', () => {
    if (settingsModal) settingsModal.classList.add('hidden');
  });
}
if (saveSettings) {
  saveSettings.addEventListener('click', () => {
    const theme = document.getElementById('themeSelect') ? document.getElementById('themeSelect').value : null;
    const notif = document.getElementById('notifSelect') ? document.getElementById('notifSelect').value : null;
    if (theme) localStorage.setItem('userTheme', theme);
    if (notif) localStorage.setItem('notifPref', notif);
    alert('Settings saved');
    if (settingsModal) settingsModal.classList.add('hidden');
  });
}
