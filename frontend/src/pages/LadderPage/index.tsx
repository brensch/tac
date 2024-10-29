// src/pages/LadderPage/index.tsx

import { Stack } from '@mui/material'
import { Route, Routes, useParams } from 'react-router-dom'
import { LadderProvider } from './LadderContext'
import { LadderGameView } from './LadderGameView'
import { LadderOverview } from './LadderOverview'

const LadderPageLayout = () => {
    const { playerID } = useParams<{ playerID: string }>()

    return (
        <Stack
            sx={{
                minHeight: "90vh",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
            }}
        >
            <LadderProvider playerID={playerID}>
                <Routes>
                    <Route path="/" element={<LadderOverview />} />
                    <Route path="/:gameType" element={<LadderGameView />} />
                </Routes>
            </LadderProvider>
        </Stack>
    )
}

const LadderPage = () => {
    return (
        <Routes>
            <Route path="/:playerID/*" element={<LadderPageLayout />} />
        </Routes>
    )
}

export default LadderPage