"use client"

import { useEffect, useState, useRef } from "react"
import { Send } from "lucide-react"
import { io } from "socket.io-client"

function ChatWindow({ currentUser, selectedUser }) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [socket, setSocket] = useState(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) return

    const newSocket = io("http://localhost:3001", {
      auth: { token },
    })

    newSocket.on("connect", () => {
      newSocket.emit("join", currentUser._id)
    })

    newSocket.on("newMessage", (message) => {
      if (
        (message.sender === selectedUser._id && message.receiver === currentUser._id) ||
        (message.sender === currentUser._id && message.receiver === selectedUser._id)
      ) {
        setMessages((prev) => [...prev, message])
      }
    })

    setSocket(newSocket)
    return () => newSocket.close()
  }, [currentUser._id])

  useEffect(() => {
    if (selectedUser) {
      setMessages([])
      fetchMessages()
    }
  }, [selectedUser])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const fetchMessages = async () => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`http://localhost:3001/api/messages/${selectedUser._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages)
      }
    } catch (error) {
      console.error("Error fetching messages:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    const tempMessage = {
      _id: `temp_${Date.now()}`,
      sender: currentUser._id,
      receiver: selectedUser._id,
      content: newMessage.trim(),
      timestamp: new Date(),
      isTemp: true,
    }

    setMessages((prev) => [...prev, tempMessage])
    const messageContent = newMessage.trim()
    setNewMessage("")

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
          receiver: selectedUser._id,
          content: messageContent,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setMessages((prev) => prev.map((msg) => (msg._id === tempMessage._id ? data.message : msg)))

        if (socket) {
          socket.emit("sendMessage", data.message)
        }
      } else {
        setMessages((prev) => prev.filter((msg) => msg._id !== tempMessage._id))
        setNewMessage(messageContent)
      }
    } catch (error) {
      setMessages((prev) => prev.filter((msg) => msg._id !== tempMessage._id))
      setNewMessage(messageContent)
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
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-medium">
            {getInitials(selectedUser.name)}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{selectedUser.name}</h3>
            <p className="text-sm text-gray-500">{selectedUser.email}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
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
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.sender === currentUser._id ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-900"
                    } ${message.isTemp ? "opacity-70" : ""}`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p
                      className={`text-xs mt-1 ${
                        message.sender === currentUser._id ? "text-blue-100" : "text-gray-500"
                      }`}
                    >
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={sendMessage} className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message ${selectedUser.name}...`}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  )
}

export default ChatWindow
