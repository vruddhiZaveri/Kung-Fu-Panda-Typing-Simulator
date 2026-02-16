/**
 * PANDA DUMPLING CATCH - Hackathon Build
 */

// --- ASSET HOOKS ---
// Drop your generated images in the folder and add their filenames here.
// The game will automatically switch from drawing shapes to drawing images!
const ASSETS = {
    bg: new Image(),
    panda: new Image(),
    dumpling: new Image()
};
ASSETS.bg.src = '';       // e.g., 'bg.png'
ASSETS.panda.src = '';    // e.g., 'panda.png'
ASSETS.dumpling.src = ''; // e.g., 'dumpling.png'

// --- CONSTANTS & SETUP ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const container = document.querySelector('.game-container');

const KEYS = ['A', 'S', 'D'];
const LANES = [200, 400, 600]; // X coordinates for lanes
const EAT_ZONE_Y = 450;
const EAT_ZONE_HEIGHT = 80;

// --- GAME STATE ---
let state = {
    hp: 3,
    score: 0,
    streak: 0,
    dumplings: [],
    isGameOver: false,
    lastTime: 0,
    spawnTimer: 0,
    currentSpawnRate: 2000, // ms between spawns
    baseFallSpeed: 150      // pixels per second
};

// --- AUDIO SYNTHESIZER (No external files needed!) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, type, duration, vol = 0.1) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
}
const sfx = {
    hit: () => playTone(600, 'sine', 0.1),
    eat: () => { playTone(800, 'square', 0.1); playTone(1200, 'sine', 0.15); },
    miss: () => playTone(150, 'sawtooth', 0.3, 0.3)
};

// --- GAME MECHANICS ---

function spawnDumpling() {
    const laneIndex = Math.floor(Math.random() * 3);

    // Difficulty scaling: Longer combos based on score
    let comboLength = 1;
    if (state.score > 20) comboLength = Math.random() > 0.5 ? 3 : 2;
    else if (state.score > 5) comboLength = Math.random() > 0.5 ? 2 : 1;

    let combo = [KEYS[laneIndex]]; // First key always matches the lane
    for (let i = 1; i < comboLength; i++) {
        combo.push(KEYS[Math.floor(Math.random() * 3)]);
    }

    state.dumplings.push({
        x: LANES[laneIndex],
        y: -50,
        combo: combo,
        progress: 0 // How many keys of the combo have been pressed
    });
}

function handleEat() {
    sfx.eat();
    state.score += 10 + (state.streak * 2); // Streak multiplier
    state.streak++;
    updateUI();

    // Increase difficulty
    state.currentSpawnRate = Math.max(600, 2000 - (state.score * 10));
    state.baseFallSpeed = Math.min(400, 150 + (state.score * 2));
}

function handleMiss() {
    if (state.isGameOver) return;
    sfx.miss();
    state.hp--;
    state.streak = 0;
    updateUI();

    // Trigger CSS screen shake
    container.classList.remove('shake');
    void container.offsetWidth; // Trigger reflow to restart animation
    container.classList.add('shake');

    if (state.hp <= 0) {
        state.isGameOver = true;
        document.getElementById('gameOverScreen').classList.remove('hidden');
        document.getElementById('finalScore').innerText = state.score;
    }
}

function updateUI() {
    document.getElementById('hpDisplay').innerText = state.hp;
    document.getElementById('scoreDisplay').innerText = state.score;
    document.getElementById('streakDisplay').innerText = state.streak;
}

function restartGame() {
    state = {
        hp: 3, score: 0, streak: 0, dumplings: [],
        isGameOver: false, lastTime: performance.now(),
        spawnTimer: 0, currentSpawnRate: 2000, baseFallSpeed: 150
    };
    document.getElementById('gameOverScreen').classList.add('hidden');
    updateUI();
    requestAnimationFrame(gameLoop);
}

// --- INPUT HANDLING ---
window.addEventListener('keydown', (e) => {
    let key = e.key.toUpperCase();

    if (state.isGameOver) {
        if (key === 'R') restartGame();
        return;
    }

    if (!KEYS.includes(key)) return;

    // Find dumplings inside the eat zone
    let inZone = state.dumplings.filter(d =>
        d.y + 25 >= EAT_ZONE_Y && d.y - 25 <= EAT_ZONE_Y + EAT_ZONE_HEIGHT
    );

    if (inZone.length === 0) return; // Don't penalize if nothing is near

    // Find the lowest dumpling that requires this key next
    inZone.sort((a, b) => b.y - a.y);
    let target = inZone.find(d => d.combo[d.progress] === key);

    if (target) {
        target.progress++;
        if (target.progress === target.combo.length) {
            // Combo complete! Remove dumpling and eat
            state.dumplings = state.dumplings.filter(d => d !== target);
            handleEat();
        } else {
            // Partial combo hit
            sfx.hit();
        }
    } else {
        // Pressed a valid game key, but it was the wrong combo step
        handleMiss();
    }
});

// --- RENDER & UPDATE LOOP ---
function gameLoop(timestamp) {
    if (state.isGameOver) return;

    const deltaTime = (timestamp - state.lastTime) / 1000; // in seconds
    state.lastTime = timestamp;

    // 1. Update logic
    state.spawnTimer += deltaTime * 1000;
    if (state.spawnTimer >= state.currentSpawnRate) {
        spawnDumpling();
        state.spawnTimer = 0;
    }

    for (let i = state.dumplings.length - 1; i >= 0; i--) {
        let d = state.dumplings[i];
        d.y += state.baseFallSpeed * deltaTime;

        // Check if missed (fell past the eat zone)
        if (d.y > EAT_ZONE_Y + EAT_ZONE_HEIGHT + 30) {
            state.dumplings.splice(i, 1);
            handleMiss();
        }
    }

    // 2. Draw Background
    if (ASSETS.bg.src && ASSETS.bg.complete) {
        ctx.drawImage(ASSETS.bg, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = '#557A46'; // Default green
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 3. Draw Lanes & Eat Zone
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    LANES.forEach(x => ctx.fillRect(x - 40, 0, 80, canvas.height));

    ctx.fillStyle = 'rgba(255, 215, 0, 0.3)'; // Golden eat zone
    ctx.fillRect(0, EAT_ZONE_Y, canvas.width, EAT_ZONE_HEIGHT);
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, EAT_ZONE_Y, canvas.width, EAT_ZONE_HEIGHT);

    // 4. Draw Po (Bottom Center)
    const poSize = 120;
    if (ASSETS.panda.src && ASSETS.panda.complete) {
        // Draw Panda stretching across lanes based on action could be added later!
        // For now, static center.
        ctx.drawImage(ASSETS.panda, canvas.width / 2 - poSize / 2, canvas.height - poSize, poSize, poSize);
    } else {
        ctx.fillStyle = 'white'; // Placeholder Po
        ctx.fillRect(canvas.width / 2 - poSize / 2, canvas.height - poSize, poSize, poSize);
        ctx.fillStyle = 'black';
        ctx.fillText("PO", canvas.width / 2 - 15, canvas.height - poSize / 2);
    }

    // 5. Draw Dumplings & Combos
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px Courier New';

    state.dumplings.forEach(d => {
        // Draw sprite or circle
        if (ASSETS.dumpling.src && ASSETS.dumpling.complete) {
            ctx.drawImage(ASSETS.dumpling, d.x - 30, d.y - 30, 60, 60);
        } else {
            ctx.fillStyle = '#F4E0B9';
            ctx.beginPath();
            ctx.arc(d.x, d.y, 25, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        // Draw Combo Text
        const textY = d.y - 40;
        // Calculate total width to center the combo text
        const spacing = 20;
        const totalWidth = (d.combo.length - 1) * spacing;
        const startX = d.x - (totalWidth / 2);

        d.combo.forEach((key, index) => {
            // Green if already pressed, Black/White if pending
            ctx.fillStyle = index < d.progress ? '#00FF00' : '#FFFFFF';
            // Add a black outline for readability
            ctx.strokeText(key, startX + (index * spacing), textY);
            ctx.fillText(key, startX + (index * spacing), textY);
        });
    });

    requestAnimationFrame(gameLoop);
}

// Initialize
state.lastTime = performance.now();
requestAnimationFrame(gameLoop);