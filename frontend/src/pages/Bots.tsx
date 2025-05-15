import React, { useEffect, useState } from "react"
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material"
import { useTheme } from "@mui/material/styles"
import { Refresh } from "@mui/icons-material"
import { ColorResult, HuePicker } from "react-color"
import { signOut } from "firebase/auth"
import { useUser } from "../context/UserContext"
import { auth, db } from "../firebaseConfig"
import { generateColor } from "../utils/colourUtils"
import { emojiList } from "@shared/types/Emojis"
import { Bot, GameType } from "@shared/types/Game"
import {
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore"

const availableGameTypes: GameType[] = [
  "connect4",
  "longboi",
  "tactictoes",
  "snek",
  "colourclash",
  "reversi",
]

const Bots: React.FC = () => {
  const { userID } = useUser()
  const theme = useTheme()

  // — My Bots subscription —
  const [bots, setBots] = useState<Bot[]>([])
  useEffect(() => {
    if (!userID) return
    const q = query(collection(db, "bots"), where("owner", "==", userID))
    return onSnapshot(q, (snap) => {
      setBots(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Bot, "id">) }))
      )
    })
  }, [userID])

  const deleteBot = async (id: string) => {
    await deleteDoc(doc(db, "bots", id))
  }

  // — Add form state —
  const [botName, setBotName] = useState("")
  const [botUrl, setBotUrl] = useState("")
  const [botCaps, setBotCaps] = useState<GameType[]>([])
  const [isPublic, setIsPublic] = useState(false)
  const [hue, setHue] = useState(Math.random() * 360)
  const [colour, setColour] = useState(generateColor(hue))
  const [emoji, setEmoji] = useState(emojiList[0] || "🐍")
  const [showEmojis, setShowEmojis] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const contrast = theme.palette.getContrastText(colour)

  const randomizeEmojis = () => {
    const shuffled = [...emojiList].sort(() => 0.5 - Math.random())
    const pick = shuffled.includes(emoji) ? emoji : shuffled[0]
    setShowEmojis([pick, ...shuffled.filter((e) => e !== pick).slice(0, 11)])
    setEmoji(pick)
  }

  useEffect(randomizeEmojis, [])
  useEffect(() => setColour(generateColor(hue)), [hue])

  const handleAdd = async () => {
    if (!userID) return setError("Login required")
    if (!botName.trim()) return setError("Name required")
    try {
      new URL(botUrl)
    } catch {
      return setError("Invalid URL")
    }
    if (!botCaps.length) return setError("Choose a capability")
    setError(null)
    setBusy(true)

    const ref = doc(collection(db, "bots"))
    const newBot: Bot = {
      id: ref.id,
      owner: userID,
      name: botName.trim(),
      url: botUrl.trim(),
      capabilities: botCaps,
      emoji,
      colour,
      public: isPublic,
      createdAt: serverTimestamp() as any,
    }

    try {
      await setDoc(ref, newBot)
      // reset
      setBotName("")
      setBotUrl("")
      setBotCaps([])
      setIsPublic(false)
      setHue(Math.random() * 360)
      randomizeEmojis()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Container sx={{ py: 3 }}>
      {/* My Bots List */}
      <Box>
        <Typography variant="h5" gutterBottom>
          My Bots
        </Typography>
        <TableContainer>
          <Table size="small" sx={{ tableLayout: "fixed" }}>
            <colgroup>
              <col />
              <col style={{ width: "150px" }} />
              <col style={{ width: "60px" }} />
            </colgroup>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Capabilities</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {bots.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{b.emoji} {b.name}</TableCell>
                  <TableCell>{b.capabilities.join(", ")}</TableCell>
                  <TableCell>
                    <Button
                      onClick={() => deleteBot(b.id)}
                      disabled={busy}
                      sx={{ minWidth: 0, p: 0 }}
                    >
                      🗑️
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Add Bot (compact) */}
      <Box
        component="form"
        onSubmit={(e) => { e.preventDefault(); handleAdd() }}
        sx={{ mt: 4 }}
      >
        <Typography variant="h5" gutterBottom>
          Add a Bot
        </Typography>

        <TextField
          label="Name"
          value={botName}
          onChange={(e) => setBotName(e.target.value)}
          disabled={busy}
          fullWidth
          size="small"
          sx={{ mb: 2 }}
        />

        <TextField
          label="URL"
          value={botUrl}
          onChange={(e) => setBotUrl(e.target.value)}
          disabled={busy}
          fullWidth
          size="small"
          sx={{ mb: 2 }}
        />

        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <HuePicker
            color={colour}
            onChange={(c: ColorResult) => setHue(c.hsl.h)}
            width="100%"
          />
        </Box>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
          {showEmojis.map((e) => (
            <Button
              key={e}
              onClick={() => !busy && setEmoji(e)}
              size="small"
              sx={{
                fontSize: "1.5rem",
                width: 50,
                height: 50,
                backgroundColor: emoji === e ? colour : "white",
              }}
            >
              {e}
            </Button>
          ))}
          <Button onClick={randomizeEmojis} size="small">
            <Refresh fontSize="small" />
          </Button>
        </Box>

        <FormGroup row sx={{ gap: 1, mb: 2 }}>
          {availableGameTypes.map((g) => (
            <FormControlLabel
              key={g}
              control={
                <Checkbox
                  checked={botCaps.includes(g)}
                  onChange={() =>
                    setBotCaps((p) =>
                      p.includes(g) ? p.filter((x) => x !== g) : [...p, g]
                    )
                  }
                  size="small"
                />
              }
              label={g}
            />
          ))}
        </FormGroup>

        <FormControlLabel
          control={
            <Switch
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              size="small"
            />
          }
          label="Public"
          sx={{ mb: 2 }}
        />



        <Button
          type="submit"
          variant="contained"
          disabled={busy}
          sx={{ bgcolor: colour, color: contrast, mb: 2 }}
        >
          Add Bot
        </Button>
        {error && (
          <Typography color="error" variant="body2" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}


      </Box>
    </Container>
  )
}

export default Bots
