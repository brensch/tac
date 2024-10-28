import { describe, expect, it } from '@jest/globals'
import { calculateMMRChanges } from './processTurn'

describe('calculateMMRChanges', () => {
    // Test basic functionality
    it('should calculate positive MMR change for first place against equal opponents', () => {
        const players = [
            { mmr: 1500, gamesPlayed: 20 },
            { mmr: 1500, gamesPlayed: 20 },
            { mmr: 1500, gamesPlayed: 20 },
            { mmr: 1500, gamesPlayed: 20 },
        ]
        const placements = [1, 2, 3, 4]
        const mmrChanges = calculateMMRChanges(players, placements)

        expect(mmrChanges[0]).toBeGreaterThan(0) // First place should gain MMR
        expect(mmrChanges[3]).toBeLessThan(0) // Last place should lose MMR
        expect(typeof mmrChanges[0]).toBe('number')
    })

    it('should calculate negative MMR change for last place against equal opponents', () => {
        const players = [
            { mmr: 1500, gamesPlayed: 20 },
            { mmr: 1500, gamesPlayed: 20 },
            { mmr: 1500, gamesPlayed: 20 },
            { mmr: 1500, gamesPlayed: 20 },
        ]
        const placements = [4, 1, 2, 3]
        const mmrChanges = calculateMMRChanges(players, placements)

        expect(mmrChanges[0]).toBeLessThan(0) // Last place should lose MMR
    })

    it('should apply increased K-factor for new players', () => {
        const playersNew = [
            { mmr: 1500, gamesPlayed: 5 },
            { mmr: 1500, gamesPlayed: 5 },
            { mmr: 1500, gamesPlayed: 5 },
            { mmr: 1500, gamesPlayed: 5 },
        ]
        const playersExperienced = [
            { mmr: 1500, gamesPlayed: 20 },
            { mmr: 1500, gamesPlayed: 20 },
            { mmr: 1500, gamesPlayed: 20 },
            { mmr: 1500, gamesPlayed: 20 },
        ]
        const placements = [4, 1, 2, 3]

        const mmrChangesNew = calculateMMRChanges(playersNew, placements)
        const mmrChangesExperienced = calculateMMRChanges(playersExperienced, placements)

        // New player should have bigger MMR changes
        expect(Math.abs(mmrChangesNew[0])).toBeGreaterThan(Math.abs(mmrChangesExperienced[0]))

        // Additional assertions to verify the behavior
        expect(mmrChangesNew[0]).toBeLessThan(0) // Should be negative (losing MMR)
        expect(mmrChangesExperienced[0]).toBeLessThan(0) // Should be negative (losing MMR)
        console.log('New player MMR change:', mmrChangesNew[0])
        console.log('Experienced player MMR change:', mmrChangesExperienced[0])
    })

    // Test against stronger opponents
    it('should give more points for beating stronger opponents', () => {
        const playersStrongerOpponents = [
            { mmr: 1500, gamesPlayed: 20 },
            { mmr: 1800, gamesPlayed: 20 },
            { mmr: 1800, gamesPlayed: 20 },
            { mmr: 1800, gamesPlayed: 20 },
        ]
        const playersEqualOpponents = [
            { mmr: 1500, gamesPlayed: 20 },
            { mmr: 1500, gamesPlayed: 20 },
            { mmr: 1500, gamesPlayed: 20 },
            { mmr: 1500, gamesPlayed: 20 },
        ]
        const placements = [1, 2, 3, 4]

        const mmrChangesStrongerOpponents = calculateMMRChanges(playersStrongerOpponents, placements)
        const mmrChangesEqualOpponents = calculateMMRChanges(playersEqualOpponents, placements)

        expect(mmrChangesStrongerOpponents[0]).toBeGreaterThan(mmrChangesEqualOpponents[0])
    })

    // Test edge cases
    it('should handle extreme MMR differences', () => {
        const players = [
            { mmr: 100, gamesPlayed: 20 },
            { mmr: 2000, gamesPlayed: 20 },
            { mmr: 2000, gamesPlayed: 20 },
            { mmr: 2000, gamesPlayed: 20 },
        ]
        const placements = [1, 2, 3, 4]
        const mmrChanges = calculateMMRChanges(players, placements)

        expect(typeof mmrChanges[0]).toBe('number')
        expect(Number.isFinite(mmrChanges[0])).toBe(true)
    })

    it('should handle minimum number of players', () => {
        const players = [
            { mmr: 1500, gamesPlayed: 20 },
            { mmr: 1500, gamesPlayed: 20 },
        ]
        const placements = [1, 2]
        const mmrChanges = calculateMMRChanges(players, placements)

        expect(typeof mmrChanges[0]).toBe('number')
        expect(Number.isFinite(mmrChanges[0])).toBe(true)
    })
})
