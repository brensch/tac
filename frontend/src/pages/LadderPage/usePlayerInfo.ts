// src/pages/LadderPage/usePlayerInfo.ts

import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebaseConfig'
import { Player } from '@shared/types/Game'

export const usePlayerInfo = (playerIDs: string[]) => {
    const [players, setPlayers] = useState<{ [id: string]: Player }>({})
    const [loadingPlayers, setLoadingPlayers] = useState(true)

    useEffect(() => {
        if (playerIDs.length === 0) {
            setLoadingPlayers(false)
            return
        }

        const uniqueIDs = Array.from(new Set(playerIDs))
        const unsubscribers: (() => void)[] = []

        // Batch IDs in groups of 10 (Firestore limit)
        const batchSize = 10
        const batches = []
        for (let i = 0; i < uniqueIDs.length; i += batchSize) {
            batches.push(uniqueIDs.slice(i, i + batchSize))
        }

        batches.forEach(batchIDs => {
            // Users collection subscription
            const usersQuery = query(
                collection(db, 'users'),
                where('__name__', 'in', batchIDs)
            )
            const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
                const newPlayers: { [id: string]: Player } = {}
                snapshot.forEach((doc) => {
                    newPlayers[doc.id] = { ...(doc.data() as Player), id: doc.id }
                })
                setPlayers(prev => ({ ...prev, ...newPlayers }))
            })
            unsubscribers.push(unsubscribeUsers)

            // Bots collection subscription
            const botsQuery = query(
                collection(db, 'bots'),
                where('__name__', 'in', batchIDs)
            )
            const unsubscribeBots = onSnapshot(botsQuery, (snapshot) => {
                const newPlayers: { [id: string]: Player } = {}
                snapshot.forEach((doc) => {
                    newPlayers[doc.id] = { ...(doc.data() as Player), id: doc.id }
                })
                setPlayers(prev => ({ ...prev, ...newPlayers }))
            })
            unsubscribers.push(unsubscribeBots)
        })

        setLoadingPlayers(false)

        return () => {
            unsubscribers.forEach(unsubscribe => unsubscribe())
        }
    }, [playerIDs.join(',')])

    return { players, loadingPlayers }
}