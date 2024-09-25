import { checkWinCondition } from "./helpers" // Import the function you're testing

function displayBoardWithIndices(board: string[], boardWidth: number): void {
  const size = board.length
  for (let y = 0; y < Math.ceil(size / boardWidth); y++) {
    let row = ""
    for (let x = 0; x < boardWidth; x++) {
      const idx = y * boardWidth + x
      if (idx < size) {
        row += `[${idx}:${board[idx]}] `.padEnd(10)
      }
    }
    console.log(row)
  }
}

describe("checkWinCondition", () => {
  test("should work", () => {
    const board = [
      "X",
      "O",
      "X",
      "O",
      "O",
      "X",
      "O",
      "X",
      "O",
      "-1",
      "X",
      "O",
      "X",
      "O",
      "X",
      "X",
      "O",
      "X",
      "O",
      "X",
      "X",
      "O",
      "O",
      "O",
      "X",
    ]
    const boardWidth = 5
    const winLength = 5
    const playerIDs = ["X", "O"]

    displayBoardWithIndices(board, boardWidth)

    const result = checkWinCondition(board, boardWidth, winLength, playerIDs)
    expect(result).toEqual([])
  })

  test("should work", () => {
    const board = [
      "X",
      "O",
      "X",
      "O",
      "X",
      "X",
      "O",
      "O",
      "O",
      "-1",
      "X",
      "O",
      "X",
      "O",
      "X",
      "O",
      "X",
      "X",
      "O",
      "X",
      "O",
      "O",
      "O",
      "O",
      "X",
    ]
    const boardWidth = 5
    const winLength = 5
    const playerIDs = ["X", "O"]

    displayBoardWithIndices(board, boardWidth)

    const result = checkWinCondition(board, boardWidth, winLength, playerIDs)
    expect(result).toEqual([])
  })
  //   test("should return no winner if board is not fully filled", () => {
  //     const board = [
  //       "X",
  //       "X",
  //       "X",
  //       "",
  //       "X",
  //       "O",
  //       "O",
  //       "O",
  //       "O",
  //       "X",
  //       "X",
  //       "O",
  //       "O",
  //       "X",
  //       "X",
  //       "X",
  //     ]
  //     const boardWidth = 4
  //     const winLength = 4
  //     const playerIDs = ["X", "O"]

  //     const result = checkWinCondition(board, boardWidth, winLength, playerIDs)
  //     expect(result).toEqual([])
  //   })

  //   test("should find the longest continuous path for X when the board is fully filled", () => {
  //     const board = [
  //       "X",
  //       "X",
  //       "X",
  //       "O",
  //       "X",
  //       "O",
  //       "O",
  //       "O",
  //       "O",
  //       "X",
  //       "X",
  //       "O",
  //       "O",
  //       "X",
  //       "X",
  //       "X",
  //     ]
  //     const boardWidth = 4
  //     const winLength = 4
  //     const playerIDs = ["X", "O"]

  //     const result = checkWinCondition(board, boardWidth, winLength, playerIDs)

  //     expect(result).toEqual([{ playerID: "X", winningSquares: [1, 5, 9, 13] }])
  //   })

  //   test("should find the longest continuous path for O when the board is fully filled", () => {
  //     const board = [
  //       "X",
  //       "X",
  //       "X",
  //       "O",
  //       "X",
  //       "O",
  //       "O",
  //       "O",
  //       "O",
  //       "X",
  //       "X",
  //       "O",
  //       "O",
  //       "X",
  //       "X",
  //       "O",
  //     ]
  //     const boardWidth = 4
  //     const winLength = 4
  //     const playerIDs = ["X", "O"]

  //     const result = checkWinCondition(board, boardWidth, winLength, playerIDs)

  //     expect(result).toEqual([{ playerID: "O", winningSquares: [3, 7, 11, 15] }])
  //   })

  //   test("should return the longest path for both players if there is a tie", () => {
  //     const board = [
  //       "X",
  //       "X",
  //       "O",
  //       "O",
  //       "X",
  //       "O",
  //       "O",
  //       "O",
  //       "O",
  //       "X",
  //       "X",
  //       "X",
  //       "O",
  //       "X",
  //       "X",
  //       "O",
  //     ]
  //     const boardWidth = 4
  //     const winLength = 4
  //     const playerIDs = ["X", "O"]

  //     const result = checkWinCondition(board, boardWidth, winLength, playerIDs)

  //     // Both X and O have paths of equal length
  //     expect(result).toEqual([
  //       { playerID: "X", winningSquares: [13, 9, 5, 1] },
  //       { playerID: "O", winningSquares: [3, 7, 11, 15] },
  //     ])
  //   })
})
