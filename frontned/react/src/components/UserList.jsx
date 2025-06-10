"use client"

import { useEffect, useState } from "react"
import { Users } from "lucide-react"
import { io } from "socket.io-client"

function UserList({ currentUser, selectedUser, onSelectUser }) {
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [onlineUsers, setOnlineUsers] = useState(new Set())

  useEffect(() => {
    fetchUsers()

    // Setup socket for online status
    const token = localStorage.getItem("token")
    const socket = io("https://chating-kv0h.onrender.com", {
      auth: { token },
      transports: ["websocket", "polling"],
    })

    socket.on("connect", () => {
      socket.emit("join", currentUser._id)
    })

    socket.on("onlineUsers", (userIds) => {
      setOnlineUsers(new Set(userIds))
    })

    socket.on("userOnline", (userId) => {
      setOnlineUsers((prev) => new Set([...prev, userId]))
    })

    socket.on("userOffline", (userId) => {
      setOnlineUsers((prev) => {
        const newSet = new Set(prev)
        newSet.delete(userId)
        return newSet
      })
    })

    return () => {
      socket.close()
    }
  }, [currentUser._id])

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("https://chating-kv0h.onrender.com/api/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        const otherUsers = data.users.filter((user) => user._id !== currentUser._id)
        setUsers(otherUsers)
      }
    } catch (error) {
      // Silent error handling
    } finally {
      setIsLoading(false)
    }
  }

  const getInitials = (name) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const handleSelectUser = (user) => {
    const userWithOnlineStatus = {
      ...user,
      isOnline: onlineUsers.has(user._id),
    }
    onSelectUser(userWithOnlineStatus)
  }

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mt-1"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Users className="h-5 w-5 text-gray-600" />
          <h2 className="font-semibold text-gray-900">Users ({users.length})</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          {users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No other users available</p>
            </div>
          ) : (
            <div className="space-y-1">
              {users.map((user) => {
                const isOnline = onlineUsers.has(user._id)
                return (
                  <button
                    key={user._id}
                    onClick={() => handleSelectUser(user)}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      selectedUser?._id === user._id ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-medium">
                          {getInitials(user.name)}
                        </div>
                        {isOnline && (
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{user.name}</p>
                        <p className="text-sm text-gray-500 truncate">{isOnline ? "Online" : "Offline"}</p>
                      </div>
                      {isOnline && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Online
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UserList
