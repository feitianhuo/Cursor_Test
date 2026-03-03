(function () {
  'use strict';

  const BOARD_SIZE = 15;
  const CELL_SIZE = 40;
  const STONE_RADIUS = 16;
  const PADDING = CELL_SIZE;

  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;

  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const statusText = document.getElementById('status-text');
  const restartBtn = document.getElementById('restart-btn');

  let board = [];
  let currentPlayer = BLACK;
  let gameOver = false;
  let lastMove = null;

  function initBoard() {
    board = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(EMPTY));
    currentPlayer = BLACK;
    gameOver = false;
    lastMove = null;
    statusText.textContent = '黑棋先行';
  }

  function drawBoard() {
    const width = canvas.width;
    const height = canvas.height;

    // 木纹背景
    ctx.fillStyle = '#deb887';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#8b4513';
    ctx.lineWidth = 1;

    for (let i = 0; i < BOARD_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(PADDING + i * CELL_SIZE, PADDING);
      ctx.lineTo(PADDING + i * CELL_SIZE, PADDING + (BOARD_SIZE - 1) * CELL_SIZE);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(PADDING, PADDING + i * CELL_SIZE);
      ctx.lineTo(PADDING + (BOARD_SIZE - 1) * CELL_SIZE, PADDING + i * CELL_SIZE);
      ctx.stroke();
    }

    // 天元与星位
    const starPoints = [
      [3, 3], [3, 11], [11, 3], [11, 11], [7, 7],
    ];
    starPoints.forEach(([r, c]) => {
      ctx.beginPath();
      ctx.arc(PADDING + c * CELL_SIZE, PADDING + r * CELL_SIZE, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#5c4033';
      ctx.fill();
    });
  }

  function drawStone(row, col, color, isLast = false) {
    const x = PADDING + col * CELL_SIZE;
    const y = PADDING + row * CELL_SIZE;

    const gradient = ctx.createRadialGradient(
      x - STONE_RADIUS * 0.3, y - STONE_RADIUS * 0.3, 0,
      x, y, STONE_RADIUS
    );

    if (color === BLACK) {
      gradient.addColorStop(0, '#4a4a4a');
      gradient.addColorStop(0.7, '#2d2d2d');
      gradient.addColorStop(1, '#1a1a1a');
    } else {
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.6, '#f5f5f0');
      gradient.addColorStop(1, '#e0e0d8');
    }

    ctx.beginPath();
    ctx.arc(x, y, STONE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = color === BLACK ? '#1a1a1a' : '#888';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (isLast) {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = color === BLACK ? '#fff' : '#333';
      ctx.fill();
    }
  }

  function draw() {
    drawBoard();
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] !== EMPTY) {
          const isLast = lastMove && lastMove[0] === r && lastMove[1] === c;
          drawStone(r, c, board[r][c], isLast);
        }
      }
    }
  }

  function checkWin(row, col, player) {
    const directions = [
      [0, 1],   // 水平
      [1, 0],   // 垂直
      [1, 1],   // 对角线
      [1, -1],  // 反斜线
    ];

    for (const [dr, dc] of directions) {
      let count = 1;
      let r = row + dr;
      let c = col + dc;
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
        count++;
        r += dr;
        c += dc;
      }
      r = row - dr;
      c = col - dc;
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
        count++;
        r -= dr;
        c -= dc;
      }
      if (count >= 5) return true;
    }
    return false;
  }

  function handleClick(e) {
    if (gameOver) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const col = Math.round((x - PADDING) / CELL_SIZE);
    const row = Math.round((y - PADDING) / CELL_SIZE);

    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return;
    if (board[row][col] !== EMPTY) return;

    board[row][col] = currentPlayer;
    lastMove = [row, col];

    if (checkWin(row, col, currentPlayer)) {
      gameOver = true;
      const winner = currentPlayer === BLACK ? '黑方' : '白方';
      statusText.textContent = `${winner}获胜！`;
      draw();
      return;
    }

    currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
    statusText.textContent = currentPlayer === BLACK ? '黑棋落子' : '白棋落子';
    draw();
  }

  restartBtn.addEventListener('click', () => {
    initBoard();
    draw();
  });

  initBoard();
  draw();
  canvas.addEventListener('click', handleClick);
})();
