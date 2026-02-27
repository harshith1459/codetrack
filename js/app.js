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
    const cacheBadge = $('#lc-cache-badge');
    loading.classList.remove('hidden');
    error.classList.add('hidden');
    if (cacheBadge) cacheBadge.classList.add('hidden');

    try {
        lcData = await fetchLeetCodeAPI(lcUsername);
        renderLeetCode();
        renderTopics();
        renderLCHeatmap();
        renderRecent();
        loading.classList.add('hidden');
        // Show cache indicator if data came from cache
        if (lcData._fromCache && cacheBadge) {
            cacheBadge.classList.remove('hidden');
        }
    } catch (e) {
        loading.classList.add('hidden');
        error.classList.remove('hidden');
        // Update error message with specifics
        const errMsg = $('#lc-error-msg');
        if (errMsg) {
            if (e.message.includes('429') || e.message.includes('rate')) {
                errMsg.textContent = 'API rate-limited (429). Try again in ~1 hour.';
            } else {
                errMsg.textContent = 'Could not fetch LeetCode data. API may be down.';
            }
        }
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
        if (!gfgData._fromCache) cacheGFGData(gfgData);
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
    $('#gfg-monthly-detail').textContent  = gfgData.monthlyScore ?? '—';
    $('#gfg-maxstreak-detail').textContent = gfgData.maxStreak ?? '—';

    // GFG Info
    $('#gfg-institute-name').textContent     = gfgData.instituteName || 'BVRIT Medak';
    $('#gfg-irank-info').textContent         = gfgData.instituteRank !== '—'
        ? '#' + gfgData.instituteRank : '—';
    $('#gfg-longest-streak-info').textContent = gfgData.maxStreak ?? '—';

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
        const ts = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 1000);
        const count = cal[ts] || cal[String(ts)] || 0;
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
    const lcSolved  = lcData ? (parseInt(lcData.totalSolved) || 0) : 0;
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
    // Also sort to be safe
    history.sort((a, b) => a.date.localeCompare(b.date));
    localStorage.setItem('ct_history', JSON.stringify(history));
    console.log('[GOALS] Seeded yesterday baseline:', entry);
}

// ─── Get LC problems solved today from submission calendar ──
function getLCTodayFromCalendar() {
    if (!lcData || !lcData.submissionCalendar) return 0;
    const cal = lcData.submissionCalendar;

    // LeetCode uses UTC midnight timestamps as keys
    const now = new Date();
    const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000;

    // Also check local midnight in case API uses that
    const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;

    const count = cal[utcMidnight] || cal[String(utcMidnight)] || cal[localMidnight] || cal[String(localMidnight)] || 0;
    console.log(`[GOALS] LC calendar lookup: UTC=${utcMidnight}, local=${localMidnight}, found=${count}`);
    return count;
}

// ─── Per-Platform Daily Goals ─────────
function updateGoalDisplays() {
    const lcNow  = lcData ? (parseInt(lcData.totalSolved) || 0) : 0;
    const gfgNow = gfgData ? (parseInt(gfgData.totalProblemsSolved) || 0) : 0;
    const today  = new Date().toISOString().split('T')[0];
    const history = getHistory();

    let lcToday  = 0;
    let gfgToday = 0;

    // Method 1: Compare against previous day's history entry (most reliable)
    const prevDayEntry = history.filter(h => h.date < today).pop();

    if (prevDayEntry) {
        const prevLc  = parseInt(prevDayEntry.lc) || 0;
        const prevGfg = parseInt(prevDayEntry.gfg) || 0;
        lcToday  = Math.max(0, lcNow - prevLc);
        gfgToday = Math.max(0, gfgNow - prevGfg);
        console.log(`[GOALS] Using history baseline: prev(${prevDayEntry.date}) LC=${prevLc}, GFG=${prevGfg}`);
    }

    // Method 2: Cross-check with LC submission calendar (more accurate for LC)
    const calendarToday = getLCTodayFromCalendar();
    if (calendarToday > 0) {
        // Calendar is authoritative for LC — it tracks actual accepted submissions
        // Use the higher of the two methods (calendar vs history diff)
        if (calendarToday > lcToday) {
            console.log(`[GOALS] LC calendar (${calendarToday}) > history diff (${lcToday}), using calendar`);
            lcToday = calendarToday;
        }
    }

    // Method 3: No previous day at all — first time using CodeTrack
    if (!prevDayEntry) {
        lcToday = calendarToday; // calendar is our best bet
        console.log(`[GOALS] No prev day — seeding baseline`);
        // Seed a yesterday entry so tomorrow's goal tracking works
        seedYesterdayBaseline(lcNow, gfgNow, lcToday);
    }

    console.log(`[GOALS] FINAL → LC today: ${lcToday}, GFG today: ${gfgToday}`);
    console.log(`[GOALS] LC: ${lcNow} now, prev: ${prevDayEntry?.lc ?? 'none'}`);
    console.log(`[GOALS] GFG: ${gfgNow} now, prev: ${prevDayEntry?.gfg ?? 'none'}`);

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
    const lcSolved  = lcData ? (parseInt(lcData.totalSolved) || 0) : 0;
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
    const summaryEl = $('#progress-summary');

    // --- Compute summary stats ---
    let weekSolved = 0, bestDay = 0, totalDays = history.length, avgPerDay = 0;
    let trackingStreak = 0;
    const dailyDeltas = [];
    const calTodayForSummary = (typeof getLCTodayFromCalendar === 'function') ? getLCTodayFromCalendar() : 0;

    for (let i = 0; i < history.length; i++) {
        const prev = i > 0 ? history[i - 1] : null;
        let lcDelta  = prev ? Math.max(0, (parseInt(history[i].lc) || 0) - (parseInt(prev.lc) || 0)) : 0;
        const gfgDelta = prev ? Math.max(0, (parseInt(history[i].gfg) || 0) - (parseInt(prev.gfg) || 0)) : 0;

        // For today: use LC calendar if it shows more (API totalSolved may lag)
        const todayCheck = new Date().toISOString().split('T')[0];
        if (history[i].date === todayCheck && calTodayForSummary > lcDelta) {
            lcDelta = calTodayForSummary;
        }

        const dayTotal = lcDelta + gfgDelta;
        dailyDeltas.push({ date: history[i].date, lcDelta, gfgDelta, dayTotal });
        if (dayTotal > bestDay) bestDay = dayTotal;
    }

    // Week calculation (Mon-Sun)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - mondayOffset);
    const mondayStr = monday.toISOString().split('T')[0];
    weekSolved = dailyDeltas.filter(d => d.date >= mondayStr).reduce((s, d) => s + d.dayTotal, 0);

    // Average (last 7 entries with deltas)
    const recent7 = dailyDeltas.slice(-7);
    const sumRecent = recent7.reduce((s, d) => s + d.dayTotal, 0);
    avgPerDay = recent7.length > 0 ? (sumRecent / recent7.length).toFixed(1) : '0';

    // Tracking streak: consecutive days with entries from today backwards
    const todayStr = today.toISOString().split('T')[0];
    for (let i = history.length - 1; i >= 0; i--) {
        const expected = new Date(today);
        expected.setDate(today.getDate() - (history.length - 1 - i));
        if (history[i].date === expected.toISOString().split('T')[0]) {
            trackingStreak++;
        } else break;
    }

    // --- Render summary stats ---
    if (summaryEl) {
        if (history.length >= 2) {
            summaryEl.innerHTML = `
                <div class="progress-stat">
                    <i class="fas fa-calendar-week"></i>
                    <div>
                        <span class="progress-stat-value">${weekSolved}</span>
                        <span class="progress-stat-label">This Week</span>
                    </div>
                </div>
                <div class="progress-stat">
                    <i class="fas fa-chart-bar"></i>
                    <div>
                        <span class="progress-stat-value">${avgPerDay}</span>
                        <span class="progress-stat-label">Avg / Day</span>
                    </div>
                </div>
                <div class="progress-stat">
                    <i class="fas fa-bolt"></i>
                    <div>
                        <span class="progress-stat-value">+${bestDay}</span>
                        <span class="progress-stat-label">Best Day</span>
                    </div>
                </div>
                <div class="progress-stat">
                    <i class="fas fa-link"></i>
                    <div>
                        <span class="progress-stat-value">${trackingStreak}d</span>
                        <span class="progress-stat-label">Tracking Streak</span>
                    </div>
                </div>
            `;
            summaryEl.classList.remove('hidden');
        } else {
            summaryEl.classList.add('hidden');
        }
    }

    // --- Render table ---
    if (history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:24px;">
            No history yet. Data is recorded each time you refresh.</td></tr>`;
    } else {
        const calToday = (typeof getLCTodayFromCalendar === 'function') ? getLCTodayFromCalendar() : 0;

        tbody.innerHTML = history.slice().reverse().map((h, i, arr) => {
            const prev  = arr[i + 1];
            const lcVal  = parseInt(h.lc) || 0;
            const gfgVal = parseInt(h.gfg) || 0;
            const totalVal = lcVal + gfgVal;
            const prevLc  = prev ? (parseInt(prev.lc) || 0) : lcVal;
            const prevGfg = prev ? (parseInt(prev.gfg) || 0) : gfgVal;
            let lcDelta  = lcVal - prevLc;
            const gfgDelta = gfgVal - prevGfg;

            const isToday = h.date === todayStr;

            // For today: cross-check with LC calendar (API totalSolved may lag behind)
            if (isToday && calToday > Math.max(0, lcDelta)) {
                lcDelta = calToday;
            }

            const dayTotal = Math.max(0, lcDelta) + Math.max(0, gfgDelta);

            const fmtDelta = (d) => {
                if (d > 0) return `<span class="delta-positive">+${d}</span>`;
                if (d < 0) return `<span class="delta-negative">${d}</span>`;
                return `<span class="delta-zero">0</span>`;
            };

            const rowClass = isToday ? 'today-row' : '';

            return `<tr class="${rowClass}">
                <td class="date-cell">${isToday ? '<i class="fas fa-circle today-dot"></i>' : ''}${formatDate(h.date)}</td>
                <td><span class="platform-badge lc-badge">${lcVal}</span></td>
                <td>${fmtDelta(lcDelta)}</td>
                <td><span class="platform-badge gfg-badge">${gfgVal}</span></td>
                <td>${fmtDelta(gfgDelta)}</td>
                <td><strong>${totalVal}</strong></td>
                <td class="day-total-cell">${dayTotal > 0 ? `<span class="day-total-badge">+${dayTotal}</span>` : `<span class="delta-zero">—</span>`}</td>
            </tr>`;
        }).join('');
    }
    renderHistoryChart(history);
}

function renderHistoryChart(history) {
    const canvas = document.getElementById('history-chart');
    if (!canvas) return;
    if (historyChart) historyChart.destroy();

    if (history.length === 0) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#55557a';
        ctx.font = '14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Solve problems & refresh to see your daily chart!', canvas.width / 2, 130);
        return;
    }

    // Compute daily deltas for bar chart
    const labels = [];
    const lcDaily = [];
    const gfgDaily = [];
    const todayStr = new Date().toISOString().split('T')[0];
    const calendarToday = (typeof getLCTodayFromCalendar === 'function') ? getLCTodayFromCalendar() : 0;

    for (let i = 0; i < history.length; i++) {
        labels.push(formatDate(history[i].date));
        const lcVal  = parseInt(history[i].lc) || 0;
        const gfgVal = parseInt(history[i].gfg) || 0;

        if (i === 0) {
            // First entry — use calendar for today, else 0
            const isToday = history[i].date === todayStr;
            lcDaily.push(isToday ? calendarToday : 0);
            gfgDaily.push(0);
        } else {
            const prevLc  = parseInt(history[i - 1].lc) || 0;
            const prevGfg = parseInt(history[i - 1].gfg) || 0;
            let lcDelta = Math.max(0, lcVal - prevLc);
            const gfgDelta = Math.max(0, gfgVal - prevGfg);

            // For today: cross-check with LC calendar (more accurate, updates faster)
            if (history[i].date === todayStr && calendarToday > lcDelta) {
                lcDelta = calendarToday;
            }

            lcDaily.push(lcDelta);
            gfgDaily.push(gfgDelta);
        }
    }

    // Max daily value for nice Y axis
    const maxDaily = Math.max(1, ...lcDaily.map((v, i) => v + (gfgDaily[i] || 0)));

    historyChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'LeetCode',
                    data: lcDaily,
                    backgroundColor: 'rgba(253, 203, 110, 0.85)',
                    borderColor: '#fdcb6e',
                    borderWidth: 1.5,
                    borderRadius: 8,
                    borderSkipped: false,
                    stack: 'daily',
                    maxBarThickness: 48,
                    barPercentage: 0.6,
                    categoryPercentage: 0.5,
                },
                {
                    label: 'GFG',
                    data: gfgDaily,
                    backgroundColor: 'rgba(0, 184, 148, 0.85)',
                    borderColor: '#00b894',
                    borderWidth: 1.5,
                    borderRadius: 8,
                    borderSkipped: false,
                    stack: 'daily',
                    maxBarThickness: 48,
                    barPercentage: 0.6,
                    categoryPercentage: 0.5,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: {
                    labels: {
                        color: '#8888a8',
                        font: { family: 'Inter', size: 12 },
                        usePointStyle: true,
                        pointStyle: 'rectRounded',
                        padding: 16,
                    },
                },
                tooltip: {
                    backgroundColor: '#1a1a2e',
                    titleColor: '#e8e8f0',
                    bodyColor: '#8888a8',
                    borderColor: '#2a2a45',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    callbacks: {
                        afterBody: function(items) {
                            const idx = items[0]?.dataIndex;
                            if (idx == null) return '';
                            const dayTotal = (lcDaily[idx] || 0) + (gfgDaily[idx] || 0);
                            return `\n📊 Day total: ${dayTotal} problem${dayTotal !== 1 ? 's' : ''}`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    ticks: { color: '#55557a', font: { size: 11 } },
                    grid: { color: 'rgba(42,42,69,0.3)' },
                },
                y: {
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Problems Solved',
                        color: '#55557a',
                        font: { size: 11, family: 'Inter' },
                    },
                    ticks: {
                        color: '#55557a',
                        font: { size: 11 },
                        stepSize: 1,
                        beginAtZero: true,
                    },
                    grid: { color: 'rgba(42,42,69,0.3)' },
                    stacked: true,
                    suggestedMax: maxDaily + 2,
                },
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
