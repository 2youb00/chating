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
  const [isTyping, setIsTyping] = useState(false)
  const [userOnlineStatus, setUserOnlineStatus] = useState(selectedUser?.isOnline || false)
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const currentChatRef = useRef(null)
  const socketInitialized = useRef(false)

  // Initialize socket only once per component lifecycle
  useEffect(() => {
    if (socketInitialized.current) return

    const token = localStorage.getItem("token")
    if (!token) return

    const newSocket = io("https://chating-kv0h.onrender.com", {
      auth: { token },
      transports: ["websocket", "polling"],
      forceNew: true, // Force new connection to prevent conflicts
    })

    newSocket.on("connect", () => {
      setIsConnected(true)
      // Only emit join once when socket connects
      newSocket.emit("join", currentUser._id)
    })

    newSocket.on("disconnect", () => {
      setIsConnected(false)
    })

    // Message events with strict filtering
    newSocket.on("newMessage", (message) => {
      // Triple check: current chat, message participants, and component mounted
      const currentChat = currentChatRef.current
      if (
        currentChat &&
        currentChat === selectedUser?._id &&
        ((message.sender === currentChat && message.receiver === currentUser._id) ||
          (message.sender === currentUser._id && message.receiver === currentChat))
      ) {
        setMessages((prev) => {
          // Prevent duplicate messages
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

    return () => {
      socketInitialized.current = false
      newSocket.close()
    }
  }, [currentUser._id])

  // Handle chat switching
  useEffect(() => {
    if (selectedUser) {
      // Clear previous chat state
      setMessages([])
      setIsTyping(false)
      setIsLoading(true)

      // Update current chat reference
      currentChatRef.current = selectedUser._id
      setUserOnlineStatus(selectedUser.isOnline || false)

      // Fetch messages for new chat
      fetchMessages()
    }
  }, [selectedUser?._id]) // Only depend on selectedUser._id

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const markMessageAsRead = async (messageId, senderId) => {
    if (socket && currentChatRef.current === selectedUser._id) {
      socket.emit("messageRead", {
        messageId: messageId,
        senderId: senderId,
        readBy: currentUser._id,
      })
    }

    try {
      const token = localStorage.getItem("token")
      await fetch(`https://chating-kv0h.onrender.com/api/messages/${messageId}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch (error) {
      // Silent error handling
    }
  }

  const fetchMessages = async () => {
    if (!selectedUser) return

    setIsLoading(true)
    const chatId = selectedUser._id

    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`https://chating-kv0h.onrender.com/api/messages/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        // Only set messages if this is still the current chat
        if (currentChatRef.current === chatId) {
          setMessages(data.messages)

          // Mark unread messages as read
          data.messages.forEach((message) => {
            if (message.sender === chatId && !message.isRead) {
              markMessageAsRead(message._id, message.sender)
            }
          })
        }
      }
    } catch (error) {
      // Silent error handling
    } finally {
      // Only update loading state if still current chat
      if (currentChatRef.current === chatId) {
        setIsLoading(false)
      }
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !socket || !isConnected || !selectedUser) return

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

    // Add message instantly to UI
    setMessages((prev) => [...prev, tempMessage])
    const messageContent = newMessage.trim()
    setNewMessage("")

    // Stop typing
    socket.emit("stopTyping", {
      senderId: currentUser._id,
      receiverId: chatId,
    })

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
          content: messageContent,
        }),
      })

      if (response.ok) {
        const data = await response.json()

        // Only update if this is still the current chat
        if (currentChatRef.current === chatId) {
          setMessages((prev) => prev.map((msg) => (msg._id === tempMessage._id ? data.message : msg)))
        }

        // Send to other user via socket
        socket.emit("sendMessage", data.message)
      } else {
        // Remove temp message on error (only if still current chat)
        if (currentChatRef.current === chatId) {
          setMessages((prev) => prev.filter((msg) => msg._id !== tempMessage._id))
          setNewMessage(messageContent)
        }
      }
    } catch (error) {
      // Remove temp message on error (only if still current chat)
      if (currentChatRef.current === chatId) {
        setMessages((prev) => prev.filter((msg) => msg._id !== tempMessage._id))
        setNewMessage(messageContent)
      }
    }
  }

  const handleTyping = (e) => {
    setNewMessage(e.target.value)

    if (socket && e.target.value.trim() && selectedUser) {
      socket.emit("typing", {
        senderId: currentUser._id,
        receiverId: selectedUser._id,
      })

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("stopTyping", {
          senderId: currentUser._id,
          receiverId: selectedUser._id,
        })
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
          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}></div>
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
    </div>
  )
}

export default ChatWindow
