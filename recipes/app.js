const DATA_DIR = 'data/';
const FILE_CACHE_KEY = 'recipes:files';
const checksKey = (slug) => `recipes:checks:${slug}`;
const CATEGORY_GRADIENTS = [
    ['#f97316', '#facc15'],
    ['#7c5cff', '#22d3ee'],
    ['#10b981', '#a3e635'],
    ['#ec4899', '#f97316'],
    ['#0ea5e9', '#6366f1'],
    ['#eab308', '#ef4444'],
];

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isRecipeFile = (name) => name.endsWith('.json') && !name.startsWith('_');

const store = {
    get(key, fallback) {
        try {
            const value = localStorage.getItem(key);
            return value === null ? fallback : JSON.parse(value);
        } catch {
            return fallback;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // Nothing to do: the page works without storage, it just forgets.
        }
    },
};

let recipes = [];
let activeCategory = 'All';
let listScroll = 0;
let wakeLock = null;
let wantAwake = false;

// GitHub Pages can't list a folder, so on the live site ask the GitHub API what's in it.
async function listFromGitHub() {
    const host = location.hostname;
    if (!host.endsWith('.github.io')) return null;
    const owner = host.slice(0, -'.github.io'.length);
    const dir = new URL(DATA_DIR, location.href).pathname.replace(/^\/|\/$/g, '');
    const response = await fetch(`https://api.github.com/repos/${owner}/${host}/contents/${dir}`);
    if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
    const entries = await response.json();
    return entries.filter((e) => e.type === 'file').map((e) => e.name).filter(isRecipeFile);
}

// Local servers such as `python3 -m http.server` return an HTML index for a folder.
async function listFromDirectoryPage() {
    const response = await fetch(DATA_DIR);
    if (!response.ok) throw new Error(`Folder listing returned ${response.status}`);
    const page = new DOMParser().parseFromString(await response.text(), 'text/html');
    return [...page.querySelectorAll('a[href]')]
        .map((a) => decodeURIComponent(a.getAttribute('href').split('/').filter(Boolean).pop() || ''))
        .filter(isRecipeFile);
}

async function listRecipeFiles() {
    const problems = [];
    for (const source of [listFromGitHub, listFromDirectoryPage]) {
        try {
            const files = await source();
            if (files && files.length) {
                const unique = [...new Set(files)];
                store.set(FILE_CACHE_KEY, unique);
                return unique;
            }
        } catch (error) {
            problems.push(error.message);
        }
    }
    const cached = store.get(FILE_CACHE_KEY, null);
    if (cached && cached.length) return cached;
    throw new Error(problems.join('; ') || 'no recipe files found');
}

function normalise(raw, file) {
    if (!raw || typeof raw.title !== 'string' || !raw.title.trim()) throw new Error('needs a "title"');
    if (!Array.isArray(raw.ingredients) || !raw.ingredients.length) throw new Error('needs an "ingredients" list');
    if (!Array.isArray(raw.steps) || !raw.steps.length) throw new Error('needs a "steps" list');

    const groups = [];
    for (const entry of raw.ingredients) {
        if (typeof entry === 'string') {
            if (!groups.length || groups[groups.length - 1].name) groups.push({ name: null, items: [] });
            groups[groups.length - 1].items.push(entry);
        } else if (entry && Array.isArray(entry.items)) {
            groups.push({ name: entry.group || null, items: entry.items.map(String) });
        } else {
            throw new Error('each ingredient must be text or { "group", "items" }');
        }
    }
    const steps = raw.steps.map((step) => (typeof step === 'string'
        ? { title: null, text: step }
        : { title: step.title || null, text: String(step.text || '') }));

    const recipe = {
        slug: file.replace(/\.json$/, ''),
        title: raw.title.trim(),
        altName: raw.altName || '',
        emoji: raw.emoji || '🍽️',
        category: raw.category || 'Other',
        description: raw.description || '',
        tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
        groups,
        steps,
        tips: Array.isArray(raw.tips) ? raw.tips.map(String) : [],
    };
    recipe.ingredientCount = groups.reduce((n, g) => n + g.items.length, 0);
    recipe.searchText = [
        recipe.title, recipe.altName, recipe.category, recipe.description, ...recipe.tags,
        ...groups.flatMap((g) => g.items),
    ].join(' ').toLowerCase();
    return recipe;
}

async function loadRecipes() {
    const files = await listRecipeFiles();
    const results = await Promise.allSettled(files.map(async (file) => {
        const response = await fetch(DATA_DIR + encodeURIComponent(file));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        let raw;
        try {
            raw = JSON.parse(await response.text());
        } catch (error) {
            throw new Error(`isn't valid JSON (${error.message})`);
        }
        return normalise(raw, file);
    }));

    const warnings = [];
    results.forEach((result, i) => {
        if (result.status === 'rejected') warnings.push(`${files[i]}: ${result.reason.message}`);
    });
    const loaded = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    return { loaded: loaded.sort((a, b) => a.title.localeCompare(b.title)), warnings };
}

function gradientFor(category) {
    const categories = [...new Set(recipes.map((r) => r.category))].sort();
    const [from, to] = CATEGORY_GRADIENTS[categories.indexOf(category) % CATEGORY_GRADIENTS.length];
    return `--from:${from};--to:${to}`;
}

function renderCategories() {
    const categories = ['All', ...new Set(recipes.map((r) => r.category).sort())];
    $('categories').innerHTML = categories.map((c) => {
        const count = c === 'All' ? recipes.length : recipes.filter((r) => r.category === c).length;
        return `<button class="chip${c === activeCategory ? ' active' : ''}" data-category="${escapeHtml(c)}">${escapeHtml(c)} <span>${count}</span></button>`;
    }).join('');
}

function renderGrid() {
    const terms = $('search').value.toLowerCase().split(/\s+/).filter(Boolean);
    const visible = recipes.filter((r) =>
        (activeCategory === 'All' || r.category === activeCategory)
        && terms.every((t) => r.searchText.includes(t)));

    $('grid').innerHTML = visible.map((r, i) => `
        <a class="recipe-card" href="#/${encodeURIComponent(r.slug)}" style="${gradientFor(r.category)};animation-delay:${i * 40}ms">
            <span class="recipe-art" aria-hidden="true">${escapeHtml(r.emoji)}</span>
            <span class="recipe-body">
                <span class="recipe-category">${escapeHtml(r.category)}</span>
                <strong>${escapeHtml(r.title)}</strong>
                ${r.altName ? `<em>${escapeHtml(r.altName)}</em>` : ''}
                <span class="recipe-desc">${escapeHtml(r.description)}</span>
                <span class="recipe-meta">${r.ingredientCount} ingredients · ${r.steps.length} steps</span>
            </span>
        </a>`).join('');

    $('count').textContent = `${visible.length} of ${recipes.length} recipes`;
    $('empty').hidden = visible.length > 0 || !recipes.length;
}

function renderWarnings(warnings) {
    $('warnings').hidden = !warnings.length;
    $('warnings').innerHTML = warnings.length
        ? `<strong>Some recipe files couldn't be read:</strong><ul>${warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>`
        : '';
}

function renderDetail(recipe) {
    const checks = store.get(checksKey(recipe.slug), { ingredients: [], steps: [] });
    const index = recipes.indexOf(recipe);
    const prev = recipes[(index - 1 + recipes.length) % recipes.length];
    const next = recipes[(index + 1) % recipes.length];
    let n = 0;

    const ingredients = recipe.groups.map((g) => `
        ${g.name ? `<h3>${escapeHtml(g.name)}</h3>` : ''}
        <ul class="checklist">
            ${g.items.map((item) => {
                const i = n++;
                return `<li><label><input type="checkbox" data-ingredient="${i}" ${checks.ingredients.includes(i) ? 'checked' : ''}><span>${escapeHtml(item)}</span></label></li>`;
            }).join('')}
        </ul>`).join('');

    const steps = recipe.steps.map((s, i) => `
        <li class="${checks.steps.includes(i) ? 'done' : ''}" data-step="${i}" tabindex="0" role="button" aria-pressed="${checks.steps.includes(i)}">
            <span class="step-num">${i + 1}</span>
            <div>${s.title ? `<strong>${escapeHtml(s.title)}</strong>` : ''}<p>${escapeHtml(s.text)}</p></div>
        </li>`).join('');

    $('detail-view').innerHTML = `
        <a class="back" href="#/">← All recipes</a>
        <header class="detail-head" style="${gradientFor(recipe.category)}">
            <span class="detail-art" aria-hidden="true">${escapeHtml(recipe.emoji)}</span>
            <div>
                <p class="eyebrow">${escapeHtml(recipe.category)}</p>
                <h1>${escapeHtml(recipe.title)}</h1>
                ${recipe.altName ? `<p class="alt-name">${escapeHtml(recipe.altName)}</p>` : ''}
                ${recipe.description ? `<p class="lead">${escapeHtml(recipe.description)}</p>` : ''}
                ${recipe.tags.length ? `<ul class="tags">${recipe.tags.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : ''}
            </div>
        </header>

        <div class="detail-actions">
            <button class="btn ghost" id="wake" type="button" hidden>☀️ Keep screen on</button>
            <button class="btn ghost" id="reset-checks" type="button">↺ Clear ticks</button>
            <button class="btn ghost" id="copy-link" type="button">🔗 Copy link</button>
            <button class="btn ghost" id="print" type="button">🖨️ Print</button>
        </div>

        <div class="detail-body">
            <section class="panel ingredients">
                <div class="panel-head">
                    <h2>Ingredients</h2>
                    <span class="progress" id="ingredient-progress"></span>
                </div>
                ${ingredients}
            </section>
            <section class="panel method">
                <div class="panel-head">
                    <h2>Method</h2>
                    <span class="progress" id="step-progress"></span>
                </div>
                <ol class="steps">${steps}</ol>
                ${recipe.tips.length ? `<aside class="tips"><strong>💡 Tips</strong><ul>${recipe.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul></aside>` : ''}
            </section>
        </div>

        ${recipes.length > 1 ? `
        <nav class="pager" aria-label="More recipes">
            <a href="#/${encodeURIComponent(prev.slug)}"><span>← Previous</span><strong>${escapeHtml(prev.emoji)} ${escapeHtml(prev.title)}</strong></a>
            <a href="#/${encodeURIComponent(next.slug)}"><span>Next →</span><strong>${escapeHtml(next.emoji)} ${escapeHtml(next.title)}</strong></a>
        </nav>` : ''}`;

    updateProgress(recipe);
    wireDetail(recipe);
}

function readChecks() {
    return {
        ingredients: [...document.querySelectorAll('[data-ingredient]:checked')].map((el) => Number(el.dataset.ingredient)),
        steps: [...document.querySelectorAll('[data-step].done')].map((el) => Number(el.dataset.step)),
    };
}

function updateProgress(recipe) {
    const { ingredients, steps } = readChecks();
    $('ingredient-progress').textContent = `${ingredients.length}/${recipe.ingredientCount} ready`;
    $('step-progress').textContent = `${steps.length}/${recipe.steps.length} done`;
    const current = document.querySelector('[data-step]:not(.done)');
    document.querySelectorAll('[data-step]').forEach((el) => el.classList.toggle('current', el === current));
}

function saveChecks(recipe) {
    store.set(checksKey(recipe.slug), readChecks());
    updateProgress(recipe);
}

function toggleStep(el, recipe) {
    el.classList.toggle('done');
    el.setAttribute('aria-pressed', el.classList.contains('done'));
    saveChecks(recipe);
}

function wireDetail(recipe) {
    const view = $('detail-view');
    view.querySelectorAll('[data-ingredient]').forEach((box) =>
        box.addEventListener('change', () => saveChecks(recipe)));
    view.querySelectorAll('[data-step]').forEach((el) => {
        el.addEventListener('click', () => toggleStep(el, recipe));
        el.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleStep(el, recipe);
            }
        });
    });

    $('reset-checks').addEventListener('click', () => {
        view.querySelectorAll('[data-ingredient]').forEach((box) => { box.checked = false; });
        view.querySelectorAll('[data-step]').forEach((el) => {
            el.classList.remove('done');
            el.setAttribute('aria-pressed', 'false');
        });
        saveChecks(recipe);
    });

    $('copy-link').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        try {
            await navigator.clipboard.writeText(location.href);
            button.textContent = '✓ Link copied';
        } catch {
            button.textContent = 'Copy the address bar';
        }
        setTimeout(() => { button.textContent = '🔗 Copy link'; }, 2000);
    });

    $('print').addEventListener('click', () => window.print());

    if ('wakeLock' in navigator) {
        $('wake').hidden = false;
        updateWakeButton();
        $('wake').addEventListener('click', async () => {
            wantAwake = !wantAwake;
            if (wantAwake) await requestWakeLock();
            else await releaseWakeLock();
            updateWakeButton();
        });
    }
}

async function requestWakeLock() {
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
            wakeLock = null;
            updateWakeButton();
        });
    } catch {
        wantAwake = false;
    }
}

async function releaseWakeLock() {
    wantAwake = false;
    if (wakeLock) await wakeLock.release();
    wakeLock = null;
}

function updateWakeButton() {
    const button = $('wake');
    if (!button) return;
    const on = Boolean(wakeLock);
    button.classList.toggle('on', on);
    button.textContent = on ? '☀️ Screen stays on' : '☀️ Keep screen on';
    button.setAttribute('aria-pressed', on);
}

// The browser drops the wake lock when the tab is hidden, so take it again on return.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wantAwake && !wakeLock) {
        requestWakeLock().then(updateWakeButton);
    }
});

function route() {
    const slug = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    const recipe = slug && recipes.find((r) => r.slug === slug);
    const showingList = !$('list-view').hidden;

    if (recipe) {
        if (showingList) listScroll = scrollY;
        $('list-view').hidden = true;
        $('detail-view').hidden = false;
        renderDetail(recipe);
        document.title = `${recipe.title} · Recipes`;
        scrollTo(0, 0);
    } else {
        releaseWakeLock();
        $('detail-view').hidden = true;
        $('list-view').hidden = false;
        document.title = 'Recipes · Badrri Narayanan';
        if (!showingList) scrollTo(0, listScroll);
    }
}

$('search').addEventListener('input', renderGrid);

$('categories').addEventListener('click', (event) => {
    const chip = event.target.closest('[data-category]');
    if (!chip) return;
    activeCategory = chip.dataset.category;
    renderCategories();
    renderGrid();
});

$('surprise').addEventListener('click', () => {
    if (!recipes.length) return;
    location.hash = `#/${encodeURIComponent(recipes[Math.floor(Math.random() * recipes.length)].slug)}`;
});

document.addEventListener('keydown', (event) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (event.key === '/' && !typing && !$('list-view').hidden) {
        event.preventDefault();
        $('search').focus();
    } else if (event.key === 'Escape' && !$('detail-view').hidden) {
        location.hash = '#/';
    } else if (event.key === 'Escape' && document.activeElement === $('search')) {
        $('search').value = '';
        renderGrid();
    }
});

window.addEventListener('hashchange', route);
$('year').textContent = new Date().getFullYear();

loadRecipes()
    .then(({ loaded, warnings }) => {
        recipes = loaded;
        renderCategories();
        renderGrid();
        renderWarnings(warnings);
        if (!recipes.length) $('count').textContent = 'No recipes yet. Add a JSON file to recipes/data/.';
        route();
    })
    .catch((error) => {
        $('count').textContent = '';
        renderWarnings([`Couldn't load the recipe list: ${error.message}`]);
    });
