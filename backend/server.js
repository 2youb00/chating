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
  })
})

app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/messages", messageRoutes)

io.use(socketAuth)

const connectedUsers = new Map() // userId -> socketId
const userSockets = new Map() // socketId -> userId

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`)

  socket.on("join", (userId) => {
    // Clean up any existing connections for this user
    const existingSocketId = connectedUsers.get(userId)
    if (existingSocketId && existingSocketId !== socket.id) {
      const existingSocket = io.sockets.sockets.get(existingSocketId)
      if (existingSocket) {
        existingSocket.disconnect()
      }
    }

    // Store new connection
    connectedUsers.set(userId, socket.id)
    userSockets.set(socket.id, userId)
    socket.userId = userId
    socket.join(`user_${userId}`)

    console.log(`User ${userId} joined with socket ${socket.id}`)

    // Broadcast user online status
    socket.broadcast.emit("userOnline", userId)

    // Send current online users to the newly connected user
    const onlineUsers = Array.from(connectedUsers.keys())
    socket.emit("onlineUsers", onlineUsers)
  })

  socket.on("sendMessage", (messageData) => {
    // Validate message data
    if (!messageData.receiver || !messageData.sender) {
      console.log("Invalid message data:", messageData)
      return
    }

    const receiverSocketId = connectedUsers.get(messageData.receiver)
    if (receiverSocketId) {
      // Send only to the specific receiver
      io.to(receiverSocketId).emit("newMessage", messageData)
      console.log(`Message sent from ${messageData.sender} to ${messageData.receiver}`)
    }
  })

  socket.on("messageRead", (data) => {
    if (!data.senderId) return

    const senderSocketId = connectedUsers.get(data.senderId)
    if (senderSocketId) {
      io.to(senderSocketId).emit("messageRead", {
        messageId: data.messageId,
        readBy: data.readBy,
      })
    }
  })

  socket.on("typing", (data) => {
    if (!data.receiverId) return

    const receiverSocketId = connectedUsers.get(data.receiverId)
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("userTyping", {
        userId: data.senderId,
        isTyping: true,
      })
    }
  })

  socket.on("stopTyping", (data) => {
    if (!data.receiverId) return

    const receiverSocketId = connectedUsers.get(data.receiverId)
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("userTyping", {
        userId: data.senderId,
        isTyping: false,
      })
    }
  })

  socket.on("disconnect", (reason) => {
    const userId = userSockets.get(socket.id)
    if (userId) {
      console.log(`User ${userId} disconnected: ${reason}`)

      // Clean up user mappings
      connectedUsers.delete(userId)
      userSockets.delete(socket.id)

      // Broadcast user offline status
      socket.broadcast.emit("userOffline", userId)

      // Send updated online users list
      const onlineUsers = Array.from(connectedUsers.keys())
      socket.broadcast.emit("onlineUsers", onlineUsers)
    }
  })

  // Handle connection errors
  socket.on("error", (error) => {
    console.error("Socket error:", error)
  })
})

app.use((err, req, res, next) => {
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
