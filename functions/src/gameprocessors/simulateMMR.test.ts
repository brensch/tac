import { calculateMMRChanges } from "./processTurn"
import * as fs from "fs"

interface Player {
    id: number
    mmr: number
    trueSkill: number
    gamesPlayed: number
    placements: number[] // Array to store count of each placement [1st, 2nd, 3rd, 4th]
    mmrHistory: number[] // Array to track MMR over time
}

describe('MMR System Simulation', () => {
    function getWinProbability(playerSkill: number, opponentSkill: number): number {
        return 1 / (1 + Math.pow(10, -(playerSkill - opponentSkill) / 400))
    }

    function groupPlayersForRound(players: Player[]): Player[][] {
        const numPlayers = players.length
        const numGroups = numPlayers / 4
        const groups: Player[][] = []

        // Sort players by MMR
        const sortedPlayers = [...players].sort((a, b) => b.mmr - a.mmr)

        // Shuffle players slightly to introduce randomness
        for (let i = sortedPlayers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * Math.min(5, i + 1));
            [sortedPlayers[i], sortedPlayers[j]] = [sortedPlayers[j], sortedPlayers[i]]
        }

        // Assign players to groups
        for (let i = 0; i < numGroups; i++) {
            groups.push(sortedPlayers.slice(i * 4, (i + 1) * 4))
        }

        return groups
    }

    function simulateGame(gamePlayers: Player[]): number[] {
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

    it('should converge to correct skill ordering after multiple rounds', () => {
        const numPlayers = 36 // Number divisible by 4
        const players: Player[] = Array.from({ length: numPlayers }, (_, i) => ({
            id: i + 1,
            mmr: 1000,
            trueSkill: 200 + (i * 50),
            gamesPlayed: 0,
            placements: [0, 0, 0, 0], // Initialize placement counts
            mmrHistory: [] // Initialize MMR history
        }))

        const TOTAL_ROUNDS = 10000
        const RECORD_INTERVAL = 10 // Record MMRs every 100 rounds

        for (let round = 1; round <= TOTAL_ROUNDS; round++) {
            // Group players for this round
            const groups = groupPlayersForRound(players)

            // Simulate games for each group
            for (const gamePlayers of groups) {
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
                    player.placements[placements[idx] - 1]++ // Record placement
                })
            }

            // Record MMR history at intervals
            if (round % RECORD_INTERVAL === 0 || round === TOTAL_ROUNDS) {
                players.forEach(player => {
                    player.mmrHistory.push(player.mmr)
                })
            }
        }

        // Generate output for MMR progression
        const mmrProgressionData: { round: number;[key: string]: number }[] = []
        const numRecords = players[0].mmrHistory.length
        for (let i = 0; i < numRecords; i++) {
            const dataPoint: { round: number;[key: string]: number } = { round: i * RECORD_INTERVAL }
            players.forEach(player => {
                dataPoint[`Player ${player.id}`] = player.mmrHistory[i]
            })
            mmrProgressionData.push(dataPoint)
        }

        // Output data to an HTML file with a graph
        generateMMRProgressionGraph(mmrProgressionData, players)

        // Build output string
        let output = `Final Results after ${TOTAL_ROUNDS} rounds:\n`
        output += 'ID\tMMR\tGames\tSkill\tSkillRank\tMMRRank\tRankDiff\t1st\t2nd\t3rd\t4th\tWin%\n'

        const sortedByMMR = [...players].sort((a, b) => b.mmr - a.mmr)
        const mmrRanks = new Map(sortedByMMR.map((p, i) => [p.id, i + 1]))
        const skillRanks = new Map([...players].sort((a, b) => b.trueSkill - a.trueSkill)
            .map((p, i) => [p.id, i + 1]))

        sortedByMMR.forEach(player => {
            const skillRank = skillRanks.get(player.id)!
            const mmrRank = mmrRanks.get(player.id)!
            const rankDiff = mmrRank - skillRank
            const winPercent = ((player.placements[0] / player.gamesPlayed) * 100).toFixed(1)
            output += `${player.id}\t${player.mmr.toFixed(1)}\t${player.gamesPlayed}\t${player.trueSkill}\t${skillRank}\t${mmrRank}\t${rankDiff}\t${player.placements[0]}\t${player.placements[1]}\t${player.placements[2]}\t${player.placements[3]}\t${winPercent}%\n`
        })

        console.log(output)
    })
})

// Function to generate an HTML file with a graph
function generateMMRProgressionGraph(mmrProgressionData: any[], players: Player[]) {
    // Prepare data for Chart.js
    const datasets = players.map(player => ({
        label: `Player ${player.id}`,
        data: player.mmrHistory,
        borderColor: getRandomColor(),
        fill: false,
        pointRadius: 0,
        borderWidth: 1
    }))

    const labels = mmrProgressionData.map(d => d.round)

    const chartData = {
        labels: labels,
        datasets: datasets
    }

    // Create HTML content
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>MMR Progression</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <h2>MMR Progression Over Time</h2>
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
    fs.writeFileSync('mmr_progression.html', htmlContent)
    console.log('MMR progression graph saved to mmr_progression.html')
}

// Function to generate random colors for the chart
function getRandomColor() {
    const r = Math.floor(Math.random() * 200)
    const g = Math.floor(Math.random() * 200)
    const b = Math.floor(Math.random() * 200)
    return `rgb(${r}, ${g}, ${b})`
}
