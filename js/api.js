/* ========================================
   CodeTrack — API Layer
   LeetCode & GFG data fetchers
   Fixed GFG with multiple fallbacks
   ======================================== */

const API = {
    leetcode: {
        profile: (u) => `https://alfa-leetcode-api.onrender.com/userProfile/${u}`,
        solved:  (u) => `https://alfa-leetcode-api.onrender.com/${u}/solved`,
        skills:  (u) => `https://alfa-leetcode-api.onrender.com/skillStats/${u}`,
        calendar:(u) => `https://alfa-leetcode-api.onrender.com/${u}/calendar`,
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

/* ── LeetCode ─────────────────────────── */
async function fetchLeetCodeAPI(username) {
    const [profileRes, solvedRes, skillsRes, calendarRes] = await Promise.allSettled([
        fetch(API.leetcode.profile(username)).then(r => r.json()),
        fetch(API.leetcode.solved(username)).then(r => r.json()),
        fetch(API.leetcode.skills(username)).then(r => r.json()),
        fetch(API.leetcode.calendar(username)).then(r => r.json()),
    ]);

    const profile  = profileRes.status  === 'fulfilled' ? profileRes.value  : {};
    const solved   = solvedRes.status   === 'fulfilled' ? solvedRes.value   : {};
    const skills   = skillsRes.status   === 'fulfilled' ? skillsRes.value   : {};
    const calendar = calendarRes.status === 'fulfilled' ? calendarRes.value : {};

    // Submission calendar
    let submissionCalendar = {};
    try {
        if (typeof calendar.submissionCalendar === 'string')
            submissionCalendar = JSON.parse(calendar.submissionCalendar);
        else if (profile.submissionCalendar && typeof profile.submissionCalendar === 'object')
            submissionCalendar = profile.submissionCalendar;
    } catch(e) {}

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

    return {
        totalSolved:   profile.totalSolved   ?? solved.solvedProblem ?? 0,
        easySolved:    profile.easySolved     ?? solved.easySolved   ?? 0,
        mediumSolved:  profile.mediumSolved   ?? solved.mediumSolved ?? 0,
        hardSolved:    profile.hardSolved     ?? solved.hardSolved   ?? 0,
        totalQuestions: profile.totalQuestions ?? 0,
        easyTotal:     profile.totalEasy      ?? 0,
        mediumTotal:   profile.totalMedium    ?? 0,
        hardTotal:     profile.totalHard      ?? 0,
        acceptanceRate: profile.acceptanceRate != null
            ? parseFloat(profile.acceptanceRate).toFixed(1) + '%' : '—',
        ranking: profile.ranking ?? '—',
        contributionPoints: profile.contributionPoint ?? profile.contributionPoints ?? 0,
        reputation: profile.reputation ?? 0,
        streak:          calendar.streak          ?? 0,
        totalActiveDays: calendar.totalActiveDays ?? 0,
        submissionCalendar,
        topicTags,
        recentSubmissions: profile.recentSubmissions ?? [],
    };
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
        totalProblemsSolved: d.total_problems_solved ?? 0,
        school:  0,
        basic:   0,
        easy:    0,
        medium:  0,
        hard:    0,
        codingScore:   d.score ?? '—',
        monthlyScore:  d.monthly_score ?? 0,
        currentStreak: d.pod_solved_current_streak ?? 0,
        maxStreak:     d.pod_solved_longest_streak ?? '—',
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
        maxStreak:     maxStr ? maxStr[1] : '—',
        instituteRank: rank   ? rank[1]   : '—',
        instituteName: inst   ? inst[1]   : '',
        languages:     [],
    };
}
