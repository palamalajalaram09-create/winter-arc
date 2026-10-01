/* ==========================================================================
   WINTER ARC — PRODUCTIVITY & PROGRESS TRACKER APPLICATION LOGIC
   ========================================================================== */

(function () {
  'use strict';

  // Default Habits matching the reference sheet
  const DEFAULT_HABITS = [
    { id: 'h1', name: 'Workout/Exercise', goal: 31 },
    { id: 'h2', name: '10,000 Steps', goal: 31 },
    { id: 'h3', name: 'Drink 3L Water', goal: 31 },
    { id: 'h4', name: 'No Junk Food', goal: 31 },
    { id: 'h5', name: 'Healthy Meals', goal: 31 },
    { id: 'h6', name: 'Read/Learn', goal: 31 },
    { id: 'h7', name: 'Meditate/Journal', goal: 31 },
    { id: 'h8', name: 'Wake Up Early', goal: 31 },
    { id: 'h9', name: 'Sleep On Time', goal: 31 },
    { id: 'h10', name: 'Be Productive', goal: 31 },
    { id: 'h11', name: 'Custom Habit 1', goal: 31 },
    { id: 'h12', name: 'Custom Habit 2', goal: 31 }
  ];

  // Sleep options matching the reference sheet
  const SLEEP_CATEGORIES = [
    '< 5 Hrs',
    '5 - 6 Hrs',
    '6 - 7 Hrs',
    '7 - 8 Hrs',
    '8 - 9 Hrs',
    '> 9 Hrs'
  ];

  const SLEEP_MIDPOINTS = {
    '< 5 Hrs': 4.5,
    '5 - 6 Hrs': 5.5,
    '6 - 7 Hrs': 6.5,
    '7 - 8 Hrs': 7.5,
    '8 - 9 Hrs': 8.5,
    '> 9 Hrs': 9.5
  };

  const STORAGE_KEY = 'winter_arc_data_v1';

  // Application State
  let state = {
    user: {
      name: 'Achiever',
      theme: 'light'
    },
    currentMonth: getInitialMonthString(),
    months: {},
    goals: [
      { id: 'g1', name: 'DSA Problems', category: 'Study Goal', target: 100, current: 64, deadline: '2026-10-31' },
      { id: 'g2', name: 'Workout Sessions', category: 'Fitness Goal', target: 25, current: 18, deadline: '2026-10-31' }
    ]
  };

  let trendChartInstance = null;
  let sheetSleepChartInstance = null;
  let progressSleepTrendChartInstance = null;
  let progressSleepCategoryChartInstance = null;

  // Init App on DOM Load
  document.addEventListener('DOMContentLoaded', () => {
    loadStateFromStorage();
    initTheme();
    initMonthSelector();
    initTabNavigation();
    initEventListeners();
    renderCurrentMonth();
  });

  // Get current system month YYYY-MM
  function getInitialMonthString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  function getDaysInMonth(monthStr) {
    const [year, month] = monthStr.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  }

  function getMonthName(monthStr) {
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  // State Persistence
  function loadStateFromStorage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        state = { ...state, ...parsed };
      } catch (e) {
        console.error('Failed to parse saved state:', e);
      }
    }
    ensureMonthExists(state.currentMonth);
  }

  function saveStateToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (window.lucide) window.lucide.createIcons();
  }

  function ensureMonthExists(monthStr) {
    if (!state.months[monthStr]) {
      state.months[monthStr] = {
        habits: JSON.parse(JSON.stringify(DEFAULT_HABITS)).map(h => ({
          ...h,
          completions: {} // { 1: true, 2: false }
        })),
        sleep: {}, // { 1: "7 - 8 Hrs", 2: "6 - 7 Hrs" }
        sleepExact: {}, // { 1: 7.5, 2: 6.5 }
        weekly: {
          1: { weight: '', mood: 8, focus: '' },
          2: { weight: '', mood: 7, focus: '' },
          3: { weight: '', mood: 8, focus: '' },
          4: { weight: '', mood: 9, focus: '' }
        },
        reflection: {
          wins: '',
          improve: '',
          nextGoals: '',
          notes: ''
        },
        dailyNotes: {},
        dailyWeight: {},
        dailyMood: {}
      };
    } else if (!state.months[monthStr].sleepExact) {
      state.months[monthStr].sleepExact = {};
    }
  }

  function getSleepHours(day) {
    const mData = getActiveMonthData();
    if (mData.sleepExact && mData.sleepExact[day] !== undefined && mData.sleepExact[day] !== null) {
      return Number(mData.sleepExact[day]);
    }
    const cat = mData.sleep ? mData.sleep[day] : null;
    if (cat && SLEEP_MIDPOINTS[cat] !== undefined) {
      return SLEEP_MIDPOINTS[cat];
    }
    return null;
  }

  function getActiveMonthData() {
    ensureMonthExists(state.currentMonth);
    return state.months[state.currentMonth];
  }

  // Theme Logic
  function initTheme() {
    document.documentElement.setAttribute('data-theme', state.user.theme || 'light');
    updateThemeIcon();
  }

  function toggleTheme() {
    state.user.theme = state.user.theme === 'light' ? 'dark' : 'light';
    initTheme();
    saveStateToStorage();
    renderSheetSleepChart();
    renderProgressSleepCharts();
    if (trendChartInstance) renderDailyTrendChart(getActiveMonthData(), getDaysInMonth(state.currentMonth));
  }

  function updateThemeIcon() {
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
      btn.innerHTML = state.user.theme === 'dark' ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
      if (window.lucide) window.lucide.createIcons();
    }
  }

  // Month Selector & Controls
  function initMonthSelector() {
    const select = document.getElementById('monthSelect');
    if (!select) return;

    select.innerHTML = '';
    const now = new Date();
    const currY = now.getFullYear();

    // Populate past 6 months and next 6 months
    for (let i = -6; i <= 6; i++) {
      const d = new Date(currY, now.getMonth() + i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      if (val === state.currentMonth) opt.selected = true;
      select.appendChild(opt);
    }

    select.addEventListener('change', (e) => {
      state.currentMonth = e.target.value;
      saveStateToStorage();
      renderCurrentMonth();
    });
  }

  // Navigation Tabs
  function initTabNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        document.querySelectorAll('.tab-view').forEach(view => {
          view.classList.remove('active');
        });

        const targetView = document.getElementById(`${targetTab}View`);
        if (targetView) targetView.classList.add('active');

        if (targetTab === 'progress') renderProgressDashboard();
        if (targetTab === 'calendar') renderCalendarView();
        if (targetTab === 'goals') renderGoalsView();
      });
    });
  }

  // Event Listeners Initialization
  function initEventListeners() {
    // Theme Toggle
    document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);

    // User Name Input
    const nameInput = document.getElementById('userNameInput');
    if (nameInput) {
      nameInput.value = state.user.name || 'Achiever';
      nameInput.addEventListener('input', (e) => {
        state.user.name = e.target.value;
        saveStateToStorage();
      });
    }

    // Month Navigation
    document.getElementById('prevMonthBtn')?.addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonthBtn')?.addEventListener('click', () => changeMonth(1));
    document.getElementById('resetMonthBtn')?.addEventListener('click', confirmResetMonth);

    // Today Button
    document.getElementById('todayBtn')?.addEventListener('click', openTodayModal);

    // Reflection Auto & Manual Save
    const reflectionFields = ['winsInput', 'improveInput', 'goalsNextInput', 'mindsetInput'];
    reflectionFields.forEach(id => {
      document.getElementById(id)?.addEventListener('input', debounce(saveReflectionData, 500));
    });
    document.getElementById('saveReflectionBtn')?.addEventListener('click', () => {
      saveReflectionData();
      showToast('Reflection Saved Successfully!');
    });

    // Add Habit Button
    document.getElementById('addHabitBtn')?.addEventListener('click', openAddHabitModal);
    document.getElementById('saveHabitBtn')?.addEventListener('click', saveHabitFromModal);
    document.getElementById('closeHabitModal')?.addEventListener('click', closeHabitModal);

    // Quick Sleep Log & View Mode Buttons
    document.getElementById('quickSleepSaveBtn')?.addEventListener('click', saveQuickSleep);
    document.getElementById('sleepGridModeBtn')?.addEventListener('click', () => setSleepViewMode('grid'));
    document.getElementById('sleepGraphModeBtn')?.addEventListener('click', () => setSleepViewMode('graph'));
    document.getElementById('sleepBothModeBtn')?.addEventListener('click', () => setSleepViewMode('both'));

    // Goals Modals
    document.getElementById('addGoalBtn')?.addEventListener('click', openAddGoalModal);
    document.getElementById('saveGoalBtn')?.addEventListener('click', saveGoalFromModal);
    document.getElementById('closeGoalModal')?.addEventListener('click', closeGoalModal);

    // Daily Modal Close & Save
    document.getElementById('closeDailyModal')?.addEventListener('click', closeDailyModal);
    document.getElementById('saveDailyModalBtn')?.addEventListener('click', saveDailyModal);

    // Export / Import
    document.getElementById('exportBtn')?.addEventListener('click', exportDataJSON);
    document.getElementById('importBtn')?.addEventListener('click', () => document.getElementById('importFileInput').click());
    document.getElementById('importFileInput')?.addEventListener('change', importDataJSON);

    // Monthly Report
    document.getElementById('reportBtn')?.addEventListener('click', openReportModal);
    document.getElementById('closeReportModal')?.addEventListener('click', closeReportModal);
    document.getElementById('printReportBtn')?.addEventListener('click', () => window.print());
  }

  function changeMonth(delta) {
    const [year, month] = state.currentMonth.split('-').map(Number);
    const d = new Date(year, month - 1 + delta, 1);
    state.currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const select = document.getElementById('monthSelect');
    if (select) select.value = state.currentMonth;

    saveStateToStorage();
    renderCurrentMonth();
  }

  function confirmResetMonth() {
    if (confirm(`Are you sure you want to reset all tracking entries for ${getMonthName(state.currentMonth)}?`)) {
      delete state.months[state.currentMonth];
      ensureMonthExists(state.currentMonth);
      saveStateToStorage();
      renderCurrentMonth();
      showToast('Month data reset.');
    }
  }

  // Main Renderer for Active Month Sheet View
  function renderCurrentMonth() {
    ensureMonthExists(state.currentMonth);
    renderHabitTable();
    renderSleepTable();
    updateSleepViewVisibility();
    renderSheetSleepChart();
    renderWeeklyCheckin();
    renderReflectionData();
    renderQuickSleepSelector();
    updateStatsSummary();
    if (window.lucide) window.lucide.createIcons();
  }

  // ==========================================================================
  // 1. HABIT TABLE RENDERER
  // ==========================================================================
  function renderHabitTable() {
    const days = getDaysInMonth(state.currentMonth);
    const mData = getActiveMonthData();

    const headerRow = document.getElementById('habitTableHeaderRow');
    const tableBody = document.getElementById('habitTableBody');
    if (!headerRow || !tableBody) return;

    // Header cells
    headerRow.innerHTML = `
      <th class="col-habit-name">Habit / Day</th>
      ${Array.from({ length: days }, (_, i) => {
        const day = i + 1;
        const isToday = isDayToday(day);
        return `<th class="col-day-header ${isToday ? 'today-header' : ''}" data-day="${day}" title="Click to view details for Day ${day}">${day}</th>`;
      }).join('')}
      <th class="col-summary">Completed</th>
      <th class="col-summary">Rate</th>
    `;

    // Add click event to day headers
    headerRow.querySelectorAll('.col-day-header').forEach(th => {
      th.addEventListener('click', () => {
        openDailyModal(parseInt(th.dataset.day, 10));
      });
    });

    // Body rows
    tableBody.innerHTML = '';
    mData.habits.forEach((habit, hIdx) => {
      const tr = document.createElement('tr');

      let completedCount = 0;
      let dayCellsHtml = '';

      for (let day = 1; day <= days; day++) {
        const isDone = habit.completions && habit.completions[day];
        if (isDone) completedCount++;
        dayCellsHtml += `
          <td class="habit-cell ${isDone ? 'completed' : ''}" 
              data-habit-idx="${hIdx}" 
              data-day="${day}"
              title="${habit.name} - Day ${day}"></td>
        `;
      }

      const pct = Math.round((completedCount / days) * 100);

      tr.innerHTML = `
        <td class="col-habit-name">
          <div class="habit-name-wrapper">
            <span class="habit-name-text" title="${habit.name}">${habit.name}</span>
            <div class="habit-actions">
              <button class="btn-icon-xs move-up-btn" data-idx="${hIdx}" title="Move Up"><i data-lucide="arrow-up"></i></button>
              <button class="btn-icon-xs move-down-btn" data-idx="${hIdx}" title="Move Down"><i data-lucide="arrow-down"></i></button>
              <button class="btn-icon-xs edit-habit-btn" data-idx="${hIdx}" title="Rename"><i data-lucide="edit-2"></i></button>
              <button class="btn-icon-xs delete-habit-btn" data-idx="${hIdx}" title="Delete"><i data-lucide="trash-2"></i></button>
            </div>
          </div>
        </td>
        ${dayCellsHtml}
        <td class="col-summary">${completedCount} / ${days}</td>
        <td class="col-summary">${pct}%</td>
      `;

      tableBody.appendChild(tr);
    });

    // Cell Click Listeners
    tableBody.querySelectorAll('.habit-cell').forEach(cell => {
      cell.addEventListener('click', (e) => {
        const hIdx = parseInt(cell.dataset.habitIdx, 10);
        const day = parseInt(cell.dataset.day, 10);
        toggleHabitCompletion(hIdx, day, cell);
      });
    });

    // Action listeners (edit, delete, reorder)
    tableBody.querySelectorAll('.edit-habit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditHabitModal(parseInt(btn.dataset.idx, 10));
      });
    });

    tableBody.querySelectorAll('.delete-habit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteHabit(parseInt(btn.dataset.idx, 10));
      });
    });

    tableBody.querySelectorAll('.move-up-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        moveHabit(parseInt(btn.dataset.idx, 10), -1);
      });
    });

    tableBody.querySelectorAll('.move-down-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        moveHabit(parseInt(btn.dataset.idx, 10), 1);
      });
    });
  }

  function toggleHabitCompletion(habitIndex, day, cellElement) {
    const mData = getActiveMonthData();
    const habit = mData.habits[habitIndex];
    if (!habit) return;

    if (!habit.completions) habit.completions = {};
    const isNowDone = !habit.completions[day];
    habit.completions[day] = isNowDone;

    // Cell Micro-Animation
    if (isNowDone) {
      cellElement.classList.add('completed');
      if (window.gsap) {
        gsap.fromTo(cellElement, { scale: 0.8 }, { scale: 1, duration: 0.2, ease: 'back.out(2)' });
      }
    } else {
      cellElement.classList.remove('completed');
    }

    // Check if day is 100% complete across all habits -> Confetti!
    if (isNowDone && isDay100PercentComplete(day)) {
      triggerConfetti();
    }

    saveStateToStorage();
    renderHabitTable();
    updateStatsSummary();
  }

  function isDay100PercentComplete(day) {
    const mData = getActiveMonthData();
    if (!mData.habits.length) return false;
    return mData.habits.every(h => h.completions && h.completions[day]);
  }

  function triggerConfetti() {
    if (window.confetti) {
      window.confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }

  function moveHabit(idx, delta) {
    const mData = getActiveMonthData();
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= mData.habits.length) return;

    const temp = mData.habits[idx];
    mData.habits[idx] = mData.habits[targetIdx];
    mData.habits[targetIdx] = temp;

    saveStateToStorage();
    renderHabitTable();
  }

  function deleteHabit(idx) {
    const mData = getActiveMonthData();
    const habit = mData.habits[idx];
    if (confirm(`Delete habit "${habit.name}"?`)) {
      mData.habits.splice(idx, 1);
      saveStateToStorage();
      renderHabitTable();
      updateStatsSummary();
    }
  }

  // ==========================================================================
  // 2. SLEEP TRACKER RENDERER
  // ==========================================================================
  function renderSleepTable() {
    const days = getDaysInMonth(state.currentMonth);
    const mData = getActiveMonthData();

    const headerRow = document.getElementById('sleepTableHeaderRow');
    const tableBody = document.getElementById('sleepTableBody');
    if (!headerRow || !tableBody) return;

    // Header cells
    headerRow.innerHTML = `
      <th class="col-habit-name">Hours Slept / Day</th>
      ${Array.from({ length: days }, (_, i) => {
        const day = i + 1;
        const isToday = isDayToday(day);
        return `<th class="col-day-header ${isToday ? 'today-header' : ''}">${day}</th>`;
      }).join('')}
    `;

    // Sleep Rows
    tableBody.innerHTML = '';
    SLEEP_CATEGORIES.forEach(cat => {
      const tr = document.createElement('tr');

      let dayCellsHtml = '';
      for (let day = 1; day <= days; day++) {
        const isSelected = mData.sleep[day] === cat;
        dayCellsHtml += `
          <td class="sleep-cell ${isSelected ? 'selected' : ''}"
              data-cat="${cat}"
              data-day="${day}"
              title="Day ${day}: ${cat}"></td>
        `;
      }

      tr.innerHTML = `
        <td class="col-habit-name">${cat}</td>
        ${dayCellsHtml}
      `;

      tableBody.appendChild(tr);
    });

    // Sleep Cell Click
    tableBody.querySelectorAll('.sleep-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const cat = cell.dataset.cat;
        const day = parseInt(cell.dataset.day, 10);
        selectSleepCategory(day, cat);
      });
    });

    updateSleepStats();
  }

  function setSleepViewMode(mode) {
    state.sleepViewMode = mode;
    updateSleepViewVisibility();
    saveStateToStorage();
  }

  function updateSleepViewVisibility() {
    const mode = state.sleepViewMode || 'grid';
    const gridContainer = document.getElementById('sleepGridTableContainer');
    const graphContainer = document.getElementById('sheetSleepGraphContainer');

    const btnGrid = document.getElementById('sleepGridModeBtn');
    const btnGraph = document.getElementById('sleepGraphModeBtn');
    const btnBoth = document.getElementById('sleepBothModeBtn');

    [btnGrid, btnGraph, btnBoth].forEach(b => b?.classList.remove('active'));

    if (mode === 'grid') {
      if (gridContainer) gridContainer.style.display = 'block';
      if (graphContainer) graphContainer.style.display = 'none';
      if (btnGrid) btnGrid.classList.add('active');
    } else if (mode === 'graph') {
      if (gridContainer) gridContainer.style.display = 'none';
      if (graphContainer) graphContainer.style.display = 'block';
      if (btnGraph) btnGraph.classList.add('active');
      renderSheetSleepChart();
    } else if (mode === 'both') {
      if (gridContainer) gridContainer.style.display = 'block';
      if (graphContainer) graphContainer.style.display = 'block';
      if (btnBoth) btnBoth.classList.add('active');
      renderSheetSleepChart();
    }
  }

  function selectSleepCategory(day, category) {
    const mData = getActiveMonthData();
    if (!mData.sleep) mData.sleep = {};
    if (!mData.sleepExact) mData.sleepExact = {};

    if (mData.sleep[day] === category) {
      delete mData.sleep[day];
      delete mData.sleepExact[day];
    } else {
      mData.sleep[day] = category;
      mData.sleepExact[day] = SLEEP_MIDPOINTS[category];
    }
    saveStateToStorage();
    renderSleepTable();
    renderSheetSleepChart();
    renderProgressSleepCharts();
  }

  function renderQuickSleepSelector() {
    const select = document.getElementById('quickSleepDay');
    if (!select) return;
    const days = getDaysInMonth(state.currentMonth);
    const today = new Date().getDate();

    select.innerHTML = '';
    for (let d = 1; d <= days; d++) {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = `Day ${d}`;
      if (d === today) opt.selected = true;
      select.appendChild(opt);
    }
  }

  function saveQuickSleep() {
    const daySelect = document.getElementById('quickSleepDay');
    const input = document.getElementById('quickSleepInput');
    if (!daySelect || !input) return;

    const day = parseInt(daySelect.value, 10);
    const valStr = input.value.trim();
    if (!valStr) return;

    // Parse string into hours number e.g. "7.5" or "7h 30m" -> 7.5
    let hours = parseFloat(valStr);
    if (valStr.includes('h')) {
      const parts = valStr.split('h');
      const h = parseFloat(parts[0]) || 0;
      const m = parseFloat(parts[1]) || 0;
      hours = h + m / 60;
    }

    if (isNaN(hours) || hours < 0) return;

    let category = '';
    if (hours < 5) category = '< 5 Hrs';
    else if (hours < 6) category = '5 - 6 Hrs';
    else if (hours < 7) category = '6 - 7 Hrs';
    else if (hours < 8) category = '7 - 8 Hrs';
    else if (hours < 9) category = '8 - 9 Hrs';
    else category = '> 9 Hrs';

    const mData = getActiveMonthData();
    if (!mData.sleep) mData.sleep = {};
    if (!mData.sleepExact) mData.sleepExact = {};

    mData.sleep[day] = category;
    mData.sleepExact[day] = Math.round(hours * 10) / 10;

    saveStateToStorage();
    renderSleepTable();
    renderSheetSleepChart();
    renderProgressSleepCharts();
    input.value = '';
    showToast(`Logged ${Math.round(hours * 10) / 10}h (${category}) for Day ${day}`);
  }

  function updateSleepStats() {
    const days = getDaysInMonth(state.currentMonth);
    let totalHrs = 0;
    let loggedDays = 0;
    let bestHrs = -1;
    let bestDay = '-';
    let lowestHrs = 999;
    let lowestDay = '-';
    let sevenPlusCount = 0;

    for (let d = 1; d <= days; d++) {
      const val = getSleepHours(d);
      if (val !== null) {
        totalHrs += val;
        loggedDays++;
        if (val > bestHrs) { bestHrs = val; bestDay = `Day ${d}`; }
        if (val < lowestHrs) { lowestHrs = val; lowestDay = `Day ${d}`; }
        if (val >= 7.0) { sevenPlusCount++; }
      }
    }

    const avg = loggedDays > 0 ? (totalHrs / loggedDays).toFixed(1) : '0.0';
    const consistency = loggedDays > 0 ? Math.round((sevenPlusCount / loggedDays) * 100) : 0;

    document.getElementById('statAvgSleep').textContent = `${avg}h`;
    document.getElementById('statBestSleep').textContent = bestDay;
    document.getElementById('statLowestSleep').textContent = loggedDays > 0 ? lowestDay : 'Day -';
    document.getElementById('statSevenPlusDays').textContent = `${sevenPlusCount} Days`;
    document.getElementById('statSleepConsistency').textContent = `${consistency}%`;
  }

  // ==========================================================================
  // SHEET SLEEP CHART RENDERER
  // ==========================================================================
  function renderSheetSleepChart() {
    const canvas = document.getElementById('sheetSleepChart');
    if (!canvas || !window.Chart) return;
    const graphContainer = document.getElementById('sheetSleepGraphContainer');
    if (graphContainer && graphContainer.style.display === 'none') return;

    const days = getDaysInMonth(state.currentMonth);
    const labels = Array.from({ length: days }, (_, i) => `${i + 1}`);

    const sleepHours = [];
    const barColors = [];
    const targetLine = [];

    for (let d = 1; d <= days; d++) {
      const hrs = getSleepHours(d);
      sleepHours.push(hrs !== null ? hrs : 0);
      targetLine.push(8.0);

      if (hrs === null) {
        barColors.push('rgba(156, 163, 175, 0.2)');
      } else if (hrs < 6.0) {
        barColors.push('#EF4444');
      } else if (hrs < 7.5) {
        barColors.push('#F59E0B');
      } else if (hrs <= 9.0) {
        barColors.push('#10B981');
      } else {
        barColors.push('#8B5CF6');
      }
    }

    if (sheetSleepChartInstance) sheetSleepChartInstance.destroy();

    const isDark = state.user.theme === 'dark';
    const textColor = isDark ? '#F3F4F6' : '#111827';
    const gridColor = isDark ? '#2E333D' : '#E5E7EB';

    sheetSleepChartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Sleep Hours',
            data: sleepHours,
            backgroundColor: barColors,
            borderRadius: 6,
            borderSkipped: false,
            barPercentage: 0.7,
            order: 2
          },
          {
            label: '8.0h Target Goal',
            data: targetLine,
            type: 'line',
            borderColor: '#6366F1',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: { display: true, text: 'Day of Month', color: textColor, font: { weight: 'bold' } },
            ticks: { color: textColor },
            grid: { color: gridColor }
          },
          y: {
            beginAtZero: true,
            max: 12,
            title: { display: true, text: 'Hours Slept', color: textColor, font: { weight: 'bold' } },
            ticks: { color: textColor, stepSize: 2 },
            grid: { color: gridColor }
          }
        },
        plugins: {
          legend: { labels: { color: textColor } },
          tooltip: {
            callbacks: {
              label: function (context) {
                if (context.dataset.label === '8.0h Target Goal') return ' Target Goal: 8.0 Hours';
                const val = context.raw;
                if (val === 0) return ` Day ${context.label}: Not logged yet`;
                let status = 'Optimal';
                if (val < 6) status = 'Sleep Deficit';
                else if (val < 7.5) status = 'Moderate';
                else if (val > 9) status = 'High / Oversleep';
                return ` Day ${context.label}: ${val} hrs (${status})`;
              }
            }
          }
        }
      }
    });
  }

  // ==========================================================================
  // 3. WEEKLY CHECK-IN RENDERER
  // ==========================================================================
  function renderWeeklyCheckin() {
    const grid = document.getElementById('weeklyCardsGrid');
    if (!grid) return;
    const mData = getActiveMonthData();

    const weeks = [
      { num: 1, range: '1 - 7', start: 1, end: 7 },
      { num: 2, range: '8 - 14', start: 8, end: 14 },
      { num: 3, range: '15 - 21', start: 15, end: 21 },
      { num: 4, range: '22 - 28+', start: 22, end: getDaysInMonth(state.currentMonth) }
    ];

    grid.innerHTML = '';
    weeks.forEach(w => {
      const wData = mData.weekly[w.num] || { weight: '', mood: 8, focus: '' };

      // Calculate weekly habit completion %
      let weekTotalPossible = 0;
      let weekCompleted = 0;
      let workoutDays = 0;
      let stepDays = 0;
      let sleepSum = 0;
      let sleepCount = 0;

      for (let day = w.start; day <= w.end; day++) {
        mData.habits.forEach(h => {
          weekTotalPossible++;
          if (h.completions && h.completions[day]) {
            weekCompleted++;
            if (h.name.toLowerCase().includes('workout')) workoutDays++;
            if (h.name.toLowerCase().includes('step')) stepDays++;
          }
        });

        const sCat = mData.sleep[day];
        if (sCat && SLEEP_MIDPOINTS[sCat]) {
          sleepSum += SLEEP_MIDPOINTS[sCat];
          sleepCount++;
        }
      }

      const weekPct = weekTotalPossible > 0 ? Math.round((weekCompleted / weekTotalPossible) * 100) : 0;
      const weekAvgSleep = sleepCount > 0 ? (sleepSum / sleepCount).toFixed(1) : '0.0';

      const card = document.createElement('div');
      card.className = 'weekly-card';
      card.innerHTML = `
        <div class="weekly-card-header">Week ${w.num} (${w.range})</div>
        
        <div class="weekly-field">
          <label>Weight:</label>
          <input type="text" class="weekly-weight-input" data-week="${w.num}" value="${wData.weight || ''}" placeholder="kg">
        </div>

        <div class="weekly-field" style="flex-direction:column; align-items:flex-start;">
          <label>Mood (1-10):</label>
          <div class="mood-selector" data-week="${w.num}">
            ${Array.from({ length: 10 }, (_, i) => {
              const val = i + 1;
              return `<button class="mood-btn ${wData.mood === val ? 'selected' : ''}" data-val="${val}">${val}</button>`;
            }).join('')}
          </div>
        </div>

        <div class="lined-box">
          <label>Focus for next week:</label>
          <textarea class="lined-textarea weekly-focus-input" data-week="${w.num}" rows="3" placeholder="Key priorities...">${wData.focus || ''}</textarea>
        </div>

        <div class="weekly-stats-mini">
          <div>Habits Done: <strong>${weekPct}%</strong> | Avg Sleep: <strong>${weekAvgSleep}h</strong></div>
          <div>Workouts: <strong>${workoutDays}d</strong> | Steps Goal: <strong>${stepDays}d</strong></div>
          <div class="mini-progress-bar">
            <div class="mini-progress-fill" style="width: ${weekPct}%"></div>
          </div>
        </div>
      `;

      grid.appendChild(card);
    });

    // Inputs handlers
    grid.querySelectorAll('.weekly-weight-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const wNum = parseInt(e.target.dataset.week, 10);
        mData.weekly[wNum].weight = e.target.value;
        saveStateToStorage();
      });
    });

    grid.querySelectorAll('.weekly-focus-input').forEach(inp => {
      inp.addEventListener('input', debounce((e) => {
        const wNum = parseInt(e.target.dataset.week, 10);
        mData.weekly[wNum].focus = e.target.value;
        saveStateToStorage();
      }, 400));
    });

    grid.querySelectorAll('.mood-selector').forEach(sel => {
      sel.querySelectorAll('.mood-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const wNum = parseInt(sel.dataset.week, 10);
          const val = parseInt(btn.dataset.val, 10);
          mData.weekly[wNum].mood = val;
          saveStateToStorage();
          renderWeeklyCheckin();
        });
      });
    });
  }

  // ==========================================================================
  // 4. MONTHLY REFLECTION RENDERER
  // ==========================================================================
  function renderReflectionData() {
    const mData = getActiveMonthData();
    const ref = mData.reflection || {};

    const wins = document.getElementById('winsInput');
    const improve = document.getElementById('improveInput');
    const goalsNext = document.getElementById('goalsNextInput');
    const notes = document.getElementById('mindsetInput');

    if (wins) wins.value = ref.wins || '';
    if (improve) improve.value = ref.improve || '';
    if (goalsNext) goalsNext.value = ref.nextGoals || '';
    if (notes) notes.value = ref.notes || '';
  }

  function saveReflectionData() {
    const mData = getActiveMonthData();
    mData.reflection = {
      wins: document.getElementById('winsInput')?.value || '',
      improve: document.getElementById('improveInput')?.value || '',
      nextGoals: document.getElementById('goalsNextInput')?.value || '',
      notes: document.getElementById('mindsetInput')?.value || ''
    };
    saveStateToStorage();
    const indicator = document.getElementById('reflectionSaveStatus');
    if (indicator) {
      indicator.textContent = 'Saved!';
      setTimeout(() => { indicator.textContent = 'Saved'; }, 1500);
    }
  }

  // ==========================================================================
  // 5. HABIT STATS & STREAK CALCULATIONS
  // ==========================================================================
  function updateStatsSummary() {
    const days = getDaysInMonth(state.currentMonth);
    const mData = getActiveMonthData();
    const todayNum = new Date().getDate();

    const totalHabits = mData.habits.length;
    let completedToday = 0;

    mData.habits.forEach(h => {
      if (h.completions && h.completions[todayNum]) {
        completedToday++;
      }
    });

    const todayPct = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;

    // Monthly total completion
    let totalCellCompletions = 0;
    mData.habits.forEach(h => {
      for (let d = 1; d <= days; d++) {
        if (h.completions && h.completions[d]) totalCellCompletions++;
      }
    });

    const totalPossibleCells = totalHabits * days;
    const monthlyPct = totalPossibleCells > 0 ? Math.round((totalCellCompletions / totalPossibleCells) * 100) : 0;

    // Streaks logic
    const { currentStreak, longestStreak } = calculateStreaks();

    document.getElementById('statTotalHabits').textContent = totalHabits;
    document.getElementById('statCompletedToday').textContent = `${completedToday} / ${totalHabits}`;
    document.getElementById('statTodayPct').textContent = `${todayPct}%`;
    document.getElementById('statCurrentStreak').textContent = `🔥 ${currentStreak} Days`;
    document.getElementById('statLongestStreak').textContent = `🏆 ${longestStreak} Days`;
    document.getElementById('statMonthlyPct').textContent = `${monthlyPct}%`;
  }

  function calculateStreaks() {
    const days = getDaysInMonth(state.currentMonth);
    const mData = getActiveMonthData();
    const totalHabits = mData.habits.length;

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    const todayNum = new Date().getDate();

    for (let d = 1; d <= days; d++) {
      let doneCount = 0;
      mData.habits.forEach(h => {
        if (h.completions && h.completions[d]) doneCount++;
      });

      const dayPct = totalHabits > 0 ? doneCount / totalHabits : 0;

      // Day is considered successful if >= 50% habits complete
      if (dayPct >= 0.5) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    }

    // Calculate current active streak ending today or yesterday
    let checkDay = todayNum;
    while (checkDay >= 1) {
      let doneCount = 0;
      mData.habits.forEach(h => {
        if (h.completions && h.completions[checkDay]) doneCount++;
      });
      const dayPct = totalHabits > 0 ? doneCount / totalHabits : 0;
      if (dayPct >= 0.5) {
        currentStreak++;
        checkDay--;
      } else {
        break;
      }
    }

    return { currentStreak, longestStreak };
  }

  // Helper: check if day is today
  function isDayToday(day) {
    const now = new Date();
    const currStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return currStr === state.currentMonth && day === now.getDate();
  }

  // ==========================================================================
  // 6. MY PROGRESS DASHBOARD VIEW
  // ==========================================================================
  function renderProgressDashboard() {
    const mData = getActiveMonthData();
    const days = getDaysInMonth(state.currentMonth);
    const { currentStreak, longestStreak } = calculateStreaks();

    let totalCompletions = 0;
    let workoutDays = 0;
    let waterDays = 0;
    let learningDays = 0;
    let totalSleepSum = 0;
    let sleepCount = 0;

    mData.habits.forEach(h => {
      for (let d = 1; d <= days; d++) {
        if (h.completions && h.completions[d]) {
          totalCompletions++;
          const lower = h.name.toLowerCase();
          if (lower.includes('workout') || lower.includes('exercise')) workoutDays++;
          if (lower.includes('water')) waterDays++;
          if (lower.includes('read') || lower.includes('learn')) learningDays++;
        }
      }
    });

    for (let d = 1; d <= days; d++) {
      const sCat = mData.sleep[d];
      if (sCat && SLEEP_MIDPOINTS[sCat]) {
        totalSleepSum += SLEEP_MIDPOINTS[sCat];
        sleepCount++;
      }
    }

    const monthlyPct = mData.habits.length > 0 ? Math.round((totalCompletions / (mData.habits.length * days)) * 100) : 0;
    const avgSleep = sleepCount > 0 ? (totalSleepSum / sleepCount).toFixed(1) : '0.0';

    document.getElementById('dashCurrentStreak').textContent = `${currentStreak} Days`;
    document.getElementById('dashBestStreak').textContent = `${longestStreak} Days`;
    document.getElementById('dashMonthlyScore').textContent = `${monthlyPct}%`;
    document.getElementById('dashWorkoutDays').textContent = `${workoutDays} Days`;
    document.getElementById('dashWaterDays').textContent = `${waterDays} Days`;
    document.getElementById('dashAvgSleep').textContent = `${avgSleep}h`;
    document.getElementById('dashLearningDays').textContent = `${learningDays} Days`;

    // Overview Rings
    renderRingsOverview(monthlyPct, avgSleep, workoutDays, days);

    // Habit Performance Bars
    renderHabitBarsList(mData, days);

    // Chart.js Daily Trend
    renderDailyTrendChart(mData, days);

    // Sleep Tracker Graphs (Trend & Category)
    renderProgressSleepCharts();
  }

  function renderRingsOverview(monthlyPct, avgSleep, workoutDays, days) {
    const container = document.getElementById('habitRingsContainer');
    if (!container) return;

    const workoutPct = Math.round((workoutDays / days) * 100);
    const sleepPct = Math.min(100, Math.round((parseFloat(avgSleep) / 8.0) * 100));

    container.innerHTML = `
      ${createRingSVG(monthlyPct, 'Monthly %')}
      ${createRingSVG(workoutPct, 'Workout %')}
      ${createRingSVG(sleepPct, 'Sleep %')}
    `;
  }

  function createRingSVG(pct, label) {
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (pct / 100) * circumference;

    return `
      <div class="ring-item">
        <svg width="90" height="90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="${radius}" stroke="var(--border-muted)" stroke-width="8" fill="none"/>
          <circle cx="50" cy="50" r="${radius}" stroke="var(--yellow-highlighter-solid)" stroke-width="8" fill="none"
                  stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
        </svg>
        <div style="font-weight: 800; font-size: 1.1rem; margin-top:-65px; margin-bottom: 40px;">${pct}%</div>
        <span class="ring-label">${label}</span>
      </div>
    `;
  }

  function renderHabitBarsList(mData, days) {
    const list = document.getElementById('habitBarsList');
    if (!list) return;

    list.innerHTML = '';
    mData.habits.forEach(h => {
      let done = 0;
      for (let d = 1; d <= days; d++) {
        if (h.completions && h.completions[d]) done++;
      }
      const pct = Math.round((done / days) * 100);

      const item = document.createElement('div');
      item.className = 'habit-bar-item';
      item.innerHTML = `
        <div class="habit-bar-label">
          <span>${h.name}</span>
          <span>${done}/${days} (${pct}%)</span>
        </div>
        <div class="habit-bar-track">
          <div class="habit-bar-fill" style="width: ${pct}%"></div>
        </div>
      `;
      list.appendChild(item);
    });
  }

  function renderDailyTrendChart(mData, days) {
    const canvas = document.getElementById('dailyTrendChart');
    if (!canvas || !window.Chart) return;

    const labels = Array.from({ length: days }, (_, i) => `${i + 1}`);
    const dataPoints = [];

    for (let d = 1; d <= days; d++) {
      let count = 0;
      mData.habits.forEach(h => {
        if (h.completions && h.completions[d]) count++;
      });
      dataPoints.push(count);
    }

    if (trendChartInstance) trendChartInstance.destroy();

    const isDark = state.user.theme === 'dark';
    const textColor = isDark ? '#F3F4F6' : '#111827';
    const gridColor = isDark ? '#2E333D' : '#E5E7EB';

    trendChartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Habits Completed',
          data: dataPoints,
          borderColor: '#EAB308',
          backgroundColor: 'rgba(234, 179, 8, 0.15)',
          fill: true,
          tension: 0.3,
          borderWidth: 3,
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: { color: textColor },
            grid: { color: gridColor }
          },
          y: {
            beginAtZero: true,
            max: mData.habits.length || 10,
            ticks: { color: textColor, precision: 0 },
            grid: { color: gridColor }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  function renderProgressSleepCharts() {
    const trendCanvas = document.getElementById('progressSleepTrendChart');
    const catCanvas = document.getElementById('progressSleepCategoryChart');
    if (!trendCanvas || !catCanvas || !window.Chart) return;

    const days = getDaysInMonth(state.currentMonth);
    const labels = Array.from({ length: days }, (_, i) => `${i + 1}`);

    const sleepHours = [];
    const pointColors = [];
    const target8Line = [];
    let totalLoggedHours = 0;
    let loggedCount = 0;
    let sevenPlusCount = 0;

    const categoryCounts = {
      '< 5 Hrs': 0,
      '5 - 6 Hrs': 0,
      '6 - 7 Hrs': 0,
      '7 - 8 Hrs': 0,
      '8 - 9 Hrs': 0,
      '> 9 Hrs': 0
    };

    const mData = getActiveMonthData();

    for (let d = 1; d <= days; d++) {
      const hrs = getSleepHours(d);
      sleepHours.push(hrs !== null ? hrs : null);
      target8Line.push(8.0);

      if (hrs !== null) {
        totalLoggedHours += hrs;
        loggedCount++;
        if (hrs >= 7.0) sevenPlusCount++;

        if (hrs < 6.0) pointColors.push('#EF4444');
        else if (hrs < 7.5) pointColors.push('#F59E0B');
        else if (hrs <= 9.0) pointColors.push('#10B981');
        else pointColors.push('#8B5CF6');

        const sCat = mData.sleep ? mData.sleep[d] : null;
        if (sCat && categoryCounts[sCat] !== undefined) {
          categoryCounts[sCat]++;
        } else {
          if (hrs < 5) categoryCounts['< 5 Hrs']++;
          else if (hrs < 6) categoryCounts['5 - 6 Hrs']++;
          else if (hrs < 7) categoryCounts['6 - 7 Hrs']++;
          else if (hrs < 8) categoryCounts['7 - 8 Hrs']++;
          else if (hrs < 9) categoryCounts['8 - 9 Hrs']++;
          else categoryCounts['> 9 Hrs']++;
        }
      } else {
        pointColors.push('rgba(156, 163, 175, 0.4)');
      }
    }

    const avgSleepVal = loggedCount > 0 ? (totalLoggedHours / loggedCount).toFixed(1) : '0.0';
    const expectedTotal = loggedCount * 8.0;
    const diff = totalLoggedHours - expectedTotal;
    const debtOrSurplus = loggedCount > 0 ? (diff >= 0 ? `+${diff.toFixed(1)}h Surplus` : `${diff.toFixed(1)}h Debt`) : '0.0h';
    const targetPct = loggedCount > 0 ? Math.round((sevenPlusCount / loggedCount) * 100) : 0;

    const avgPill = document.getElementById('dashSleepAvgPill');
    const debtPill = document.getElementById('dashSleepDebtPill');
    const targetPill = document.getElementById('dashSleepTargetMetPill');

    if (avgPill) avgPill.textContent = `${avgSleepVal}h`;
    if (debtPill) debtPill.textContent = debtOrSurplus;
    if (targetPill) targetPill.textContent = `${targetPct}%`;

    const isDark = state.user.theme === 'dark';
    const textColor = isDark ? '#F3F4F6' : '#111827';
    const gridColor = isDark ? '#2E333D' : '#E5E7EB';

    // 1. Trend Chart
    if (progressSleepTrendChartInstance) progressSleepTrendChartInstance.destroy();

    progressSleepTrendChartInstance = new Chart(trendCanvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Sleep Duration (hrs)',
            data: sleepHours,
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            fill: true,
            tension: 0.35,
            borderWidth: 3,
            pointRadius: 5,
            pointBackgroundColor: pointColors,
            spanGaps: true
          },
          {
            label: '8.0h Target Baseline',
            data: target8Line,
            borderColor: '#6366F1',
            borderWidth: 2,
            borderDash: [6, 6],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: { color: textColor },
            grid: { color: gridColor }
          },
          y: {
            beginAtZero: true,
            max: 12,
            ticks: { color: textColor, stepSize: 2 },
            grid: { color: gridColor }
          }
        },
        plugins: {
          legend: { labels: { color: textColor } }
        }
      }
    });

    // 2. Category Doughnut Chart
    if (progressSleepCategoryChartInstance) progressSleepCategoryChartInstance.destroy();

    progressSleepCategoryChartInstance = new Chart(catCanvas, {
      type: 'doughnut',
      data: {
        labels: SLEEP_CATEGORIES,
        datasets: [{
          data: SLEEP_CATEGORIES.map(cat => categoryCounts[cat]),
          backgroundColor: [
            '#EF4444', // < 5 Hrs
            '#F97316', // 5 - 6 Hrs
            '#FBBF24', // 6 - 7 Hrs
            '#10B981', // 7 - 8 Hrs
            '#059669', // 8 - 9 Hrs
            '#8B5CF6'  // > 9 Hrs
          ],
          borderWidth: 2,
          borderColor: isDark ? '#181B20' : '#FFFFFF'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: textColor, font: { size: 11 } }
          }
        }
      }
    });
  }

  // ==========================================================================
  // 7. CALENDAR VIEW RENDERER
  // ==========================================================================
  function renderCalendarView() {
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;

    const [year, month] = state.currentMonth.split('-').map(Number);
    const firstDayIndex = new Date(year, month - 1, 1).getDay();
    const daysInMonth = getDaysInMonth(state.currentMonth);
    const mData = getActiveMonthData();

    grid.innerHTML = '';

    // Empty cells for previous month padding
    for (let i = 0; i < firstDayIndex; i++) {
      const empty = document.createElement('div');
      empty.className = 'calendar-cell other-month';
      grid.appendChild(empty);
    }

    // Month Days
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = isDayToday(day);
      let completedHabits = 0;
      let hasWorkout = false;
      let hasWater = false;
      let hasLearning = false;

      mData.habits.forEach(h => {
        if (h.completions && h.completions[day]) {
          completedHabits++;
          const lower = h.name.toLowerCase();
          if (lower.includes('workout')) hasWorkout = true;
          if (lower.includes('water')) hasWater = true;
          if (lower.includes('read') || lower.includes('learn')) hasLearning = true;
        }
      });

      const sCat = mData.sleep[day] || '';

      const cell = document.createElement('div');
      cell.className = `calendar-cell ${isToday ? 'today-cell' : ''}`;
      cell.innerHTML = `
        <div class="cell-day-num">${day}</div>
        <div class="cell-badges">
          ${completedHabits > 0 ? `<span class="badge-tag">✓ ${completedHabits}</span>` : ''}
          ${hasWorkout ? `<span class="badge-tag">💪</span>` : ''}
          ${hasWater ? `<span class="badge-tag">💧</span>` : ''}
          ${sCat ? `<span class="badge-tag">😴 ${sCat.split(' ')[0]}</span>` : ''}
          ${hasLearning ? `<span class="badge-tag">📚</span>` : ''}
        </div>
      `;

      cell.addEventListener('click', () => openDailyModal(day));
      grid.appendChild(cell);
    }
  }

  // ==========================================================================
  // 8. GOALS VIEW RENDERER
  // ==========================================================================
  function renderGoalsView() {
    const grid = document.getElementById('goalsGrid');
    if (!grid) return;

    grid.innerHTML = '';
    state.goals.forEach((goal, idx) => {
      const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));

      const card = document.createElement('div');
      card.className = 'goal-card';
      card.innerHTML = `
        <div class="goal-card-header">
          <div>
            <span class="goal-category">${goal.category}</span>
            <div class="goal-title">${goal.name}</div>
          </div>
          <button class="btn-icon-xs delete-goal-btn" data-idx="${idx}" title="Delete Goal"><i data-lucide="trash-2"></i></button>
        </div>

        <div class="goal-progress-info">
          <span>Target: ${goal.current} / ${goal.target}</span>
          <span>${pct}%</span>
        </div>

        <div class="habit-bar-track">
          <div class="habit-bar-fill" style="width: ${pct}%"></div>
        </div>

        <div class="goal-actions">
          <button class="btn btn-xs btn-outline inc-btn" data-idx="${idx}" data-val="1">+1</button>
          <button class="btn btn-xs btn-outline inc-btn" data-idx="${idx}" data-val="5">+5</button>
          <button class="btn btn-xs btn-secondary done-btn" data-idx="${idx}">Mark Complete</button>
        </div>
      `;

      grid.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons();

    // Goal Increment Buttons
    grid.querySelectorAll('.inc-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const val = parseInt(btn.dataset.val, 10);
        state.goals[idx].current = Math.min(state.goals[idx].target, state.goals[idx].current + val);
        saveStateToStorage();
        renderGoalsView();
      });
    });

    grid.querySelectorAll('.done-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        state.goals[idx].current = state.goals[idx].target;
        saveStateToStorage();
        renderGoalsView();
        triggerConfetti();
      });
    });

    grid.querySelectorAll('.delete-goal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        if (confirm('Delete this goal?')) {
          state.goals.splice(idx, 1);
          saveStateToStorage();
          renderGoalsView();
        }
      });
    });
  }

  // ==========================================================================
  // 9. DAILY DETAIL MODAL
  // ==========================================================================
  let activeModalDay = 1;

  function openTodayModal() {
    const today = new Date().getDate();
    openDailyModal(today);
  }

  function openDailyModal(day) {
    activeModalDay = day;
    const mData = getActiveMonthData();

    document.getElementById('modalDayTitle').textContent = `DAY ${day} — ${getMonthName(state.currentMonth)}`;

    // Render Habits Checklist
    const checklist = document.getElementById('modalHabitsChecklist');
    if (checklist) {
      checklist.innerHTML = '';
      mData.habits.forEach((h, hIdx) => {
        const isChecked = h.completions && h.completions[day];
        const item = document.createElement('label');
        item.className = 'checklist-item';
        item.innerHTML = `
          <input type="checkbox" data-idx="${hIdx}" ${isChecked ? 'checked' : ''}>
          <span>${h.name}</span>
        `;
        checklist.appendChild(item);
      });
    }

    // Sleep Selector
    const sleepSel = document.getElementById('modalSleepSelect');
    if (sleepSel) sleepSel.value = mData.sleep[day] || '';

    // Weight
    const weightInp = document.getElementById('modalWeightInput');
    if (weightInp) weightInp.value = mData.dailyWeight[day] || '';

    // Mood Picker 1-10
    const moodPicker = document.getElementById('modalMoodPicker');
    if (moodPicker) {
      const activeMood = mData.dailyMood[day] || 8;
      moodPicker.innerHTML = Array.from({ length: 10 }, (_, i) => {
        const val = i + 1;
        return `<button class="mood-picker-btn ${val === activeMood ? 'active' : ''}" data-val="${val}">${val}</button>`;
      }).join('');

      moodPicker.querySelectorAll('.mood-picker-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          moodPicker.querySelectorAll('.mood-picker-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });
    }

    // Daily Notes
    const notesInp = document.getElementById('modalNotesInput');
    if (notesInp) notesInp.value = mData.dailyNotes[day] || '';

    document.getElementById('dailyModal').classList.add('active');
  }

  function closeDailyModal() {
    document.getElementById('dailyModal').classList.remove('active');
  }

  function saveDailyModal() {
    const mData = getActiveMonthData();

    // Habits checkboxes
    const checklist = document.getElementById('modalHabitsChecklist');
    if (checklist) {
      checklist.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        const hIdx = parseInt(cb.dataset.idx, 10);
        if (!mData.habits[hIdx].completions) mData.habits[hIdx].completions = {};
        mData.habits[hIdx].completions[activeModalDay] = cb.checked;
      });
    }

    // Sleep
    const sleepSel = document.getElementById('modalSleepSelect');
    if (sleepSel && sleepSel.value) {
      mData.sleep[activeModalDay] = sleepSel.value;
    }

    // Weight
    const weightInp = document.getElementById('modalWeightInput');
    if (weightInp) mData.dailyWeight[activeModalDay] = weightInp.value;

    // Mood
    const activeMoodBtn = document.querySelector('#modalMoodPicker .mood-picker-btn.active');
    if (activeMoodBtn) mData.dailyMood[activeModalDay] = parseInt(activeMoodBtn.dataset.val, 10);

    // Notes
    const notesInp = document.getElementById('modalNotesInput');
    if (notesInp) mData.dailyNotes[activeModalDay] = notesInp.value;

    saveStateToStorage();
    renderCurrentMonth();
    closeDailyModal();
    showToast(`Saved Day ${activeModalDay} entries!`);
  }

  // ==========================================================================
  // 10. HABIT MODAL (ADD / EDIT)
  // ==========================================================================
  function openAddHabitModal() {
    document.getElementById('habitModalTitle').textContent = 'Add Custom Habit';
    document.getElementById('habitEditId').value = '';
    document.getElementById('habitNameInput').value = '';
    document.getElementById('habitGoalInput').value = 31;
    document.getElementById('habitModal').classList.add('active');
  }

  function openEditHabitModal(idx) {
    const mData = getActiveMonthData();
    const habit = mData.habits[idx];
    document.getElementById('habitModalTitle').textContent = 'Edit Habit';
    document.getElementById('habitEditId').value = idx;
    document.getElementById('habitNameInput').value = habit.name;
    document.getElementById('habitGoalInput').value = habit.goal || 31;
    document.getElementById('habitModal').classList.add('active');
  }

  function closeHabitModal() {
    document.getElementById('habitModal').classList.remove('active');
  }

  function saveHabitFromModal() {
    const name = document.getElementById('habitNameInput').value.trim();
    const goal = parseInt(document.getElementById('habitGoalInput').value, 10) || 31;
    const editId = document.getElementById('habitEditId').value;
    if (!name) return;

    const mData = getActiveMonthData();
    if (editId !== '') {
      const idx = parseInt(editId, 10);
      mData.habits[idx].name = name;
      mData.habits[idx].goal = goal;
    } else {
      mData.habits.push({
        id: 'h_' + Date.now(),
        name: name,
        goal: goal,
        completions: {}
      });
    }

    saveStateToStorage();
    renderHabitTable();
    updateStatsSummary();
    closeHabitModal();
  }

  // ==========================================================================
  // 11. GOAL MODAL (ADD / EDIT)
  // ==========================================================================
  function openAddGoalModal() {
    document.getElementById('goalModalTitle').textContent = 'Add Goal';
    document.getElementById('goalEditId').value = '';
    document.getElementById('goalNameInput').value = '';
    document.getElementById('goalTargetInput').value = 100;
    document.getElementById('goalCurrentInput').value = 0;
    document.getElementById('goalModal').classList.add('active');
  }

  function closeGoalModal() {
    document.getElementById('goalModal').classList.remove('active');
  }

  function saveGoalFromModal() {
    const cat = document.getElementById('goalCategorySelect').value;
    const name = document.getElementById('goalNameInput').value.trim();
    const target = parseInt(document.getElementById('goalTargetInput').value, 10) || 100;
    const current = parseInt(document.getElementById('goalCurrentInput').value, 10) || 0;
    const deadline = document.getElementById('goalDeadlineInput').value;

    if (!name) return;

    state.goals.push({
      id: 'g_' + Date.now(),
      name, category: cat, target, current, deadline
    });

    saveStateToStorage();
    renderGoalsView();
    closeGoalModal();
  }

  // ==========================================================================
  // 12. MONTHLY REPORT MODAL
  // ==========================================================================
  function openReportModal() {
    const mData = getActiveMonthData();
    const days = getDaysInMonth(state.currentMonth);
    const { currentStreak, longestStreak } = calculateStreaks();

    let totalCompletions = 0;
    mData.habits.forEach(h => {
      for (let d = 1; d <= days; d++) {
        if (h.completions && h.completions[d]) totalCompletions++;
      }
    });

    const overallPct = mData.habits.length > 0 ? Math.round((totalCompletions / (mData.habits.length * days)) * 100) : 0;

    const content = document.getElementById('reportContent');
    if (!content) return;

    content.innerHTML = `
      <div class="report-title">
        <h2>WINTER ARC REPORT</h2>
        <p><strong>${state.user.name}</strong> • ${getMonthName(state.currentMonth)}</p>
        <h3 style="margin-top:10px; font-size: 1.5rem;">Overall Completion: ${overallPct}%</h3>
      </div>

      <div class="report-grid">
        <div class="report-section">
          <h4>Habit Breakdown</h4>
          <ul>
            ${mData.habits.map(h => {
              let cnt = 0;
              for (let d = 1; d <= days; d++) if (h.completions && h.completions[d]) cnt++;
              const p = Math.round((cnt / days) * 100);
              return `<li><strong>${h.name}:</strong> ${cnt}/${days} (${p}%)</li>`;
            }).join('')}
          </ul>
        </div>

        <div class="report-section">
          <h4>Streaks & Performance</h4>
          <p>🔥 <strong>Current Streak:</strong> ${currentStreak} Days</p>
          <p>🏆 <strong>Best Streak:</strong> ${longestStreak} Days</p>
          <br>
          <h4>Sleep & Reflection</h4>
          <p><strong>Wins:</strong> ${mData.reflection?.wins || 'N/A'}</p>
          <p><strong>Areas to Improve:</strong> ${mData.reflection?.improve || 'N/A'}</p>
        </div>
      </div>
    `;

    document.getElementById('reportModal').classList.add('active');
  }

  function closeReportModal() {
    document.getElementById('reportModal').classList.remove('active');
  }

  // ==========================================================================
  // 13. IMPORT / EXPORT DATA
  // ==========================================================================
  function exportDataJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `winter_arc_backup_${state.currentMonth}.json`);
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    dlAnchorElem.remove();
    showToast('Exported backup file successfully!');
  }

  function importDataJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
      try {
        const imported = JSON.parse(event.target.result);
        if (imported && imported.months) {
          state = imported;
          saveStateToStorage();
          initTheme();
          initMonthSelector();
          renderCurrentMonth();
          showToast('Data Imported Successfully!');
        } else {
          alert('Invalid JSON backup file structure.');
        }
      } catch (err) {
        alert('Error parsing JSON backup file.');
      }
    };
    reader.readAsText(file);
  }

  // ==========================================================================
  // UTILITY HELPERS
  // ==========================================================================
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  function showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; bottom: 20px; right: 20px;
      background: var(--text-main); color: var(--paper-bg);
      padding: 10px 18px; border-radius: 6px; font-weight: 700;
      box-shadow: var(--shadow-lg); z-index: 10000;
      animation: fadeIn 0.2s ease;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

})();
