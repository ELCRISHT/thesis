async function loadCSV()
{
  const BACKEND_URL = "/api";
  try {
    const res = await fetch(`${BACKEND_URL}/students`);
    if (!res.ok) throw new Error('Failed to fetch data from backend');
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error loading data from backend:', error);
    
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
  }
}

let dataset = [];
let barChart, lineChart, pieChart, yearLevelChart;

function number(x){ return isNaN(parseFloat(x))?0:parseFloat(x); }

function calcAvgGrade(data){
  const vals = data.map(d=>number(d.Prior_GWA));
  return (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2);
}

function buildDropdown(data){
  const sel = document.getElementById('studentSelect');
  sel.innerHTML = '';
  data.forEach(d=>{
    const opt = document.createElement('option');
    opt.value = d.Student_ID;
    opt.text = `${d.Student_ID} — ${d.College}`;
    sel.appendChild(opt);
  });
}

async function updateCards(data){
  document.getElementById('aiIndex').innerText = data.AI_Dependency_Index || '—';

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

  document.getElementById('riskStatus').innerText = risk;
  document.getElementById('avgGrade').innerText = calcAvgGrade(dataset);
  document.getElementById('totalResp').innerText = dataset.length;
}

function renderBar(data){
  const ctx = document.getElementById('barChart').getContext('2d');
  const vals = [
    number(data.Reading_Dependency_Score),
    number(data.Writing_Dependency_Score),
    number(data.Numeracy_Dependency_Score)
  ];
  if(barChart) barChart.destroy();
  barChart = new Chart(ctx,{type:'bar',data:{
    labels:['Reading','Writing','Numeracy'],
    datasets:[{label:'Dependency Score',data:vals,backgroundColor:['#2563eb','#ef4444','#f97316']}]},
    options:{
      responsive: true,
      maintainAspectRatio: true,
      layout: {
        padding: {
          top: 10,
          right: 10,
          bottom: 10,
          left: 10
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            boxWidth: 15,
            padding: 8,
            font: {
              size: 11
            }
          }
        }
      },
      scales:{
        y:{
          beginAtZero:true,
          max:7,
          ticks: {
            stepSize: 1,
            padding: 5,
            callback: function(value) {
              return value;
            }
          }
        },
        x: {
          ticks: {
            padding: 5
          }
        }
      }
    }});
}

function renderLine(){
  const ctx = document.getElementById('lineChart').getContext('2d');

  // Mapping of college names to abbreviations
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

  // Order of colleges as specified
  const collegeOrder = ['CAS', 'CBAA', 'CCS', 'CCJE', 'COE', 'CIT', 'CHMT', 'CTE'];
  const abbrevToOrder = {};
  collegeOrder.forEach((abbrev, index) => {
    abbrevToOrder[abbrev] = index;
  });

  const collegeGroups = {};
  dataset.forEach(d => {
    const college = d.College;
    if (!collegeGroups[college]) {
      collegeGroups[college] = { count: 0, aiSum: 0 };
    }
    collegeGroups[college].count++;
    collegeGroups[college].aiSum += number(d.AI_Dependency_Index);
  });
  
  // Function to get abbreviation from college name
  const getAbbrev = (label) => {
    // Check if we have a direct mapping
    if (collegeAbbrevMap[label]) {
      return collegeAbbrevMap[label];
    }
    // Fallback: try partial matching
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes('arts') && lowerLabel.includes('sciences')) return 'CAS';
    if (lowerLabel.includes('business') || lowerLabel.includes('accountancy')) return 'CBAA';
    if (lowerLabel.includes('computer studies')) return 'CCS';
    if (lowerLabel.includes('criminal justice')) return 'CCJE';
    if (lowerLabel.includes('engineering')) return 'COE';
    // Check for IT/Information Technology - must come before other checks
    if (lowerLabel.includes('information technology') || 
        lowerLabel.includes('industrial technology') ||
        (lowerLabel.includes('technology') && !lowerLabel.includes('computer') && !lowerLabel.includes('teacher'))) {
      return 'CIT';
    }
    if (lowerLabel.includes('hospitality') || lowerLabel.includes('tourism')) return 'CHMT';
    if (lowerLabel.includes('teacher education')) return 'CTE';
    
    // Final fallback: use original abbreviation logic but preserve CIT
    const words = label.replace('College of ', '').split(' ');
    if (words.length === 1) {
      const word = words[0].toLowerCase();
      if (word === 'it' || word.includes('technology')) return 'CIT';
      return words[0].substring(0, 4);
    }
    const abbrev = words.map(w => w[0]).join('');
    // If it starts with CIT or is just IT, return CIT
    if (abbrev.startsWith('CIT') || abbrev === 'IT') return 'CIT';
    return abbrev.substring(0, 3);
  };

  // Sort colleges by the specified order
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
    // Ensure IT is always converted to CIT
    return abbrev === 'IT' ? 'CIT' : abbrev;
  });
  
  // Generate different colors for each point
  const pointColors = [
    '#ef4444', // Red
    '#3b82f6', // Blue
    '#10b981', // Green
    '#f59e0b', // Amber
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#84cc16'  // Lime
  ];
  
  if(lineChart) lineChart.destroy();
  
  lineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [       {
          label: 'Average AI Dependency Score',         data: avgAIs,
          borderColor: '#93c5fd',
          backgroundColor: '#93c5fd',
          borderWidth: 3,
          pointRadius: 5,
          pointBackgroundColor: pointColors.slice(0, avgAIs.length),
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointHoverRadius: 7,         fill: false,
          tension: 0.1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      layout: {
        padding: {
          top: 10,
          right: 15,
          bottom: 30,
          left: 15
        }
      },
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { 
          display: true,
          position: 'top',
          labels: {
            boxWidth: 15,
            padding: 8,
            font: {
              size: 11
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 10,
          callbacks: {
            title: function(context) {
              return fullLabels[context[0].dataIndex];
            },
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              label += context.parsed.y.toFixed(2);
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          display: true,
          ticks: {
            maxRotation: 45,
            minRotation: 45,
            autoSkip: false,
            font: {
              size: 9
            },
            padding: 5
          },
          grid: {
            display: false
          }
        },
        y: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          display: true,
          title: {
            display: true,
            text: 'AI Dependency Score',
            font: {
              size: 11
            },
            padding: {
              top: 0,
              bottom: 5
            }
          },
          ticks: {
            font: {
              size: 10
            },
            padding: 5
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          }
        }
      }
    }
  });
}

function renderPieChart(){
  const ctx = document.getElementById('pieChart').getContext('2d');

  let highRisk = 0;
  let lowRisk = 0;
  dataset.forEach(d => {
    const risk = (number(d.High_Risk_Flag) === 1 || number(d.AI_Dependency_Index) > 5.5) ? 'HIGH' : 'LOW';
    if (risk === 'HIGH') highRisk++;
    else lowRisk++;
  });

  if(pieChart) pieChart.destroy();
  pieChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['High Risk', 'Low Risk'],
      datasets: [{
        data: [highRisk, lowRisk],
        backgroundColor: ['#ef4444', '#10b981'],
        borderColor: ['#dc2626', '#059669'],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      layout: {
        padding: {
          top: 10,
          right: 10,
          bottom: 20,
          left: 10
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 15,
            padding: 8,
            font: {
              size: 11
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((context.parsed / total) * 100).toFixed(1);
              return `${context.label}: ${context.parsed} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

function renderYearLevelChart(){
  const ctx = document.getElementById('yearLevelChart').getContext('2d');

  // Normalize year level to standard format
  function normalizeYearLevel(year) {
    if (!year || year === '') return 'Unknown';
    const yearStr = String(year).trim();
    
    // Check for numeric values (1, 2, 3, 4)
    if (/^[1-4]$/.test(yearStr)) {
      const num = parseInt(yearStr);
      return ['1st Year', '2nd Year', '3rd Year', '4th Year'][num - 1];
    }
    
    // Check for common formats
    const lower = yearStr.toLowerCase();
    if (lower.includes('1st') || lower.includes('first') || lower === '1') return '1st Year';
    if (lower.includes('2nd') || lower.includes('second') || lower === '2') return '2nd Year';
    if (lower.includes('3rd') || lower.includes('third') || lower === '3') return '3rd Year';
    if (lower.includes('4th') || lower.includes('fourth') || lower === '4') return '4th Year';
    
    // Return as-is if it doesn't match known patterns
    return yearStr;
  }

  const yearGroups = {};
  dataset.forEach(d => {
    const year = normalizeYearLevel(d.Year_Level);
    if (!yearGroups[year]) {
      yearGroups[year] = { count: 0, aiSum: 0 };
    }
    yearGroups[year].count++;
    yearGroups[year].aiSum += number(d.AI_Dependency_Index);
  });

  // Use all available year levels, sorted intelligently
  const yearOrder = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Unknown'];
  const sortedYears = yearOrder.filter(y => yearGroups[y] && yearGroups[y].count > 0);
  
  // If no standard years found, use whatever is in the data
  if (sortedYears.length === 0) {
    const allYears = Object.keys(yearGroups).filter(y => yearGroups[y].count > 0);
    sortedYears.push(...allYears.sort());
  }
  
  // Debug: log what we found
  console.log('Year Groups:', yearGroups);
  console.log('Sorted Years:', sortedYears);
  
  // If no data, show empty chart with message
  if (sortedYears.length === 0) {
    console.warn('No year level data found in dataset');
    if(yearLevelChart) yearLevelChart.destroy();
    yearLevelChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['No Data'],
        datasets: [{
          label: 'Average AI Dependency Score',
          data: [0],
          borderColor: '#f59e0b',
          backgroundColor: '#fef3c7',
          borderWidth: 3,
          pointRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        layout: {
          padding: {
            top: 10,
            right: 10,
            bottom: 10,
            left: 10
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        scales: {
          x: { 
            title: { 
              display: true, 
              text: 'Year Level',
              padding: {
                top: 5,
                bottom: 0
              }
            },
            ticks: {
              padding: 5
            }
          },
          y: { 
            title: { 
              display: true, 
              text: 'AI Dependency Score',
              padding: {
                top: 0,
                bottom: 5
              }
            }, 
            beginAtZero: true, 
            max: 7,
            ticks: {
              padding: 5
            }
          }
        }
      }
    });
    return;
  }
  
  const avgAIs = sortedYears.map(y => yearGroups[y].aiSum / yearGroups[y].count);

  if(yearLevelChart) yearLevelChart.destroy();
  yearLevelChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: sortedYears,
      datasets: [{
        label: 'Average AI Dependency Score',
        data: avgAIs,
        borderColor: '#f59e0b',
        backgroundColor: '#fef3c7',
        borderWidth: 3,
        pointRadius: 6,
        pointBackgroundColor: '#f59e0b',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointHoverRadius: 8,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      layout: {
        padding: {
          top: 10,
          right: 10,
          bottom: 20,
          left: 15
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `Avg AI Index: ${context.parsed.y.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Year Level',
            padding: {
              top: 5,
              bottom: 0
            }
          },
          ticks: {
            padding: 5
          }
        },
        y: {
          title: {
            display: true,
            text: 'AI Dependency Score',
            padding: {
              top: 0,
              bottom: 5
            }
          },
          beginAtZero: true,
          max: 7,
          ticks: {
            padding: 5
          }
        }
      }
    }
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
  document.getElementById('recoText').innerHTML = '<ul><li>'+recs.join('</li><li>')+'</li></ul>';
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

async function generateReport() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  
  const sel = document.getElementById('studentSelect');
  const id = sel.value;
  const record = dataset.find(d => d.Student_ID === id);
  
  if (!record) {
    alert('Please select a student first');
    return;
  }
  

  const reportsBtn = document.querySelector('a[href="#"][onclick*="generateReport"]') || 
                     document.getElementById('reportsBtn');
  const originalText = reportsBtn ? reportsBtn.innerText : 'Reports';
  if (reportsBtn) reportsBtn.innerText = 'Generating...';
  
  try {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = 20;
    
    
    doc.setFillColor(11, 91, 215);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('IntelliGrade Report', margin, 25);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Laguna State Polytechnic University - San Pablo City Campus', margin, 33);
    
    yPos = 50;
    doc.setTextColor(0, 0, 0);
    
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Student Information', margin, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Student ID: ${record.Student_ID}`, margin, yPos);
    yPos += 6;
    doc.text(`College: ${record.College}`, margin, yPos);
    yPos += 6;
    doc.text(`Year Level: ${record.Year_Level || 'N/A'}`, margin, yPos);
    yPos += 6;
    doc.text(`Report Generated: ${new Date().toLocaleString()}`, margin, yPos);
    yPos += 12;
    
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Key Metrics', margin, yPos);
    yPos += 8;
    
  
    const metrics = [
      { label: 'AI Dependency Index', value: record.AI_Dependency_Index },
      { label: 'Predicted Risk', value: (number(record.High_Risk_Flag) === 1 || number(record.AI_Dependency_Index) > 5.5) ? 'HIGH' : 'LOW' },
      { label: 'Performance Level', value: record.Final_Grade },
      { label: 'Motivation Score', value: record.Motivation_Score }
    ];
    
    const boxWidth = (pageWidth - 2 * margin - 15) / 2;
    const boxHeight = 15;
    let xPos = margin;
    
    doc.setFontSize(9);
    metrics.forEach((metric, idx) => {
      if (idx % 2 === 0 && idx > 0) {
        yPos += boxHeight + 5;
        xPos = margin;
      }
      
      
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(245, 245, 245);
      doc.rect(xPos, yPos, boxWidth, boxHeight, 'FD');
      
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(metric.label, xPos + 3, yPos + 5);
      
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.text(String(metric.value), xPos + 3, yPos + 11);
      doc.setFontSize(9);
      
      xPos += boxWidth + 5;
    });
    
    yPos += boxHeight + 15;
    
    // Dependency Domains Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Dependency Domain Scores', margin, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Reading: ${record.Reading_Dependency_Score}`, margin, yPos);
    yPos += 6;
    doc.text(`Writing: ${record.Writing_Dependency_Score}`, margin, yPos);
    yPos += 6;
    doc.text(`Numeracy: ${record.Numeracy_Dependency_Score}`, margin, yPos);
    yPos += 12;
    
    
    const barChartCanvas = document.getElementById('barChart');
    if (barChartCanvas) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Dependency Domains Chart', margin, yPos);
      yPos += 8;
      
      const barChartImg = barChartCanvas.toDataURL('image/png');
      const chartWidth = pageWidth - 2 * margin;
      const chartHeight = 60;
      doc.addImage(barChartImg, 'PNG', margin, yPos, chartWidth, chartHeight);
      yPos += chartHeight + 15;
    }
    
  
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = 20;
    }
    
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Recommendations', margin, yPos);
    yPos += 8;
    
    const ai = number(record.AI_Dependency_Index);
    const mot = number(record.Motivation_Score);
    const env = number(record.Environment_Score);
    let recs = [];
    
    if (ai > 6) {
      recs.push('High AI reliance detected - recommend writing workshops and guided assignments to rebuild skill.');
    }
    if (mot < 4) {
      recs.push('Low autonomous motivation - consider autonomy-supportive tasks and formative feedback.');
    }
    if (env > 5) {
      recs.push('Strong peer reliance - promote collaborative but independent tasks; monitor group dependency.');
    }
    if (recs.length === 0) {
      recs.push('No immediate concerns; encourage balanced AI used only.');
    }
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    recs.forEach((rec, idx) => {
      const lines = doc.splitTextToSize(`${idx + 1}. ${rec}`, pageWidth - 2 * margin - 5);
      lines.forEach(line => {
        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(line, margin + 5, yPos);
        yPos += 6;
      });
      yPos += 2;
    });
    

    doc.addPage();
    yPos = 20;
    
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('College-Wide Analysis', margin, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Students Analyzed: ${dataset.length}`, margin, yPos);
    yPos += 6;
    doc.text(`Average Grade (All Students): ${calcAvgGrade(dataset)}`, margin, yPos);
    yPos += 12;
  
    const lineChartCanvas = document.getElementById('lineChart');
    if (lineChartCanvas) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Student Distribution by College', margin, yPos);
      yPos += 8;
      
      const lineChartImg = lineChartCanvas.toDataURL('image/png');
      const chartWidth = pageWidth - 2 * margin;
      const chartHeight = 100;
      doc.addImage(lineChartImg, 'PNG', margin, yPos, chartWidth, chartHeight);
      yPos += chartHeight + 10;
    }
    
  
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('IntelliGrade • All Rights Reserved • DevCo-BLV (2025)', pageWidth / 2, pageHeight - 10, { align: 'center' });
    
    
    doc.save(`IntelliGrade_Report_${record.Student_ID}_${Date.now()}.pdf`);
    
  } catch (error) {
    console.error('Error generating report:', error);
    alert('Error generating report. Please try again.');
  } finally {
    
    if (reportsBtn) reportsBtn.innerText = originalText;
  }
}


document.addEventListener('DOMContentLoaded', () => {
  const reportsBtn = document.getElementById('reportsBtn');
  
  if (reportsBtn) {
    reportsBtn.addEventListener('click', async (e) => {
      e.preventDefault();

      // --- NEW CONFIRMATION ALERT ---
      const choice = prompt(
        "Select report option:\n\n1 = Selected Student Report\n2 = All Students PDF Report\n3 = Export All Data (CSV)\n\nEnter 1, 2, or 3:"
      );

      if (choice === "1") {
        generateReport();   // existing function for one student
      }
      else if (choice === "2") {
        generateAllStudentsPDF();   // comprehensive summary report
      }
      else if (choice === "3") {
        exportAllData();   // existing function in your code
      }
      else if (choice !== null) {
        alert("Invalid choice. Operation cancelled.");
      }
    });
  }
});


let appSettings = {
  theme: 'light',
  chartAnimation: true,
  riskThreshold: 5.5,
  autoRefresh: false,
  refreshInterval: 300,
  exportFormat: 'pdf',
  includeCharts: true,
  enableNotifications: true,
  notifyHighRisk: true
};

function openSettings() {
  const modal = document.getElementById('settingsModal');
  modal.style.display = 'block';
  
  
  loadSettingsUI();
}

function closeSettings() {
  const modal = document.getElementById('settingsModal');
  modal.style.display = 'none';
}

function loadSettingsUI() {
  
  const savedSettings = localStorage.getItem('appSettings');
  if (savedSettings) {
    appSettings = JSON.parse(savedSettings);
  }
  
  
  const activeUser = localStorage.getItem('activeUser');
  document.getElementById('userName').value = activeUser || 'Admin';
  document.getElementById('themeSelect').value = appSettings.theme;
  document.getElementById('chartAnimation').checked = appSettings.chartAnimation;
  document.getElementById('riskThreshold').value = appSettings.riskThreshold;
  document.getElementById('autoRefresh').checked = appSettings.autoRefresh;
  document.getElementById('refreshInterval').value = appSettings.refreshInterval;
  document.getElementById('refreshInterval').disabled = !appSettings.autoRefresh;
  document.getElementById('exportFormat').value = appSettings.exportFormat;
  document.getElementById('includeCharts').checked = appSettings.includeCharts;
  document.getElementById('enableNotifications').checked = appSettings.enableNotifications;
  document.getElementById('notifyHighRisk').checked = appSettings.notifyHighRisk;
  
  
  applyTheme(appSettings.theme);
}

async function saveSettings() {

  appSettings.theme = document.getElementById('themeSelect').value;
  appSettings.chartAnimation = document.getElementById('chartAnimation').checked;
  appSettings.riskThreshold = parseFloat(document.getElementById('riskThreshold').value);
  appSettings.autoRefresh = document.getElementById('autoRefresh').checked;
  appSettings.refreshInterval = parseInt(document.getElementById('refreshInterval').value);
  appSettings.exportFormat = document.getElementById('exportFormat').value;
  appSettings.includeCharts = document.getElementById('includeCharts').checked;
  appSettings.enableNotifications = document.getElementById('enableNotifications').checked;
  appSettings.notifyHighRisk = document.getElementById('notifyHighRisk').checked;

  
  localStorage.setItem('appSettings', JSON.stringify(appSettings));

  
  applyTheme(appSettings.theme);


  if (barChart) {
    barChart.options.animation = appSettings.chartAnimation;
  }
  if (lineChart) {
    lineChart.options.animation = appSettings.chartAnimation;
  }


  alert('Settings saved successfully!');


  closeSettings();

  const sel = document.getElementById('studentSelect');
  if (sel.value) {
    const record = dataset.find(d => d.Student_ID === sel.value);
    if (record) {
      await updateCards(record);
      renderBar(record);
      generateRecommendations(record);
    }
  }
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }
}

function exportAllData() {
  if (!dataset || dataset.length === 0) {
    alert('No data available to export');
    return;
  }
  

  const headers = Object.keys(dataset[0]);
  const csvContent = [
    headers.join(','),
    ...dataset.map(row => headers.map(header => row[header]).join(','))
  ].join('\n');
  

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `IntelliGrade_AllData_${Date.now()}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  alert('Data exported successfully!');
}

function clearCache() {
  if (confirm('Are you sure you want to clear the cache? This will not delete your data.')) {

    const activeUser = localStorage.getItem('activeUser');
    const settings = localStorage.getItem('appSettings');
    
    localStorage.clear();
        if (activeUser) localStorage.setItem('activeUser', activeUser);
    if (settings) localStorage.setItem('appSettings', settings);
    
    alert('Cache cleared successfully!');
  }
}


document.addEventListener('DOMContentLoaded', () => {
  const autoRefreshCheckbox = document.getElementById('autoRefresh');
  const refreshIntervalInput = document.getElementById('refreshInterval');
  
  if (autoRefreshCheckbox) {
    autoRefreshCheckbox.addEventListener('change', (e) => {
      refreshIntervalInput.disabled = !e.target.checked;
    });
  }
});


const settingsBtn = document.querySelectorAll('.nav-btn')[2]; // Settings is the 3rd button
if (settingsBtn) {
  settingsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openSettings();
  });
}


window.addEventListener('click', (event) => {
  const modal = document.getElementById('settingsModal');
  if (event.target === modal) {
    closeSettings();
  }
});

async function refreshDashboard() {
  
  const sel = document.getElementById('studentSelect');

  if (dataset.length > 0) {
    
    sel.value = dataset[0].Student_ID;

    const record = dataset.find(d => d.Student_ID === sel.value);
    if (record) {
      await updateCards(record);
      renderBar(record);
      generateRecommendations(record);
    }

    
    renderLine();
    renderPieChart();
    renderYearLevelChart();

    
    if (appSettings.enableNotifications) {
      showNotification('Dashboard refreshed successfully!');
    }
  }
}


function showNotification(message) {
  
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 100);

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}


const dashboardBtn = document.querySelectorAll('.nav-btn')[0]; // Dashboard is the 1st button
if (dashboardBtn) {
  dashboardBtn.addEventListener('click', (e) => {
    e.preventDefault();
    
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    
    dashboardBtn.classList.add('active');
    
    
    refreshDashboard();
  });
}

(async ()=>{
  dataset = await loadCSV();
  buildDropdown(dataset);
  document.getElementById('totalResp').innerText = dataset.length;
  document.getElementById('avgGrade').innerText = calcAvgGrade(dataset);
  renderLine(); 
  renderPieChart(); 
  renderYearLevelChart();
  if(dataset.length>0){
    document.getElementById('studentSelect').value = dataset[0].Student_ID;
    await updateCards(dataset[0]);
    renderBar(dataset[0]);
    generateRecommendations(dataset[0]);
  }
})();

async function generateAllStudentsPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  
  if (!dataset || dataset.length === 0) {
    alert('No data available to generate report');
    return;
  }

  const reportsBtn = document.getElementById('reportsBtn');
  const originalText = reportsBtn ? reportsBtn.innerText : 'Reports';
  if (reportsBtn) reportsBtn.innerText = 'Generating...';
  
  try {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = 20;
    
    // Header
    doc.setFillColor(11, 91, 215);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('IntelliGrade Summary Report', margin, 25);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Laguna State Polytechnic University - San Pablo City Campus', margin, 33);
    
    yPos = 50;
    doc.setTextColor(0, 0, 0);
    
    // Overall Statistics
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Overall Statistics', margin, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // Calculate overall statistics
    const totalStudents = dataset.length;
    const avgGrade = calcAvgGrade(dataset);
    const avgAI = (dataset.reduce((sum, d) => sum + number(d.AI_Dependency_Index), 0) / totalStudents).toFixed(2);
    const avgReading = (dataset.reduce((sum, d) => sum + number(d.Reading_Dependency_Score), 0) / totalStudents).toFixed(2);
    const avgWriting = (dataset.reduce((sum, d) => sum + number(d.Writing_Dependency_Score), 0) / totalStudents).toFixed(2);
    const avgNumeracy = (dataset.reduce((sum, d) => sum + number(d.Numeracy_Dependency_Score), 0) / totalStudents).toFixed(2);
    
    let highRisk = 0;
    let lowRisk = 0;
    dataset.forEach(d => {
      const risk = (number(d.High_Risk_Flag) === 1 || number(d.AI_Dependency_Index) > 5.5) ? 'HIGH' : 'LOW';
      if (risk === 'HIGH') highRisk++;
      else lowRisk++;
    });
    
    const highRiskPercent = ((highRisk / totalStudents) * 100).toFixed(1);
    const lowRiskPercent = ((lowRisk / totalStudents) * 100).toFixed(1);
    
    doc.text(`Total Students Analyzed: ${totalStudents}`, margin, yPos);
    yPos += 6;
    doc.text(`Average Grade (All Students): ${avgGrade}`, margin, yPos);
    yPos += 6;
    doc.text(`Average AI Dependency Index: ${avgAI}`, margin, yPos);
    yPos += 6;
    doc.text(`Report Generated: ${new Date().toLocaleString()}`, margin, yPos);
    yPos += 12;
    
    // Risk Distribution
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Risk Distribution', margin, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`High Risk: ${highRisk} students (${highRiskPercent}%)`, margin, yPos);
    yPos += 6;
    doc.text(`Low Risk: ${lowRisk} students (${lowRiskPercent}%)`, margin, yPos);
    yPos += 12;
    
    // Average Dependency Scores
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Average Dependency Domain Scores', margin, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Reading: ${avgReading}`, margin, yPos);
    yPos += 6;
    doc.text(`Writing: ${avgWriting}`, margin, yPos);
    yPos += 6;
    doc.text(`Numeracy: ${avgNumeracy}`, margin, yPos);
    yPos += 12;
    
    // College-wise Breakdown
    const collegeGroups = {};
    dataset.forEach(d => {
      const college = d.College || 'Unknown';
      if (!collegeGroups[college]) {
        collegeGroups[college] = { count: 0, aiSum: 0, gradeSum: 0, highRisk: 0 };
      }
      collegeGroups[college].count++;
      collegeGroups[college].aiSum += number(d.AI_Dependency_Index);
      collegeGroups[college].gradeSum += number(d.Final_Grade);
      const risk = (number(d.High_Risk_Flag) === 1 || number(d.AI_Dependency_Index) > 5.5) ? 'HIGH' : 'LOW';
      if (risk === 'HIGH') collegeGroups[college].highRisk++;
    });
    
    if (yPos > pageHeight - 80) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('College-wise Breakdown', margin, yPos);
    yPos += 8;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('College', margin, yPos);
    doc.text('Students', margin + 50, yPos);
    doc.text('Avg AI Index', margin + 80, yPos);
    doc.text('Avg Grade', margin + 120, yPos);
    doc.text('High Risk', margin + 150, yPos);
    yPos += 6;
    
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
    yPos += 4;
    
    doc.setFont('helvetica', 'normal');
    const sortedColleges = Object.keys(collegeGroups).sort();
    sortedColleges.forEach(college => {
      if (yPos > pageHeight - 20) {
        doc.addPage();
        yPos = 20;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('College', margin, yPos);
        doc.text('Students', margin + 50, yPos);
        doc.text('Avg AI Index', margin + 80, yPos);
        doc.text('Avg Grade', margin + 120, yPos);
        doc.text('High Risk', margin + 150, yPos);
        yPos += 6;
        doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
        yPos += 4;
        doc.setFont('helvetica', 'normal');
      }
      
      const stats = collegeGroups[college];
      const avgAI = (stats.aiSum / stats.count).toFixed(2);
      const avgGrade = (stats.gradeSum / stats.count).toFixed(2);
      const collegeName = college.length > 20 ? college.substring(0, 17) + '...' : college;
      
      doc.text(collegeName, margin, yPos);
      doc.text(String(stats.count), margin + 50, yPos);
      doc.text(avgAI, margin + 80, yPos);
      doc.text(avgGrade, margin + 120, yPos);
      doc.text(`${stats.highRisk} (${((stats.highRisk / stats.count) * 100).toFixed(1)}%)`, margin + 150, yPos);
      yPos += 6;
    });
    
    yPos += 8;
    
    // Year Level Breakdown
    const yearGroups = {};
    dataset.forEach(d => {
      const year = d.Year_Level || 'Unknown';
      if (!yearGroups[year]) {
        yearGroups[year] = { count: 0, aiSum: 0, gradeSum: 0, highRisk: 0 };
      }
      yearGroups[year].count++;
      yearGroups[year].aiSum += number(d.AI_Dependency_Index);
      yearGroups[year].gradeSum += number(d.Final_Grade);
      const risk = (number(d.High_Risk_Flag) === 1 || number(d.AI_Dependency_Index) > 5.5) ? 'HIGH' : 'LOW';
      if (risk === 'HIGH') yearGroups[year].highRisk++;
    });
    
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Year Level Breakdown', margin, yPos);
    yPos += 8;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Year Level', margin, yPos);
    doc.text('Students', margin + 50, yPos);
    doc.text('Avg AI Index', margin + 80, yPos);
    doc.text('Avg Grade', margin + 120, yPos);
    doc.text('High Risk', margin + 150, yPos);
    yPos += 6;
    
    doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
    yPos += 4;
    
    doc.setFont('helvetica', 'normal');
    const sortedYears = Object.keys(yearGroups).sort();
    sortedYears.forEach(year => {
      if (yPos > pageHeight - 20) {
        doc.addPage();
        yPos = 20;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Year Level', margin, yPos);
        doc.text('Students', margin + 50, yPos);
        doc.text('Avg AI Index', margin + 80, yPos);
        doc.text('Avg Grade', margin + 120, yPos);
        doc.text('High Risk', margin + 150, yPos);
        yPos += 6;
        doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
        yPos += 4;
        doc.setFont('helvetica', 'normal');
      }
      
      const stats = yearGroups[year];
      const avgAI = (stats.aiSum / stats.count).toFixed(2);
      const avgGrade = (stats.gradeSum / stats.count).toFixed(2);
      
      doc.text(year, margin, yPos);
      doc.text(String(stats.count), margin + 50, yPos);
      doc.text(avgAI, margin + 80, yPos);
      doc.text(avgGrade, margin + 120, yPos);
      doc.text(`${stats.highRisk} (${((stats.highRisk / stats.count) * 100).toFixed(1)}%)`, margin + 150, yPos);
      yPos += 6;
    });
    
    yPos += 10;
    
    // Add Charts
    if (yPos > pageHeight - 100) {
      doc.addPage();
      yPos = 20;
    }
    
    // Line Chart (College Distribution)
    const lineChartCanvas = document.getElementById('lineChart');
    if (lineChartCanvas) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Student Distribution by College', margin, yPos);
      yPos += 8;
      
      const lineChartImg = lineChartCanvas.toDataURL('image/png');
      const chartWidth = pageWidth - 2 * margin;
      const chartHeight = 80;
      doc.addImage(lineChartImg, 'PNG', margin, yPos, chartWidth, chartHeight);
      yPos += chartHeight + 10;
    }
    
    if (yPos > pageHeight - 100) {
      doc.addPage();
      yPos = 20;
    }
    
    // Pie Chart (Risk Distribution)
    const pieChartCanvas = document.getElementById('pieChart');
    if (pieChartCanvas) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Risk Distribution', margin, yPos);
      yPos += 8;
      
      const pieChartImg = pieChartCanvas.toDataURL('image/png');
      const chartWidth = pageWidth - 2 * margin;
      const chartHeight = 80;
      doc.addImage(pieChartImg, 'PNG', margin, yPos, chartWidth, chartHeight);
      yPos += chartHeight + 10;
    }
    
    if (yPos > pageHeight - 100) {
      doc.addPage();
      yPos = 20;
    }
    
    // Year Level Chart
    const yearLevelCanvas = document.getElementById('yearLevelChart');
    if (yearLevelCanvas) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('AI Dependency by Year Level', margin, yPos);
      yPos += 8;
      
      const yearLevelImg = yearLevelCanvas.toDataURL('image/png');
      const chartWidth = pageWidth - 2 * margin;
      const chartHeight = 80;
      doc.addImage(yearLevelImg, 'PNG', margin, yPos, chartWidth, chartHeight);
      yPos += chartHeight + 10;
    }
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('IntelliGrade • All Rights Reserved • DevCo-BLV (2025)', pageWidth / 2, pageHeight + 0.5, { align: 'center' });
    
    // Save PDF
    doc.save(`IntelliGrade_Summary_Report_${Date.now()}.pdf`);
    
  } catch (error) {
    console.error('Error generating summary report:', error);
    alert('Error generating summary report. Please try again.');
  } finally {
    if (reportsBtn) reportsBtn.innerText = originalText;
  }
}
