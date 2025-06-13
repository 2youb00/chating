import Message from "../models/message.js"
import { ObjectId } from "mongodb"

class MessageController {
  static async sendMessage(req, res) {
    try {
      const { sender, receiver, content, type } = req.body

      if (!sender || !receiver || !content) {
        return res.status(400).json({ message: "Sender, receiver, and content are required" })
      }

      if (!ObjectId.isValid(sender) || !ObjectId.isValid(receiver)) {
        return res.status(400).json({ message: "Invalid user ID format" })
      }

      const message = await Message.create({ sender, receiver, content, type })

      res.status(201).json({
        message: "Message sent successfully",
        message: message,
      })
    } catch (error) {
      console.error("Send message error:", error)
      res.status(500).json({ message: "Internal server error" })
    }
  }

  static async getConversation(req, res) {
    try {
      const { userId } = req.params
      const currentUserId = req.user.userId

      const messages = await Message.findConversation(currentUserId, userId)
      await Message.markConversationAsRead(userId, currentUserId)

      res.json({ messages })
    } catch (error) {
      console.error("Get messages error:", error)
      res.status(500).json({ message: "Internal server error" })
    }
  }

  static async markMessageAsRead(req, res) {
    try {
      const { messageId } = req.params
      const readBy = req.user.userId

      await Message.markAsRead(new ObjectId(messageId), readBy)
      res.json({ message: "Message marked as read" })
    } catch (error) {
      console.error("Mark message as read error:", error)
      res.status(500).json({ message: "Internal server error" })
    }
  }
}

export default MessageController
