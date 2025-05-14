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
  Paper,
  Grid,
} from "@mui/material"
import { ColorResult, HuePicker } from "react-color"
import { signOut } from "firebase/auth"
import { useUser } from "../context/UserContext" // Assuming this path is correct
import { auth, db } from "../firebaseConfig" // Assuming this path is correct
import { generateColor } from "../utils/colourUtils" // Assuming this path is correct
import { emojiList } from "@shared/types/Emojis" // Assuming this path is correct
import { Bot, GameType } from "@shared/types/Game" // Assuming this path is correct
import { doc, setDoc, serverTimestamp, collection } from "firebase/firestore"

// Available game types for selection
const availableGameTypes: GameType[] = [
  "connect4",
  "longboi",
  "tactictoes",
  "snek",
  "colourclash",
  "reversi",
]

const NewSnek: React.FC = () => {
  // Get the current user's ID from the context
  const { userID } = useUser()

  // State for Snek's name
  const [snekName, setSnekName] = useState<string>("")
  // State for Snek's URL
  const [snekUrl, setSnekUrl] = useState<string>("")
  // State for Snek's capabilities (which games it can play)
  const [snekCapabilities, setSnekCapabilities] = useState<GameType[]>([])

  // State for color selection (hue value)
  const [hue, setHue] = useState<number>(Math.random() * 360) // Initialize with a random hue
  // State for the selected color string (HSL format)
  const [selectedColour, setSelectedColour] = useState<string>(generateColor(hue))
  // State for the selected emoji
  const [selectedEmoji, setSelectedEmoji] = useState<string>(emojiList[0] || "🐍") // Default to first emoji or snake
  // State for the list of emojis displayed for selection
  const [displayedEmojis, setDisplayedEmojis] = useState<string[]>([])

  // State for handling and displaying errors
  const [error, setError] = useState<string | null>(null)
  // State for displaying success messages
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  // State to track if the form is currently being submitted
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  /**
   * Shuffles the emoji list and updates the displayed emojis.
   * Ensures the currently selected emoji is part of the displayed list.
   */
  const randomizeEmojis = () => {
    console.log("[randomizeEmojis] Randomizing emojis.")
    const shuffledEmojis = [...emojiList].sort(() => 0.5 - Math.random())
    // Ensure the currently selected emoji is included, or pick the first from shuffled list
    const currentSelectedInList = shuffledEmojis.includes(selectedEmoji)
      ? selectedEmoji
      : shuffledEmojis[0]

    const filteredEmojis = shuffledEmojis.filter(
      (emoji) => emoji !== currentSelectedInList,
    )
    // Display the selected emoji first, followed by 11 other random emojis
    setDisplayedEmojis([currentSelectedInList, ...filteredEmojis.slice(0, 11)])
    // If the initially selected emoji wasn't in the shuffled list, update selectedEmoji
    if (!shuffledEmojis.includes(selectedEmoji) && shuffledEmojis.length > 0) {
      setSelectedEmoji(currentSelectedInList)
      console.log("[randomizeEmojis] Updated selected emoji to:", currentSelectedInList)
    }
  }

  // Effect to randomize emojis when the component mounts
  useEffect(() => {
    randomizeEmojis()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty dependency array means this runs once on mount

  // Effect to update the selected color whenever the hue changes
  useEffect(() => {
    const newColor = generateColor(hue)
    setSelectedColour(newColor)
    console.log("[useEffect hue] Hue changed, new color:", newColor)
  }, [hue])

  /**
   * Handles clicking on an emoji button.
   * Sets the clicked emoji as the selected one and updates the displayed list.
   * @param emoji The emoji string that was clicked.
   */
  const handleEmojiClick = (emoji: string) => {
    console.log("[handleEmojiClick] Emoji clicked:", emoji)
    setSelectedEmoji(emoji)
    // Reorder displayed emojis to show the newly selected one first
    setDisplayedEmojis(prevEmojis => {
      const otherEmojis = prevEmojis.filter(e => e !== emoji)
      return [emoji, ...otherEmojis.slice(0, 11)]
    })
  }

  /**
   * Handles changes from the HuePicker component.
   * @param color The color result object from react-color.
   */
  const handleHueChange = (color: ColorResult) => {
    // console.log("[handleHueChange] Hue picker changed, HSL hue:", color.hsl.h); // Can be noisy
    setHue(color.hsl.h)
  }

  /**
   * Handles changes to Snek capabilities (checkboxes).
   * Adds or removes a capability from the snekCapabilities array.
   * @param capability The GameType string of the capability being changed.
   */
  const handleCapabilityChange = (capability: GameType) => {
    setSnekCapabilities((prevCapabilities) => {
      const newCapabilities = prevCapabilities.includes(capability)
        ? prevCapabilities.filter((c) => c !== capability)
        : [...prevCapabilities, capability]
      console.log("[handleCapabilityChange] Capability changed:", capability, "New capabilities:", newCapabilities)
      return newCapabilities
    })
  }

  /**
   * Handles the submission of the new Snek form.
   * Validates input, prepares data, and attempts to save to Firestore.
   */
  const handleSubmitSnek = async () => {
    console.log("[handleSubmitSnek] Initiated.")
    console.log("[handleSubmitSnek] Current userID:", userID)

    // Validation checks
    if (!userID) {
      console.error("[handleSubmitSnek] Validation failed: User not logged in.")
      setError("You must be logged in to add a Snek.")
      return // Exit if user not logged in
    }
    console.log("[handleSubmitSnek] User ID check passed.")

    if (!snekName.trim()) {
      console.error("[handleSubmitSnek] Validation failed: Snek name is required.")
      setError("Snek name is required.")
      return // Exit if name is empty
    }
    console.log("[handleSubmitSnek] Snek name check passed.")

    if (!snekUrl.trim()) {
      console.error("[handleSubmitSnek] Validation failed: Snek URL is required.")
      setError("Snek URL is required.")
      return // Exit if URL is empty
    }
    console.log("[handleSubmitSnek] Snek URL check passed.")

    try {
      new URL(snekUrl.trim()) // Validate URL format
      console.log("[handleSubmitSnek] Snek URL format check passed.")
    } catch (_) {
      console.error("[handleSubmitSnek] Validation failed: Invalid Snek URL format.", snekUrl)
      setError("Invalid Snek URL format. Please include http:// or https://")
      return // Exit if URL format is invalid
    }

    if (snekCapabilities.length === 0) {
      console.error("[handleSubmitSnek] Validation failed: Snek must have at least one capability.")
      setError("Snek must have at least one capability.")
      return // Exit if no capabilities selected
    }
    console.log("[handleSubmitSnek] Snek capabilities check passed.")

    // All validations passed, proceed with submission
    console.log("[handleSubmitSnek] Setting isSubmitting to true.")
    setIsSubmitting(true)
    setError(null) // Clear previous errors
    setSuccessMessage(null) // Clear previous success messages

    // Generate a new document reference for the bot with a unique ID
    const newBotRef = doc(collection(db, "bots"))
    console.log("[handleSubmitSnek] Generated new BotRef ID:", newBotRef.id)

    // Prepare the data object for Firestore
    const newSnekData: Bot = {
      id: newBotRef.id, // Store the generated ID within the document
      owner: userID,
      name: snekName.trim(),
      url: snekUrl.trim(),
      capabilities: snekCapabilities,
      emoji: selectedEmoji,
      colour: selectedColour,
      createdAt: serverTimestamp() as any, // Use server timestamp for creation date
    }

    console.log("[handleSubmitSnek] Prepared Snek data:", JSON.stringify(newSnekData, null, 2))

    try {
      console.log("[handleSubmitSnek] Attempting to setDoc to Firestore...")
      await setDoc(newBotRef, newSnekData) // Save the document to Firestore
      console.log("[handleSubmitSnek] setDoc successful! Document ID:", newBotRef.id)
      setSuccessMessage(`Snek "${snekName}" added successfully with ID: ${newBotRef.id}!`)
      // Reset form fields after successful submission
      setSnekName("")
      setSnekUrl("")
      setSnekCapabilities([])
      console.log("[handleSubmitSnek] Form reset.")
    } catch (submissionError: any) {
      // Catch and log any errors during Firestore operation
      console.error("[handleSubmitSnek] Error during setDoc:", submissionError)
      console.error("[handleSubmitSnek] Error name:", submissionError.name)
      console.error("[handleSubmitSnek] Error message:", submissionError.message)
      console.error("[handleSubmitSnek] Error stack:", submissionError.stack)
      setError(submissionError.message || "Failed to add Snek. Check console for details.")
    } finally {
      // This block will run regardless of success or failure in the try block
      console.log("[handleSubmitSnek] Reached finally block. Setting isSubmitting to false.")
      setIsSubmitting(false) // Reset submission state
    }
  }

  // JSX for the component's UI
  return (
    <Container sx={{ maxWidth: "100%", py: 3 }}>
      <Paper elevation={3} sx={{ p: { xs: 2, md: 4 }, maxWidth: "700px", mx: "auto" }}>
        <Typography variant="h4" component="h1" gutterBottom textAlign="center">
          Add a New Snek
        </Typography>

        <Box
          component="form"
          // The Button type="submit" will trigger this if not prevented.
          // Alternatively, can add onSubmit to the <Box component="form">
          // onSubmit={(e) => { e.preventDefault(); handleSubmitSnek(); }}
          display="flex"
          flexDirection="column"
          alignItems="center"
          width="100%"
        >
          {/* Snek Name Input */}
          <TextField
            label="Snek Name"
            variant="outlined"
            value={snekName}
            onChange={(e) => setSnekName(e.target.value)}
            fullWidth
            sx={{ mt: 2, mb: 1 }}
            required
            disabled={isSubmitting}
          />

          {/* Snek URL Input */}
          <TextField
            label="Snek URL (e.g., https://my-snek.example.com)"
            variant="outlined"
            value={snekUrl}
            onChange={(e) => setSnekUrl(e.target.value)}
            fullWidth
            sx={{ mt: 1, mb: 2 }}
            type="url"
            required
            placeholder="https://..."
            disabled={isSubmitting}
          />

          {/* Appearance Section */}
          <Typography variant="h6" component="h2" sx={{ mt: 2, width: "100%" }}>
            Appearance
          </Typography>

          <Grid container spacing={2} alignItems="center" sx={{ width: "100%" }}>
            {/* Emoji Preview */}
            <Grid item xs={12} md={2} sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
              <Box
                sx={{
                  width: "50px",
                  height: "50px",
                  fontSize: "2.5rem",
                  backgroundColor: selectedColour,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "8px",
                  border: "1px solid #ccc",
                  marginRight: { xs: 0, md: '10px' },
                  marginBottom: { xs: '10px', md: 0 }
                }}
              >
                {selectedEmoji}
              </Box>
            </Grid>
            {/* Hue Picker */}
            <Grid item xs={12} md={10}>
              <Box
                sx={{
                  mt: { xs: 0, md: 1 },
                  width: "100%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  border: "2px solid #000",
                  "& .hue-horizontal": {
                    borderRadius: "0px !important",
                    height: "20px !important",
                  },
                  opacity: isSubmitting ? 0.7 : 1, // Dim if submitting
                }}
              >
                <HuePicker
                  color={selectedColour}
                  onChange={handleHueChange}
                  width="100%"
                // Note: HuePicker itself doesn't have a 'disabled' prop
                />
              </Box>
            </Grid>
          </Grid>

          {/* Emoji Selection Buttons */}
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1,
              justifyContent: "center",
              mt: 2,
              mb: 1,
              p: 1,
              border: '1px dashed grey',
              borderRadius: '4px',
              width: '100%',
              opacity: isSubmitting ? 0.7 : 1, // Dim if submitting
            }}
          >
            {displayedEmojis.map((emoji) => (
              <Button
                key={emoji}
                variant="outlined"
                onClick={() => handleEmojiClick(emoji)}
                disabled={isSubmitting}
                sx={{
                  fontSize: "1.8rem",
                  minWidth: "50px",
                  width: "50px",
                  height: "50px",
                  p: 0,
                  borderColor: selectedEmoji === emoji ? selectedColour : 'grey.400',
                  borderWidth: selectedEmoji === emoji ? '2px' : '1px',
                  backgroundColor:
                    selectedEmoji === emoji ? selectedColour + "33" : "white", // Highlight selected
                  ":hover": {
                    borderColor: selectedColour,
                    backgroundColor: selectedColour + "22",
                  }
                }}
              >
                {emoji}
              </Button>
            ))}
          </Box>

          {/* Button to get more emojis */}
          <Button
            onClick={randomizeEmojis}
            variant="outlined"
            size="small"
            disabled={isSubmitting}
            sx={{ mt: 0, mb: 2, color: selectedColour, borderColor: selectedColour }}
          >
            More Emojis
          </Button>

          {/* Snek Capabilities Section */}
          <Typography variant="h6" component="h2" sx={{ mt: 2, mb: 1, width: "100%" }}>
            Snek Capabilities
          </Typography>
          <FormGroup sx={{
            width: "100%",
            mb: 2,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '8px',
            opacity: isSubmitting ? 0.7 : 1, // Dim if submitting
          }}>
            {availableGameTypes.map((gameType) => (
              <FormControlLabel
                key={gameType}
                control={
                  <Checkbox
                    checked={snekCapabilities.includes(gameType)}
                    onChange={() => handleCapabilityChange(gameType)}
                    disabled={isSubmitting}
                    sx={{
                      color: selectedColour, // Use selected color for checkbox
                      '&.Mui-checked': {
                        color: selectedColour,
                      },
                    }}
                  />
                }
                label={gameType.charAt(0).toUpperCase() + gameType.slice(1)} // Capitalize label
              />
            ))}
          </FormGroup>

          {/* Error Message Display */}
          {error && (
            <Typography color="error" sx={{ textAlign: "center", mt: 2, mb: 1 }}>
              {error}
            </Typography>
          )}
          {/* Success Message Display */}
          {successMessage && (
            <Typography color="success.main" sx={{ textAlign: "center", mt: 2, mb: 1 }}>
              {successMessage}
            </Typography>
          )}

          {/* Submit Button */}
          <Button
            type="submit" // Makes this button submit the form
            variant="contained"
            fullWidth
            disabled={isSubmitting}
            onClick={(e) => { e.preventDefault(); handleSubmitSnek() }} // Handle submission on click
            sx={{
              mt: 3,
              mb: 2,
              backgroundColor: selectedColour, // Use selected color for button
              color: generateColor(hue + 180) > '#808080' ? 'black' : 'white', // Contrast text color
              ":hover": { backgroundColor: generateColor(hue, 70, 40) }, // Darken on hover
            }}
          >
            {isSubmitting ? "Adding Snek..." : "Add Snek"}
          </Button>

          {/* Sign Out Button */}
          <Button
            onClick={async () => {
              console.log("[Sign Out Button] Clicked.")
              await signOut(auth)
              window.location.reload() // Reload page after sign out
            }}
            variant="text"
            color="inherit"
            disabled={isSubmitting}
            sx={{ mt: 1, color: 'grey.700' }}
          >
            Sign Out
          </Button>
        </Box>
      </Paper>
    </Container>
  )
}

export default NewSnek
