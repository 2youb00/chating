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
    origin: ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  },
})

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  }),
)
app.use(express.json())

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "ChatConnect server is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/messages", messageRoutes)

io.use(socketAuth)

const connectedUsers = new Map()
const userTyping = new Map()

io.on("connection", (socket) => {
  socket.on("join", (userId) => {
    connectedUsers.set(userId, socket.id)
    socket.userId = userId
    socket.join(`user_${userId}`)

    // Broadcast user online status to all connected users
    io.emit("userOnline", userId)

    // Send current online users to the newly connected user
    const onlineUsers = Array.from(connectedUsers.keys())
    socket.emit("onlineUsers", onlineUsers)

    // Send online users to all other connected users
    socket.broadcast.emit("onlineUsers", onlineUsers)
  })

  socket.on("sendMessage", (messageData) => {
    const receiverSocketId = connectedUsers.get(messageData.receiver)
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", messageData)
    }
  })

  socket.on("messageRead", (data) => {
    const senderSocketId = connectedUsers.get(data.senderId)
    if (senderSocketId) {
      io.to(senderSocketId).emit("messageRead", {
        messageId: data.messageId,
        readBy: data.readBy,
      })
    }
  })

  socket.on("typing", (data) => {
    const receiverSocketId = connectedUsers.get(data.receiverId)
    if (receiverSocketId) {
      userTyping.set(data.senderId, data.receiverId)
      io.to(receiverSocketId).emit("userTyping", {
        userId: data.senderId,
        isTyping: true,
      })
    }
  })

  socket.on("stopTyping", (data) => {
    const receiverSocketId = connectedUsers.get(data.receiverId)
    if (receiverSocketId) {
      userTyping.delete(data.senderId)
      io.to(receiverSocketId).emit("userTyping", {
        userId: data.senderId,
        isTyping: false,
      })
    }
  })

  socket.on("disconnect", () => {
    if (socket.userId) {
      connectedUsers.delete(socket.userId)
      userTyping.delete(socket.userId)

      // Broadcast user offline status to all connected users
      io.emit("userOffline", socket.userId)

      // Send updated online users list to all connected users
      const onlineUsers = Array.from(connectedUsers.keys())
      io.emit("onlineUsers", onlineUsers)
    }
  })
})

app.use((err, req, res, next) => {
  console.error("Server error:", err)
  res.status(500).json({ message: "Something went wrong!" })
})

app.use("*", (req, res) => {
  res.status(404).json({ message: "Route not found" })
})

const PORT = process.env.PORT || 3001

async function startServer() {
  try {
    // Try to connect to the database
    await connectToDatabase()

    // If connection successful, start the server
    server.listen(PORT, () => {
      console.log(`🚀 ChatConnect Server running on port ${PORT}`)
      console.log(`💬 Socket.IO ready for real-time messaging`)
    })
  } catch (error) {
    console.error("❌ Failed to start server:", error.message)
    process.exit(1)
  }
}

// Add more graceful error handling
startServer().catch((err) => {
  console.error("Fatal error during server startup:", err)
  process.exit(1)
})

process.on("SIGINT", async () => {
  console.log("\n👋 Shutting down server...")
  io.close()
  server.close(() => {
    process.exit(0)
  })
})

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err)
  // Keep the process running, but log the error
})

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason)
  // Keep the process running, but log the error
})
