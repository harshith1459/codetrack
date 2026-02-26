/* ========================================
   CodeTrack — Dashboard App Logic V3
   Separate dashboards, per-platform goals,
   productivity features
   Personalized for Pooru Harshith
   ======================================== */

// ─── HARDCODED DEFAULTS ───────────────
const DEFAULT_LC_USER  = 'harshith1459';
const DEFAULT_GFG_USER = '23211a6792';
const DAILY_GOAL_PER_PLATFORM = 3;

// ─── State ────────────────────────────
let lcUsername  = DEFAULT_LC_USER;
let gfgUsername = DEFAULT_GFG_USER;
let lcData  = null;
let gfgData = null;
let historyChart = null;

// Timer state
let timerInterval = null;
let timerSeconds = 25 * 60;
let timerRunning = false;
let pomodoroSessions = 0;
let isBreak = false;

// ─── DOM Refs ─────────────────────────
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ─── Motivation Quotes ────────────────
const QUOTES = [
    '"The only way to do great work is to love what you do." — Steve Jobs',
    '"It does not matter how slowly you go as long as you do not stop." — Confucius',
    '"Code is like humor. When you have to explain it, it\'s bad." — Cory House',
    '"First, solve the problem. Then, write the code." — John Johnson',
    '"Strive not to be a success, but rather to be of value." — Albert Einstein',
    '"The best error message is the one that never shows up." — Thomas Fuchs',
    '"Consistency is what transforms average into excellence."',
    '"Hard choices, easy life. Easy choices, hard life." — Jerzy Gregorek',
    '"Your limitation—it\'s only your imagination."',
    '"Dream it. Wish it. Do it."',
    '"Success is not final, failure is not fatal: it is the courage to continue that counts." — Winston Churchill',
    '"Every expert was once a beginner."',
    '"The secret of getting ahead is getting started." — Mark Twain',
    '"Don\'t watch the clock; do what it does. Keep going." — Sam Levenson',
    '"Push yourself, because no one else is going to do it for you."',
    '"Great things never come from comfort zones."',
    '"3 problems a day keeps the placement tension away! 💪"',
    '"Solve. Learn. Repeat. That\'s the Harshith way! 🚀"',
];

// ─── Init ─────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const saved = loadConfig();
    if (saved) {
        lcUsername  = saved.lc  || DEFAULT_LC_USER;
        gfgUsername = saved.gfg || DEFAULT_GFG_USER;
        if (gfgUsername === '23211A6792') gfgUsername = '23211a6792';
    } else {
        saveConfig(lcUsername, gfgUsername);
    }
    saveConfig(lcUsername, gfgUsername);

    updateUIUsernames();
    bindEvents();
    initTabs();
    showRandomQuote();
    updateTimerDisplay();
    refreshAll();
});

// ─── Tab Navigation ───────────────────
function initTabs() {
    $$('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
}

function switchTab(tabId) {
    $$('.nav-tab').forEach(t => t.classList.remove('active'));
    $$('.tab-content').forEach(c => c.classList.remove('active'));
    const tab = document.querySelector(`.nav-tab[data-tab="${tabId}"]`);
    if (tab) tab.classList.add('active');
    const content = $(`#tab-${tabId}`);
    if (content) content.classList.add('active');
}

// ─── Events ───────────────────────────
function bindEvents() {
    $('#refresh-btn').addEventListener('click', () => {
        $('#refresh-btn').classList.add('spinning');
        refreshAll().finally(() =>
            setTimeout(() => $('#refresh-btn').classList.remove('spinning'), 600)
        );
    });

    $('#settings-btn').addEventListener('click', () => {
        $('#settings-lc').value  = lcUsername;
        $('#settings-gfg').value = gfgUsername;
        $('#settings-modal').classList.remove('hidden');
    });

    $('#modal-cancel').addEventListener('click', () => {
        $('#settings-modal').classList.add('hidden');
    });

    $('#modal-save').addEventListener('click', () => {
        const newLc  = $('#settings-lc').value.trim();
        const newGfg = $('#settings-gfg').value.trim();
        if (newLc)  lcUsername  = newLc;
        if (newGfg) gfgUsername = newGfg;
        saveConfig(lcUsername, gfgUsername);
        updateUIUsernames();
        $('#settings-modal').classList.add('hidden');
        refreshAll();
    });

    $('#clear-history-btn').addEventListener('click', () => {
        if (confirm('Clear all progress history?')) {
            localStorage.removeItem('ct_history');
            renderHistory();
        }
    });

    $('#settings-modal').addEventListener('click', (e) => {
        if (e.target === $('#settings-modal')) $('#settings-modal').classList.add('hidden');
    });

    // Productivity: Timer
    $('#timer-start').addEventListener('click', toggleTimer);
    $('#timer-reset').addEventListener('click', resetTimer);

    // Quotes
    $('#new-quote-btn').addEventListener('click', showRandomQuote);
}

function updateUIUsernames() {
    $('#lc-user-tag').textContent   = `@${lcUsername}`;
    $('#gfg-user-tag').textContent  = `@${gfgUsername}`;
    const lcLink = $('#lc-profile-link');
    if (lcLink) {
        lcLink.href = API.leetcode.profileUrl(lcUsername);
        lcLink.textContent = `@${lcUsername} `;
    }
    const gfgLink = $('#gfg-profile-link');
    if (gfgLink) {
        gfgLink.href = API.gfg.profileUrl(gfgUsername);
        gfgLink.textContent = `@${gfgUsername} `;
    }
}

// ─── Refresh All Data ─────────────────
async function refreshAll() {
    await Promise.all([fetchLeetCode(), fetchGFG()]);
    updateTotals();
    saveSnapshot();          // save BEFORE goal check so history exists
    updateGoalDisplays();
    updateWeeklyChallenge();
    renderHistory();
    renderGFGHeatmap();
    $('#last-updated').textContent = `Updated: ${new Date().toLocaleTimeString()}`;
}

// ─── Fetch LeetCode ───────────────────
async function fetchLeetCode() {
    const loading = $('#lc-loading');
    const error   = $('#lc-error');
    loading.classList.remove('hidden');
    error.classList.add('hidden');

    try {
        lcData = await fetchLeetCodeAPI(lcUsername);
        renderLeetCode();
        renderTopics();
        renderLCHeatmap();
        renderRecent();
        loading.classList.add('hidden');
    } catch (e) {
        loading.classList.add('hidden');
        error.classList.remove('hidden');
        console.error('LC fetch error:', e);
    }
}

// ─── Fetch GFG ────────────────────────
async function fetchGFG() {
    const loading = $('#gfg-loading');
    const error   = $('#gfg-error');
    loading.classList.remove('hidden');
    error.classList.add('hidden');

    try {
        gfgData = await fetchGFGAPI(gfgUsername);
        console.log('[APP] GFG data received:', gfgData);
        renderGFG();
        loading.classList.add('hidden');
    } catch (e) {
        loading.classList.add('hidden');
        error.classList.remove('hidden');
        console.error('GFG fetch error:', e);
    }
}

// ─── Render LeetCode (Overview + Tab) ──
function renderLeetCode() {
    if (!lcData) return;

    // Overview card
    $('#lc-total').textContent      = lcData.totalSolved;
    $('#lc-easy').textContent       = `${lcData.easySolved} / ${lcData.easyTotal}`;
    $('#lc-medium').textContent     = `${lcData.mediumSolved} / ${lcData.mediumTotal}`;
    $('#lc-hard').textContent       = `${lcData.hardSolved} / ${lcData.hardTotal}`;
    $('#lc-acceptance').textContent = lcData.acceptanceRate;

    // Hero stats
    $('#lc-streak').textContent     = `${lcData.streak} days`;
    $('#lc-active-days').textContent = lcData.totalActiveDays;
    $('#lc-ranking').textContent    = lcData.ranking !== '—'
        ? '#' + Number(lcData.ranking).toLocaleString() : '—';

    // LC Tab stats
    $('#lc-streak-tab').textContent  = `${lcData.streak} days`;
    $('#lc-ranking-tab').textContent = lcData.ranking !== '—'
        ? '#' + Number(lcData.ranking).toLocaleString() : '—';
    $('#lc-active-tab').textContent  = lcData.totalActiveDays;
    $('#lc-accept-tab').textContent  = lcData.acceptanceRate;

    // LC Tab problem breakdown
    $('#lc-total-tab').textContent   = lcData.totalSolved;
    $('#lc-easy-tab').textContent    = `${lcData.easySolved} / ${lcData.easyTotal}`;
    $('#lc-medium-tab').textContent  = `${lcData.mediumSolved} / ${lcData.mediumTotal}`;
    $('#lc-hard-tab').textContent    = `${lcData.hardSolved} / ${lcData.hardTotal}`;
    $('#lc-contrib-tab').textContent = lcData.contributionPoints;

    // Donuts
    drawDonut('lc-ring', [
        { value: lcData.easySolved,   color: '#00b894' },
        { value: lcData.mediumSolved, color: '#fdcb6e' },
        { value: lcData.hardSolved,   color: '#e17055' },
    ], lcData.totalQuestions);

    drawDonut('lc-ring-tab', [
        { value: lcData.easySolved,   color: '#00b894' },
        { value: lcData.mediumSolved, color: '#fdcb6e' },
        { value: lcData.hardSolved,   color: '#e17055' },
    ], lcData.totalQuestions, 82);
}

// ─── Render GFG (Overview + Tab) ──────
function renderGFG() {
    if (!gfgData) return;

    const total = parseInt(gfgData.totalProblemsSolved) || 0;

    // Overview card
    $('#gfg-total').textContent          = total;
    $('#gfg-total-detail').textContent   = total;
    $('#gfg-coding-score-ov').textContent = gfgData.codingScore;
    $('#gfg-rank-ov').textContent        = gfgData.instituteRank !== '—'
        ? '#' + gfgData.instituteRank : '—';

    // Hero stats
    $('#gfg-score').textContent = gfgData.codingScore;

    // GFG Tab stats
    $('#gfg-score-tab').textContent  = gfgData.codingScore;
    $('#gfg-solved-tab').textContent = total;
    $('#gfg-streak-tab').textContent = gfgData.currentStreak;
    $('#gfg-rank-tab').textContent   = gfgData.instituteRank !== '—'
        ? '#' + gfgData.instituteRank : '—';

    // GFG Tab problem details
    $('#gfg-total-tab').textContent       = total;
    $('#gfg-solved-detail').textContent   = total;
    $('#gfg-cs-detail').textContent       = gfgData.codingScore;
    $('#gfg-monthly-detail').textContent  = gfgData.monthlyScore || '—';
    $('#gfg-maxstreak-detail').textContent = gfgData.maxStreak || '—';

    // GFG Info
    $('#gfg-institute-name').textContent     = gfgData.instituteName || 'BVRIT Medak';
    $('#gfg-irank-info').textContent         = gfgData.instituteRank !== '—'
        ? '#' + gfgData.instituteRank : '—';
    $('#gfg-longest-streak-info').textContent = gfgData.maxStreak || '—';

    // Donuts
    drawDonut('gfg-ring', [{ value: total, color: '#00b894' }], total || 1);
    drawDonut('gfg-ring-tab', [{ value: total, color: '#00b894' }], total || 1, 82);
}

// ─── Render Topic Tags (LC Tab) ───────
function renderTopics() {
    const grid = $('#topics-grid');
    if (!lcData || !lcData.topicTags || lcData.topicTags.length === 0) {
        grid.innerHTML = '<p class="empty-msg">No topic data available.</p>';
        return;
    }

    const levelColors = {
        fundamental: { bg: 'rgba(0,184,148,0.12)', border: '#00b894', text: '#00b894' },
        intermediate: { bg: 'rgba(253,203,110,0.12)', border: '#fdcb6e', text: '#fdcb6e' },
        advanced: { bg: 'rgba(225,112,85,0.12)', border: '#e17055', text: '#e17055' },
    };
    const levelLabels = {
        fundamental: 'Fundamental', intermediate: 'Intermediate', advanced: 'Advanced',
    };

    grid.innerHTML = lcData.topicTags.map(t => {
        const c = levelColors[t.level] || levelColors.fundamental;
        return `<div class="topic-tag" style="background:${c.bg};border-color:${c.border}">
            <span class="topic-name">${t.name}</span>
            <span class="topic-count" style="color:${c.text}">${t.count}</span>
            <span class="topic-level" style="color:${c.text}">${levelLabels[t.level]}</span>
        </div>`;
    }).join('');
}

// ─── Render LC Heatmap (LC Tab) ───────
function renderLCHeatmap() {
    const container = $('#lc-heatmap-container');
    if (!lcData || !lcData.submissionCalendar || Object.keys(lcData.submissionCalendar).length === 0) {
        container.innerHTML = '<p class="empty-msg">No submission data for heatmap.</p>';
        return;
    }

    const cal = lcData.submissionCalendar;
    const today = new Date();
    const days  = 120;

    let html = '<div class="heatmap-grid">';
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const ts = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 1000);
        const count = cal[ts] || 0;
        const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 8 ? 3 : 4;
        const title = `${d.toLocaleDateString('en-US', {month:'short', day:'numeric'})}: ${count} submission${count !== 1 ? 's' : ''}`;
        html += `<div class="heatmap-cell lc-heatmap level-${level}" title="${title}"></div>`;
    }
    html += '</div>';

    html += `<div class="heatmap-legend">
        <span>Less</span>
        <div class="heatmap-cell lc-heatmap level-0"></div>
        <div class="heatmap-cell lc-heatmap level-1"></div>
        <div class="heatmap-cell lc-heatmap level-2"></div>
        <div class="heatmap-cell lc-heatmap level-3"></div>
        <div class="heatmap-cell lc-heatmap level-4"></div>
        <span>More</span>
    </div>`;

    container.innerHTML = html;
}

// ─── Render GFG Heatmap (GFG Tab) ─────
function renderGFGHeatmap() {
    const container = $('#gfg-heatmap-container');
    if (!container) return;

    const history = getHistory();
    if (history.length < 2) {
        container.innerHTML = '<p class="empty-msg">GFG activity heatmap builds as you track daily. Keep using CodeTrack!</p>';
        return;
    }

    // Build a map of date -> gfg problems solved that day
    const dayMap = {};
    for (let i = 1; i < history.length; i++) {
        const delta = Math.max(0, history[i].gfg - history[i - 1].gfg);
        dayMap[history[i].date] = delta;
    }

    const today = new Date();
    const days = 120;

    let html = '<div class="heatmap-grid">';
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const count = dayMap[dateStr] || 0;
        const level = count === 0 ? 0 : count <= 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4;
        const title = `${d.toLocaleDateString('en-US', {month:'short', day:'numeric'})}: ${count} problem${count !== 1 ? 's' : ''}`;
        html += `<div class="heatmap-cell gfg-heatmap level-${level}" title="${title}"></div>`;
    }
    html += '</div>';

    html += `<div class="heatmap-legend">
        <span>Less</span>
        <div class="heatmap-cell gfg-heatmap level-0"></div>
        <div class="heatmap-cell gfg-heatmap level-1"></div>
        <div class="heatmap-cell gfg-heatmap level-2"></div>
        <div class="heatmap-cell gfg-heatmap level-3"></div>
        <div class="heatmap-cell gfg-heatmap level-4"></div>
        <span>More</span>
    </div>`;

    container.innerHTML = html;
}

// ─── Render Recent Submissions (LC Tab) ─
function renderRecent() {
    const list = $('#recent-list');
    if (!lcData || !lcData.recentSubmissions || lcData.recentSubmissions.length === 0) {
        list.innerHTML = '<p class="empty-msg">No recent submissions.</p>';
        return;
    }

    list.innerHTML = lcData.recentSubmissions.slice(0, 10).map(s => {
        const ts = s.timestamp ? new Date(s.timestamp * 1000).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : '';
        const statusClass = s.statusDisplay === 'Accepted' ? 'accepted' : 'failed';
        const icon = s.statusDisplay === 'Accepted' ? 'fa-check-circle' : 'fa-times-circle';
        return `<div class="recent-item ${statusClass}">
            <i class="fas ${icon}"></i>
            <div class="recent-info">
                <span class="recent-title">${s.title || s.titleSlug || 'Unknown'}</span>
                <span class="recent-time">${ts}</span>
            </div>
            <span class="recent-status">${s.statusDisplay || ''}</span>
        </div>`;
    }).join('');
}

// ─── Update Totals ────────────────────
function updateTotals() {
    const lcSolved  = lcData ? lcData.totalSolved : 0;
    const gfgSolved = gfgData ? (parseInt(gfgData.totalProblemsSolved) || 0) : 0;
    $('#total-solved').textContent = lcSolved + gfgSolved;
}

// ─── Seed yesterday baseline (first-time use) ──
function seedYesterdayBaseline(lcNow, gfgNow, lcTodayFromCalendar) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    const history = getHistory();

    // Don't seed if yesterday already exists
    if (history.find(h => h.date === yStr)) return;

    // Yesterday's totals = today's totals minus what was solved today
    const lcYesterday  = Math.max(0, lcNow - lcTodayFromCalendar);
    const gfgYesterday = gfgNow; // no way to know GFG today count, assume same

    const entry = { date: yStr, lc: lcYesterday, gfg: gfgYesterday, total: lcYesterday + gfgYesterday };
    history.unshift(entry); // add at beginning
    localStorage.setItem('ct_history', JSON.stringify(history));
    console.log('[GOALS] Seeded yesterday baseline:', entry);
}

// ─── Per-Platform Daily Goals ─────────
function updateGoalDisplays() {
    const lcNow  = lcData ? lcData.totalSolved : 0;
    const gfgNow = gfgData ? (parseInt(gfgData.totalProblemsSolved) || 0) : 0;
    const today  = new Date().toISOString().split('T')[0];
    const history = getHistory();

    let lcToday  = 0;
    let gfgToday = 0;

    // Compare against previous day's history entry
    const prevDayEntry = history.filter(h => h.date < today).pop();
    if (prevDayEntry) {
        lcToday  = Math.max(0, lcNow - prevDayEntry.lc);
        gfgToday = Math.max(0, gfgNow - prevDayEntry.gfg);
    } else {
        // No previous day at all — first time using CodeTrack.
        // Use LC submission calendar to count today's submissions
        if (lcData && lcData.submissionCalendar) {
            const todayMidnight = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime() / 1000);
            lcToday = lcData.submissionCalendar[todayMidnight] || 0;
        }
        // For GFG — no calendar available, so seed a "yesterday" baseline
        // so future refreshes can detect changes
        if (history.length <= 1) {
            seedYesterdayBaseline(lcNow, gfgNow, lcToday);
        }
    }

    console.log(`[GOALS] LC: ${lcNow} now, prev: ${prevDayEntry?.lc ?? 'none'}, today solved: ${lcToday}`);
    console.log(`[GOALS] GFG: ${gfgNow} now, prev: ${prevDayEntry?.gfg ?? 'none'}, today solved: ${gfgToday}`);

    const goal = DAILY_GOAL_PER_PLATFORM;

    // LC Goal
    const lcPct = Math.min(100, (lcToday / goal) * 100);
    $('#lc-goal-fill').style.width = lcPct + '%';
    $('#lc-goal-count').textContent = `${lcToday} / ${goal}`;
    if (lcPct >= 100) {
        $('#lc-goal-text').textContent = '🎉 LeetCode daily goal achieved!';
        $('#lc-goal-fill').style.background = 'linear-gradient(90deg, #00b894, #55efc4)';
    } else if (lcToday > 0) {
        $('#lc-goal-text').textContent = `${goal - lcToday} more LC problem${goal - lcToday > 1 ? 's' : ''} to go!`;
    } else {
        $('#lc-goal-text').textContent = `Solve ${goal} LeetCode problems today!`;
    }

    // GFG Goal
    const gfgPct = Math.min(100, (gfgToday / goal) * 100);
    $('#gfg-goal-fill').style.width = gfgPct + '%';
    $('#gfg-goal-count').textContent = `${gfgToday} / ${goal}`;
    if (gfgPct >= 100) {
        $('#gfg-goal-text').textContent = '🎉 GFG daily goal achieved!';
        $('#gfg-goal-fill').style.background = 'linear-gradient(90deg, #00b894, #55efc4)';
    } else if (gfgToday > 0) {
        $('#gfg-goal-text').textContent = `${goal - gfgToday} more GFG problem${goal - gfgToday > 1 ? 's' : ''} to go!`;
    } else {
        $('#gfg-goal-text').textContent = `Solve ${goal} GFG problems today!`;
    }
}

// ─── Weekly Challenge ─────────────────
function updateWeeklyChallenge() {
    const history = getHistory();
    if (history.length < 2) {
        $('#weekly-fill').style.width = '0%';
        $('#weekly-count').textContent = '0 / 21';
        return;
    }

    // Calculate problems solved this week (Mon-Sun)
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - mondayOffset);
    const mondayStr = monday.toISOString().split('T')[0];

    // Find the entry just before this week started
    const beforeWeek = history.filter(h => h.date < mondayStr);
    const baseTotal = beforeWeek.length > 0 ? beforeWeek[beforeWeek.length - 1].total : 0;
    const currentTotal = history[history.length - 1].total;
    const weekSolved = Math.max(0, currentTotal - baseTotal);

    const pct = Math.min(100, (weekSolved / 21) * 100);
    $('#weekly-fill').style.width = pct + '%';
    $('#weekly-count').textContent = `${weekSolved} / 21`;
}

// ─── Canvas Donut Chart ───────────────
function drawDonut(canvasId, segments, maxVal, radius) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;
    const r = radius || 72;
    const lineW = 16;

    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(42, 42, 69, 0.6)';
    ctx.lineWidth = lineW;
    ctx.stroke();

    const total = segments.reduce((s, seg) => s + seg.value, 0);
    if (total === 0) return;
    let startAngle = -Math.PI / 2;

    segments.forEach(seg => {
        if (seg.value === 0) return;
        const sliceAngle = (seg.value / (maxVal || total)) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, startAngle, startAngle + sliceAngle);
        ctx.strokeStyle = seg.color;
        ctx.lineWidth = lineW;
        ctx.lineCap = 'round';
        ctx.stroke();
        startAngle += sliceAngle;
    });
}

// ─── History / Progress Log ───────────
function getHistory() {
    try { return JSON.parse(localStorage.getItem('ct_history') || '[]'); }
    catch { return []; }
}

function saveSnapshot() {
    const history = getHistory();
    const today = new Date().toISOString().split('T')[0];
    const lcSolved  = lcData ? lcData.totalSolved : 0;
    const gfgSolved = gfgData ? (parseInt(gfgData.totalProblemsSolved) || 0) : 0;
    const total = lcSolved + gfgSolved;

    const existing = history.findIndex(h => h.date === today);
    const entry = { date: today, lc: lcSolved, gfg: gfgSolved, total };
    if (existing >= 0) history[existing] = entry;
    else history.push(entry);

    while (history.length > 90) history.shift();
    localStorage.setItem('ct_history', JSON.stringify(history));
}

function renderHistory() {
    const history = getHistory();
    const tbody   = $('#history-body');

    if (history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">
            No history yet. Data is recorded each time you refresh.</td></tr>`;
    } else {
        tbody.innerHTML = history.slice().reverse().map((h, i, arr) => {
            const prev  = arr[i + 1];
            const delta = prev ? h.total - prev.total : 0;
            const cls   = delta > 0 ? 'delta-positive' : 'delta-zero';
            const sign  = delta > 0 ? '+' : '';
            return `<tr>
                <td>${formatDate(h.date)}</td>
                <td>${h.lc}</td>
                <td>${h.gfg}</td>
                <td><strong>${h.total}</strong></td>
                <td class="${cls}">${sign}${delta}</td>
            </tr>`;
        }).join('');
    }
    renderHistoryChart(history);
}

function renderHistoryChart(history) {
    const canvas = document.getElementById('history-chart');
    if (!canvas) return;
    if (historyChart) historyChart.destroy();

    if (history.length < 2) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#55557a';
        ctx.font = '14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Chart will appear after 2+ days of data', canvas.width / 2, 130);
        return;
    }

    historyChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: history.map(h => formatDate(h.date)),
            datasets: [
                {
                    label: 'Total', data: history.map(h => h.total),
                    borderColor: '#6c63ff', backgroundColor: 'rgba(108,99,255,0.1)',
                    fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: 4,
                },
                {
                    label: 'LeetCode', data: history.map(h => h.lc),
                    borderColor: '#fdcb6e', backgroundColor: 'transparent',
                    tension: 0.4, borderWidth: 2, pointRadius: 3, borderDash: [6, 3],
                },
                {
                    label: 'GFG', data: history.map(h => h.gfg),
                    borderColor: '#00b894', backgroundColor: 'transparent',
                    tension: 0.4, borderWidth: 2, pointRadius: 3, borderDash: [6, 3],
                },
            ],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { labels: { color: '#8888a8', font: { family:'Inter', size:12 } } },
                tooltip: {
                    backgroundColor:'#1a1a2e', titleColor:'#e8e8f0', bodyColor:'#8888a8',
                    borderColor:'#2a2a45', borderWidth:1, cornerRadius:8, padding:12,
                },
            },
            scales: {
                x: { ticks: { color:'#55557a', font:{ size:11 } }, grid:{ color:'rgba(42,42,69,0.3)' } },
                y: { ticks: { color:'#55557a', font:{ size:11 } }, grid:{ color:'rgba(42,42,69,0.3)' } },
            },
        },
    });
}

// ─── Pomodoro Timer ───────────────────
function toggleTimer() {
    if (timerRunning) {
        clearInterval(timerInterval);
        timerRunning = false;
        $('#timer-start').innerHTML = '<i class="fas fa-play"></i> Start';
    } else {
        timerRunning = true;
        $('#timer-start').innerHTML = '<i class="fas fa-pause"></i> Pause';
        timerInterval = setInterval(() => {
            timerSeconds--;
            if (timerSeconds <= 0) {
                clearInterval(timerInterval);
                timerRunning = false;
                if (!isBreak) {
                    pomodoroSessions++;
                    updateSessionDots();
                    // Start break
                    isBreak = true;
                    timerSeconds = pomodoroSessions % 4 === 0 ? 15 * 60 : 5 * 60;
                    $('#timer-start').innerHTML = '<i class="fas fa-play"></i> Start Break';
                    try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2LkZeXl5GJfHFkV0xDOzY0NTk/R1BWX2p1gIqSnJ+dn5mQh3tvZFhMQDYwLzM6Q05aZXF+iZKam5uYkIZ7b2NXS0A3MC8zOkRPW2dygoyVnJ2cmJCFem5iVkpANzAvMztFUFxodIKMlZydnJiQhXpuYlZKQDcwLzM7RVBZZHB8hokPiJGXmpqXko2Ee3JoXVJIQDo2Njs=').play(); } catch(e) {}
                    alert(pomodoroSessions % 4 === 0
                        ? '🎉 Great work! Take a 15-min long break!'
                        : '☕ Focus session done! Take a 5-min break.');
                } else {
                    isBreak = false;
                    timerSeconds = 25 * 60;
                    $('#timer-start').innerHTML = '<i class="fas fa-play"></i> Start';
                    alert('⏰ Break over! Ready for the next focus session?');
                }
            }
            updateTimerDisplay();
        }, 1000);
    }
}

function resetTimer() {
    clearInterval(timerInterval);
    timerRunning = false;
    isBreak = false;
    timerSeconds = 25 * 60;
    pomodoroSessions = 0;
    updateTimerDisplay();
    updateSessionDots();
    $('#timer-start').innerHTML = '<i class="fas fa-play"></i> Start';
}

function updateTimerDisplay() {
    const min = Math.floor(timerSeconds / 60);
    const sec = timerSeconds % 60;
    $('#timer-display').textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function updateSessionDots() {
    for (let i = 1; i <= 4; i++) {
        const dot = $(`#s${i}`);
        if (dot) dot.classList.toggle('completed', i <= pomodoroSessions % 4 || (pomodoroSessions > 0 && pomodoroSessions % 4 === 0 && i <= 4));
    }
}

// ─── Motivation Quotes ────────────────
function showRandomQuote() {
    const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    $('#motivation-quote').textContent = q;
}

// ─── Helpers ──────────────────────────
function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function saveConfig(lc, gfg) {
    localStorage.setItem('ct_config', JSON.stringify({ lc, gfg }));
}

function loadConfig() {
    try { return JSON.parse(localStorage.getItem('ct_config')); }
    catch { return null; }
}
