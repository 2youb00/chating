"use client"

import { useEffect, useState, useRef } from "react"
import { Send, Check, CheckCheck } from "lucide-react"
import { io } from "socket.io-client"

function ChatWindow({ currentUser, selectedUser, onUserStatusChange }) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionAttempts, setConnectionAttempts] = useState(0)
  const [isTyping, setIsTyping] = useState(false)
  const [userOnlineStatus, setUserOnlineStatus] = useState(selectedUser?.isOnline || false)
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const currentChatRef = useRef(null)
  const socketInitialized = useRef(false)
  const reconnectTimeoutRef = useRef(null)

  // Initialize socket with retry logic
  useEffect(() => {
    if (socketInitialized.current) return

    const initializeSocket = () => {
      const token = localStorage.getItem("token")
      if (!token) {
        console.error("No token found")
        return
      }

      console.log("Initializing socket connection...")

      const newSocket = io("http://localhost:3001", {
        auth: { token },
        transports: ["websocket", "polling"],
        forceNew: true,
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      })

      newSocket.on("connect", () => {
        console.log("Socket connected successfully")
        setIsConnected(true)
        setConnectionAttempts(0)

        // Join user room immediately
        newSocket.emit("join", currentUser._id)
        console.log(`User ${currentUser._id} joined`)
      })

      newSocket.on("connect_error", (error) => {
        console.error("Socket connection error:", error)
        setIsConnected(false)
        setConnectionAttempts((prev) => prev + 1)

        // Retry connection for new users
        if (connectionAttempts < 3) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`Retrying connection... Attempt ${connectionAttempts + 1}`)
            newSocket.connect()
          }, 2000)
        }
      })

      newSocket.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason)
        setIsConnected(false)

        // Auto-reconnect for new users
        if (reason === "io server disconnect" || reason === "transport close") {
          setTimeout(() => {
            console.log("Attempting to reconnect...")
            newSocket.connect()
          }, 1000)
        }
      })

      newSocket.on("reconnect", () => {
        console.log("Socket reconnected")
        setIsConnected(true)
        newSocket.emit("join", currentUser._id)
      })

      // Message events with strict filtering
      newSocket.on("newMessage", (message) => {
        const currentChat = currentChatRef.current
        if (
          currentChat &&
          currentChat === selectedUser?._id &&
          ((message.sender === currentChat && message.receiver === currentUser._id) ||
            (message.sender === currentUser._id && message.receiver === currentChat))
        ) {
          setMessages((prev) => {
            const exists = prev.some((msg) => msg._id === message._id)
            if (exists) return prev
            return [...prev, message]
          })

          if (message.sender === currentChat) {
            markMessageAsRead(message._id, message.sender)
          }
        }
      })

      newSocket.on("messageRead", (data) => {
        const currentChat = currentChatRef.current
        if (currentChat && currentChat === selectedUser?._id) {
          setMessages((prev) =>
            prev.map((msg) => (msg._id === data.messageId ? { ...msg, isRead: true, readBy: data.readBy } : msg)),
          )
        }
      })

      newSocket.on("userTyping", (data) => {
        const currentChat = currentChatRef.current
        if (data.userId === currentChat && currentChat === selectedUser?._id) {
          setIsTyping(data.isTyping)
        }
      })

      newSocket.on("userOnline", (userId) => {
        if (userId === selectedUser?._id) {
          setUserOnlineStatus(true)
          onUserStatusChange?.(userId, true)
        }
      })

      newSocket.on("userOffline", (userId) => {
        if (userId === selectedUser?._id) {
          setUserOnlineStatus(false)
          setIsTyping(false)
          onUserStatusChange?.(userId, false)
        }
      })

      newSocket.on("onlineUsers", (userIds) => {
        if (selectedUser?._id) {
          const isOnline = userIds.includes(selectedUser._id)
          setUserOnlineStatus(isOnline)
          onUserStatusChange?.(selectedUser._id, isOnline)
        }
      })

      setSocket(newSocket)
      socketInitialized.current = true

      return newSocket
    }

    const socket = initializeSocket()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      socketInitialized.current = false
      if (socket) {
        socket.close()
      }
    }
  }, [currentUser._id, connectionAttempts, selectedUser?._id])

  // Handle chat switching
  useEffect(() => {
    if (selectedUser) {
      setMessages([])
      setIsTyping(false)
      setIsLoading(true)
      currentChatRef.current = selectedUser._id
      setUserOnlineStatus(selectedUser.isOnline || false)
      fetchMessages()
    }
  }, [selectedUser?._id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const markMessageAsRead = async (messageId, senderId) => {
    if (socket && socket.connected && currentChatRef.current === selectedUser._id) {
      socket.emit("messageRead", {
        messageId: messageId,
        senderId: senderId,
        readBy: currentUser._id,
      })
    }

    try {
      const token = localStorage.getItem("token")
      await fetch(`http://localhost:3001/api/messages/${messageId}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch (error) {
      console.error("Error marking message as read:", error)
    }
  }

  const fetchMessages = async () => {
    if (!selectedUser) return

    setIsLoading(true)
    const chatId = selectedUser._id

    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`http://localhost:3001/api/messages/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        if (currentChatRef.current === chatId) {
          setMessages(data.messages)

          data.messages.forEach((message) => {
            if (message.sender === chatId && !message.isRead) {
              markMessageAsRead(message._id, message.sender)
            }
          })
        }
      } else {
        console.error("Failed to fetch messages:", response.status)
      }
    } catch (error) {
      console.error("Error fetching messages:", error)
    } finally {
      if (currentChatRef.current === chatId) {
        setIsLoading(false)
      }
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedUser) return

    // Allow sending even if socket is not connected (will retry)
    const chatId = selectedUser._id
    const tempMessage = {
      _id: `temp_${Date.now()}_${currentUser._id}`,
      sender: currentUser._id,
      receiver: chatId,
      content: newMessage.trim(),
      timestamp: new Date(),
      isRead: false,
      isTemp: true,
    }

    setMessages((prev) => [...prev, tempMessage])
    const messageContent = newMessage.trim()
    setNewMessage("")

    // Stop typing
    if (socket && socket.connected) {
      socket.emit("stopTyping", {
        senderId: currentUser._id,
        receiverId: chatId,
      })
    }

    try {
      const token = localStorage.getItem("token")
      const response = await fetch("http://localhost:3001/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sender: currentUser._id,
          receiver: chatId,
          content: messageContent,
        }),
      })

      if (response.ok) {
        const data = await response.json()

        if (currentChatRef.current === chatId) {
          setMessages((prev) => prev.map((msg) => (msg._id === tempMessage._id ? data.message : msg)))
        }

        // Send via socket if connected, otherwise message is still saved
        if (socket && socket.connected) {
          socket.emit("sendMessage", data.message)
        } else {
          console.log("Message saved but socket not connected - will sync when reconnected")
        }
      } else {
        console.error("Failed to send message:", response.status)
        if (currentChatRef.current === chatId) {
          setMessages((prev) => prev.filter((msg) => msg._id !== tempMessage._id))
          setNewMessage(messageContent)
        }
      }
    } catch (error) {
      console.error("Error sending message:", error)
      if (currentChatRef.current === chatId) {
        setMessages((prev) => prev.filter((msg) => msg._id !== tempMessage._id))
        setNewMessage(messageContent)
      }
    }
  }

  const handleTyping = (e) => {
    setNewMessage(e.target.value)

    if (socket && socket.connected && e.target.value.trim() && selectedUser) {
      socket.emit("typing", {
        senderId: currentUser._id,
        receiverId: selectedUser._id,
      })

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      typingTimeoutRef.current = setTimeout(() => {
        if (socket && socket.connected) {
          socket.emit("stopTyping", {
            senderId: currentUser._id,
            receiverId: selectedUser._id,
          })
        }
      }, 2000)
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

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (!selectedUser) return null

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-3 md:p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="h-9 w-9 md:h-10 md:w-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-medium">
                {getInitials(selectedUser.name)}
              </div>
              {userOnlineStatus && (
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{selectedUser.name}</h3>
              <p className="text-xs md:text-sm text-gray-500">
                {userOnlineStatus ? "Online" : "Offline"}
                {isTyping && userOnlineStatus && " • typing..."}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-yellow-500"}`}></div>
            {!isConnected && connectionAttempts > 0 && <span className="text-xs text-yellow-600">Connecting...</span>}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-3 md:space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message._id}
                  className={`flex ${message.sender === currentUser._id ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] md:max-w-xs lg:max-w-md px-3 py-2 md:px-4 md:py-2 rounded-lg ${
                      message.sender === currentUser._id ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-900"
                    } ${message.isTemp ? "opacity-70" : ""}`}
                  >
                    <p className="text-sm break-words">{message.content}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p
                        className={`text-xs ${message.sender === currentUser._id ? "text-blue-100" : "text-gray-500"}`}
                      >
                        {formatTime(message.timestamp)}
                      </p>
                      {message.sender === currentUser._id && !message.isTemp && (
                        <div className="ml-2">
                          {message.isRead ? (
                            <CheckCheck className="h-3 w-3 text-blue-200" />
                          ) : (
                            <Check className="h-3 w-3 text-blue-200" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-3 md:p-4">
        <form onSubmit={sendMessage} className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={handleTyping}
            placeholder={`Message ${selectedUser.name}...`}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="px-3 py-2 md:px-4 md:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        {!isConnected && (
          <p className="text-xs text-yellow-600 mt-1">Messages will be saved and sent when connection is restored</p>
        )}
      </div>
    </div>
  )
}

export default ChatWindow
