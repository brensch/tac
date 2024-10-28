import { calculateMMRChanges } from "./processTurn"
import * as fs from "fs"

interface Player {
    id: number
    mmr: number
    trueSkill: number
    gamesPlayed: number
    placements: number[] // Array to store count of each placement
    mmrHistory: (number | null)[] // Array to track MMR over time
    joinedRound: number // Round when the player joined
}

describe('MMR System Simulation with New Players', () => {
    function getWinProbability(playerSkill: number, opponentSkill: number): number {
        return 1 / (1 + Math.pow(10, -(playerSkill - opponentSkill) / 400))
    }

    function groupPlayersForRound(players: Player[]): Player[][] {
        const groups: Player[][] = []

        // Shuffle players to introduce randomness
        const shuffledPlayers = [...players]
        for (let i = shuffledPlayers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledPlayers[i], shuffledPlayers[j]] = [shuffledPlayers[j], shuffledPlayers[i]]
        }

        // Sort players by MMR to group similar MMR players together
        shuffledPlayers.sort((a, b) => b.mmr - a.mmr)

        // Group players
        let index = 0
        while (index < shuffledPlayers.length) {
            const remainingPlayers = shuffledPlayers.length - index

            // Determine group size (minimum 2, maximum 4)
            let groupSize = Math.min(4, remainingPlayers)

            // Ensure group size is at least 2
            if (remainingPlayers === 1 && groups.length > 0) {
                // Add the last player to the previous group
                groups[groups.length - 1].push(shuffledPlayers[index])
                index++
            } else if (remainingPlayers === 1 && groups.length === 0) {
                // Only one player in total, skip the round
                console.log(`Only one player (${shuffledPlayers[index].id}) is available. Skipping the round.`)
                index++
            } else {
                const group = shuffledPlayers.slice(index, index + groupSize)
                groups.push(group)
                index += groupSize
            }
        }

        return groups
    }

    function simulateGame(gamePlayers: Player[]): number[] {
        if (gamePlayers.length < 2) {
            console.log(`Not enough players to simulate a game.`)
            return []
        }

        const placements: { playerId: number; score: number }[] = gamePlayers.map(player => {
            const otherPlayers = gamePlayers.filter(p => p.id !== player.id)
            const avgWinProbability = otherPlayers.reduce((sum, opponent) =>
                sum + getWinProbability(player.trueSkill, opponent.trueSkill), 0) / otherPlayers.length

            const randomFactor = Math.random()
            const score = avgWinProbability * 0.8 + randomFactor * 0.2
            return { playerId: player.id, score }
        })

        placements.sort((a, b) => b.score - a.score)

        const placementMap = new Map<number, number>()
        placements.forEach(({ playerId }, index) => {
            placementMap.set(playerId, index + 1)
        })

        return gamePlayers.map(player => placementMap.get(player.id)!)
    }

    it('should simulate MMR progression with new players joining every 100 rounds', () => {
        let numPlayers = 4 // Starting with only 4 players
        const players: Player[] = Array.from({ length: numPlayers }, (_, i) => {
            const trueSkill = 1000 + (i * 200) // Starting trueSkills for initial players
            return {
                id: i + 1,
                mmr: 1000,
                trueSkill,
                gamesPlayed: 0,
                placements: [],
                mmrHistory: [],
                joinedRound: 1 // Initial players joined at round 1
            }
        })

        const TOTAL_ROUNDS = 100000
        const RECORD_INTERVAL = 100 // Record MMRs every 100 rounds
        const NEW_PLAYER_INTERVAL = 1000 // Introduce new player every 100 rounds
        let nextPlayerId = numPlayers + 1

        const recordedRounds: number[] = []

        for (let round = 1; round <= TOTAL_ROUNDS; round++) {
            // Introduce a new player every NEW_PLAYER_INTERVAL rounds
            if (round % NEW_PLAYER_INTERVAL === 0) {
                const trueSkill = Math.floor(Math.random() * 2001) // Random trueSkill between 0 and 2000
                players.push({
                    id: nextPlayerId++,
                    mmr: 1000,
                    trueSkill,
                    gamesPlayed: 0,
                    placements: [],
                    mmrHistory: [],
                    joinedRound: round
                })
                numPlayers++
            }

            // Group players for this round
            const groups = groupPlayersForRound(players)

            // Simulate games for each group
            for (const gamePlayers of groups) {
                if (gamePlayers.length < 2) {
                    console.log(`Not enough players in group to simulate a game.`)
                    continue
                }

                const placements = simulateGame(gamePlayers)

                // Prepare data for MMR calculation
                const playersForMMR = gamePlayers.map(player => ({
                    mmr: player.mmr,
                    gamesPlayed: player.gamesPlayed
                }))

                // Calculate MMR changes
                const mmrChanges = calculateMMRChanges(playersForMMR, placements)

                gamePlayers.forEach((player, idx) => {
                    const mmrChange = mmrChanges[idx]
                    player.mmr += mmrChange
                    player.gamesPlayed++

                    // Ensure placements array is large enough
                    const placementIndex = placements[idx] - 1
                    while (player.placements.length <= placementIndex) {
                        player.placements.push(0)
                    }

                    player.placements[placementIndex]++ // Record placement
                })
            }

            // Record MMR history at intervals
            if (round % RECORD_INTERVAL === 0 || round === TOTAL_ROUNDS) {
                recordedRounds.push(round)

                players.forEach(player => {
                    // const index = recordedRounds.length - 1
                    if (player.joinedRound <= round) {
                        // For players who have joined
                        // Ensure mmrHistory array is correctly sized
                        while (player.mmrHistory.length < recordedRounds.length - 1) {
                            player.mmrHistory.push(null)
                        }
                        player.mmrHistory.push(player.mmr)
                    } else {
                        // For players who haven't joined yet
                        player.mmrHistory.push(null)
                    }
                })
            }
        }

        // Generate output for MMR progression
        generateMMRProgressionGraph(recordedRounds, players)

        // Build output string
        let output = `Final Results after ${TOTAL_ROUNDS} rounds:\n`
        output += 'ID\tMMR\tGames\tSkill\tSkillRank\tMMRRank\tRankDiff\t1st\t2nd\t3rd\t4th\tWin%\n'

        const sortedByMMR = [...players].sort((a, b) => b.mmr - a.mmr)
        const mmrRanks = new Map(sortedByMMR.map((p, i) => [p.id, i + 1]))
        const skillRanks = new Map([...players].sort((a, b) => b.trueSkill - a.trueSkill)
            .map((p, i) => [p.id, i + 1]))

        sortedByMMR.forEach(player => {
            const skillRank = skillRanks.get(player.id) ?? '-'
            const mmrRank = mmrRanks.get(player.id)!
            const rankDiff = skillRank !== '-' ? mmrRank - skillRank : '-'
            const totalPlacements = player.placements.reduce((sum, count) => sum + count, 0)
            const winPercent = totalPlacements > 0 ? ((player.placements[0] / totalPlacements) * 100).toFixed(1) : '0.0'

            // Get the breakdown of placements (1st, 2nd, 3rd, 4th)
            const placementsString = player.placements.slice(0, 4).map(count => count || 0).join('\t')

            output += `${player.id}\t${player.mmr.toFixed(1)}\t${player.gamesPlayed}\t${player.trueSkill}\t${skillRank}\t${mmrRank}\t${rankDiff}\t${placementsString}\t${winPercent}%\n`
        })

        console.log(output)
    })
})

// Function to generate an HTML file with a graph
function generateMMRProgressionGraph(recordedRounds: number[], players: Player[]) {
    // Prepare data for Chart.js
    const datasets = players.map(player => ({
        label: `Player ${player.id} (TS: ${player.trueSkill})`,
        data: player.mmrHistory,
        borderColor: getRandomColor(),
        fill: false,
        pointRadius: 0,
        borderWidth: 1
    }))

    const labels = recordedRounds

    const chartData = {
        labels: labels,
        datasets: datasets
    }

    // Create HTML content
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>MMR Progression with New Players</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <h2>MMR Progression Over Time with New Players Joining</h2>
    <canvas id="mmrChart" width="1600" height="800"></canvas>
    <script>
        const ctx = document.getElementById('mmrChart').getContext('2d');
        const chartData = ${JSON.stringify(chartData)};
        const mmrChart = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: {
                animation: false,
                responsive: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Round'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'MMR'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false // Set to true to display legend
                    }
                },
                elements: {
                    line: {
                        tension: 0 // Disable bezier curves
                    }
                }
            }
        });
    </script>
</body>
</html>
`

    // Write HTML content to file
    fs.writeFileSync('mmr_progression_new_players.html', htmlContent)
    console.log('MMR progression graph saved to mmr_progression_new_players.html')
}

// Function to generate random colors for the chart
function getRandomColor() {
    const r = Math.floor(Math.random() * 200)
    const g = Math.floor(Math.random() * 200)
    const b = Math.floor(Math.random() * 200)
    return `rgb(${r}, ${g}, ${b})`
}
