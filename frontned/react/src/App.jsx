"use client"

import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { useState, useEffect } from "react"
import HomePage from "./pages/HomePage"
import ChatPage from "./pages/ChatPage"
import "./App.css"

function App() {
  // Initialize authentication state from localStorage immediately
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const token = localStorage.getItem("token")
    const user = localStorage.getItem("user")
    return !!(token && user)
  })

  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("token")
    const user = localStorage.getItem("user")

    if (token && user) {
      setIsAuthenticated(true)
    } else {
      setIsAuthenticated(false)
    }

    setIsLoading(false)
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <Router future={{ v7_relativeSplatPath: true }}>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route
            path="/"
            element={
              isAuthenticated ? <Navigate to="/chat" replace /> : <HomePage setIsAuthenticated={setIsAuthenticated} />
            }
          />
          <Route
            path="/chat"
            element={
              isAuthenticated ? <ChatPage setIsAuthenticated={setIsAuthenticated} /> : <Navigate to="/" replace />
            }
          />
        </Routes>
      </div>
    </Router>
  )
}

export default App
