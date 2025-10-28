import {
    showScreen,
    updateLobbyUI,
    updateCategoryUI,
    updatePrimingUI,
    showLoading,
    updateRoundUI,
    revealAnswers,
    updateGameOverUI
} from './ui.js';
import { generateTrivia } from './ai.js';

const room = new WebsimSocket();
const MAX_SCORE = 10;
const ROUND_TIME = 20; // seconds

let roundInterval;

async function initializeGame() {
    await room.initialize();

    if (!room.roomState.gameState) {
        room.updateRoomState({
            gameState: 'lobby',
            scores: {},
            players: {},
            round: 0,
        });
    }

    room.updatePresence({
        isReady: false,
        category: null,
        primingText: null,
        answered: false,
        answer: null,
    });

    setupUIEventListeners();

    room.subscribeRoomState(handleRoomStateChange);
    room.subscribePresence(handlePresenceChange);
}

function handleRoomStateChange(state) {
    switch (state.gameState) {
        case 'lobby':
            showScreen('lobby-screen');
            updateLobbyUI(room.peers, room.clientId);
            break;
        case 'category-selection':
            showScreen('category-screen');
            updateCategoryUI(room.presence);
            break;
        case 'priming':
            showScreen('priming-screen');
            updatePrimingUI(room.presence);
            break;
        case 'round-start':
            startRound();
            break;
        case 'round-active':
            showScreen('round-screen');
            updateRoundUI(state, room.presence, room.clientId, handleAnswer);
            break;
        case 'round-reveal':
            clearInterval(roundInterval);
            revealAnswers(state, room.presence, room.clientId);
            setTimeout(checkForNextRound, 5000);
            break;
        case 'game-over':
            clearInterval(roundInterval);
            showScreen('game-over-screen');
            updateGameOverUI(state.winner, room.peers);
            break;
    }
}

function handlePresenceChange(presence) {
    switch (room.roomState.gameState) {
        case 'lobby':
            updateLobbyUI(room.peers, room.clientId);
            break;
        case 'category-selection':
            updateCategoryUI(presence);
            checkAllPlayersReadyForNextStage(Object.values(presence).filter(p => p.category));
            break;
        case 'priming':
            updatePrimingUI(presence);
            checkAllPlayersReadyForNextStage(Object.values(presence).filter(p => p.isReady));
            break;
        case 'round-active':
            const allAnswered = Object.values(presence).every(p => p.answered);
            if (allAnswered) {
                scoreRound();
            }
            break;
    }
}

function checkAllPlayersReadyForNextStage(readyPlayers) {
    if (readyPlayers.length === Object.keys(room.peers).length) {
         if (isHost()) {
            if (room.roomState.gameState === 'category-selection') {
                 room.updateRoomState({ gameState: 'priming' });
            } else if (room.roomState.gameState === 'priming') {
                 room.updateRoomState({ gameState: 'round-start' });
            }
        }
    }
}

function setupUIEventListeners() {
    document.getElementById('start-game-btn').addEventListener('click', () => {
        if (isHost()) {
            const initialScores = {};
            const players = {};
            Object.keys(room.peers).forEach(id => {
                initialScores[id] = 0;
                players[id] = { id };
            });
            room.updateRoomState({ gameState: 'category-selection', scores: initialScores, players });
        }
    });

    document.getElementById('submit-category-btn').addEventListener('click', () => {
        const category = document.getElementById('category-input').value;
        if (category.trim()) {
            room.updatePresence({ category });
            document.getElementById('category-input-container').style.display = 'none';
        }
    });

    document.getElementById('submit-priming-btn').addEventListener('click', () => {
        const primingText = document.getElementById('priming-input').value;
        room.updatePresence({ primingText, isReady: true });
        document.getElementById('priming-input-container').style.display = 'none';
    });
    
    document.getElementById('play-again-btn').addEventListener('click', () => {
        if (isHost()) {
            room.updateRoomState({ gameState: 'lobby', scores: {}, players: {}, round: 0 });
        }
        room.updatePresence({ isReady: false, category: null, primingText: null, answered: false, answer: null });
    });
}

async function startRound() {
    if (!isHost()) return;
    
    room.updateRoomState({ timer: ROUND_TIME });
    showLoading('Generating new question...');

    const playerIds = Object.keys(room.peers);
    const questionPlayerId = playerIds[Math.floor(Math.random() * playerIds.length)];
    const questionPlayerPresence = room.presence[questionPlayerId];

    try {
        const trivia = await generateTrivia(questionPlayerPresence.category, questionPlayerPresence.primingText);
        room.updateRoomState({
            gameState: 'round-active',
            currentQuestion: trivia,
            questionMaster: questionPlayerId,
            round: (room.roomState.round || 0) + 1,
        });
        
        startTimer();

    } catch (error) {
        console.error("Failed to generate trivia:", error);
        // Retry or handle error
        startRound(); // Simple retry
    }
}

function startTimer() {
    if(!isHost()) return;
    
    clearInterval(roundInterval);
    let timeLeft = ROUND_TIME;
    
    roundInterval = setInterval(() => {
        timeLeft--;
        room.updateRoomState({ timer: timeLeft });
        if (timeLeft <= 0) {
            clearInterval(roundInterval);
            scoreRound();
        }
    }, 1000);
}


function handleAnswer(answer) {
    room.updatePresence({ answered: true, answer: answer });
}

function scoreRound() {
    if (!isHost()) return;

    const newScores = { ...room.roomState.scores };
    const correctAnswer = room.roomState.currentQuestion.answer;
    
    Object.values(room.presence).forEach(player => {
        if (player.answer === correctAnswer) {
            newScores[player.clientId] = (newScores[player.clientId] || 0) + 1;
        }
    });

    room.updateRoomState({ gameState: 'round-reveal', scores: newScores });
}


function checkForNextRound() {
    if (!isHost()) return;

    const winner = Object.keys(room.roomState.scores).find(id => room.roomState.scores[id] >= MAX_SCORE);

    if (winner) {
        room.updateRoomState({ gameState: 'game-over', winner: winner });
    } else {
        // Reset presence for next round
        const resetPresence = {};
        Object.keys(room.presence).forEach(id => {
            resetPresence[id] = room.requestPresenceUpdate(id, {
                answered: false,
                answer: null,
            });
        });

        // The presence update handler will trigger the update for clients
        room.subscribePresenceUpdateRequests((updateRequest, fromClientId) => {
            if(room.clientId === fromClientId) return;
            room.updatePresence(updateRequest);
        });

        room.updateRoomState({ gameState: 'round-start' });
    }
}

function isHost() {
    // Simple host election: first player in the list is the host.
    const playerIds = Object.keys(room.peers).sort();
    return room.clientId === playerIds[0];
}

export { initializeGame };

