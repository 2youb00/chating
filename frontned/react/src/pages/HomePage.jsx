"use client"

import { useState } from "react"
import LoginForm from "../components/LoginForm"
import SignupForm from "../components/SignupForm"

function HomePage({ setIsAuthenticated }) {
  const [isLogin, setIsLogin] = useState(true)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">ChatConnect</h1>
          <p className="text-gray-600">Real-time messaging made simple</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">{isLogin ? "Welcome Back" : "Create Account"}</h2>
            <p className="text-gray-600 text-sm mt-1">
              {isLogin ? "Sign in to start chatting with others" : "Join ChatConnect to connect with people"}
            </p>
          </div>

          {isLogin ? (
            <LoginForm setIsAuthenticated={setIsAuthenticated} />
          ) : (
            <SignupForm setIsAuthenticated={setIsAuthenticated} />
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-blue-600 hover:text-blue-800 text-sm underline"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage
