import { SnekProcessor } from "./gameprocessors/SnekProcessor" // Adjust the import path as needed
import { Timestamp } from "firebase/firestore" // Adjust this import based on your firebase setup
import { GameSetup, GamePlayer } from "@shared/types/Game"

// Mock Timestamp.now() to return a consistent value
jest.mock("firebase/firestore", () => ({
  Timestamp: {
    now: jest.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
  },
}))

describe("SnekProcessor", () => {
  function createGameSetup(
    width: number,
    height: number,
    playerCount: number,
  ): GameSetup {
    const gamePlayers: GamePlayer[] = Array.from(
      { length: playerCount },
      (_, i) => ({
        id: `p${i + 1}`,
        type: "human",
      }),
    )
    return {
      gameType: "snek",
      gamePlayers: gamePlayers,
      boardWidth: width,
      boardHeight: height,
      playersReady: [],
      maxTurnTime: 10,
      startRequested: false,
      started: true,
      timeCreated: Timestamp.now(),
    }
  }

  test("initializes game with correct board size", () => {
    const gameSetup = createGameSetup(7, 7, 4)
    const game = new SnekProcessor(gameSetup)
    const initializedGame = game.initializeGame()
    const board = game.visualizeBoard(initializedGame)
    const lines = board.split("\n")
    expect(lines.length).toBe(7)
    expect(lines[0].split(" ").length).toBe(7)
  })

  test("places correct number of players", () => {
    const gameSetup = createGameSetup(9, 9, 4)
    const game = new SnekProcessor(gameSetup)
    const initializedGame = game.initializeGame()
    const board = game.visualizeBoard(initializedGame)
    const playerCount = (board.match(/[1-4]/g) || []).length
    expect(playerCount).toBe(4)
  })

  test("places players on even squares", () => {
    const gameSetup = createGameSetup(11, 11, 8)
    const game = new SnekProcessor(gameSetup)
    const initializedGame = game.initializeGame()
    const board = game.visualizeBoard(initializedGame)
    const lines = board.split("\n")
    for (let y = 0; y < lines.length; y++) {
      const squares = lines[y].split(" ")
      for (let x = 0; x < squares.length; x++) {
        if (squares[x].match(/[1-8]/)) {
          expect((x + y) % 2).toBe(0)
        }
      }
    }
  })

  test("places players near edges for small number of players", () => {
    const gameSetup = createGameSetup(7, 7, 2)
    const game = new SnekProcessor(gameSetup)
    const initializedGame = game.initializeGame()
    const board = game.visualizeBoard(initializedGame)
    const lines = board.split("\n")
    const playerPositions = []
    for (let y = 0; y < lines.length; y++) {
      const squares = lines[y].split(" ")
      for (let x = 0; x < squares.length; x++) {
        if (squares[x].match(/[1-2]/)) {
          playerPositions.push({ x, y })
        }
      }
    }
    playerPositions.forEach((pos) => {
      expect(
        pos.x === 1 || pos.x === 5 || pos.y === 1 || pos.y === 5,
      ).toBeTruthy()
    })
  })

  test("handles different board sizes and player counts", () => {
    const testCases = [
      { width: 5, height: 5, players: 2 },
      { width: 7, height: 7, players: 4 },
      { width: 9, height: 9, players: 8 },
      { width: 13, height: 13, players: 12 },
    ]

    testCases.forEach(({ width, height, players }) => {
      const gameSetup = createGameSetup(width, height, players)
      const game = new SnekProcessor(gameSetup)
      const initializedGame = game.initializeGame()
      const board = game.visualizeBoard(initializedGame)
      const lines = board.split("\n")

      expect(lines.length).toBe(height)
      expect(lines[0].split(" ").length).toBe(width)

      const playerCount = (board.match(/[1-9]/g) || []).length
      expect(playerCount).toBe(players)
    })
  })
})
