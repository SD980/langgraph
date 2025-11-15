const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const boardCanvas = document.getElementById("board");
const boardCtx = boardCanvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const startBtn = document.getElementById("start");

boardCtx.scale(BLOCK_SIZE, BLOCK_SIZE);
nextCtx.scale(30, 30);

const SHAPES = {
  I: {
    color: "#48e5ff",
    matrix: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  J: {
    color: "#4185ff",
    matrix: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  L: {
    color: "#ff9f46",
    matrix: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  O: {
    color: "#ffd246",
    matrix: [
      [1, 1],
      [1, 1],
    ],
  },
  S: {
    color: "#4dff7c",
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
  },
  T: {
    color: "#b268ff",
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  Z: {
    color: "#ff5f7a",
    matrix: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
  },
};

const dropSpeeds = [1000, 900, 800, 700, 600, 500, 400, 350, 300, 250];

let board = createBoard();
let bag = [];
let currentPiece = null;
let nextPiece = null;
let lastTime = 0;
let dropCounter = 0;
let score = 0;
let lines = 0;
let level = 1;
let running = false;
let paused = false;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function getRandomBag() {
  const keys = Object.keys(SHAPES);
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  return keys.slice();
}

function spawnPiece() {
  if (bag.length === 0) {
    bag = getRandomBag();
  }
  const type = bag.pop();
  const shape = SHAPES[type];
  return {
    pos: { x: Math.floor((COLS - shape.matrix[0].length) / 2), y: 0 },
    matrix: shape.matrix.map((row) => row.slice()),
    color: shape.color,
  };
}

function resetGame() {
  board = createBoard();
  bag = [];
  score = 0;
  lines = 0;
  level = 1;
  updateScore();
  currentPiece = spawnPiece();
  nextPiece = spawnPiece();
  running = true;
  paused = false;
  startBtn.textContent = "게임 중지";
}

function merge(piece) {
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        board[y + piece.pos.y][x + piece.pos.x] = piece.color;
      }
    });
  });
}

function collide(piece) {
  for (let y = 0; y < piece.matrix.length; y++) {
    for (let x = 0; x < piece.matrix[y].length; x++) {
      if (!piece.matrix[y][x]) continue;
      const boardY = y + piece.pos.y;
      const boardX = x + piece.pos.x;
      if (boardY >= ROWS || boardX < 0 || boardX >= COLS) {
        return true;
      }
      if (boardY >= 0 && board[boardY][boardX]) {
        return true;
      }
    }
  }
  return false;
}

function clearLines() {
  let cleared = 0;
  outer: for (let y = ROWS - 1; y >= 0; y--) {
    for (let x = 0; x < COLS; x++) {
      if (!board[y][x]) {
        continue outer;
      }
    }
    const row = board.splice(y, 1)[0].fill(null);
    board.unshift(row);
    cleared++;
    y++;
  }
  if (cleared > 0) {
    lines += cleared;
    score += [0, 100, 300, 500, 800][cleared];
    level = Math.min(10, 1 + Math.floor(lines / 10));
    updateScore();
  }
}

function rotate(matrix, dir) {
  const size = matrix.length;
  const rotated = Array.from({ length: size }, () => Array(size).fill(0));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (dir > 0) {
        rotated[x][size - 1 - y] = matrix[y][x];
      } else {
        rotated[size - 1 - x][y] = matrix[y][x];
      }
    }
  }
  return rotated;
}

function attemptRotate(dir) {
  const clone = currentPiece.matrix.map((row) => row.slice());
  const rotated = rotate(clone, dir);
  const oldX = currentPiece.pos.x;
  currentPiece.matrix = rotated;
  let offset = 1;
  while (collide(currentPiece)) {
    currentPiece.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > currentPiece.matrix[0].length) {
      currentPiece.pos.x = oldX;
      currentPiece.matrix = clone;
      return;
    }
  }
}

function drop() {
  currentPiece.pos.y++;
  if (collide(currentPiece)) {
    currentPiece.pos.y--;
    merge(currentPiece);
    clearLines();
    currentPiece = nextPiece;
    nextPiece = spawnPiece();
    if (collide(currentPiece)) {
      running = false;
      startBtn.textContent = "다시 시작";
    }
  }
  dropCounter = 0;
}

function hardDrop() {
  while (!collide(currentPiece)) {
    currentPiece.pos.y++;
  }
  currentPiece.pos.y--;
  drop();
}

function move(dir) {
  currentPiece.pos.x += dir;
  if (collide(currentPiece)) {
    currentPiece.pos.x -= dir;
  }
}

function update(time = 0) {
  if (!running || paused) {
    draw();
    return;
  }
  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;
  const speed = dropSpeeds[level - 1];
  if (dropCounter > speed) {
    drop();
  }
  draw();
  requestAnimationFrame(update);
}

function draw() {
  boardCtx.fillStyle = "#030712";
  boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
  board.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawBlock(boardCtx, x, y, value);
      } else {
        boardCtx.strokeStyle = "rgba(255,255,255,0.05)";
        boardCtx.strokeRect(x, y, 1, 1);
      }
    });
  });
  if (currentPiece) {
    currentPiece.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
          drawBlock(boardCtx, currentPiece.pos.x + x, currentPiece.pos.y + y, currentPiece.color);
        }
      });
    });
  }
  drawNext();
}

function drawNext() {
  nextCtx.fillStyle = "#030712";
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!nextPiece) return;
  const matrix = nextPiece.matrix;
  const offsetX = Math.floor((4 - matrix[0].length) / 2);
  const offsetY = Math.floor((4 - matrix.length) / 2);
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawBlock(nextCtx, x + offsetX, y + offsetY, nextPiece.color);
      }
    });
  });
}

function drawBlock(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 0.03;
  ctx.strokeRect(x + 0.02, y + 0.02, 0.96, 0.96);
}

function updateScore() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines.toString();
  levelEl.textContent = level.toString();
}

function togglePause() {
  if (!running) return;
  paused = !paused;
  startBtn.textContent = paused ? "재개" : "게임 중지";
  if (!paused) {
    lastTime = performance.now();
    requestAnimationFrame(update);
  } else {
    draw();
  }
}

function handleKey(e) {
  if (!running || paused) {
    if (e.code === "Space" && !running) {
      startGame();
    }
    return;
  }
  switch (e.code) {
    case "ArrowLeft":
      move(-1);
      break;
    case "ArrowRight":
      move(1);
      break;
    case "ArrowDown":
      drop();
      break;
    case "ArrowUp":
      attemptRotate(1);
      break;
    case "Space":
      hardDrop();
      break;
    case "KeyP":
      togglePause();
      break;
  }
}

document.addEventListener("keydown", handleKey);

startBtn.addEventListener("click", () => {
  if (!running) {
    startGame();
  } else if (paused) {
    togglePause();
  } else {
    togglePause();
  }
});

function startGame() {
  resetGame();
  lastTime = performance.now();
  requestAnimationFrame(update);
}

draw();
