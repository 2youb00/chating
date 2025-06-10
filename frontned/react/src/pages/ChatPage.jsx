"use client"

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import UserList from "../components/UserList"
import ChatWindow from "../components/ChatWindow"
import { LogOut, MessageCircle, Menu, ArrowLeft } from "lucide-react"

function ChatPage({ setIsAuthenticated }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showSidebar, setShowSidebar] = useState(true)
  const navigate = useNavigate()

  const isMobile = window.innerWidth < 768

  useEffect(() => {
    setShowSidebar(!isMobile)

    const handleResize = () => {
      const mobile = window.innerWidth < 768
      setShowSidebar(!mobile)
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem("token")
    const user = localStorage.getItem("user")

    if (!token || !user) {
      navigate("/")
      return
    }

    try {
      setCurrentUser(JSON.parse(user))
    } catch (error) {
      navigate("/")
      return
    }

    setIsLoading(false)
  }, [navigate])

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    setIsAuthenticated(false)
    navigate("/")
  }

  const handleSelectUser = (user) => {
    setSelectedUser(user)
    if (window.innerWidth < 768) {
      setShowSidebar(false)
    }
  }

  const handleUserStatusChange = (userId, isOnline) => {
    if (selectedUser && selectedUser._id === userId) {
      setSelectedUser((prev) => ({ ...prev, isOnline }))
    }
  }

  const toggleSidebar = () => {
    setShowSidebar(!showSidebar)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!currentUser) {
    return null
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {selectedUser && !showSidebar ? (
              <button onClick={toggleSidebar} className="mr-3 md:hidden" aria-label="Back to user list">
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
            ) : (
              <button onClick={toggleSidebar} className="mr-3 md:hidden" aria-label="Toggle sidebar">
                <Menu className="h-5 w-5 text-gray-600" />
              </button>
            )}
            <div className="flex items-center space-x-3">
              <MessageCircle className="h-7 w-7 text-blue-600" />
              <div>
                <h1 className="text-lg md:text-xl font-semibold text-gray-900">ChatConnect</h1>
                <p className="text-xs md:text-sm text-gray-500">Welcome, {currentUser.name}</p>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center px-3 py-1.5 md:px-4 md:py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <LogOut className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden xs:inline">Logout</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {showSidebar && window.innerWidth < 768 && (
          <div className="fixed inset-0 bg-black bg-opacity-30 z-10 md:hidden" onClick={toggleSidebar}></div>
        )}

        <div
          className={`${
            showSidebar ? "translate-x-0" : "-translate-x-full"
          } transform transition-transform duration-300 ease-in-out fixed md:relative z-20 w-72 md:w-80 h-[calc(100%-60px)] md:h-auto bg-white border-r border-gray-200 md:translate-x-0`}
        >
          <UserList
            currentUser={currentUser}
            selectedUser={selectedUser}
            onSelectUser={handleSelectUser}
            onUserStatusChange={handleUserStatusChange}
          />
        </div>

        <div className="flex-1 overflow-hidden">
          {selectedUser ? (
            <ChatWindow
              currentUser={currentUser}
              selectedUser={selectedUser}
              onUserStatusChange={handleUserStatusChange}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-50">
              <div className="text-center px-4">
                <MessageCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
                <p className="text-gray-500">Choose a user from the sidebar to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ChatPage
