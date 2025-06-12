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

app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/messages", messageRoutes)

io.use(socketAuth)

const connectedUsers = new Map()

io.on("connection", (socket) => {
  socket.on("join", (userId) => {
    connectedUsers.set(userId, socket.id)
    socket.userId = userId
  })

  socket.on("sendMessage", (messageData) => {
    const receiverSocketId = connectedUsers.get(messageData.receiver)
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", messageData)
    }
  })

  socket.on("disconnect", () => {
    if (socket.userId) {
      connectedUsers.delete(socket.userId)
    }
  })
})

const PORT = process.env.PORT || 3001

async function startServer() {
  try {
    await connectToDatabase()
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`)
    })
  } catch (error) {
    console.error("❌ Failed to start server:", error.message)
    process.exit(1)
  }
}

startServer()
