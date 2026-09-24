const DAY_MS = 86_400_000;
const YEAR_MS = 365.25 * DAY_MS;
const RING_CIRCUMFERENCE = 2 * Math.PI * 52;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Each entry is the sign that starts in that month, and the day it starts.
const ZODIAC = [
    ['Aquarius', '♒', 20], ['Pisces', '♓', 19], ['Aries', '♈', 21], ['Taurus', '♉', 20],
    ['Gemini', '♊', 21], ['Cancer', '♋', 21], ['Leo', '♌', 23], ['Virgo', '♍', 23],
    ['Libra', '♎', 23], ['Scorpio', '♏', 23], ['Sagittarius', '♐', 22], ['Capricorn', '♑', 22],
];
const CHINESE_ZODIAC = [
    ['Rat', '🐀'], ['Ox', '🐂'], ['Tiger', '🐅'], ['Rabbit', '🐇'], ['Dragon', '🐉'], ['Snake', '🐍'],
    ['Horse', '🐎'], ['Goat', '🐐'], ['Monkey', '🐒'], ['Rooster', '🐓'], ['Dog', '🐕'], ['Pig', '🐖'],
];
const PLANETS = [
    { name: 'Mercury', orbit: 0.2408467 },
    { name: 'Venus', orbit: 0.61519726 },
    { name: 'Earth', orbit: 1 },
    { name: 'Mars', orbit: 1.8808158 },
    { name: 'Jupiter', orbit: 11.862615 },
    { name: 'Saturn', orbit: 29.447498 },
];

const $ = (id) => document.getElementById(id);
const number = (n) => Math.floor(n).toLocaleString('en-US');
const longDate = (d) => d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

let dob = null;
let timer = null;

function parseBirth(dateValue, timeValue) {
    const [y, m, d] = dateValue.split('-').map(Number);
    const [hh, mm] = (timeValue || '00:00').split(':').map(Number);
    return new Date(y, m - 1, d, hh, mm);
}

function diffYMD(from, to) {
    let years = to.getFullYear() - from.getFullYear();
    let months = to.getMonth() - from.getMonth();
    let days = to.getDate() - from.getDate();
    if (days < 0) {
        months--;
        days += new Date(to.getFullYear(), to.getMonth(), 0).getDate();
    }
    if (months < 0) {
        years--;
        months += 12;
    }
    return { years, months, days };
}

// A 29 February birthday is celebrated on 28 February in non-leap years.
function birthdayIn(year) {
    const lastDay = new Date(year, dob.getMonth() + 1, 0).getDate();
    return new Date(year, dob.getMonth(), Math.min(dob.getDate(), lastDay), dob.getHours(), dob.getMinutes());
}

function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function westernSign(date) {
    const month = date.getMonth();
    return date.getDate() >= ZODIAC[month][2] ? ZODIAC[month] : ZODIAC[(month + 11) % 12];
}

// The Chinese year starts at Lunar New Year, so a January or early-February birth can belong to the previous year's animal.
function chineseSign(date) {
    let year = date.getFullYear();
    try {
        const part = new Intl.DateTimeFormat('en-u-ca-chinese', { year: 'numeric' })
            .formatToParts(date)
            .find((p) => p.type === 'relatedYear');
        if (part) year = Number(part.value);
    } catch {
        // Fall back to the Gregorian year.
    }
    return CHINESE_ZODIAC[(((year - 4) % 12) + 12) % 12];
}

function milestones() {
    const addDays = (n) => new Date(dob.getFullYear(), dob.getMonth(), dob.getDate() + n, dob.getHours(), dob.getMinutes());
    const addMonths = (n) => new Date(dob.getFullYear(), dob.getMonth() + n, dob.getDate(), dob.getHours(), dob.getMinutes());
    return [
        { label: '1,000 days old', date: addDays(1_000) },
        { label: '1,000 weeks old', date: addDays(7_000) },
        { label: '10,000 days old', date: addDays(10_000) },
        { label: '1 billion seconds old', date: new Date(dob.getTime() + 1e12) },
        { label: '500 months old', date: addMonths(500) },
        { label: '20,000 days old', date: addDays(20_000) },
        { label: '2 billion seconds old', date: new Date(dob.getTime() + 2e12) },
        { label: '30,000 days old', date: addDays(30_000) },
    ].sort((a, b) => a.date - b.date);
}

function renderStatic(now) {
    const age = diffYMD(dob, now);
    $('age-line').innerHTML = `<strong>${age.years}</strong> years <strong>${age.months}</strong> months <strong>${age.days}</strong> days`;
    $('age-sub').textContent = `You were born on a ${WEEKDAYS[dob.getDay()]}, ${dob.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}.`;

    const thisYears = birthdayIn(now.getFullYear());
    const isBirthday = isSameDay(thisYears, now);
    $('birthday-banner').hidden = !isBirthday;

    const lived = now - dob;
    const units = [
        ['months', age.years * 12 + age.months],
        ['weeks', lived / (7 * DAY_MS)],
        ['days', lived / DAY_MS],
        ['hours', lived / 3_600_000],
        ['minutes', lived / 60_000],
    ];
    $('totals').innerHTML = units.map(([unit, value]) =>
        `<div><strong>${number(value)}</strong><span>${unit}</span></div>`).join('');

    renderCalendar();
    renderSigns();
    renderMilestones(now);
    renderPlanets(lived);
    return isBirthday;
}

function renderLive() {
    const now = new Date();
    $('ticker').textContent = number((now - dob) / 1000);

    let next = birthdayIn(now.getFullYear());
    if (next <= now) next = birthdayIn(now.getFullYear() + 1);
    const previous = birthdayIn(next.getFullYear() - 1);
    const progress = (now - previous) / (next - previous);
    const remaining = next - now;

    $('ring-fill').style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);
    $('ring-days').textContent = Math.floor(remaining / DAY_MS);
    $('next-date').textContent = longDate(next);
    $('turning').textContent = `You'll turn ${next.getFullYear() - dob.getFullYear()} on a ${WEEKDAYS[next.getDay()]}.`;

    const parts = [
        ['days', Math.floor(remaining / DAY_MS)],
        ['hrs', Math.floor(remaining / 3_600_000) % 24],
        ['min', Math.floor(remaining / 60_000) % 60],
        ['sec', Math.floor(remaining / 1000) % 60],
    ];
    $('clock').innerHTML = parts.map(([unit, value]) =>
        `<div><strong>${String(value).padStart(2, '0')}</strong><span>${unit}</span></div>`).join('');
}

function renderCalendar() {
    const year = dob.getFullYear();
    const month = dob.getMonth();
    const offset = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const title = dob.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const cells = [
        ...WEEKDAYS.map((d) => `<span class="dow">${d.slice(0, 2)}</span>`),
        ...Array.from({ length: offset }, () => '<span></span>'),
        ...Array.from({ length: days }, (_, i) =>
            `<span class="${i + 1 === dob.getDate() ? 'day born-day' : 'day'}">${i + 1}</span>`),
    ];
    $('calendar').innerHTML = `<p class="cal-title">${title}</p><div class="cal-grid">${cells.join('')}</div>`;
}

function renderSigns() {
    const [western, symbol] = westernSign(dob);
    const [animal, emoji] = chineseSign(dob);
    $('signs').innerHTML = `
        <div class="sign"><span class="sign-icon">${symbol}</span><div><strong>${western}</strong><span>Star sign</span></div></div>
        <div class="sign"><span class="sign-icon">${emoji}</span><div><strong>Year of the ${animal}</strong><span>Chinese zodiac</span></div></div>`;
}

function renderMilestones(now) {
    const list = milestones();
    const nextIndex = list.findIndex((m) => m.date > now);
    $('milestones').innerHTML = list.map((m, i) => {
        const passed = m.date <= now;
        const daysAway = Math.ceil((m.date - now) / DAY_MS);
        const when = passed ? 'Reached' : daysAway === 1 ? 'Tomorrow' : `In ${number(daysAway)} days`;
        const cls = passed ? 'passed' : i === nextIndex ? 'next' : '';
        return `<li class="${cls}">
            <span class="dot" aria-hidden="true">${passed ? '✓' : ''}</span>
            <div><strong>${m.label}</strong><span>${longDate(m.date)}</span></div>
            <em>${when}</em>
        </li>`;
    }).join('');
}

function renderPlanets(lived) {
    const earthYears = lived / YEAR_MS;
    $('planets').innerHTML = PLANETS.map((p) => `
        <div class="planet">
            <span class="orb ${p.name.toLowerCase()}" aria-hidden="true"></span>
            <strong>${(earthYears / p.orbit).toFixed(p.orbit > 10 ? 2 : 1)}</strong>
            <span>${p.name} years</span>
        </div>`).join('');
}

function showError(message) {
    $('error').textContent = message;
    $('results').hidden = true;
    $('share').hidden = true;
    clearInterval(timer);
}

function calculate() {
    const dateValue = $('dob').value;
    if (!dateValue) return showError('Pick your date of birth first.');
    const candidate = parseBirth(dateValue, $('tob').value);
    if (Number.isNaN(candidate.getTime()) || candidate.getFullYear() < 1900) {
        return showError('That date doesn\'t look right.');
    }
    if (candidate > new Date()) return showError('That date is in the future. Time traveller?');

    dob = candidate;
    $('error').textContent = '';
    $('results').hidden = false;
    $('share').hidden = false;

    const isBirthday = renderStatic(new Date());
    renderLive();
    clearInterval(timer);
    let lastDay = new Date().getDate();
    timer = setInterval(() => {
        renderLive();
        const now = new Date();
        if (now.getDate() !== lastDay) {
            lastDay = now.getDate();
            renderStatic(now);
        }
    }, 1000);

    const hash = `dob=${dateValue}${$('tob').value ? `&tob=${$('tob').value}` : ''}`;
    history.replaceState(null, '', `#${hash}`);
    if (isBirthday) window.confetti();
}

$('dob-form').addEventListener('submit', (event) => {
    event.preventDefault();
    calculate();
});

$('share').addEventListener('click', async () => {
    const button = $('share');
    try {
        await navigator.clipboard.writeText(location.href);
        button.textContent = 'Link copied ✓';
    } catch {
        button.textContent = 'Copy the address bar';
    }
    setTimeout(() => { button.textContent = 'Copy share link'; }, 2000);
});

const today = new Date();
$('dob').max = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

const params = new URLSearchParams(location.hash.slice(1));
if (params.get('dob')) {
    $('dob').value = params.get('dob');
    $('tob').value = params.get('tob') || '';
    calculate();
}
