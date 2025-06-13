"use client"

import { useEffect, useState, useRef } from "react"
import { Send, Check, CheckCheck, Palette } from "lucide-react"
import { io } from "socket.io-client"
import DrawingCanvas from "./DrawingCanvas"

function ChatWindow({ currentUser, selectedUser, onUserStatusChange }) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [userOnlineStatus, setUserOnlineStatus] = useState(selectedUser?.isOnline || false)
  const [showDrawing, setShowDrawing] = useState(false)
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const currentChatRef = useRef(null)
  const socketInitialized = useRef(false)
  const socketReconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  // Initialize socket connection with better reconnection handling
  useEffect(() => {
    const initializeSocket = () => {
      if (socketInitialized.current) return

      const token = localStorage.getItem("token")
      if (!token) return

      console.log("Initializing socket connection...")

      const newSocket = io("https://chating-kv0h.onrender.com", {
        auth: { token },
        transports: ["websocket", "polling"],
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      })

      newSocket.on("connect", () => {
        console.log("Socket connected successfully")
        setIsConnected(true)
        socketReconnectAttempts.current = 0
        newSocket.emit("join", currentUser._id)

        // Request online users immediately after connection
        newSocket.emit("getOnlineUsers")
      })

      newSocket.on("disconnect", () => {
        console.log("Socket disconnected")
        setIsConnected(false)
      })

      newSocket.on("connect_error", (error) => {
        console.error("Socket connection error:", error)
        socketReconnectAttempts.current += 1

        if (socketReconnectAttempts.current >= maxReconnectAttempts) {
          console.error("Max reconnection attempts reached")
          newSocket.close()
          socketInitialized.current = false
        }
      })

      newSocket.on("newMessage", (message) => {
        console.log("New message received:", message)
        const currentChat = currentChatRef.current

        if (
          currentChat &&
          ((message.sender === currentChat && message.receiver === currentUser._id) ||
            (message.sender === currentUser._id && message.receiver === currentChat))
        ) {
          setMessages((prev) => {
            // Prevent duplicate messages by checking ID
            const exists = prev.some((msg) => msg._id === message._id)
            if (exists) return prev
            return [...prev, message]
          })

          // Mark message as read immediately if it's from the current chat partner
          if (message.sender === currentChat) {
            markMessageAsRead(message._id, message.sender)
          }
        }
      })

      newSocket.on("messageRead", (data) => {
        console.log("Message read event:", data)
        const currentChat = currentChatRef.current

        if (currentChat) {
          setMessages((prev) =>
            prev.map((msg) => (msg._id === data.messageId ? { ...msg, isRead: true, readBy: data.readBy } : msg)),
          )
        }
      })

      newSocket.on("userTyping", (data) => {
        const currentChat = currentChatRef.current
        if (data.userId === currentChat) {
          setIsTyping(data.isTyping)
        }
      })

      newSocket.on("userOnline", (userId) => {
        console.log("User online:", userId)
        if (userId === selectedUser?._id) {
          setUserOnlineStatus(true)
          onUserStatusChange?.(userId, true)
        }
      })

      newSocket.on("userOffline", (userId) => {
        console.log("User offline:", userId)
        if (userId === selectedUser?._id) {
          setUserOnlineStatus(false)
          setIsTyping(false)
          onUserStatusChange?.(userId, false)
        }
      })

      newSocket.on("onlineUsers", (userIds) => {
        console.log("Online users:", userIds)
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

    const newSocket = initializeSocket()

    // Cleanup function
    return () => {
      if (newSocket) {
        console.log("Cleaning up socket connection")
        newSocket.close()
      }
      socketInitialized.current = false
    }
  }, [currentUser._id, selectedUser?._id])

  // Handle chat switching with improved state management
  useEffect(() => {
    if (!selectedUser) return

    console.log("Selected user changed:", selectedUser._id)

    // Clear previous chat state
    setMessages([])
    setIsTyping(false)
    setIsLoading(true)

    // Update current chat reference
    currentChatRef.current = selectedUser._id
    setUserOnlineStatus(selectedUser.isOnline || false)

    // Fetch messages for new chat
    fetchMessages()

    // Notify server about chat change
    if (socket && isConnected) {
      socket.emit("joinChat", {
        userId: currentUser._id,
        chatPartnerId: selectedUser._id,
      })
    }
  }, [selectedUser?._id, isConnected])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Improved message read marking with retry mechanism
  const markMessageAsRead = async (messageId, senderId) => {
    console.log("Marking message as read:", messageId)

    // Emit socket event first for immediate UI update
    if (socket && isConnected && currentChatRef.current === selectedUser?._id) {
      socket.emit("messageRead", {
        messageId: messageId,
        senderId: senderId,
        readBy: currentUser._id,
      })
    }

    // Then update server via API (with retry)
    const updateServer = async (retries = 3) => {
      try {
        const token = localStorage.getItem("token")
        const response = await fetch(`https://chating-kv0h.onrender.com/api/messages/${messageId}/read`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok && retries > 0) {
          console.log(`Read receipt API failed, retrying... (${retries} attempts left)`)
          setTimeout(() => updateServer(retries - 1), 1000)
        }
      } catch (error) {
        if (retries > 0) {
          console.log(`Read receipt API error, retrying... (${retries} attempts left)`)
          setTimeout(() => updateServer(retries - 1), 1000)
        }
      }
    }

    updateServer()
  }

  // Improved message fetching with better error handling
  const fetchMessages = async () => {
    if (!selectedUser) return

    setIsLoading(true)
    const chatId = selectedUser._id
    console.log("Fetching messages for chat:", chatId)

    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`https://chating-kv0h.onrender.com/api/messages/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()

        // Only update if this is still the current chat
        if (currentChatRef.current === chatId) {
          console.log(`Received ${data.messages.length} messages`)
          setMessages(data.messages)

          // Mark unread messages as read with a slight delay to ensure UI is ready
          setTimeout(() => {
            if (currentChatRef.current === chatId) {
              data.messages.forEach((message) => {
                if (message.sender === chatId && !message.isRead) {
                  markMessageAsRead(message._id, message.sender)
                }
              })
            }
          }, 300)
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

  // Enhanced message sending with better error handling
  const sendMessage = async (content, type = "text") => {
    if (!selectedUser || !isConnected) return

    const chatId = selectedUser._id
    const tempMessage = {
      _id: `temp_${Date.now()}_${currentUser._id}`,
      sender: currentUser._id,
      receiver: chatId,
      content: content,
      type: type,
      timestamp: new Date(),
      isRead: false,
      isTemp: true,
    }

    // Add message instantly to UI
    setMessages((prev) => [...prev, tempMessage])

    if (socket && type === "text") {
      socket.emit("stopTyping", {
        senderId: currentUser._id,
        receiverId: chatId,
      })
    }

    try {
      const token = localStorage.getItem("token")
      const response = await fetch("https://chating-kv0h.onrender.com/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sender: currentUser._id,
          receiver: chatId,
          content: content,
          type: type,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log("Message sent successfully:", data.message)

        if (currentChatRef.current === chatId) {
          // Replace temp message with real one
          setMessages((prev) => prev.map((msg) => (msg._id === tempMessage._id ? data.message : msg)))
        }

        // Emit socket event to notify recipient
        if (socket) {
          socket.emit("sendMessage", data.message)
        }
      } else {
        console.error("Failed to send message:", response.status)
        if (currentChatRef.current === chatId) {
          // Remove temp message on error
          setMessages((prev) => prev.filter((msg) => msg._id !== tempMessage._id))
          if (type === "text") setNewMessage(content)
        }
      }
    } catch (error) {
      console.error("Error sending message:", error)
      if (currentChatRef.current === chatId) {
        // Remove temp message on error
        setMessages((prev) => prev.filter((msg) => msg._id !== tempMessage._id))
        if (type === "text") setNewMessage(content)
      }
    }
  }

  const handleSendText = (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !isConnected || !selectedUser) return

    sendMessage(newMessage.trim(), "text")
    setNewMessage("")
  }

  const handleSendDrawing = (drawingData) => {
    sendMessage(drawingData, "drawing")
    setShowDrawing(false)
  }

  const handleTyping = (e) => {
    setNewMessage(e.target.value)

    if (socket && isConnected && e.target.value.trim() && selectedUser) {
      socket.emit("typing", {
        senderId: currentUser._id,
        receiverId: selectedUser._id,
      })

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      typingTimeoutRef.current = setTimeout(() => {
        if (socket && isConnected) {
          socket.emit("stopTyping", {
            senderId: currentUser._id,
            receiverId: selectedUser._id,
          })
        }
      }, 2000)
    }
  }

  // Force refresh messages and connection status
  const handleRefreshChat = () => {
    if (selectedUser) {
      fetchMessages()

      if (socket && isConnected) {
        socket.emit("getOnlineUsers")
      } else if (!isConnected) {
        // Try to reconnect socket
        socketInitialized.current = false
        socketReconnectAttempts.current = 0
      }
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

  // Check if string is a valid base64 image
  const isBase64Image = (str) => {
    return (
      typeof str === "string" &&
      (str.startsWith("data:image/png;base64,") ||
        str.startsWith("data:image/jpeg;base64,") ||
        str.startsWith("data:image/jpg;base64,") ||
        str.startsWith("data:image/gif;base64,"))
    )
  }

  const renderMessage = (message) => {
    // Handle drawing or base64 image messages
    if (message.type === "drawing" || isBase64Image(message.content)) {
      return (
        <div className="max-w-[75%] md:max-w-xs lg:max-w-md">
          <img
            src={message.content || "/placeholder.svg"}
            alt="Drawing"
            className="rounded-lg max-w-full h-auto border"
            style={{ maxHeight: "300px" }}
            onLoad={() => {
              // Ensure scroll to bottom after image loads
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
            }}
          />
          <div className="flex items-center justify-between mt-1">
            <p className={`text-xs ${message.sender === currentUser._id ? "text-blue-100" : "text-gray-500"}`}>
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
      )
    }

    // Handle text messages
    return (
      <div
        className={`max-w-[75%] md:max-w-xs lg:max-w-md px-3 py-2 md:px-4 md:py-2 rounded-lg ${
          message.sender === currentUser._id ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-900"
        } ${message.isTemp ? "opacity-70" : ""}`}
      >
        <p className="text-sm break-words">{message.content}</p>
        <div className="flex items-center justify-between mt-1">
          <p className={`text-xs ${message.sender === currentUser._id ? "text-blue-100" : "text-gray-500"}`}>
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
    )
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
          <div className="flex items-center gap-2">
            <button onClick={handleRefreshChat} className="p-1 hover:bg-gray-100 rounded-full" title="Refresh chat">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 2v6h-6"></path>
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                <path d="M3 22v-6h6"></path>
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
              </svg>
            </button>
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}></div>
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
                  {renderMessage(message)}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-3 md:p-4">
        <form onSubmit={handleSendText} className="flex space-x-2">
          <button
            type="button"
            onClick={() => setShowDrawing(true)}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full"
            title="Open Drawing Canvas"
            disabled={!isConnected}
          >
            <Palette className="h-5 w-5" />
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={handleTyping}
            placeholder={isConnected ? `Message ${selectedUser.name}...` : "Connecting..."}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={!isConnected}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || !isConnected}
            className="px-3 py-2 md:px-4 md:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>

      {showDrawing && <DrawingCanvas onSendDrawing={handleSendDrawing} onClose={() => setShowDrawing(false)} />}
    </div>
  )
}

export default ChatWindow
