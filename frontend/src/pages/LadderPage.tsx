// LadderPage.tsx

import React, { useState, useEffect } from 'react';
import {
  Box,
  Stack,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc,
  collection,
  onSnapshot,
  getDoc,
} from 'firebase/firestore';
import { db } from '../firebaseConfig'; // Adjust the path as necessary
import { useUser } from '../context/UserContext'; // Adjust the path as necessary
import {
  GameType,
  Ranking,
  GameResult,
  Player,
} from '@shared/types/Game'; // Adjust the path as necessary
import { EmojiCycler } from '../components/EmojiCycler'

const LadderPage: React.FC = () => {
  const { gameType: routeGameType } = useParams<{ gameType: string }>();
  const navigate = useNavigate();
  const { userID } = useUser();
  const [selectedGameType, setSelectedGameType] = useState<GameType>(
    (routeGameType as GameType) || 'snek'
  );
  const [topPlayers, setTopPlayers] = useState<Ranking[]>([]);
  const [userRanking, setUserRanking] = useState<Ranking | null>(null);
  const [userGameHistory, setUserGameHistory] = useState<GameResult[]>([]);
  const [playersMap, setPlayersMap] = useState<{ [id: string]: Player }>({});

  // Separate loading states
  const [loadingTopPlayers, setLoadingTopPlayers] = useState(true);
  const [loadingUserRanking, setLoadingUserRanking] = useState(true);
  const [loadingPlayersMap, setLoadingPlayersMap] = useState(true);
  const loading = loadingTopPlayers || loadingUserRanking || loadingPlayersMap;

  const gameTypes: GameType[] = [
    'snek',
    'connect4',
    'tactictoes',
    'longboi',
    'reversi',
    'colourclash',
  ];

  useEffect(() => {
    setSelectedGameType((routeGameType as GameType) || 'snek');
  }, [routeGameType]);

  useEffect(() => {
    // Reset state when selectedGameType changes
    setTopPlayers([]);
    setUserRanking(null);
    setUserGameHistory([]);
    setPlayersMap({});
    setRequiredPlayerIDs(new Set());
    setLoadingTopPlayers(true);
    setLoadingUserRanking(true);
    setLoadingPlayersMap(true);
  }, [selectedGameType]);

  const handleGameTypeChange = (event: SelectChangeEvent<string>) => {
    const newGameType = event.target.value as GameType;
    navigate(`/ladder/${newGameType}`);
  };

  // Collect required player IDs
  const [requiredPlayerIDs, setRequiredPlayerIDs] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Fetch top 10 players
    const rankingsRef = collection(db, 'rankings');
    const unsubscribeRankings = onSnapshot(rankingsRef, (snapshot) => {
      const rankings: Ranking[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Ranking;
        if (data.rankings && data.rankings[selectedGameType]) {
          rankings.push({ ...data, playerID: docSnap.id });
        }
      });
      rankings.sort((a, b) => {
        const mmrA = a.rankings[selectedGameType].currentMMR;
        const mmrB = b.rankings[selectedGameType].currentMMR;
        return mmrB - mmrA;
      });
      const top10 = rankings.slice(0, 10);
      setTopPlayers(top10);

      // Collect player IDs from top 10
      const top10IDs = top10.map((ranking) => ranking.playerID);
      setRequiredPlayerIDs((prev) => {
        const newSet = new Set(prev);
        top10IDs.forEach((id) => newSet.add(id));
        return newSet;
      });

      setLoadingTopPlayers(false);
    });

    return () => {
      unsubscribeRankings();
      setLoadingTopPlayers(true);
    };
  }, [selectedGameType]);

  useEffect(() => {
    // Fetch user ranking
    const userDocRef = doc(db, 'rankings', userID);
    const unsubscribeUserRanking = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Ranking;
        if (data.rankings && data.rankings[selectedGameType]) {
          setUserRanking({ ...data, playerID: userID });
          const history = [...data.rankings[selectedGameType].gameHistory]
            .reverse()
            .slice(0, 10);
          setUserGameHistory(history);

          // Collect opponent IDs
          const opponentIDs = new Set<string>();
          history.forEach((gameResult) => {
            gameResult.opponents.forEach((opponent) => {
              opponentIDs.add(opponent.playerID);
            });
          });

          // Update requiredPlayerIDs
          setRequiredPlayerIDs((prev) => {
            const newSet = new Set(prev);
            opponentIDs.forEach((id) => newSet.add(id));
            return newSet;
          });
        } else {
          setUserRanking(null);
          setUserGameHistory([]);
        }
      } else {
        setUserRanking(null);
        setUserGameHistory([]);
      }

      // Ensure user's own ID is included
      setRequiredPlayerIDs((prev) => {
        const newSet = new Set(prev);
        newSet.add(userID);
        return newSet;
      });

      setLoadingUserRanking(false);
    });

    return () => {
      unsubscribeUserRanking();
      setLoadingUserRanking(true);
    };
  }, [userID, selectedGameType]);

  // Fetch all required player data
  useEffect(() => {
    const fetchPlayers = async () => {
      setLoadingPlayersMap(true);

      const missingPlayerIDs = Array.from(requiredPlayerIDs).filter(
        (id) => !(id in playersMap)
      );

      if (missingPlayerIDs.length === 0) {
        setLoadingPlayersMap(false);
        return;
      }

      const newPlayersMap: { [id: string]: Player } = {};
      const promises = missingPlayerIDs.map(async (id) => {
        // Try fetching from users collection
        const userDocRef = doc(db, 'users', id);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          newPlayersMap[id] = { ...(userDoc.data() as Player), id };
          return;
        }
        // Try fetching from bots collection
        const botDocRef = doc(db, 'bots', id);
        const botDoc = await getDoc(botDocRef);
        if (botDoc.exists()) {
          newPlayersMap[id] = { ...(botDoc.data() as Player), id };
          return;
        }
      });
      await Promise.all(promises);
      setPlayersMap((prev) => ({ ...prev, ...newPlayersMap }));
      setLoadingPlayersMap(false);
    };

    fetchPlayers();
  }, [requiredPlayerIDs]);

  // Function to get ordinal suffix
  const ordinalSuffix = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'],
      v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return (
    <Stack
      sx={{
        minHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
      }}
    >
      <Box sx={{ padding: 2 }}>
        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel id="game-type-select-label">Game Type</InputLabel>
          <Select
            labelId="game-type-select-label"
            value={selectedGameType}
            label="Game Type"
            onChange={handleGameTypeChange}
          >
            {gameTypes.map((type) => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {loading ? (
          <Box sx={{ mt: 4 }}>
            <EmojiCycler />
          </Box>
        ) : (
          <>
            {/* Top 10 Players */}
            <Typography variant="h5" sx={{ mt: 4 }}>
              Top 10 Players
            </Typography>
            {topPlayers.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Rank</TableCell>
                      <TableCell>Player</TableCell>
                      <TableCell>MMR</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topPlayers.map((ranking, index) => {
                      const playerID = ranking.playerID;
                      const gameRanking = ranking.rankings[selectedGameType];
                      if (!gameRanking) return null; // Skip if no ranking for selectedGameType
                      const mmr = gameRanking.currentMMR;
                      const player = playersMap[playerID];
                      const playerName = player ? player.name : playerID;
                      return (
                        <TableRow
                          key={playerID}
                          sx={{ backgroundColor: player?.colour || 'inherit' }}
                        >
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            {player?.emoji ? `${player.emoji} ` : ''}
                            {playerName}
                          </TableCell>
                          <TableCell>{mmr}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography>No rankings available for this game type.</Typography>
            )}

            {/* User Ranking and Game History */}
            {userRanking && userRanking.rankings[selectedGameType] ? (
              <>
                <Typography variant="h5" sx={{ mt: 4 }}>
                  Your Stats
                </Typography>
                <Typography>
                  Current MMR: {userRanking.rankings[selectedGameType].currentMMR}
                </Typography>
                <Typography>
                  Games Played: {userRanking.rankings[selectedGameType].gamesPlayed}
                </Typography>
                <Typography>
                  Wins: {userRanking.rankings[selectedGameType].wins}
                </Typography>
                <Typography>
                  Losses: {userRanking.rankings[selectedGameType].losses}
                </Typography>

                <Typography variant="h5" sx={{ mt: 4 }}>
                  Game History
                </Typography>
                {userGameHistory.length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>View Replay</TableCell>
                          <TableCell>Opponents</TableCell>
                          <TableCell>Result</TableCell>
                          <TableCell>MMR Change</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {userGameHistory.map((gameResult, index) => {
                          const opponentsNames = gameResult.opponents
                            .map((opponent) => {
                              const opponentPlayer = playersMap[opponent.playerID];
                              return opponentPlayer
                                ? opponentPlayer.name
                                : opponent.playerID;
                            })
                            .join(', ');
                          const date = gameResult.timestamp
                            .toDate()
                            .toLocaleString();
                          const mmrChange = gameResult.mmrChange;
                          const result = ordinalSuffix(gameResult.placement);
                          return (
                            <TableRow key={index}>
                              <TableCell>
                                <a
                                  href={`/session/${gameResult.sessionID}/${gameResult.gameID}`}
                                  style={{
                                    textDecoration: 'none',
                                    color: 'inherit',
                                  }}
                                >
                                  {date}
                                </a>
                              </TableCell>
                              <TableCell>{opponentsNames}</TableCell>
                              <TableCell>{result}</TableCell>
                              <TableCell>
                                {mmrChange > 0 ? `+${mmrChange}` : mmrChange}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography>No games played yet.</Typography>
                )}
              </>
            ) : (
              <Typography variant="h6" sx={{ mt: 4 }}>
                You haven't played any games of this type yet.
              </Typography>
            )}
          </>
        )}
      </Box>
    </Stack>
  );
};

export default LadderPage;
