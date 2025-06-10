import express from "express"
import UserController from "../controllers/userController.js"
import { authenticateToken } from "../middlewares/auth.js"
import { ObjectId } from "mongodb"

const router = express.Router()

// Middleware to validate ObjectId format
const validateObjectId = (req, res, next) => {
  const { id } = req.params

  if (id && !ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid user ID format" })
  }

  next()
}

router.get("/", authenticateToken, UserController.getAllUsers)
router.get("/:id", authenticateToken, validateObjectId, UserController.getUserById)

export default router
