import express from "express"
import MessageController from "../controllers/messageController.js"
import { authenticateToken } from "../middlewares/auth.js"
import { ObjectId } from "mongodb"

const router = express.Router()

// Middleware to validate ObjectId format
const validateObjectId = (req, res, next) => {
  const { userId, messageId } = req.params

  if (userId && !ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID format" })
  }

  if (messageId && !ObjectId.isValid(messageId)) {
    return res.status(400).json({ message: "Invalid message ID format" })
  }

  next()
}

router.post("/", authenticateToken, MessageController.sendMessage)
router.get("/:userId", authenticateToken, validateObjectId, MessageController.getConversation)
router.put("/:messageId/read", authenticateToken, validateObjectId, MessageController.markMessageAsRead)

export default router
