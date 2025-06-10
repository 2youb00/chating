import { connectToDatabase } from "../config/database.js"
import bcrypt from "bcryptjs"
import { ObjectId } from "mongodb"

class User {
  static async create(userData) {
    const { db } = await connectToDatabase()

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 12)

    const result = await db.collection("users").insertOne({
      name: userData.name,
      email: userData.email,
      password: hashedPassword,
      createdAt: new Date(),
      isOnline: false,
    })

    return {
      _id: result.insertedId,
      name: userData.name,
      email: userData.email,
    }
  }

  static async findByEmail(email) {
    const { db } = await connectToDatabase()
    return await db.collection("users").findOne({ email })
  }

  static async findById(id) {
    const { db } = await connectToDatabase()
    return await db.collection("users").findOne({ _id: new ObjectId(id) })
  }

  static async findAll() {
    const { db } = await connectToDatabase()
    return await db
      .collection("users")
      .find({}, { projection: { password: 0 } })
      .toArray()
  }

  static async updateOnlineStatus(userId, isOnline) {
    const { db } = await connectToDatabase()
    return await db.collection("users").updateOne({ _id: new ObjectId(userId) }, { $set: { isOnline } })
  }

  static async validatePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword)
  }
}

export default User
