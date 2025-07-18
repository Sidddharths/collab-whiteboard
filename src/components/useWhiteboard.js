import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { COLORS, BRUSH_SIZES, COLOR_WHEEL_POSITIONS } from "./tools"; // Added import

const socket = io("http://localhost:5000");

export const useWhiteboard = () => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [color, setColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1]);
  const [isEraser, setIsEraser] = useState(false);
  const [showColorWheel, setShowColorWheel] = useState(false);
  const colorWheelRef = useRef(null);

  //text
const [isTextToolActive, setIsTextToolActive] = useState(false);
const [texts, setTexts] = useState([]);

const drawTextOnCanvas = (x, y, text, color) => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.font = "16px sans-serif";
  ctx.fillText(text, x, y);
};


  // Close color wheel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (colorWheelRef.current && !colorWheelRef.current.contains(event.target)) {
        setShowColorWheel(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Initialize canvas and socket listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;

    socket.on("drawing", ({ x0, y0, x1, y1, color, brushSize, isEraser }) => {
      drawLine(x0, y0, x1, y1, color, brushSize, isEraser, false);
    });

    socket.on("text", ({ x, y, text, color }) => {
  drawTextOnCanvas(x, y, text, color);
});


    socket.on("clearCanvas", () => {
      clearCanvas(false);
    });

    return () => {
      socket.off("drawing");
      socket.off("clearCanvas");
    };
  }, []);

  useEffect(() => {
  const canvas = canvasRef.current;
  if (canvas) {
    canvas.width = window.innerWidth * 0.97;
    canvas.height = window.innerHeight * 0.93;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}, []);

useEffect(() => {
  const canvas = canvasRef.current;
  const ctx = canvas.getContext("2d");

  ctx.strokeStyle = isEraser ? "#FFFFFF" : color;
  ctx.lineWidth = brushSize;
}, [color, brushSize, isEraser]);


  const drawLine = (x0, y0, x1, y1, color, brushSize, isEraser, emit = true) => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
    
    const currentStrokeStyle = ctx.strokeStyle;
    const currentLineWidth = ctx.lineWidth;
    
    ctx.strokeStyle = isEraser ? "#FFFFFF" : color;
    ctx.lineWidth = brushSize;
    
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    
    ctx.strokeStyle = currentStrokeStyle;
    ctx.lineWidth = currentLineWidth;

    if (!emit) return;

    socket.emit("drawing", { 
      x0, y0, x1, y1, 
      color, 
      brushSize, 
      isEraser 
    });
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = isEraser ? "#FFFFFF" : color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    // Start a new path for smooth drawing
    ctx.beginPath();
    ctx.moveTo(x, y);

    setLastPos({ x, y });
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext("2d");
    
    // Calculate distance for smooth drawing
    const distance = Math.sqrt(Math.pow(x - lastPos.x, 2) + Math.pow(y - lastPos.y, 2));
    
    // Use quadratic curves for smoother lines
    if (distance > 2) {
      const midX = (lastPos.x + x) / 2;
      const midY = (lastPos.y + y) / 2;
      
      ctx.quadraticCurveTo(lastPos.x, lastPos.y, midX, midY);
      ctx.stroke();
      
      // Emit for socket with throttling for performance
      socket.emit("drawing", {
        x0: lastPos.x,
        y0: lastPos.y,
        x1: x,
        y1: y,
        color,
        brushSize,
        isEraser
      });
      
      setLastPos({ x, y });
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    
    // Finish the current path
    ctx.stroke();
    ctx.closePath();
    
    setIsDrawing(false);
  };


  const clearCanvas = (emit = true) => {
  const canvas = canvasRef.current;
  if (!canvas) return; // 👈 Fix for null error

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (emit) {
    socket.emit("clearCanvas");
  }
};


  return {
  canvasRef,
  isDrawing,
  color,
  brushSize,
  isEraser,
  COLORS,
  BRUSH_SIZES,
  setColor,
  setBrushSize,
  setIsEraser,
  startDrawing,
  draw,
  stopDrawing,
  clearCanvas,
  showColorWheel,
  setShowColorWheel,
  colorWheelRef,
  COLOR_WHEEL_POSITIONS,
  drawTextOnCanvas,
  socket, // ✅ add this
};
};