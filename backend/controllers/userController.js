import User from "../models/user.js"

class UserController {
  static async getAllUsers(req, res) {
    try {
      const users = await User.findAll()
      res.json({ users })
    } catch (error) {
      console.error("Get users error:", error)
      res.status(500).json({ message: "Internal server error" })
    }
  }

  static async getUserById(req, res) {
    try {
      const { id } = req.params
      const user = await User.findById(id)

      if (!user) {
        return res.status(404).json({ message: "User not found" })
      }

      const { password, ...userResponse } = user
      res.json({ user: userResponse })
    } catch (error) {
      console.error("Get user error:", error)
      res.status(500).json({ message: "Internal server error" })
    }
  }
}

export default UserController
