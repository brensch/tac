// Utility function to generate a 4-character lowercase string and number combo
const generateShortID = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";
    for (let i = 0; i < 4; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
};
// Function to initialize a new game with a flattened board
const initializeGame = (playerID) => {
    const boardSize = 4 * 4; // For a 4x4 game
    const initialBoard = Array(boardSize).fill(""); // Flattened board
    return {
        board: initialBoard,
        boardWidth: 4,
        playerIDs: [playerID],
        currentRound: 1,
        gameID: generateShortID(),
        started: false,
        hasMoved: [],
    };
};
export { initializeGame };
//# sourceMappingURL=Game.js.map