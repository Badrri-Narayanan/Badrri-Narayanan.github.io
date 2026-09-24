const MOVES = {
    rock:     { emoji: '✊', key: 'r', beats: { scissors: 'crushes', lizard: 'crushes' } },
    paper:    { emoji: '✋', key: 'p', beats: { rock: 'covers', spock: 'disproves' } },
    scissors: { emoji: '✌️', key: 's', beats: { paper: 'cuts', lizard: 'decapitates' } },
    lizard:   { emoji: '🦎', key: 'l', beats: { spock: 'poisons', paper: 'eats' } },
    spock:    { emoji: '🖖', key: 'k', beats: { scissors: 'smashes', rock: 'vaporizes' } },
};
const CLASSIC = ['rock', 'paper', 'scissors'];
const EXTENDED = [...CLASSIC, 'lizard', 'spock'];
const MATCH_TARGET = 3;
const HISTORY_LENGTH = 12;
// Smart CPU still plays randomly some of the time so it can't be steered into a loop.
const SMART_RANDOMNESS = 0.2;
const REVEAL_DELAY_MS = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900;
const STATS_KEY = 'rps-stats';

const $ = (id) => document.getElementById(id);
const arena = $('arena');

const state = {
    variant: 'classic',
    opponent: 'random',
    format: 'free',
    busy: false,
    streak: 0,
    lastMove: null,
    transitions: {},
    match: { you: 0, cpu: 0 },
    history: [],
};
const stats = loadStats();

function loadStats() {
    const empty = { wins: 0, losses: 0, ties: 0, best: 0 };
    try {
        return { ...empty, ...JSON.parse(localStorage.getItem(STATS_KEY) || '{}') };
    } catch {
        return empty;
    }
}

function saveStats() {
    try {
        localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch {
        // Stats just won't survive a reload.
    }
}

const activeMoves = () => (state.variant === 'classic' ? CLASSIC : EXTENDED);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const capitalise = (word) => word[0].toUpperCase() + word.slice(1);

function outcome(you, cpu) {
    if (you === cpu) return 'tie';
    return MOVES[you].beats[cpu] ? 'win' : 'lose';
}

function movesThatBeat(move) {
    return activeMoves().filter((m) => MOVES[m].beats[move]);
}

// Predicts the player's next move from what they tended to play after their previous one.
function cpuMove() {
    const moves = activeMoves();
    if (state.opponent === 'random' || !state.lastMove || Math.random() < SMART_RANDOMNESS) {
        return pick(moves);
    }
    const seen = state.transitions[state.lastMove] || {};
    const candidates = moves.filter((m) => seen[m]);
    if (!candidates.length) return pick(moves);
    const predicted = candidates.reduce((a, b) => (seen[b] > seen[a] ? b : a));
    return pick(movesThatBeat(predicted));
}

function learn(move) {
    if (state.lastMove) {
        const seen = (state.transitions[state.lastMove] ??= {});
        seen[move] = (seen[move] || 0) + 1;
    }
    state.lastMove = move;
}

function setHands(you, cpu) {
    $('you-hand').textContent = MOVES[you].emoji;
    $('cpu-hand').firstElementChild.textContent = MOVES[cpu].emoji;
}

function play(move) {
    if (state.busy || !activeMoves().includes(move) || $('match-dialog').open) return;
    state.busy = true;

    const cpu = cpuMove();
    learn(move);
    markChoice(move);

    setHands('rock', 'rock');
    arena.classList.remove('win', 'lose', 'tie', 'shaking');
    void arena.offsetWidth;
    arena.classList.add('shaking');
    $('result').textContent = 'Rock… Paper… Scissors…';
    $('detail').textContent = ' ';

    setTimeout(() => reveal(move, cpu), REVEAL_DELAY_MS);
}

function reveal(you, cpu) {
    arena.classList.remove('shaking');
    setHands(you, cpu);
    const result = outcome(you, cpu);
    arena.classList.add(result);

    if (result === 'win') {
        stats.wins++;
        state.streak++;
        state.match.you++;
        $('result').textContent = 'You win!';
        $('detail').textContent = `${capitalise(you)} ${MOVES[you].beats[cpu]} ${cpu}.`;
    } else if (result === 'lose') {
        stats.losses++;
        state.streak = 0;
        state.match.cpu++;
        $('result').textContent = 'CPU wins';
        $('detail').textContent = `${capitalise(cpu)} ${MOVES[cpu].beats[you]} ${you}.`;
    } else {
        stats.ties++;
        $('result').textContent = "It's a tie";
        $('detail').textContent = 'Great minds think alike.';
    }
    stats.best = Math.max(stats.best, state.streak);
    saveStats();

    state.history.unshift({ you, cpu, result });
    state.history.length = Math.min(state.history.length, HISTORY_LENGTH);

    renderStats();
    renderHistory();
    renderPips();
    state.busy = false;

    if (state.format === 'bo5' && Math.max(state.match.you, state.match.cpu) >= MATCH_TARGET) {
        endMatch();
    }
}

function endMatch() {
    const won = state.match.you > state.match.cpu;
    $('match-emoji').textContent = won ? '🏆' : '🤖';
    $('match-title').textContent = won ? 'You won the match!' : 'The CPU takes the match';
    $('match-score').textContent = `Final score ${state.match.you} – ${state.match.cpu}`;
    $('match-dialog').showModal();
    if (won) window.confetti();
}

function resetMatch() {
    state.match = { you: 0, cpu: 0 };
    renderPips();
}

function markChoice(move) {
    document.querySelectorAll('.choice').forEach((btn) => {
        btn.classList.toggle('picked', btn.dataset.move === move);
    });
}

function renderChoices() {
    $('choices').innerHTML = activeMoves().map((m) => `
        <button class="choice" data-move="${m}" aria-label="${capitalise(m)}">
            <span class="choice-emoji" aria-hidden="true">${MOVES[m].emoji}</span>
            <span class="choice-name">${capitalise(m)}</span>
            <kbd>${MOVES[m].key.toUpperCase()}</kbd>
        </button>`).join('');
}

function renderRules() {
    const extended = state.variant === 'extended';
    $('rules').hidden = !extended;
    if (!extended) return;
    $('rules-list').innerHTML = EXTENDED.flatMap((m) =>
        Object.entries(MOVES[m].beats).map(([loser, verb]) =>
            `<li>${MOVES[m].emoji} ${capitalise(m)} <em>${verb}</em> ${loser} ${MOVES[loser].emoji}</li>`)
    ).join('');
}

function renderStats() {
    const total = stats.wins + stats.losses + stats.ties;
    $('stat-wins').textContent = stats.wins;
    $('stat-losses').textContent = stats.losses;
    $('stat-ties').textContent = stats.ties;
    $('stat-rate').textContent = total ? `${Math.round((stats.wins / total) * 100)}%` : '–';
    $('stat-streak').textContent = state.streak;
    $('stat-best').textContent = stats.best;
}

function renderHistory() {
    if (!state.history.length) {
        $('history').innerHTML = '<li class="empty">No rounds yet.</li>';
        return;
    }
    $('history').innerHTML = state.history.map(({ you, cpu, result }) =>
        `<li class="${result}" title="${capitalise(you)} vs ${cpu}: ${result}">
            ${MOVES[you].emoji}<span>vs</span>${MOVES[cpu].emoji}
        </li>`).join('');
}

function renderPips() {
    const show = state.format === 'bo5';
    for (const side of ['you', 'cpu']) {
        const el = $(`${side}-pips`);
        el.hidden = !show;
        el.innerHTML = Array.from({ length: MATCH_TARGET }, (_, i) =>
            `<span class="${i < state.match[side] ? 'on' : ''}"></span>`).join('');
    }
}

document.querySelectorAll('.seg').forEach((group) => {
    group.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button || state.busy) return;
        group.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === button));
        state[group.dataset.setting] = button.dataset.value;

        if (group.dataset.setting === 'variant') {
            renderChoices();
            renderRules();
        }
        if (group.dataset.setting === 'opponent') {
            $('cpu-mode').textContent = state.opponent;
        }
        resetMatch();
    });
});

$('choices').addEventListener('click', (event) => {
    const button = event.target.closest('.choice');
    if (button) play(button.dataset.move);
});

document.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const move = activeMoves().find((m) => MOVES[m].key === event.key.toLowerCase());
    if (move) play(move);
});

$('match-dialog').addEventListener('close', resetMatch);

$('reset').addEventListener('click', () => {
    Object.assign(stats, { wins: 0, losses: 0, ties: 0, best: 0 });
    state.streak = 0;
    state.history = [];
    saveStats();
    renderStats();
    renderHistory();
    resetMatch();
});

renderChoices();
renderRules();
renderStats();
renderPips();
