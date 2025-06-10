import dotenv from "dotenv"
dotenv.config()

import { MongoClient } from "mongodb"

const uri = process.env.MONGODB_URI
console.log("✅ Loaded MONGODB_URI:", uri)

if (!uri) {
  console.error("❌ MONGODB_URI environment variable is required")
  process.exit(1)
}

const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 30000, // Increased from 5000 to 30000
  socketTimeoutMS: 60000, // Increased from 45000 to 60000
  useNewUrlParser: true,
  useUnifiedTopology: true,
  retryWrites: true,
  w: "majority",
}

let client
let clientPromise

// Create a more resilient connection function
async function createConnection() {
  try {
    client = new MongoClient(uri, options)
    console.log("⏳ Connecting to MongoDB...")

    // Add retry logic
    let retries = 3
    let connected = false

    while (retries > 0 && !connected) {
      try {
        await client.connect()
        connected = true
      } catch (err) {
        console.log(`⚠️ Connection attempt failed, retries left: ${retries - 1}`)
        retries--
        if (retries === 0) throw err
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }
    }

    return client
  } catch (error) {
    console.error("❌ Failed to create MongoDB client:", error.message)
    process.exit(1)
  }
}

// Initialize the connection
clientPromise = createConnection()

export async function connectToDatabase() {
  try {
    const client = await clientPromise

    // Test the connection
    await client.db("admin").command({ ping: 1 })
    console.log("✅ MongoDB connected successfully")

    const dbName = new URL(uri).pathname.substring(1) || "chatconnect"
    const db = client.db(dbName)

    console.log(`📊 Using database: ${dbName}`)

    await createIndexes(db)
    return { client, db }
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message)
    console.error("🔍 Please check:")
    console.error("  - Your network connection")
    console.error("  - MongoDB Atlas whitelist settings (IP access)")
    console.error("  - Username and password in connection string")
    console.error("  - MongoDB service status")
    process.exit(1)
  }
}

async function createIndexes(db) {
  try {
    await db.collection("users").createIndex({ email: 1 }, { unique: true })
    await db.collection("messages").createIndex({ sender: 1, receiver: 1 })
    await db.collection("messages").createIndex({ timestamp: -1 })
    console.log("✅ Database indexes created successfully")
  } catch (error) {
    console.warn("⚠️ Could not create indexes:", error.message)
  }
}

// Handle process termination
process.on("SIGINT", async () => {
  if (client) {
    console.log("Closing MongoDB connection...")
    await client.close()
    console.log("MongoDB connection closed")
  }
  process.exit(0)
})

export default clientPromise
