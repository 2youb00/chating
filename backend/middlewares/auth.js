import jwt from "jsonwebtoken"

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ message: "Access token required" })
  }

  jwt.verify(token, process.env.JWT_SECRET || "your-secret-key", (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token" })
    }
    req.user = user
    next()
  })
}

export const socketAuth = (socket, next) => {
  const token = socket.handshake.auth.token
  if (!token) {
    return next(new Error("No token"))
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key")
    socket.userId = decoded.userId
    next()
  } catch (err) {
    next(new Error("Invalid token"))
  }
}
