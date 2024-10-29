// src/pages/LadderPage/index.tsx

import { Stack } from '@mui/material'
import React from 'react'
import { Route, Routes } from 'react-router-dom'
import { LadderGameView } from './LadderGameView'
import { LadderOverview } from './LadderOverview'

const LadderPageLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <Stack
            sx={{
                minHeight: "90vh",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
            }}
        >
            {children}
        </Stack>
    )
}

const LadderPage = () => {
    return (
        <Routes>
            <Route
                path="/:playerID"
                element={
                    <LadderPageLayout>
                        <LadderOverview />
                    </LadderPageLayout>
                }
            />
            <Route
                path="/:playerID/:gameType"
                element={
                    <LadderPageLayout>
                        <LadderGameView />
                    </LadderPageLayout>
                }
            />
        </Routes>
    )
}

export default LadderPage