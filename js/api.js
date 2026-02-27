/* ========================================
   CodeTrack — API Layer
   LeetCode & GFG data fetchers
   Fixed GFG with multiple fallbacks
   ======================================== */

// ─── LC API mirrors — tried in order ───
const LC_API_BASES = [
    'https://alfa-leetcode-api.onrender.com',
    'https://leetcode-api-faisalshohag.vercel.app',
];

const API = {
    leetcode: {
        profile: (base, u) => `${base}/userProfile/${u}`,
        solved:  (base, u) => `${base}/${u}/solved`,
        skills:  (base, u) => `${base}/skillStats/${u}`,
        calendar:(base, u) => `${base}/${u}/calendar`,
        profileUrl: (u) => `https://leetcode.com/u/${u}/`,
    },
    gfg: {
        authApi: (u) => `https://authapi.geeksforgeeks.org/api-get/user-profile-info/?handle=${u}`,
        profileUrl: (u) => `https://www.geeksforgeeks.org/profile/${u}`,
    },
};

// CORS proxy list — try in order
const CORS_PROXIES = [
    { name: 'codetabs', url: (target) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(target)}`, type: 'direct' },
    { name: 'allorigins', url: (target) => `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`, type: 'wrapped' },
    { name: 'corsproxy', url: (target) => `https://corsproxy.io/?${encodeURIComponent(target)}`, type: 'direct' },
];

// ─── Safe JSON fetch with timeout + status check ───
async function safeFetchJSON(url, timeoutMs = 12000) {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text.substring(0, 120)}`);
    }
    return res.json();
}

// ─── LC cache in localStorage ───
function cacheLCData(data) {
    try { localStorage.setItem('ct_lc_cache', JSON.stringify({ ts: Date.now(), data })); } catch(e) {}
}
function getCachedLC() {
    try {
        const c = JSON.parse(localStorage.getItem('ct_lc_cache'));
        if (c && c.data && (Date.now() - c.ts) < 3600000) return c.data; // valid for 1 hour
    } catch(e) {}
    return null;
}

// ─── Parse submissionCalendar (handles JSON string, Python dict string, or object) ───
function parseSubmissionCalendar(raw) {
    if (!raw) return {};
    if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch(e) {}
        try { return JSON.parse(raw.replace(/'/g, '"').replace(/None/g, 'null').replace(/True/g, 'true').replace(/False/g, 'false')); } catch(e2) {}
    }
    return {};
}

// ─── Compute streak from submissionCalendar ───
function computeStreakFromCalendar(cal) {
    if (!cal || Object.keys(cal).length === 0) return 0;

    // Collect all active dates as "YYYY-MM-DD" strings (UTC)
    const activeDates = new Set();
    for (const [ts, count] of Object.entries(cal)) {
        if (parseInt(count) > 0) {
            const d = new Date(parseInt(ts) * 1000);
            activeDates.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`);
        }
    }
    if (activeDates.size === 0) return 0;

    const now = new Date();
    const fmt = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
    let checkDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    // If no submission today, start counting from yesterday
    if (!activeDates.has(fmt(checkDate))) {
        checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    }

    let streak = 0;
    while (activeDates.has(fmt(checkDate))) {
        streak++;
        checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    }
    return streak;
}

// ─── Compute total active days from submissionCalendar ───
function computeActiveDays(cal) {
    if (!cal) return 0;
    return Object.values(cal).filter(v => parseInt(v) > 0).length;
}

/* ── LeetCode ─────────────────────────── */
async function fetchLeetCodeAPI(username) {
    let profile = {}, solved = {}, skills = {}, calendar = {};
    let succeeded = false;

    // ── Attempt 1: Primary API (alfa-leetcode-api) with split endpoints ──
    const primaryBase = LC_API_BASES[0];
    try {
        console.log(`[LC] Trying primary API: ${primaryBase}`);
        const [profileRes, solvedRes, skillsRes, calendarRes] = await Promise.allSettled([
            safeFetchJSON(API.leetcode.profile(primaryBase, username)),
            safeFetchJSON(API.leetcode.solved(primaryBase, username)),
            safeFetchJSON(API.leetcode.skills(primaryBase, username)),
            safeFetchJSON(API.leetcode.calendar(primaryBase, username)),
        ]);

        profile  = profileRes.status  === 'fulfilled' ? profileRes.value  : {};
        solved   = solvedRes.status   === 'fulfilled' ? solvedRes.value   : {};
        skills   = skillsRes.status   === 'fulfilled' ? skillsRes.value   : {};
        calendar = calendarRes.status === 'fulfilled' ? calendarRes.value : {};

        if (profile.totalSolved != null || solved.solvedProblem != null) {
            console.log(`[LC] ✅ Primary API returned data`);
            succeeded = true;
        } else {
            console.log(`[LC] ⚠️ Primary API returned empty data`);
        }
    } catch(e) {
        console.log(`[LC] ❌ Primary API failed: ${e.message}`);
    }

    // ── Attempt 2: Fallback single-endpoint API ──
    if (!succeeded) {
        const fallbackBase = LC_API_BASES[1];
        try {
            console.log(`[LC] Trying fallback API: ${fallbackBase}`);
            const data = await safeFetchJSON(`${fallbackBase}/${username}`, 15000);
            if (data && data.totalSolved != null) {
                console.log(`[LC] ✅ Fallback API returned data`);
                // Map single-endpoint response to our expected shape
                profile = data;
                solved  = data;
                skills  = {};
                calendar = {
                    submissionCalendar: data.submissionCalendar || {},
                    streak: data.streak || 0,
                    totalActiveDays: data.totalActiveDays || 0,
                };
                succeeded = true;
            }
        } catch(e) {
            console.log(`[LC] ❌ Fallback API failed: ${e.message}`);
        }
    }

    // ── Attempt 3: Use cached data ──
    if (!succeeded) {
        const cached = getCachedLC();
        if (cached) {
            console.log('[LC] 📦 Using cached data (API rate-limited or down)');
            cached._fromCache = true;
            return cached;
        }
        throw new Error('All LeetCode API mirrors failed and no cache available');
    }

    // Submission calendar — try multiple sources, handle Python dict strings
    let submissionCalendar = {};
    const rawCal = calendar.submissionCalendar || profile.submissionCalendar;
    submissionCalendar = parseSubmissionCalendar(rawCal);

    // Topic tags
    const topicTags = [];
    try {
        const td = skills?.matchedUser?.tagProblemCounts;
        if (td) {
            ['fundamental','intermediate','advanced'].forEach(lvl => {
                (td[lvl] || []).forEach(t =>
                    topicTags.push({ name: t.tagName, count: t.problemsSolved, level: lvl })
                );
            });
        }
    } catch(e) {}
    topicTags.sort((a, b) => b.count - a.count);

    const result = {
        totalSolved:   parseInt(profile.totalSolved ?? solved.solvedProblem ?? 0) || 0,
        easySolved:    parseInt(profile.easySolved ?? solved.easySolved ?? 0) || 0,
        mediumSolved:  parseInt(profile.mediumSolved ?? solved.mediumSolved ?? 0) || 0,
        hardSolved:    parseInt(profile.hardSolved ?? solved.hardSolved ?? 0) || 0,
        totalQuestions: parseInt(profile.totalQuestions ?? 0) || 0,
        easyTotal:     parseInt(profile.totalEasy ?? 0) || 0,
        mediumTotal:   parseInt(profile.totalMedium ?? 0) || 0,
        hardTotal:     parseInt(profile.totalHard ?? 0) || 0,
        acceptanceRate: (() => {
            if (profile.acceptanceRate != null) return parseFloat(profile.acceptanceRate).toFixed(1) + '%';
            // Compute from totalSubmissions if available (Vercel fallback)
            const ts = profile.totalSubmissions;
            if (Array.isArray(ts) && ts[0] && ts[0].submissions > 0) {
                return ((ts[0].count / ts[0].submissions) * 100).toFixed(1) + '%';
            }
            return '—';
        })(),
        ranking: profile.ranking ?? '—',
        contributionPoints: parseInt(profile.contributionPoint ?? profile.contributionPoints ?? 0) || 0,
        reputation: parseInt(profile.reputation ?? 0) || 0,
        streak:          computeStreakFromCalendar(submissionCalendar),
        totalActiveDays: computeActiveDays(submissionCalendar),
        submissionCalendar,
        topicTags,
        recentSubmissions: profile.recentSubmissions ?? [],
        _fromCache: false,
    };

    cacheLCData(result);
    return result;
}

/* ── GFG ──────────────────────────────── */
async function fetchGFGAPI(username) {
    const apiUrl = API.gfg.authApi(username);
    console.log('[GFG] Fetching data for:', username);

    // Attempt 1: Direct API call
    try {
        console.log('[GFG] Attempt 1: Direct API...');
        const res = await fetch(apiUrl, { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
            const d = await res.json();
            console.log('[GFG] Direct API response:', d);
            if (d.data && d.message === 'data retrieved successfully') {
                console.log('[GFG] ✅ Direct API worked!');
                return parseGFGAuthData(d.data);
            }
        }
    } catch(e) { console.log('[GFG] Direct API failed (CORS expected):', e.message); }

    // Attempt 2-4: Try each CORS proxy
    for (const proxy of CORS_PROXIES) {
        try {
            console.log(`[GFG] Trying ${proxy.name} proxy...`);
            const proxyUrl = proxy.url(apiUrl);
            const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
            
            if (res.ok) {
                if (proxy.type === 'wrapped') {
                    // allorigins wraps response in { contents: "..." }
                    const wrapper = await res.json();
                    if (wrapper.contents) {
                        const d = JSON.parse(wrapper.contents);
                        console.log(`[GFG] ${proxy.name} proxy response:`, d);
                        if (d.data) {
                            console.log(`[GFG] ✅ ${proxy.name} proxy worked!`);
                            return parseGFGAuthData(d.data);
                        }
                    }
                } else {
                    // direct proxy returns JSON as-is
                    const text = await res.text();
                    try {
                        const d = JSON.parse(text);
                        console.log(`[GFG] ${proxy.name} proxy response:`, d);
                        if (d.data) {
                            console.log(`[GFG] ✅ ${proxy.name} proxy worked!`);
                            return parseGFGAuthData(d.data);
                        }
                    } catch(parseErr) {
                        // Maybe it returned HTML — try scraping
                        if (text.includes('total_problems_solved')) {
                            console.log(`[GFG] ${proxy.name} returned text with data, parsing...`);
                            return parseGFGHTML(text);
                        }
                    }
                }
            }
        } catch(e) { console.log(`[GFG] ${proxy.name} proxy failed:`, e.message); }
    }

    // Attempt 5: Scrape profile page via proxy
    try {
        console.log('[GFG] Attempt: Scraping profile page...');
        const profileUrl = API.gfg.profileUrl(username);
        const proxyUrl = CORS_PROXIES[0].url(profileUrl);
        const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
        if (res.ok) {
            const html = await res.text();
            const parsed = parseGFGHTML(html);
            if (parsed.totalProblemsSolved > 0) {
                console.log('[GFG] ✅ Profile scrape worked!');
                return parsed;
            }
        }
    } catch(e) { console.log('[GFG] Profile scrape failed:', e.message); }

    throw new Error('Could not fetch GFG data after all attempts.');
}

function parseGFGAuthData(d) {
    console.log('[GFG] Parsing auth data:', JSON.stringify(d).substring(0, 300));
    return {
        totalProblemsSolved: parseInt(d.total_problems_solved ?? 0) || 0,
        school:  0,
        basic:   0,
        easy:    0,
        medium:  0,
        hard:    0,
        codingScore:   d.score ?? '—',
        monthlyScore:  parseInt(d.monthly_score ?? 0) || 0,
        currentStreak: parseInt(d.pod_solved_current_streak ?? 0) || 0,
        maxStreak:     parseInt(d.pod_solved_longest_streak ?? 0) || 0,
        instituteRank: d.institute_rank ?? '—',
        instituteName: d.institute_name ?? '',
        languages:     d.languages_used ? Object.keys(d.languages_used) : [],
    };
}

function parseGFGHTML(html) {
    const match  = html.match(/"total_problems_solved"\s*:\s*(\d+)/);
    const score  = html.match(/"score"\s*:\s*(\d+)/);
    const rank   = html.match(/"institute_rank"\s*:\s*(\d+)/);
    const streak = html.match(/"pod_solved_current_streak"\s*:\s*(\d+)/);
    const maxStr = html.match(/"pod_solved_longest_streak"\s*:\s*(\d+)/);
    const inst   = html.match(/"institute_name"\s*:\s*"([^"]+)"/);

    return {
        totalProblemsSolved: match  ? parseInt(match[1])  : 0,
        school: 0, basic: 0, easy: 0, medium: 0, hard: 0,
        codingScore:   score  ? score[1]  : '—',
        monthlyScore:  0,
        currentStreak: streak ? parseInt(streak[1]) : 0,
        maxStreak:     maxStr ? parseInt(maxStr[1]) : 0,
        instituteRank: rank   ? rank[1]   : '—',
        instituteName: inst   ? inst[1]   : '',
        languages:     [],
    };
}
