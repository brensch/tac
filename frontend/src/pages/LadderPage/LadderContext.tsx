// src/pages/LadderPage/LadderContext.tsx

import React, { createContext, useContext, useEffect, useState } from 'react'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebaseConfig'
import { RankingData } from './types'
import { GameType } from '@shared/types/Game'

interface RankingsMap {
    [gameType: string]: RankingData[]
}

interface LadderContextType {
    selectedPlayerRanking: RankingData | null
    globalRankings: RankingsMap
    loadingPlayer: boolean
    loadingGlobal: boolean
}

const LadderContext = createContext<LadderContextType>({
    selectedPlayerRanking: null,
    globalRankings: {},
    loadingPlayer: true,
    loadingGlobal: true
})

export const useLadder = () => useContext(LadderContext)

interface Props {
    children: React.ReactNode
    playerID?: string
}

const gameTypes: GameType[] = [
    'snek',
    'connect4',
    'tactictoes',
    'longboi',
    'reversi',
    'colourclash',
]

export const LadderProvider: React.FC<Props> = ({ children, playerID }) => {
    const [selectedPlayerRanking, setSelectedPlayerRanking] = useState<RankingData | null>(null)
    const [globalRankings, setGlobalRankings] = useState<RankingsMap>({})
    const [loadingPlayer, setLoadingPlayer] = useState(true)
    const [loadingGlobal, setLoadingGlobal] = useState(true)

    // Subscribe to selected player's ranking
    useEffect(() => {
        if (!playerID) {
            setSelectedPlayerRanking(null)
            setLoadingPlayer(false)
            return
        }

        setLoadingPlayer(true)
        const rankingRef = doc(db, 'rankings', playerID)
        const unsubscribe = onSnapshot(rankingRef, (doc) => {
            if (doc.exists()) {
                setSelectedPlayerRanking({
                    ...(doc.data() as Omit<RankingData, 'playerID'>),
                    playerID
                })
            } else {
                setSelectedPlayerRanking(null)
            }
            setLoadingPlayer(false)
        })

        return () => unsubscribe()
    }, [playerID])

    // Subscribe to global rankings for all game types
    useEffect(() => {
        setLoadingGlobal(true)
        const rankingsRef = collection(db, 'rankings')
        const unsubscribe = onSnapshot(rankingsRef, (snapshot) => {
            const newRankings: RankingsMap = {}

            // Initialize empty arrays for each game type
            gameTypes.forEach(type => {
                newRankings[type] = []
            })

            // Populate rankings for each game type
            snapshot.forEach((doc) => {
                const data = doc.data() as Omit<RankingData, 'playerID'>
                const playerRanking = { ...data, playerID: doc.id }

                gameTypes.forEach(gameType => {
                    if (data.rankings?.[gameType]?.currentMMR !== undefined) {
                        newRankings[gameType].push(playerRanking)
                    }
                })
            })

            // Sort rankings for each game type
            gameTypes.forEach(gameType => {
                newRankings[gameType].sort((a, b) => {
                    const mmrA = a.rankings[gameType]?.currentMMR ?? 0
                    const mmrB = b.rankings[gameType]?.currentMMR ?? 0
                    return mmrB - mmrA
                })
            })

            setGlobalRankings(newRankings)
            setLoadingGlobal(false)
        })

        return () => unsubscribe()
    }, [])

    return (
        <LadderContext.Provider value={{
            selectedPlayerRanking,
            globalRankings,
            loadingPlayer,
            loadingGlobal
        }}>
            {children}
        </LadderContext.Provider>
    )
}