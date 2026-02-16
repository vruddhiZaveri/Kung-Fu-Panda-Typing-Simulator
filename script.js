const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const container = document.getElementById("game-container");

// --- 1. DOM UI ELEMENTS ---
const uiHp = document.getElementById("hp-val");
const uiScore = document.getElementById("score-val");
const uiLvl = document.getElementById("lvl-val");
const uiGoal = document.getElementById("goal-val");
const uiLetter = document.getElementById("target-letter");
const mainMenu = document.getElementById("main-menu");
const gameWrapper = document.getElementById("game-wrapper");

// --- 2. ASSET LOADER (Removed static background image) ---
const imageUrls = {
    dumpling: 'public/assets/dumpling.png',
    hit: 'public/assets/hit.png',
    masterIdle: 'public/assets/master/master_pose1.png',
    masterThrow: 'public/assets/master/master_pose2.png',
    poIdle: 'public/assets/panda/panda_idle.png',
    poPose1: 'public/assets/panda/panda_pose1.png',
    poPose2: 'public/assets/panda/panda_pose2.png',
    poHurt: 'public/assets/panda/panda_hurt.png'
};

const IMAGES = {};
let imagesLoaded = 0;
const totalImages = Object.keys(imageUrls).length;

for (let key in imageUrls) {
    IMAGES[key] = new Image();
    IMAGES[key].onload = () => { imagesLoaded++; };
    IMAGES[key].src = imageUrls[key];
}

// AUDIO SETUP
const AUDIO = {
    menuBgm: new Audio('public/assets/menu_bgm.mp3'),
    gameBgm: new Audio('public/assets/game_bgm.mp3'),
    shifuYell: new Audio('public/assets/shifu_yell.mp3')
};
AUDIO.menuBgm.loop = true;
AUDIO.gameBgm.loop = true;

// --- 3. GAME STATE ---
let score = 0;
let hp = 100;
let entities = [];
let currentLevel = 1;
let caughtInLevel = 0;
let levelGoal = 8;
let gameState = "MENU";
let spawnTimer;

const letters = "WASDEQ";

// --- 4. ENTITIES ---
const GROUND_Y = 500;

const player = {
    x: 300,
    y: GROUND_Y - 130,
    w: 110,
    h: 130,
    baseSpeed: 14, // Will scale up as game gets faster
    autoMoveTarget: null,
    currentSprite: 'poIdle',
    actionTimer: 0
};

const master = {
    x: 1020,
    y: 280,
    w: 130,
    h: 130,
    currentSprite: 'masterIdle',
    actionTimer: 0
};

const keysPressed = { ArrowLeft: false, ArrowRight: false };

// --- 5. MENU CONTROLS & AUDIO PIPELINE ---
document.getElementById('btn-play').addEventListener('click', () => {
    mainMenu.style.display = 'none';
    gameWrapper.style.display = 'flex';
    gameState = "START";

    AUDIO.menuBgm.pause();
    AUDIO.gameBgm.currentTime = 0;
    AUDIO.gameBgm.play();

    if (imagesLoaded === totalImages) {
        update();
    } else {
        const checkLoad = setInterval(() => {
            if (imagesLoaded === totalImages) {
                clearInterval(checkLoad);
                update();
            }
        }, 100);
    }
});

document.getElementById('btn-exit').addEventListener('click', () => {
    document.getElementById('menu-box').innerHTML = '<h2 style="color:white; font-size:40px;">Thanks for playing!</h2>';
});

window.addEventListener('click', () => {
    if (gameState === "MENU" && AUDIO.menuBgm.paused) {
        AUDIO.menuBgm.play();
    }
}, { once: true });


// --- 6. GAME LOGIC & PROGRESSIVE SPEED ---
function updateUI() {
    uiHp.innerText = hp;
    uiScore.innerText = score;
    uiLvl.innerText = currentLevel;
    uiGoal.innerText = `${caughtInLevel}/${levelGoal}`;

    const activeDumpling = entities.find(e => e.type === 'dumpling');
    if (activeDumpling && gameState === "PLAYING") {
        uiLetter.innerText = activeDumpling.letter;
        uiLetter.style.color = "#ffd700";
    } else {
        uiLetter.innerText = "-";
        uiLetter.style.color = "#fff";
    }
}

function spawnEntity() {
    if (gameState !== "PLAYING") return;

    // SCALING DIFFICULTY: Increases based on score AND current level
    const dynamicDifficulty = currentLevel + (score / 40);

    const isBomb = Math.random() < 0.35;

    // As difficulty goes up, flight time drops (objects move faster)
    // Capped at 25 frames so it never becomes mathematically impossible
    const flightTime = Math.max(25, 70 - (dynamicDifficulty * 4.5));
    const gravity = 0.4 + (dynamicDifficulty * 0.05);

    let landingX;
    if (isBomb) {
        landingX = player.x + (player.w / 2);
        if (Math.random() < 0.3) {
            AUDIO.shifuYell.currentTime = 0;
            AUDIO.shifuYell.play();
        }
    } else {
        landingX = Math.random() * 700 + 100;
    }

    const startX = master.x;
    const startY = master.y + 40;

    const vx = (landingX - startX) / flightTime;
    const vy = (GROUND_Y - startY - 0.5 * gravity * flightTime * flightTime) / flightTime;

    entities.push({
        x: startX,
        y: startY,
        vx: vx,
        vy: vy,
        gravity: gravity,
        landingX: landingX,
        type: isBomb ? 'bomb' : 'dumpling',
        letter: isBomb ? null : letters[Math.floor(Math.random() * letters.length)]
    });

    master.currentSprite = 'masterThrow';
    master.actionTimer = 25;

    // Time between throws gets shorter
    let nextSpawn = Math.max(450, 2000 - (dynamicDifficulty * 180));
    spawnTimer = setTimeout(spawnEntity, nextSpawn);
}

function triggerShake() {
    container.classList.remove('shake');
    void container.offsetWidth;
    container.classList.add('shake');
}

// --- 7. INPUT HANDLING ---
window.addEventListener("keydown", (e) => {
    if (gameState === "MENU") return;

    if (e.key === "ArrowLeft") keysPressed.ArrowLeft = true;
    if (e.key === "ArrowRight") keysPressed.ArrowRight = true;

    if (gameState === "START" || gameState === "WIN_ANIM" || gameState === "FAIL_ANIM") {
        if (gameState === "WIN_ANIM") { currentLevel++; levelGoal += 2; }
        else if (gameState === "FAIL_ANIM") { score = 0; currentLevel = 1; levelGoal = 8; } // Reset stats on fail

        caughtInLevel = 0; entities = []; hp = 100;
        player.currentSprite = 'poIdle';
        player.autoMoveTarget = null;
        gameState = "PLAYING";
        clearTimeout(spawnTimer);
        spawnEntity();
        updateUI();
        return;
    }

    const pressed = e.key.toUpperCase();
    if (letters.includes(pressed)) {
        let targetDumplings = entities.filter(ent => ent.type === 'dumpling' && ent.letter === pressed);

        if (targetDumplings.length > 0) {
            targetDumplings.sort((a, b) => b.y - a.y);
            const target = targetDumplings[0];

            player.autoMoveTarget = target.landingX - (player.w / 2);
            player.currentSprite = 'poPose2';
        }
    }
});

window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft") keysPressed.ArrowLeft = false;
    if (e.key === "ArrowRight") keysPressed.ArrowRight = false;
});

// --- 8. MAIN GAME LOOP ---
function update() {
    if (gameState === "MENU" || imagesLoaded < totalImages) return;

    // Only clear the canvas. DO NOT draw the background image anymore,
    // so the video behind it is visible!
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate dynamic player speed so Po can keep up with the faster game
    const currentSpeed = player.baseSpeed + (score / 30);

    // --- PLAYER MOVEMENT SYSTEM ---
    if (gameState === "PLAYING") {
        if (keysPressed.ArrowLeft || keysPressed.ArrowRight) {
            player.autoMoveTarget = null;
            if (keysPressed.ArrowLeft) player.x -= currentSpeed;
            if (keysPressed.ArrowRight) player.x += currentSpeed;
        }
        else if (player.autoMoveTarget !== null) {
            const distance = player.autoMoveTarget - player.x;

            if (Math.abs(distance) <= currentSpeed) {
                player.x = player.autoMoveTarget;
                player.autoMoveTarget = null;
                player.currentSprite = 'poPose1';
            } else {
                player.x += Math.sign(distance) * currentSpeed;
            }
        }

        if (player.x < 10) player.x = 10;
        if (player.x > canvas.width - 250) player.x = canvas.width - 250;
    }

    if (player.actionTimer > 0) {
        player.actionTimer--;
        if (player.actionTimer <= 0 && gameState === "PLAYING" && player.autoMoveTarget === null) {
            player.currentSprite = 'poIdle';
        }
    }
    if (master.actionTimer > 0) {
        master.actionTimer--;
        if (master.actionTimer <= 0) master.currentSprite = 'masterIdle';
    }

    // --- DRAW CHARACTERS ---
    ctx.drawImage(IMAGES[master.currentSprite], master.x, master.y, master.w, master.h);
    ctx.drawImage(IMAGES[player.currentSprite], player.x, player.y, player.w, player.h);

    if (gameState === "PLAYING") {
        updateUI();

        for (let i = entities.length - 1; i >= 0; i--) {
            let e = entities[i];

            e.vy += e.gravity;
            e.x += e.vx;
            e.y += e.vy;

            const heightFromGround = Math.max(0, GROUND_Y - e.y);
            const shadowWidth = Math.max(10, 40 - (heightFromGround * 0.1));
            ctx.fillStyle = "rgba(0,0,0,0.4)";
            ctx.beginPath(); ctx.ellipse(e.x, GROUND_Y, shadowWidth, shadowWidth / 3, 0, 0, Math.PI * 2); ctx.fill();

            if (e.type === 'bomb') {
                ctx.fillStyle = "#ff4757";
                ctx.beginPath(); ctx.arc(e.x, e.y, 22, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = "#fff"; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(e.x, e.y - 22); ctx.lineTo(e.x + 10, e.y - 35); ctx.stroke();
            } else {
                ctx.drawImage(IMAGES.dumpling, e.x - 30, e.y - 30, 60, 60);

                ctx.fillStyle = "white";
                ctx.font = "bold 24px Arial";
                ctx.textAlign = "center";
                ctx.strokeStyle = "black";
                ctx.lineWidth = 4;
                ctx.strokeText(e.letter, e.x, e.y + 8);
                ctx.fillText(e.letter, e.x, e.y + 8);
            }

            // --- HIT DETECTION / CATCHING ---
            if (e.y >= GROUND_Y) {
                const poCenterX = player.x + (player.w / 2);

                if (e.type === 'bomb') {
                    if (Math.abs(e.x - poCenterX) < 70) {
                        gameState = "FAIL_ANIM";
                        player.currentSprite = 'poHurt';
                        triggerShake();
                    } else {
                        ctx.drawImage(IMAGES.hit, e.x - 40, GROUND_Y - 40, 80, 80);
                    }
                } else if (e.type === 'dumpling') {
                    if (Math.abs(e.x - poCenterX) < 75) {
                        caughtInLevel++;
                        score += 10;
                        player.currentSprite = 'poPose1';
                        player.actionTimer = 15;
                        if (caughtInLevel >= levelGoal) gameState = "WIN_ANIM";
                    } else {
                        hp -= 15;
                        player.currentSprite = 'poHurt';
                        player.actionTimer = 20;
                        triggerShake();
                        if (hp <= 0) gameState = "FAIL_ANIM";
                    }
                }

                entities.splice(i, 1);
            }
        }
    }

    // --- OVERLAY SCREENS ---
    if (gameState !== "PLAYING" && gameState !== "MENU") {
        ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = "center";

        if (gameState === "START") {
            ctx.fillStyle = "#ffd700"; ctx.font = "bold 48px Arial";
            ctx.fillText("DUMPLING DASH", canvas.width / 2, 250);
            ctx.fillStyle = "white"; ctx.font = "24px Courier";
            ctx.fillText("Press ANY KEY to Start", canvas.width / 2, 310);
            ctx.font = "18px Courier";
            ctx.fillText("Press Letters (W, A, S, D, E, Q) to Auto-Dash.", canvas.width / 2, 350);
            ctx.fillStyle = "#ff4757";
            ctx.fillText("Use LEFT/RIGHT ARROWS to dodge BOMBS!", canvas.width / 2, 380);
        }
        else if (gameState === "WIN_ANIM") {
            ctx.fillStyle = "#2ed573"; ctx.font = "bold 48px Arial";
            ctx.fillText("LEVEL CLEAR!", canvas.width / 2, 270);
            ctx.fillStyle = "white"; ctx.font = "24px Courier";
            ctx.fillText("Press ANY KEY for next level", canvas.width / 2, 330);
        }
        else if (gameState === "FAIL_ANIM") {
            ctx.fillStyle = "#ff4757"; ctx.font = "bold 48px Arial";
            ctx.fillText("GAME OVER", canvas.width / 2, 270);
            ctx.fillStyle = "white"; ctx.font = "24px Courier";
            ctx.fillText("Press ANY KEY to restart", canvas.width / 2, 330);
        }
    }

    if (gameState !== "MENU") {
        requestAnimationFrame(update);
    }
}