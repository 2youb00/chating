"use client"

import { useState, useRef } from "react"
import CanvasDraw from "react-canvas-draw"
import { Palette, Eraser, RotateCcw, Download, Send, X } from "lucide-react"

function DrawingCanvas({ onSendDrawing, onClose }) {
  const canvasRef = useRef(null)
  const [brushColor, setBrushColor] = useState("#000000")
  const [brushRadius, setBrushRadius] = useState(3)
  const [isErasing, setIsErasing] = useState(false)

  const colors = [
    "#000000",
    "#FF0000",
    "#00FF00",
    "#0000FF",
    "#FFFF00",
    "#FF00FF",
    "#00FFFF",
    "#FFA500",
    "#800080",
    "#FFC0CB",
  ]

  const handleClear = () => {
    canvasRef.current?.clear()
  }

  const handleUndo = () => {
    canvasRef.current?.undo()
  }

  const handleSave = () => {
    const canvas = canvasRef.current?.canvas.drawing
    if (canvas) {
      const dataURL = canvas.toDataURL("image/png")
      onSendDrawing(dataURL)
    }
  }

  const handleDownload = () => {
    const canvas = canvasRef.current?.canvas.drawing
    if (canvas) {
      const dataURL = canvas.toDataURL("image/png")
      const link = document.createElement("a")
      link.download = `drawing-${Date.now()}.png`
      link.href = dataURL
      link.click()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center">
            <Palette className="h-5 w-5 mr-2" />
            Drawing Canvas
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tools */}
        <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
          {/* Color Palette */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Color:</span>
            <div className="flex gap-1">
              {colors.map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    setBrushColor(color)
                    setIsErasing(false)
                  }}
                  className={`w-8 h-8 rounded-full border-2 ${
                    brushColor === color && !isErasing ? "border-gray-800" : "border-gray-300"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Custom Color */}
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={brushColor}
              onChange={(e) => {
                setBrushColor(e.target.value)
                setIsErasing(false)
              }}
              className="w-8 h-8 rounded border"
            />
          </div>

          {/* Brush Size */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Size:</span>
            <input
              type="range"
              min="1"
              max="20"
              value={brushRadius}
              onChange={(e) => setBrushRadius(Number.parseInt(e.target.value))}
              className="w-20"
            />
            <span className="text-sm w-6">{brushRadius}</span>
          </div>

          {/* Eraserc */}
          <button
            onClick={() => setIsErasing(!isErasing)}
            className={`flex items-center gap-2 px-3 py-2 rounded ${
              isErasing ? "bg-red-100 text-red-700" : "bg-gray-200 text-gray-700"
            }`}
          >
            <Eraser className="h-4 w-4" />
            Eraser
          </button>

          {/* Actions */}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={handleUndo}
              className="flex items-center gap-2 px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              <RotateCcw className="h-4 w-4" />
              Undo
            </button>
            <button onClick={handleClear} className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200">
              Clear
            </button>
          </div>
        </div>

        {/* Canvas - Now in a scrollable container */}
        <div className="overflow-auto flex-1 border border-gray-300 rounded-lg mb-4">
          <div className="min-w-full min-h-full">
            <CanvasDraw
              ref={canvasRef}
              brushColor={isErasing ? "#FFFFFF" : brushColor}
              brushRadius={isErasing ? brushRadius * 2 : brushRadius}
              canvasWidth={800}
              canvasHeight={500}
              backgroundColor="#FFFFFF"
              hideGrid={true}
              lazyRadius={0}
              style={{
                boxShadow: "none",
              }}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            <Download className="h-4 w-4" />
            Download
          </button>

          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Send className="h-4 w-4" />
              Send Drawing
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DrawingCanvas
