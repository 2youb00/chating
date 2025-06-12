import jwt from "jsonwebtoken"

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ message: "Access token required" })
  }

  jwt.verify(token, process.env.JWT_SECRET || "your-secret-key", (err, user) => {
    if (err) {
      console.error("Token verification error:", err.message)
      return res.status(403).json({ message: "Invalid or expired token" })
    }
    req.user = user
    next()
  })
}

export const socketAuth = (socket, next) => {
  const token = socket.handshake.auth.token

  if (!token) {
    console.error("Socket auth: No token provided")
    return next(new Error("Authentication error: No token"))
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key")
    socket.userId = decoded.userId
    console.log(`Socket authenticated for user: ${decoded.userId}`)
    next()
  } catch (err) {
    console.error("Socket auth error:", err.message)
    next(new Error("Authentication error: Invalid token"))
  }
}
