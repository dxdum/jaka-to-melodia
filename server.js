const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Admin password - change this!
const ADMIN_PASSWORD = 'melodia2024';

// Timer interval reference
let timerInterval = null;

// Game state
let gameState = {
  currentRound: 1,
  teams: [
    { id: 1, name: 'Drużyna 1', points: 0 },
    { id: 2, name: 'Drużyna 2', points: 0 },
    { id: 3, name: 'Drużyna 3', points: 0 },
    { id: 4, name: 'Drużyna 4', points: 0 },
    { id: 5, name: 'Drużyna 5', points: 0 }
  ],
  round1Categories: [
    { id: 1, name: 'POLSKIE PRZEBOJE WSZECH CZASÓW', totalTracks: 7, remainingTracks: 7, pointsRule: 'tytuł 1pkt, wykonawca 1pkt' },
    { id: 2, name: 'MUZYKA Z BAJEK I FILMÓW DLA DZIECI', totalTracks: 7, remainingTracks: 7, pointsRule: 'Jaka to bajka 1pkt' },
    { id: 3, name: 'WSPÓŁCZESNE HITY RADIOWE', totalTracks: 3, remainingTracks: 3, pointsRule: 'Tytuł 1pkt, Wykonawca 1pkt' },
    { id: 4, name: 'FILMY', totalTracks: 4, remainingTracks: 4, pointsRule: 'Zgadnij film 1pkt' },
    { id: 5, name: 'DISCO POLO & IMPREZY', totalTracks: 5, remainingTracks: 5, pointsRule: 'Wykonawca 1pkt, Tytuł 1pkt' },
    { id: 6, name: 'HITY LAT 90 - POLSKA I ŚWIAT', totalTracks: 5, remainingTracks: 5, pointsRule: 'Wykonawca 1pkt, Tytuł 1pkt' },
    { id: 7, name: 'HITY LAT 80 - ŚWIAT', totalTracks: 5, remainingTracks: 5, pointsRule: 'Wykonawca 1pkt, Tytuł 1pkt' }
  ],
  round2Categories: [
    { id: 1, name: 'Polskie Hity', totalTracks: 3, remainingTracks: 3 },
    { id: 2, name: 'Filmowe', totalTracks: 3, remainingTracks: 3 },
    { id: 3, name: 'Z Bajek', totalTracks: 3, remainingTracks: 3 },
    { id: 4, name: 'Klasyczne', totalTracks: 3, remainingTracks: 3 },
    { id: 5, name: 'Lata 80.', totalTracks: 3, remainingTracks: 3 },
    { id: 6, name: 'Lata 90.', totalTracks: 3, remainingTracks: 3 },
    { id: 7, name: 'Lata 2000.', totalTracks: 3, remainingTracks: 3 },
    { id: 8, name: 'Rockowe', totalTracks: 3, remainingTracks: 3 },
    { id: 9, name: 'Metalowe', totalTracks: 3, remainingTracks: 3 }
  ],
  // Round 3 state
  round3: {
    activeTeamId: null,
    timerRunning: false,
    timeRemaining: 60
  }
};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Public game view
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Socket.io connections
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send current state to new connection
  socket.emit('gameState', gameState);

  // Admin authentication
  socket.on('adminLogin', (password) => {
    if (password === ADMIN_PASSWORD) {
      socket.emit('adminLoginResult', { success: true });
      socket.isAdmin = true;
    } else {
      socket.emit('adminLoginResult', { success: false, message: 'Nieprawidłowe hasło!' });
    }
  });

  // Add new team
  socket.on('addTeam', () => {
    if (!socket.isAdmin) return;
    const newId = Math.max(...gameState.teams.map(t => t.id)) + 1;
    gameState.teams.push({
      id: newId,
      name: `Drużyna ${newId}`,
      points: 0
    });
    io.emit('gameState', gameState);
  });

  // Remove team
  socket.on('removeTeam', (teamId) => {
    if (!socket.isAdmin) return;
    if (gameState.teams.length <= 2) return;
    gameState.teams = gameState.teams.filter(t => t.id !== teamId);
    if (gameState.round3.activeTeamId === teamId) {
      gameState.round3.activeTeamId = null;
    }
    io.emit('gameState', gameState);
  });

  // Update team name
  socket.on('updateTeamName', (data) => {
    if (!socket.isAdmin) return;
    const team = gameState.teams.find(t => t.id === data.teamId);
    if (team) {
      team.name = data.name;
      io.emit('gameState', gameState);
    }
  });

  // Update team points
  socket.on('updateTeamPoints', (data) => {
    if (!socket.isAdmin) return;
    const team = gameState.teams.find(t => t.id === data.teamId);
    if (team) {
      team.points = Math.max(0, team.points + data.change);
      io.emit('gameState', gameState);
    }
  });

  // Set team points directly
  socket.on('setTeamPoints', (data) => {
    if (!socket.isAdmin) return;
    const team = gameState.teams.find(t => t.id === data.teamId);
    if (team) {
      team.points = Math.max(0, data.points);
      io.emit('gameState', gameState);
    }
  });

  // Update round 1 category tracks
  socket.on('updateRound1Tracks', (data) => {
    if (!socket.isAdmin) return;
    const category = gameState.round1Categories.find(c => c.id === data.categoryId);
    if (category) {
      category.remainingTracks = Math.max(0, Math.min(data.remaining, category.totalTracks));
      io.emit('gameState', gameState);
    }
  });

  // Update round 2 category tracks
  socket.on('updateRound2Tracks', (data) => {
    if (!socket.isAdmin) return;
    const category = gameState.round2Categories.find(c => c.id === data.categoryId);
    if (category) {
      category.remainingTracks = Math.max(0, Math.min(data.remaining, category.totalTracks));
      io.emit('gameState', gameState);
    }
  });

  // Switch round
  socket.on('switchRound', (round) => {
    if (!socket.isAdmin) return;
    gameState.currentRound = round;
    // Stop timer when switching rounds
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
      gameState.round3.timerRunning = false;
    }
    io.emit('gameState', gameState);
  });

  // Round 1: Start category lottery
  socket.on('startCategoryLottery', () => {
    if (!socket.isAdmin) return;

    // Get categories with remaining tracks
    const availableCategories = gameState.round1Categories.filter(c => c.remainingTracks > 0);
    if (availableCategories.length === 0) return;

    // Pick random winner
    const winnerIndex = Math.floor(Math.random() * availableCategories.length);
    const winner = availableCategories[winnerIndex];

    // Broadcast lottery start to all clients
    io.emit('categoryLotteryStart', {
      categories: availableCategories,
      winnerId: winner.id,
      duration: 7000
    });
  });

  // Round 3: Select active team
  socket.on('round3SelectTeam', (teamId) => {
    if (!socket.isAdmin) return;
    gameState.round3.activeTeamId = teamId;
    gameState.round3.timeRemaining = 60;
    gameState.round3.timerRunning = false;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    io.emit('gameState', gameState);
  });

  // Round 3: Start timer
  socket.on('round3StartTimer', () => {
    if (!socket.isAdmin) return;
    if (gameState.round3.activeTeamId === null) return;
    if (gameState.round3.timerRunning) return;

    gameState.round3.timerRunning = true;
    io.emit('gameState', gameState);

    timerInterval = setInterval(() => {
      if (gameState.round3.timeRemaining > 0) {
        gameState.round3.timeRemaining--;
        io.emit('gameState', gameState);
      } else {
        clearInterval(timerInterval);
        timerInterval = null;
        gameState.round3.timerRunning = false;
        io.emit('gameState', gameState);
      }
    }, 1000);
  });

  // Round 3: Stop timer
  socket.on('round3StopTimer', () => {
    if (!socket.isAdmin) return;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    gameState.round3.timerRunning = false;
    io.emit('gameState', gameState);
  });

  // Round 3: Reset timer
  socket.on('round3ResetTimer', () => {
    if (!socket.isAdmin) return;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    gameState.round3.timeRemaining = 60;
    gameState.round3.timerRunning = false;
    io.emit('gameState', gameState);
  });

  // Reset game
  socket.on('resetGame', () => {
    if (!socket.isAdmin) return;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    gameState.teams.forEach(t => t.points = 0);
    gameState.round1Categories.forEach(c => c.remainingTracks = c.totalTracks);
    gameState.round2Categories.forEach(c => c.remainingTracks = c.totalTracks);
    gameState.round3 = { activeTeamId: null, timerRunning: false, timeRemaining: 60 };
    gameState.currentRound = 1;
    io.emit('gameState', gameState);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           🎵 JAKA TO MELODIA - GAME SERVER 🎵             ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║   Server running on: http://localhost:${PORT}               ║
║                                                           ║
║   👥 Teams view:  http://localhost:${PORT}/                 ║
║   🔐 Admin panel: http://localhost:${PORT}/admin            ║
║                                                           ║
║   Admin password: ${ADMIN_PASSWORD}                          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
