import { init, id } from "@instantdb/core";
import "./styles.css";

// Initialize InstantDB
const APP_ID = "f27090f5-7ca9-4acc-a74e-cad07d031c2b";
const db = init({ appId: APP_ID });

console.log("InstantDB initialized:", db);

// Configuration
const ROWS = 3;
const COLS = 8;
const FILLED_PER_ROW = 5;
const PLACEHOLDER_CONTENT = [
  "Só falta QA",
  "É preciso cuidado com os edge cases!!!",
  "É preciso testar",
  "Tudo direitinho",
  "Pendo",
  "Tenho que ir comer",
  "Depois do almoço",
  "Não posso, tenho treino/ginásio",
  "Já fui treinar às 6h30",
  "Já trabalhei na Farfetch",
  "Na Farfetch é que isso era bem feito",
  "A minha namorada trabalha na Farfetch",
  "Tenho um amigo ",
  "Dynamic forms estão impecáveis",
  "Se precisares conheço um gajo",
  "Isso tem que se pedir a X",
  "Restaurante / bar / viagem a que fui é incrível, tens que experimentar",
  "Na Maia tens um lugar melhor",
  "A minha família tem não sei o quê",
  "Foi o meu avô que construiu a Maia",
  "Estou à espera que alguém faça Y",
  "Estive a fazer os testes de integração",
  "Então, não consegues arranjar uma horinha por dia para treinar?",
  "Quando é que vêem para o Padle?",
  "Estou a fazer",
  "Não se querem juntar",
  "Vou olhar para isso",
  "Não estou em casa / no pc",
  "Estive a fazer review",
  "Estou aqui à volta do bug",
  "Fiz um fix para isso",
  "Eu já testei",
  "Já mando isso deixa só testar as changes em integ",
  "Está testado. Podemos mover para staging para o verdadeiro teste",
  "Vou só dar update",
  "Tá feito, falta só fazer X",
  "Estamos a precisar de QA's",
  "Detetei aqui um bug",
  "Cuidado a testar, foi aí que apanhei os bugs",
];

const PASTEL_COLORS = [
  "#FFB3BA", // pastel pink
  "#BAFFC9", // pastel mint
  "#BAE1FF", // pastel blue
  "#FFFFBA", // pastel yellow
  "#E0BBE4", // pastel lavender
  "#FFDAB9", // pastel peach
  "#D4A5A5", // pastel mauve
  "#C7CEEA", // pastel periwinkle
  "#B5EAD7", // pastel mint green
  "#FFE5B4", // pastel apricot
  "#C5E3F6", // pastel sky blue
  "#E8DCC3", // pastel sage
];

// Types
interface Cell {
  type: "filled" | "empty";
  content?: string;
  selected?: boolean;
  color?: string;
}

type CardData = Cell[][];

interface Player {
  id: string;
  username: string;
  gameId: string;
  selectedCells: number[];
  completedLines: number;
  hasCompletedCard: boolean;
  joinedAt: number;
}

interface Game {
  id: string;
  name: string;
  createdAt: number;
  winnerId?: string | null;
  winnerName?: string | null;
  players: Player[];
}

interface PlayerWithCard extends Player {
  cardData: CardData;
  emptyColor: string;
}

// LocalStorage keys
const STORAGE_KEY_USERNAME = "bingo_username";

// State
let currentGameId: string | null = null;
let currentPlayerId: string | null = null;
let currentUsername: string | null = null;
let cardData: CardData = [];
let completedRows = new Set<number>();
let audioContext: AudioContext | null = null;
let sessionEmptyColor: string | null = null;
let hasPlayedLineSound = false;
let gameSubscriptionUnsubscribe: (() => void) | null = null;

// Load saved username from localStorage
function loadSavedUsername(): string | null {
  return localStorage.getItem(STORAGE_KEY_USERNAME);
}

// Save username to localStorage
function saveUsername(username: string) {
  localStorage.setItem(STORAGE_KEY_USERNAME, username);
}

// DOM Elements
const landingScreen = document.getElementById("landingScreen")!;
const gameScreen = document.getElementById("gameScreen")!;
const usernameModal = document.getElementById("usernameModal")!;
const grid = document.getElementById("bingoGrid")!;
const clearBtn = document.getElementById("clearBtn")!;
const newSessionBtn = document.getElementById("newSessionBtn")!;
const leaveGameBtn = document.getElementById("leaveGameBtn")!;
const victoryOverlay = document.getElementById("victoryOverlay")!;
const confettiCanvas = document.getElementById(
  "confettiCanvas"
) as HTMLCanvasElement;
const ctx = confettiCanvas.getContext("2d")!;
const gameList = document.getElementById("gameList")!;
const createGameBtn = document.getElementById("createGameBtn")!;
const newGameName = document.getElementById("newGameName") as HTMLInputElement;
const usernameInput = document.getElementById(
  "usernameInput"
) as HTMLInputElement;
const submitUsername = document.getElementById("submitUsername")!;
const playersList = document.getElementById("playersList")!;
const victoryTitle = document.getElementById("victoryTitle")!;
const victoryText = document.getElementById("victoryText")!;
const victoryNewSessionBtn = document.getElementById("victoryNewSessionBtn")!;
const victoryLeaveGameBtn = document.getElementById("victoryLeaveGameBtn")!;

console.log("DOM elements:", { createGameBtn, newGameName, gameList });

// Initialize audio context on first user interaction
function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
  }
}

// Utility: Generate unique ID
function generateId() {
  return id();
}

// Utility: Shuffle array (Fisher-Yates)
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Generate random positions for filled cells in a row
function getRandomFilledPositions(): number[] {
  const positions = shuffle([...Array(COLS).keys()]);
  return positions.slice(0, FILLED_PER_ROW).sort((a, b) => a - b);
}

// Generate card data
function generateCard(): CardData {
  const shuffledContent = shuffle(PLACEHOLDER_CONTENT);
  let contentIndex = 0;
  const newCardData: CardData = [];

  // Select one color for all empty cells in this session
  sessionEmptyColor =
    PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)];

  for (let row = 0; row < ROWS; row++) {
    const filledPositions = new Set(getRandomFilledPositions());
    const rowData: Cell[] = [];

    for (let col = 0; col < COLS; col++) {
      if (filledPositions.has(col)) {
        rowData.push({
          type: "filled",
          content: shuffledContent[contentIndex++],
          selected: false,
        });
      } else {
        rowData.push({
          type: "empty",
          color: sessionEmptyColor,
        });
      }
    }

    newCardData.push(rowData);
  }

  return newCardData;
}

// Subscribe to games list and all players
db.subscribeQuery({ games: {}, players: {} }, (resp) => {
  if (resp.error) {
    console.error("Error loading games:", resp.error);
    return;
  }

  const games = (resp.data?.games || []) as Game[];
  const allPlayers = (resp.data?.players || []) as Player[];

  // Add player counts to each game and filter out empty games
  const gamesWithCounts = games
    .map((game) => ({
      ...game,
      playerCount: allPlayers.filter((p) => p.gameId === game.id).length,
    }))
    .filter((game) => game.playerCount > 0); // Only show games with players

  renderGamesList(gamesWithCounts);
});

// Render games list
function renderGamesList(games: (Game & { playerCount: number })[]) {
  if (games.length === 0) {
    gameList.innerHTML =
      '<p style="text-align: center; color: #7f8c8d">No games available. Create one!</p>';
    return;
  }

  gameList.innerHTML = games
    .map(
      (game) => `
      <div class="game-item" data-game-id="${game.id}">
        <div class="game-info">
          <div class="game-name">${game.name}</div>
          <div class="game-players">${game.playerCount} player(s)</div>
        </div>
        <button class="btn-primary" style="padding: 0.5rem 1rem; font-size: 0.9rem;">Join</button>
      </div>
    `
    )
    .join("");

  // Attach event listeners
  document.querySelectorAll(".game-item").forEach((item) => {
    item.addEventListener("click", () => {
      const gameId = (item as HTMLElement).dataset.gameId;
      if (gameId) selectGame(gameId);
    });
  });
}

// Create new game
createGameBtn.addEventListener("click", async () => {
  try {
    const gameName = newGameName.value.trim();
    if (!gameName) {
      alert("Please enter a game name");
      return;
    }

    console.log("Creating game:", gameName);
    initAudioContext();
    const gameId = generateId();

    console.log("Transacting to database...");
    await db.transact(
      db.tx.games[gameId].update({
        name: gameName,
        createdAt: Date.now(),
      })
    );

    console.log("Game created successfully!");
    newGameName.value = "";
    selectGame(gameId);
  } catch (error) {
    console.error("Error creating game:", error);
    alert("Error creating game: " + (error as Error).message);
  }
});

// Select game to join
function selectGame(gameId: string) {
  currentGameId = gameId;

  // Check if we have a saved username
  const savedUsername = loadSavedUsername();
  if (savedUsername) {
    // Auto-join with saved username
    currentUsername = savedUsername;
    joinGameWithUsername(savedUsername);
  } else {
    // Show username modal
    usernameModal.classList.add("show");
  }
}

// Join game with username
async function joinGameWithUsername(username: string) {
  initAudioContext();
  currentUsername = username;
  currentPlayerId = generateId();

  // Generate unique card for this player
  const playerCard = generateCard();

  await db.transact(
    db.tx.players[currentPlayerId].update({
      gameId: currentGameId,
      username: username,
      selectedCells: [],
      completedLines: 0,
      hasCompletedCard: false,
      joinedAt: Date.now(),
      cardData: playerCard,
      emptyColor: sessionEmptyColor,
    })
  );

  showGameScreen();
}

// Submit username and join game
submitUsername.addEventListener("click", async () => {
  const username = usernameInput.value.trim();
  if (!username) {
    alert("Please enter your name");
    return;
  }

  // Save username to localStorage
  saveUsername(username);

  usernameInput.value = "";
  usernameModal.classList.remove("show");

  await joinGameWithUsername(username);
});

// Show game screen
function showGameScreen() {
  landingScreen.classList.remove("active");
  gameScreen.classList.add("active");

  // Unsubscribe from previous subscription if it exists
  if (gameSubscriptionUnsubscribe) {
    gameSubscriptionUnsubscribe();
  }

  // Subscribe to current game and its players
  const unsubscribe = db.subscribeQuery(
    {
      games: {
        $: {
          where: { id: currentGameId },
        },
        players: {},
      },
      players: {
        $: {
          where: { gameId: currentGameId },
        },
      },
    },
    (resp) => {
      if (resp.error) {
        console.error("Error loading game:", resp.error);
        return;
      }

      const game = resp.data?.games?.[0] as Game | undefined;
      const players = (resp.data?.players || []) as PlayerWithCard[];

      // Check if current player still exists (they might have been removed)
      const currentPlayer = players.find((p) => p.id === currentPlayerId);

      if (!currentPlayer) {
        // Player was removed, go back to landing screen
        returnToLandingScreen();
        return;
      }

      if (currentPlayer.cardData) {
        // Use the player's unique card data (create a deep copy to make it mutable)
        cardData = JSON.parse(JSON.stringify(currentPlayer.cardData));
        sessionEmptyColor = currentPlayer.emptyColor;

        // Apply selected cells to card data
        if (currentPlayer.selectedCells) {
          currentPlayer.selectedCells.forEach((cellIndex) => {
            const row = Math.floor(cellIndex / COLS);
            const col = cellIndex % COLS;
            if (
              cardData[row] &&
              cardData[row][col] &&
              cardData[row][col].type === "filled"
            ) {
              cardData[row][col].selected = true;
            }
          });
        }

        renderCard();
      }

      renderPlayersList(players);

      // Check if there's a winner and show overlay to all players
      if (game?.winnerId) {
        showWinnerOverlay(game.winnerId, game.winnerName || "Someone");
      } else {
        // Hide overlay if no winner yet
        hideWinnerOverlay();
      }
    }
  );

  gameSubscriptionUnsubscribe = unsubscribe;
}

// Helper function to return to landing screen
function returnToLandingScreen() {
  // Unsubscribe from game updates
  if (gameSubscriptionUnsubscribe) {
    gameSubscriptionUnsubscribe();
    gameSubscriptionUnsubscribe = null;
  }

  // Clear game state (but keep username in localStorage)
  currentGameId = null;
  currentPlayerId = null;
  // Note: we keep currentUsername so we don't need to ask again
  cardData = [];
  completedRows.clear();
  hasPlayedLineSound = false;

  // Return to landing screen
  gameScreen.classList.remove("active");
  landingScreen.classList.add("active");
  victoryOverlay.classList.remove("show");
}

// Render card
function renderCard() {
  grid.innerHTML = "";

  cardData.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const cellDiv = document.createElement("div");
      cellDiv.className = `cell ${cell.type}`;

      if (cell.type === "filled") {
        cellDiv.textContent = cell.content || "";
        if (cell.selected) {
          cellDiv.classList.add("selected");
        }
        cellDiv.addEventListener("click", () =>
          handleCellClick(rowIndex, colIndex)
        );
      } else {
        cellDiv.style.setProperty("--cell-color", cell.color || "");
      }

      grid.appendChild(cellDiv);
    });
  });
}

// Handle cell click
async function handleCellClick(row: number, col: number) {
  const cell = cardData[row][col];
  if (cell.type !== "filled") return;

  initAudioContext();
  cell.selected = !cell.selected;
  renderCard();

  // Calculate selected cells and update database
  const selectedCells: number[] = [];
  cardData.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell.type === "filled" && cell.selected) {
        selectedCells.push(rowIndex * COLS + colIndex);
      }
    });
  });

  const { completedLines, hasCompletedCard } = checkCompletions();

  await db.transact(
    db.tx.players[currentPlayerId!].update({
      selectedCells: selectedCells,
      completedLines: completedLines,
      hasCompletedCard: hasCompletedCard,
    })
  );

  // If player just completed the card, mark them as winner in the game
  if (hasCompletedCard) {
    await db.transact(
      db.tx.games[currentGameId!].update({
        winnerId: currentPlayerId,
        winnerName: currentUsername,
      })
    );
  }
}

// Check for row and full completions
function checkCompletions(): {
  completedLines: number;
  hasCompletedCard: boolean;
} {
  let newlyCompletedCount = 0;
  let totalCompletedLines = 0;

  // Check each row
  cardData.forEach((row, rowIndex) => {
    const filledCells = row.filter((cell) => cell.type === "filled");
    const allSelected = filledCells.every((cell) => cell.selected);

    if (allSelected && filledCells.length > 0) {
      totalCompletedLines++;
      if (!completedRows.has(rowIndex)) {
        completedRows.add(rowIndex);
        newlyCompletedCount++;
      }
    }
  });

  // Trigger celebration for newly completed rows
  if (newlyCompletedCount > 0 && !hasPlayedLineSound) {
    onRowComplete();
  }

  // Check if all cells are selected
  const allFilledCells = cardData
    .flat()
    .filter((cell) => cell.type === "filled");
  const allCellsSelected =
    allFilledCells.length > 0 && allFilledCells.every((cell) => cell.selected);

  if (allCellsSelected && completedRows.size === ROWS) {
    onFullComplete();
  }

  return {
    completedLines: totalCompletedLines,
    hasCompletedCard: allCellsSelected && completedRows.size === ROWS,
  };
}

// Render players list
function renderPlayersList(players: Player[]) {
  const totalCells = ROWS * FILLED_PER_ROW;

  playersList.innerHTML = players
    .sort((a, b) => b.selectedCells.length - a.selectedCells.length)
    .map((player) => {
      const progress = `${player.selectedCells.length}/${totalCells}`;

      // Show different icons based on completion
      let icons = "";
      if (player.hasCompletedCard) {
        icons = '<span class="bingo-icon">🎉</span>';
      } else if (player.completedLines > 0) {
        icons = '<span class="bingo-icon">✓</span>';
      }

      const completedClass = player.hasCompletedCard ? "completed" : "";

      return `
        <li class="player-item ${completedClass}">
          <span class="player-name">${player.username}</span>
          <div class="player-stats">
            <span class="player-progress">${progress}</span>
            ${icons}
          </div>
        </li>
      `;
    })
    .join("");
}

// Row completion handler
function onRowComplete() {
  playRowCompleteSound();
  launchConfetti(50);
  hasPlayedLineSound = true;
}

// Full completion handler (for current player)
function onFullComplete() {
  playFullCompleteSound();
  launchConfetti(200);
  // Note: The overlay will be shown via the game subscription when winnerId is set
}

// Show winner overlay to all players
function showWinnerOverlay(winnerId: string, winnerName: string) {
  const isWinner = winnerId === currentPlayerId;

  if (isWinner) {
    // Winner view
    victoryTitle.textContent = "🎉 BINGO! 🎉";
    victoryText.textContent = "Parabéns! Você completou o cartão!";
    launchConfetti(200);
  } else {
    // Loser view
    victoryTitle.textContent = "😔 Game Over";
    victoryText.textContent = `${winnerName} won the game!`;
    playLossSound();
  }

  victoryOverlay.classList.add("show");
}

// Hide winner overlay
function hideWinnerOverlay() {
  victoryOverlay.classList.remove("show");
}

// Play row complete sound
function playRowCompleteSound() {
  if (!audioContext) return;

  const notes = [523.25, 659.25]; // C5, E5
  const duration = 0.15;

  notes.forEach((freq, index) => {
    const oscillator = audioContext!.createOscillator();
    const gainNode = audioContext!.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext!.destination);

    oscillator.frequency.value = freq;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(
      0.3,
      audioContext!.currentTime + index * duration
    );
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext!.currentTime + index * duration + duration
    );

    oscillator.start(audioContext!.currentTime + index * duration);
    oscillator.stop(audioContext!.currentTime + index * duration + duration);
  });
}

// Play full complete sound
function playFullCompleteSound() {
  if (!audioContext) return;

  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  const duration = 0.2;

  notes.forEach((freq, index) => {
    const oscillator = audioContext!.createOscillator();
    const gainNode = audioContext!.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext!.destination);

    oscillator.frequency.value = freq;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(
      0.3,
      audioContext!.currentTime + index * duration
    );
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext!.currentTime + index * duration + duration * 1.5
    );

    oscillator.start(audioContext!.currentTime + index * duration);
    oscillator.stop(
      audioContext!.currentTime + index * duration + duration * 1.5
    );
  });
}

// Play loss sound
function playLossSound() {
  if (!audioContext) return;

  // Descending sad notes
  const notes = [523.25, 466.16, 415.3, 392.0]; // C5, A#4, G#4, G4
  const duration = 0.25;

  notes.forEach((freq, index) => {
    const oscillator = audioContext!.createOscillator();
    const gainNode = audioContext!.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext!.destination);

    oscillator.frequency.value = freq;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(
      0.2,
      audioContext!.currentTime + index * duration
    );
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext!.currentTime + index * duration + duration * 1.2
    );

    oscillator.start(audioContext!.currentTime + index * duration);
    oscillator.stop(
      audioContext!.currentTime + index * duration + duration * 1.2
    );
  });
}

// Confetti system
let confettiPieces: ConfettiPiece[] = [];
let animationId: number | null = null;

function resizeCanvas() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

class ConfettiPiece {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  gravity: number;

  constructor() {
    this.x = Math.random() * confettiCanvas.width;
    this.y = -20;
    this.w = Math.random() * 10 + 5;
    this.h = Math.random() * 10 + 5;
    this.vx = Math.random() * 4 - 2;
    this.vy = Math.random() * 3 + 2;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = Math.random() * 10 - 5;
    this.color =
      PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)];
    this.gravity = 0.1;
  }

  update() {
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    this.rotation += this.rotationSpeed;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
    ctx.restore();
  }

  isOffScreen() {
    return this.y > confettiCanvas.height + 20;
  }
}

function launchConfetti(count: number) {
  for (let i = 0; i < count; i++) {
    confettiPieces.push(new ConfettiPiece());
  }

  if (!animationId) {
    animateConfetti();
  }
}

function animateConfetti() {
  ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

  confettiPieces = confettiPieces.filter((piece) => !piece.isOffScreen());

  confettiPieces.forEach((piece) => {
    piece.update();
    piece.draw();
  });

  if (confettiPieces.length > 0) {
    animationId = requestAnimationFrame(animateConfetti);
  } else {
    animationId = null;
  }
}

// Clear button handler
clearBtn.addEventListener("click", async () => {
  initAudioContext();
  completedRows.clear();
  cardData.forEach((row) => {
    row.forEach((cell) => {
      if (cell.type === "filled") {
        cell.selected = false;
      }
    });
  });
  renderCard();

  await db.transact(
    db.tx.players[currentPlayerId!].update({
      selectedCells: [],
      completedLines: 0,
      hasCompletedCard: false,
    })
  );
});

// New session handler (reusable function)
async function startNewSession() {
  console.log("Starting new session...");
  initAudioContext();

  // Clear local state immediately
  completedRows.clear();
  hasPlayedLineSound = false;
  cardData = [];

  console.log("Resetting winner in game...");
  // Reset winner in the game first
  await db.transact(
    db.tx.games[currentGameId!].update({
      winnerId: null,
      winnerName: null,
    })
  );

  console.log("Fetching all players...");
  // Get all players in the game using subscribeQuery with immediate unsubscribe
  const players = await new Promise<Player[]>((resolve, reject) => {
    let unsubscribeFn: (() => void) | null = null;
    unsubscribeFn = db.subscribeQuery(
      {
        players: {
          $: {
            where: { gameId: currentGameId },
          },
        },
      },
      (resp) => {
        if (resp.error) {
          reject(resp.error);
        } else {
          const playersList = (resp.data?.players || []) as Player[];
          if (unsubscribeFn) unsubscribeFn();
          resolve(playersList);
        }
      }
    );
  });

  console.log(`Found ${players.length} players to reset`);

  // Generate new cards for all players first
  const playerUpdates = players.map((player) => {
    const newCard = generateCard();
    const newColor =
      PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)];

    console.log(`Generated new card for player: ${player.username}`);

    return {
      playerId: player.id,
      update: {
        selectedCells: [],
        completedLines: 0,
        hasCompletedCard: false,
        cardData: newCard,
        emptyColor: newColor,
      },
    };
  });

  // Update all players in sequence
  for (const { playerId, update } of playerUpdates) {
    console.log(`Updating player ${playerId} with new card...`);
    await db.transact(db.tx.players[playerId].update(update));
  }

  console.log("New session started - all players reset with new cards!");

  // The card and overlay will be reloaded automatically via the subscription
}

// New session button handler (in game)
newSessionBtn.addEventListener("click", startNewSession);

// Victory overlay New Session button handler
victoryNewSessionBtn.addEventListener("click", startNewSession);

// Leave game button handler
leaveGameBtn.addEventListener("click", async () => {
  if (confirm("Are you sure you want to leave this game?")) {
    const gameIdToCheck = currentGameId;
    const playerIdToDelete = currentPlayerId;

    console.log(
      "Leaving game:",
      gameIdToCheck,
      "Deleting player:",
      playerIdToDelete
    );

    // Delete the player
    await db.transact(db.tx.players[playerIdToDelete!].delete());

    // Wait a bit for the delete to propagate
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check if there are any remaining players in the game
    const remainingPlayers = await new Promise<Player[]>((resolve, reject) => {
      let unsubscribeFn: (() => void) | null = null;
      unsubscribeFn = db.subscribeQuery(
        {
          players: {
            $: {
              where: { gameId: gameIdToCheck },
            },
          },
        },
        (resp) => {
          if (resp.error) {
            reject(resp.error);
          } else {
            const playersList = (resp.data?.players || []) as Player[];
            if (unsubscribeFn) unsubscribeFn();
            resolve(playersList);
          }
        }
      );
    });

    console.log(
      "Remaining players in game:",
      remainingPlayers.length,
      remainingPlayers
    );

    // If no players left, delete the game
    if (remainingPlayers.length === 0) {
      console.log("No players left, deleting game:", gameIdToCheck);
      await db.transact(db.tx.games[gameIdToCheck!].delete());
    }

    // Return to landing screen
    returnToLandingScreen();
  }
});

// Victory overlay Leave Game button handler
victoryLeaveGameBtn.addEventListener("click", async () => {
  if (confirm("Are you sure you want to leave this game?")) {
    const gameIdToCheck = currentGameId;
    const playerIdToDelete = currentPlayerId;

    console.log(
      "Leaving game:",
      gameIdToCheck,
      "Deleting player:",
      playerIdToDelete
    );

    // Delete the player
    await db.transact(db.tx.players[playerIdToDelete!].delete());

    // Wait a bit for the delete to propagate
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check if there are any remaining players in the game
    const remainingPlayers = await new Promise<Player[]>((resolve, reject) => {
      let unsubscribeFn: (() => void) | null = null;
      unsubscribeFn = db.subscribeQuery(
        {
          players: {
            $: {
              where: { gameId: gameIdToCheck },
            },
          },
        },
        (resp) => {
          if (resp.error) {
            reject(resp.error);
          } else {
            const playersList = (resp.data?.players || []) as Player[];
            if (unsubscribeFn) unsubscribeFn();
            resolve(playersList);
          }
        }
      );
    });

    console.log(
      "Remaining players in game:",
      remainingPlayers.length,
      remainingPlayers
    );

    // If no players left, delete the game
    if (remainingPlayers.length === 0) {
      console.log("No players left, deleting game:", gameIdToCheck);
      await db.transact(db.tx.games[gameIdToCheck!].delete());
    }

    // Return to landing screen
    returnToLandingScreen();
  }
});

// Cleanup empty games periodically
async function cleanupEmptyGames() {
  try {
    // Fetch games and players using subscribeQuery with immediate unsubscribe
    const { games, allPlayers } = await new Promise<{
      games: Game[];
      allPlayers: Player[];
    }>((resolve, reject) => {
      let unsubscribeFn: (() => void) | null = null;
      unsubscribeFn = db.subscribeQuery(
        { games: {}, players: {} },
        (resp) => {
          if (resp.error) {
            reject(resp.error);
          } else {
            const games = (resp.data?.games || []) as Game[];
            const allPlayers = (resp.data?.players || []) as Player[];
            if (unsubscribeFn) unsubscribeFn();
            resolve({ games, allPlayers });
          }
        }
      );
    });

    // Find games with no players
    const emptyGames = games.filter((game) => {
      const playerCount = allPlayers.filter((p) => p.gameId === game.id).length;
      return playerCount === 0;
    });

    // Delete empty games
    if (emptyGames.length > 0) {
      console.log(`Cleaning up ${emptyGames.length} empty game(s)`);
      for (const game of emptyGames) {
        await db.transact(db.tx.games[game.id].delete());
      }
    }
  } catch (error) {
    console.error("Error cleaning up empty games:", error);
  }
}

// Run cleanup every 30 seconds
setInterval(cleanupEmptyGames, 30000);

// Run cleanup once on startup
cleanupEmptyGames();
