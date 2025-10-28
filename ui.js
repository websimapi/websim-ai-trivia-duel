function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.style.display = 'none';
    });
    document.getElementById(screenId).style.display = 'block';
}

function updateLobbyUI(peers, clientId) {
    const playerList = document.getElementById('player-list');
    playerList.innerHTML = '';
    const peerCount = Object.keys(peers).length;

    Object.values(peers).forEach(peer => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        playerCard.innerHTML = `<img src="${peer.avatarUrl}" alt="${peer.username}"><span>${peer.username} ${peer.id === clientId ? '(You)' : ''}</span>`;
        playerList.appendChild(playerCard);
    });

    const startBtn = document.getElementById('start-game-btn');
    if (peerCount >= 2) {
        startBtn.style.display = 'block';
    } else {
        startBtn.style.display = 'none';
    }
}

function updateCategoryUI(presence) {
    const statusDiv = document.getElementById('category-status');
    statusDiv.innerHTML = '';
    Object.values(presence).forEach(player => {
        const playerStatus = document.createElement('div');
        playerStatus.textContent = `${player.username}: ${player.category ? `✅ Submitted` : '🤔 Choosing...'}`;
        statusDiv.appendChild(playerStatus);
    });
}

function updatePrimingUI(presence) {
    const statusDiv = document.getElementById('priming-status');
    statusDiv.innerHTML = '';
    Object.values(presence).forEach(player => {
        const playerStatus = document.createElement('div');
        playerStatus.textContent = `${player.username}: ${player.isReady ? `✅ Ready` : '📝 Typing...'}`;
        statusDiv.appendChild(playerStatus);
    });
}

function showLoading(message) {
    showScreen('round-screen');
    const questionContainer = document.getElementById('question-container');
    questionContainer.innerHTML = `<h2>${message}</h2>`;
    document.getElementById('round-header').style.visibility = 'hidden';
}


function updateRoundUI(state, presence, clientId, answerCallback) {
    document.getElementById('round-header').style.visibility = 'visible';
    
    const scoresDiv = document.getElementById('scores');
    scoresDiv.innerHTML = Object.entries(state.scores).map(([id, score]) =>
        `${presence[id]?.username || 'Player'}: ${score}`
    ).join(' | ');

    document.getElementById('timer').textContent = `Time: ${state.timer}`;

    const questionText = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const roundResult = document.getElementById('round-result');

    questionText.textContent = state.currentQuestion.question;
    optionsContainer.innerHTML = '';
    roundResult.textContent = '';
    
    const clientPresence = presence[clientId];
    const hasAnswered = clientPresence && clientPresence.answered;

    state.currentQuestion.options.forEach(option => {
        const button = document.createElement('button');
        button.textContent = option;
        button.className = 'option-btn';
        if (hasAnswered) {
            button.classList.add('disabled');
            button.disabled = true;
        } else {
            button.onclick = () => answerCallback(option);
        }
        optionsContainer.appendChild(button);
    });

    const waitingDiv = document.getElementById('waiting-for-players');
    if (hasAnswered) {
        waitingDiv.textContent = 'Waiting for other players...';
    } else {
        waitingDiv.textContent = '';
    }
}

function revealAnswers(state, presence, clientId) {
    const { options, answer: correctAnswer } = state.currentQuestion;
    const optionButtons = document.querySelectorAll('.option-btn');

    optionButtons.forEach(button => {
        button.disabled = true;
        button.classList.add('disabled');
        const optionText = button.textContent;
        if (optionText === correctAnswer) {
            button.classList.add('correct');
        }
    });

    Object.values(presence).forEach(player => {
        if (player.answer && player.answer !== correctAnswer) {
            optionButtons.forEach(button => {
                if (button.textContent === player.answer) {
                    button.classList.add('incorrect');
                }
            });
        }
    });

    const roundResult = document.getElementById('round-result');
    const clientAnswer = presence[clientId]?.answer;
    if (clientAnswer === correctAnswer) {
        roundResult.textContent = 'You got it right!';
        roundResult.style.color = '#4CAF50';
    } else {
        roundResult.textContent = 'Incorrect!';
        roundResult.style.color = '#f44336';
    }
}


function updateGameOverUI(winnerId, peers, isHost) {
    const winnerText = document.getElementById('winner-text');
    const winner = peers[winnerId];
    winnerText.textContent = winner ? `${winner.username} wins!` : 'It\'s a draw!';
    
    const playAgainBtn = document.getElementById('play-again-btn');
    if (isHost) {
        playAgainBtn.style.display = 'inline-block';
    } else {
        playAgainBtn.style.display = 'none';
        winnerText.textContent += "\nWaiting for the host to start a new game.";
    }
}

export {
    showScreen,
    updateLobbyUI,
    updateCategoryUI,
    updatePrimingUI,
    showLoading,
    updateRoundUI,
    revealAnswers,
    updateGameOverUI
};