import User from "../models/user.js"
import jwt from "jsonwebtoken"

class AuthController {
  static async login(req, res) {
    try {
      const { email, password } = req.body

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" })
      }

      const user = await User.findByEmail(email)
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" })
      }

      const isPasswordValid = await User.validatePassword(password, user.password)
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid credentials" })
      }

      const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET || "your-secret-key", {
        expiresIn: "7d",
      })

      const userResponse = {
        _id: user._id,
        name: user.name,
        email: user.email,
      }

      res.json({
        message: "Login successful",
        token,
        user: userResponse,
      })
    } catch (error) {
      console.error("Login error:", error)
      res.status(500).json({ message: "Internal server error" })
    }
  }

  static async signup(req, res) {
    try {
      const { name, email, password } = req.body

      if (!name || !email || !password) {
        return res.status(400).json({ message: "Name, email, and password are required" })
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" })
      }

      const existingUser = await User.findByEmail(email)
      if (existingUser) {
        return res.status(409).json({ message: "User already exists with this email" })
      }

      const user = await User.create({ name, email, password })

      const token = jwt.sign({ userId: user._id, email }, process.env.JWT_SECRET || "your-secret-key", {
        expiresIn: "7d",
      })

      res.status(201).json({
        message: "User created successfully",
        token,
        user,
      })
    } catch (error) {
      console.error("Signup error:", error)
      res.status(500).json({ message: "Internal server error" })
    }
  }

  static async verifyToken(req, res) {
    // If middleware passed, token is valid
    res.json({ valid: true, user: { userId: req.user.userId, email: req.user.email } })
  }
}

export default AuthController
