import confetti from 'canvas-confetti';

// --- DATA STATE ---
// The array indexes 0-8 represent the 9 fixed grid slots.
// The values 1-9 represent the image tiles.
let puzzleState = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const correctState = [1, 2, 3, 4, 5, 6, 7, 8, 9];

let isSolved = false;
let isAnimating = false;

// --- DOM ELEMENTS ---
const instructionOverlay = document.getElementById('instruction-overlay');
const startBtn = document.getElementById('start-btn');
const gameScreen = document.getElementById('game-screen');
const puzzleBoard = document.getElementById('puzzle-board');
const progressIndicator = document.getElementById('progress-indicator');
// The 9 fixed slots in the CSS grid
const slots = Array.from(document.querySelectorAll('.grid-cell'));
const app = document.getElementById('app');

const celebrationOverlay = document.getElementById('celebration-overlay');
const msg1 = document.getElementById('msg-1');
const msg2 = document.getElementById('msg-2');
const msg3 = document.getElementById('msg-3');

const btnScramble = document.getElementById('op-scramble');
const btnSolve = document.getElementById('op-solve');
const btnReset = document.getElementById('op-reset');

// --- DRAG STATE ---
let draggedTileId = null;
let sourceSlotIndex = null;
let targetSlotIndex = null;

// --- INITIALIZATION ---
function init() {
  // Clear slots just in case
  slots.forEach(slot => (slot.innerHTML = ''));
  renderPuzzle();
}

// Renders the tiles based strictly on the puzzleState array.
// The grid slots never move. Only their tile contents change.
function renderPuzzle() {
  puzzleState.forEach((tileId, slotIndex) => {
    const slot = slots[slotIndex];
    let tile = document.querySelector(`.tile[data-id="${tileId}"]`);
    
    // Create the tile if it doesn't exist
    if (!tile) {
      tile = document.createElement('div');
      tile.classList.add('tile');
      tile.dataset.id = tileId;
      tile.style.backgroundImage = `url('./assets/puzzle/image${tileId}.png')`;
      tile.addEventListener('pointerdown', handlePointerDown);
    }
    
    // Ensure the tile is inside the correct fixed slot
    if (tile.parentElement !== slot) {
      slot.appendChild(tile);
    }
  });
  
  updateProgress();
}

// --- DRAGGING ---
function handlePointerDown(e) {
  if (isSolved || isAnimating) return;
  
  const tile = e.target;
  draggedTileId = parseInt(tile.dataset.id);
  sourceSlotIndex = puzzleState.indexOf(draggedTileId);
  
  // Elevate visually
  tile.setPointerCapture(e.pointerId);
  const rect = tile.getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  const offsetY = e.clientY - rect.top;
  const origWidth = rect.width;
  const origHeight = rect.height;
  
  tile.classList.add('dragging');
  // Temporary absolute positioning styles for dragging only
  tile.style.width = `${origWidth}px`;
  tile.style.height = `${origHeight}px`;
  
  // Move temporarily to app container to float above grid
  app.appendChild(tile);
  updateTilePosition(tile, e.clientX, e.clientY, offsetX, offsetY);
  
  const moveHandler = (ev) => {
    updateTilePosition(tile, ev.clientX, ev.clientY, offsetX, offsetY);
    checkHoverTarget(ev.clientX, ev.clientY, tile);
  };
  
  const finishDragHandler = (ev) => {
    tile.releasePointerCapture(ev.pointerId);
    tile.removeEventListener('pointermove', moveHandler);
    tile.removeEventListener('pointerup', finishDragHandler);
    tile.removeEventListener('pointercancel', finishDragHandler);
    handleDrop(tile);
  };
  
  tile.addEventListener('pointermove', moveHandler);
  tile.addEventListener('pointerup', finishDragHandler);
  tile.addEventListener('pointercancel', finishDragHandler);
}

function updateTilePosition(tile, clientX, clientY, offsetX, offsetY) {
  tile.style.left = `${clientX - offsetX}px`;
  tile.style.top = `${clientY - offsetY}px`;
}

function checkHoverTarget(clientX, clientY, dragTile) {
  // Clear all highlights
  slots.forEach(slot => slot.classList.remove('highlight'));
  targetSlotIndex = null;
  
  // Temporarily hide floating tile to hit-test the grid underneath
  dragTile.style.display = 'none';
  const elemBelow = document.elementFromPoint(clientX, clientY);
  dragTile.style.display = 'block';
  
  if (!elemBelow) return;
  
  const slotBelow = elemBelow.closest('.grid-cell');
  if (slotBelow) {
    const slotIndex = parseInt(slotBelow.dataset.pos) - 1;
    // Don't highlight if hovering its own original slot
    if (slotIndex !== sourceSlotIndex) {
      targetSlotIndex = slotIndex;
      slotBelow.classList.add('highlight');
    }
  }
}

// --- DROP AND SWAP ---
function handleDrop(dragTile) {
  slots.forEach(slot => slot.classList.remove('highlight'));
  
  // 1. Capture FIRST visual positions (for FLIP)
  const floatingRect = dragTile.getBoundingClientRect();
  
  // FORCE CLEANUP: Strip all temporary drag positioning styles instantly
  dragTile.classList.remove('dragging');
  dragTile.style.width = '';
  dragTile.style.height = '';
  dragTile.style.left = '';
  dragTile.style.top = '';
  
  if (targetSlotIndex !== null) {
    // Valid Swap
    const targetTileId = puzzleState[targetSlotIndex];
    const targetTile = document.querySelector(`.tile[data-id="${targetTileId}"]`);
    const targetOldRect = targetTile.getBoundingClientRect();
    
    // 2. Update DATA STATE
    puzzleState[sourceSlotIndex] = targetTileId;
    puzzleState[targetSlotIndex] = draggedTileId;
    
    // 3. Render new fixed DOM structure based entirely on state
    renderPuzzle();
    
    // 4. Capture LAST positions
    const dragDestRect = dragTile.getBoundingClientRect();
    const targetDestRect = targetTile.getBoundingClientRect();
    
    isAnimating = true;
    
    // 5 & 6 & 7: Calculate, Animate, and Cleanup FLIP transform
    animateFLIP(dragTile, floatingRect, dragDestRect);
    animateFLIP(targetTile, targetOldRect, targetDestRect, () => {
      isAnimating = false;
      checkCompletion();
    });
    
  } else {
    // Invalid Drop: Pointer wasn't over a valid different cell, or pointer canceled
    // Render the unmodified state (snaps dragTile immediately back to sourceSlot)
    renderPuzzle();
    
    const dragDestRect = dragTile.getBoundingClientRect();
    
    isAnimating = true;
    animateFLIP(dragTile, floatingRect, dragDestRect, () => {
      isAnimating = false;
    });
  }
  
  // Clear drag state
  draggedTileId = null;
  sourceSlotIndex = null;
  targetSlotIndex = null;
}

// --- FLIP ANIMATION ---
function animateFLIP(element, firstRect, lastRect, onComplete) {
  const deltaX = firstRect.left - lastRect.left;
  const deltaY = firstRect.top - lastRect.top;
  
  // If it didn't move, complete immediately
  if (deltaX === 0 && deltaY === 0) {
    if (onComplete) onComplete();
    return;
  }
  
  // Step 5: Apply initial transform to visually match firstRect
  element.style.transition = 'none';
  element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
  
  // Force browser layout
  element.getBoundingClientRect();
  
  // Step 6: Animate transform to 0 (which brings it perfectly to lastRect / normal DOM position)
  requestAnimationFrame(() => {
    element.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
    element.style.transform = 'translate(0, 0)';
    
    // Step 7: Force Cleanup after animation ends
    // 400ms matches the CSS transition time
    setTimeout(() => {
      element.style.transition = '';
      element.style.transform = '';
      if (onComplete) onComplete();
    }, 400);
  });
}


// --- GAME LOGIC ---
function updateProgress() {
  let correctCount = 0;
  for (let i = 0; i < 9; i++) {
    if (puzzleState[i] === correctState[i]) {
      correctCount++;
    }
  }
  progressIndicator.textContent = `PIECES IN PLACE: ${correctCount} / 9`;
}

function checkCompletion() {
  let solved = true;
  for (let i = 0; i < 9; i++) {
    if (puzzleState[i] !== correctState[i]) {
      solved = false;
      break;
    }
  }
  
  if (solved && !isSolved) {
    isSolved = true;
    // Wait approximately 500ms after final swap completes
    setTimeout(() => {
      app.classList.add('puzzle-solved');
      triggerCelebration();
    }, 500);
  }
}

// --- CELEBRATION ---
function triggerCelebration() {
  const myCanvas = document.getElementById('confetti-canvas');
  const myConfetti = confetti.create(myCanvas, {
    resize: true,
    useWorker: true
  });
  
  const duration = 5 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 45, spread: 60, ticks: 150, zIndex: 1000 };

  const interval = setInterval(function() {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) {
      return clearInterval(interval);
    }
    const particleCount = 40 * (timeLeft / duration);
    
    // Left popper
    myConfetti(Object.assign({}, defaults, { 
      particleCount, 
      origin: { x: 0.1, y: 0.9 },
      angle: 60,
      colors: ['#00d2ff', '#ffffff', '#00ff88']
    }));
    // Right popper
    myConfetti(Object.assign({}, defaults, { 
      particleCount, 
      origin: { x: 0.9, y: 0.9 },
      angle: 120,
      colors: ['#00d2ff', '#ffffff', '#00ff88']
    }));
  }, 250);

  // Sequence the final messages
  setTimeout(() => {
    celebrationOverlay.classList.remove('hidden');
    msg1.classList.remove('hidden');
    msg1.classList.add('msg-reveal');
    
    setTimeout(() => {
      msg2.classList.remove('hidden');
      msg2.classList.add('msg-reveal');
      
      setTimeout(() => {
        msg3.classList.remove('hidden');
        msg3.classList.add('msg-reveal');
      }, 1500);
      
    }, 2000);
    
  }, 1000);
}

function scramble() {
  // Scramble the state array
  puzzleState.sort(() => Math.random() - 0.5);
  // Re-render
  renderPuzzle();
  
  isSolved = false;
  app.classList.remove('puzzle-solved');
  hideCelebration();
}

function forceSolve() {
  puzzleState = [...correctState];
  renderPuzzle();
  checkCompletion();
}

function reset() {
  puzzleState = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  isSolved = false;
  app.classList.remove('puzzle-solved');
  hideCelebration();
  renderPuzzle();
  
  instructionOverlay.classList.remove('hidden');
  gameScreen.classList.add('hidden');
}

function hideCelebration() {
  celebrationOverlay.classList.add('hidden');
  msg1.classList.add('hidden');
  msg2.classList.add('hidden');
  msg3.classList.add('hidden');
  msg1.classList.remove('msg-reveal');
  msg2.classList.remove('msg-reveal');
  msg3.classList.remove('msg-reveal');
  confetti.reset();
}

// --- EVENTS ---
startBtn.addEventListener('click', () => {
  instructionOverlay.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  scramble();
});

btnScramble.addEventListener('click', scramble);
btnSolve.addEventListener('click', forceSolve);
btnReset.addEventListener('click', reset);

document.addEventListener('keydown', (e) => {
  if (e.key === '1') scramble();
  if (e.key === '2') forceSolve();
  if (e.key === '3') reset();
});

// Boot up
init();
