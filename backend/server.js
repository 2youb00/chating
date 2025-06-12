import express from "express"
import http from "http"
import { Server } from "socket.io"
import cors from "cors"
import dotenv from "dotenv"

dotenv.config()

import authRoutes from "./routes/authRoutes.js"
import userRoutes from "./routes/userRoutes.js"
import messageRoutes from "./routes/messageRoutes.js"
import { socketAuth } from "./middlewares/auth.js"
import { connectToDatabase } from "./config/database.js"

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
   cors: {
    origin: ["http://localhost:5173", "http://localhost:3000","https://chating-theta.vercel.app"],
    methods: ["GET", "POST"],
    credentials: true,
  },
})

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://chating-theta.vercel.app"
    ],
    credentials: true,
  }),
)
app.use(express.json())

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "ChatConnect server is running",
    timestamp: new Date().toISOString(),
    connectedUsers: connectedUsers.size,
  })
})

app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/messages", messageRoutes)

// Enhanced socket authentication
io.use((socket, next) => {
  console.log("Socket connection attempt:", socket.id)
  socketAuth(socket, next)
})

const connectedUsers = new Map()
const userSockets = new Map()

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id} for user: ${socket.userId}`)

  socket.on("join", (userId) => {
    try {
      // Validate userId
      if (!userId || userId !== socket.userId) {
        console.error(`Invalid userId in join: ${userId} vs ${socket.userId}`)
        return
      }

      // Clean up any existing connections for this user
      const existingSocketId = connectedUsers.get(userId)
      if (existingSocketId && existingSocketId !== socket.id) {
        const existingSocket = io.sockets.sockets.get(existingSocketId)
        if (existingSocket) {
          console.log(`Disconnecting existing socket for user ${userId}`)
          existingSocket.disconnect()
        }
      }

      // Store new connection
      connectedUsers.set(userId, socket.id)
      userSockets.set(socket.id, userId)
      socket.userId = userId
      socket.join(`user_${userId}`)

      console.log(`✅ User ${userId} successfully joined with socket ${socket.id}`)

      // Broadcast user online status
      socket.broadcast.emit("userOnline", userId)

      // Send current online users
      const onlineUsers = Array.from(connectedUsers.keys())
      socket.emit("onlineUsers", onlineUsers)

      // Confirm connection to client
      socket.emit("joinConfirmed", { userId, socketId: socket.id })
    } catch (error) {
      console.error("Error in join handler:", error)
    }
  })

  socket.on("sendMessage", (messageData) => {
    try {
      if (!messageData.receiver || !messageData.sender) {
        console.log("Invalid message data:", messageData)
        return
      }

      // Verify sender matches socket user
      if (messageData.sender !== socket.userId) {
        console.error(`Sender mismatch: ${messageData.sender} vs ${socket.userId}`)
        return
      }

      const receiverSocketId = connectedUsers.get(messageData.receiver)
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newMessage", messageData)
        console.log(`✅ Message sent from ${messageData.sender} to ${messageData.receiver}`)
      } else {
        console.log(`Receiver ${messageData.receiver} not online`)
      }
    } catch (error) {
      console.error("Error in sendMessage:", error)
    }
  })

  socket.on("messageRead", (data) => {
    try {
      if (!data.senderId) return

      const senderSocketId = connectedUsers.get(data.senderId)
      if (senderSocketId) {
        io.to(senderSocketId).emit("messageRead", {
          messageId: data.messageId,
          readBy: data.readBy,
        })
      }
    } catch (error) {
      console.error("Error in messageRead:", error)
    }
  })

  socket.on("typing", (data) => {
    try {
      if (!data.receiverId || data.senderId !== socket.userId) return

      const receiverSocketId = connectedUsers.get(data.receiverId)
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("userTyping", {
          userId: data.senderId,
          isTyping: true,
        })
      }
    } catch (error) {
      console.error("Error in typing:", error)
    }
  })

  socket.on("stopTyping", (data) => {
    try {
      if (!data.receiverId || data.senderId !== socket.userId) return

      const receiverSocketId = connectedUsers.get(data.receiverId)
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("userTyping", {
          userId: data.senderId,
          isTyping: false,
        })
      }
    } catch (error) {
      console.error("Error in stopTyping:", error)
    }
  })

  socket.on("disconnect", (reason) => {
    try {
      const userId = userSockets.get(socket.id)
      if (userId) {
        console.log(`❌ User ${userId} disconnected: ${reason}`)

        connectedUsers.delete(userId)
        userSockets.delete(socket.id)

        socket.broadcast.emit("userOffline", userId)

        const onlineUsers = Array.from(connectedUsers.keys())
        socket.broadcast.emit("onlineUsers", onlineUsers)
      }
    } catch (error) {
      console.error("Error in disconnect:", error)
    }
  })

  socket.on("error", (error) => {
    console.error("Socket error:", error)
  })
})

app.use((err, req, res, next) => {
  console.error("Express error:", err)
  res.status(500).json({ message: "Something went wrong!" })
})

app.use("*", (req, res) => {
  res.status(404).json({ message: "Route not found" })
})

const PORT = process.env.PORT || 3001

async function startServer() {
  try {
    await connectToDatabase()
    server.listen(PORT, () => {
      console.log(`🚀 ChatConnect Server running on port ${PORT}`)
      console.log(`💬 Socket.IO ready for real-time messaging`)
      console.log(`🔗 Health check: http://localhost:${PORT}/health`)
    })
  } catch (error) {
    console.error("❌ Failed to start server:", error.message)
    process.exit(1)
  }
}

startServer()

process.on("SIGINT", async () => {
  console.log("\n👋 Shutting down server...")
  io.close()
  server.close(() => process.exit(0))
})
