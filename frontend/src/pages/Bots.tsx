// Bots.tsx

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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material"
import { useTheme } from "@mui/material/styles"
import { Refresh } from "@mui/icons-material"
import { ColorResult, HuePicker } from "react-color"
import { useUser } from "../context/UserContext"
import { db } from "../firebaseConfig"
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

  // existing delete function
  const deleteBot = async (id: string) => {
    await deleteDoc(doc(db, "bots", id))
  }

  // deletion dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const openDeleteDialog = (id: string) => {
    setPendingDeleteId(id)
    setDeleteDialogOpen(true)
  }

  const handleCancelDelete = () => {
    setPendingDeleteId(null)
    setDeleteDialogOpen(false)
  }

  const handleConfirmDelete = async () => {
    if (pendingDeleteId) {
      await deleteBot(pendingDeleteId)
    }
    setPendingDeleteId(null)
    setDeleteDialogOpen(false)
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
    if (!userID) {
      setError("Login required")
      return
    }
    if (!botName.trim()) {
      setError("Name required")
      return
    }
    try {
      new URL(botUrl)
    } catch {
      setError("Invalid URL")
      return
    }
    if (!botCaps.length) {
      setError("Choose a capability")
      return
    }
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
      // reset form
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
        {bots.length === 0 ? (
          <Typography variant="body1" sx={{ mb: 2 }}>
            you got no bots m8. add one below.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small" sx={{ tableLayout: "fixed" }}>
              <colgroup>
                <col />
                <col style={{ width: "130px" }} />
                <col style={{ width: "150px" }} />
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
                    <TableCell>
                      {b.emoji} {b.name}
                    </TableCell>
                    <TableCell>{b.capabilities.join(", ")}</TableCell>
                    <TableCell align="center">
                      <Button
                        onClick={() => openDeleteDialog(b.id)}
                        disabled={busy}
                        sx={{ minWidth: 0, px: 1 }}
                      >
                        Delete 💣
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Add Bot Form */}
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault()
          handleAdd()
        }}
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

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            mb: 2,
            border: "2px solid #000",
            "& .hue-horizontal": {
              borderRadius: "0px !important",
            },
          }}
        >
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
                    setBotCaps((prev) =>
                      prev.includes(g)
                        ? prev.filter((x) => x !== g)
                        : [...prev, g]
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            border: "2px solid black",
            borderRadius: 0,
            boxShadow: "none",
          },
        }}
      >
        <DialogTitle>Delete Bot</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this bot?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default Bots