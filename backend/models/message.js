import { connectToDatabase } from "../config/database.js"
import { ObjectId } from "mongodb"

class Message {
  static async create(messageData) {
    const { db } = await connectToDatabase()

    const result = await db.collection("messages").insertOne({
      sender: new ObjectId(messageData.sender),
      receiver: new ObjectId(messageData.receiver),
      content: messageData.content,
      type: messageData.type || "text", // Add message type
      timestamp: new Date(),
      isRead: false,
      readAt: null,
    })

    return await db.collection("messages").findOne({ _id: result.insertedId })
  }

  static async findConversation(userId1, userId2) {
    const { db } = await connectToDatabase()

    return await db
      .collection("messages")
      .find({
        $or: [
          { sender: new ObjectId(userId1), receiver: new ObjectId(userId2) },
          { sender: new ObjectId(userId2), receiver: new ObjectId(userId1) },
        ],
      })
      .sort({ timestamp: 1 })
      .toArray()
  }

  static async markAsRead(messageId, readBy) {
    const { db } = await connectToDatabase()

    return await db.collection("messages").updateOne(
      { _id: new ObjectId(messageId) },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
          readBy: new ObjectId(readBy),
        },
      },
    )
  }

  static async markConversationAsRead(senderId, receiverId) {
    const { db } = await connectToDatabase()

    return await db.collection("messages").updateMany(
      {
        sender: new ObjectId(senderId),
        receiver: new ObjectId(receiverId),
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
          readBy: new ObjectId(receiverId),
        },
      },
    )
  }

  static async findById(id) {
    const { db } = await connectToDatabase()
    return await db.collection("messages").findOne({ _id: new ObjectId(id) })
  }

  static async deleteMessage(id) {
    const { db } = await connectToDatabase()
    return await db.collection("messages").deleteOne({ _id: new ObjectId(id) })
  }
}

export default Message
