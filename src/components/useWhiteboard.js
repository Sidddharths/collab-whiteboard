import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { COLORS, BRUSH_SIZES, COLOR_WHEEL_POSITIONS } from "./tools";

const socket = io("whiteboard-backend-production-adbd.up.railway.app");

export const useWhiteboard = () => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [color, setColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1]);
  const [isEraser, setIsEraser] = useState(false);
  const [showColorWheel, setShowColorWheel] = useState(false);
  const colorWheelRef = useRef(null);

  // Generate unique user ID
  const [userId] = useState(() => Math.random().toString(36).substr(2, 9));
  const [currentStrokeId, setCurrentStrokeId] = useState(null);

  // Text functionality
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

  // Helper function to get coordinates from mouse or touch event
  const getEventCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Handle touch events
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    
    // Handle mouse events
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  // Close color wheel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (colorWheelRef.current && !colorWheelRef.current.contains(event.target)) {
        setShowColorWheel(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
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

    socket.on("drawing", ({ x0, y0, x1, y1, color, brushSize, isEraser, userId: drawingUserId, strokeId, isStrokeStart }) => {
      // Don't draw our own strokes (we draw them locally)
      if (drawingUserId === userId) return;
      
      drawLineFromSocket(x0, y0, x1, y1, color, brushSize, isEraser, strokeId, isStrokeStart);
    });

    socket.on("text", ({ x, y, text, color }) => {
      drawTextOnCanvas(x, y, text, color);
    });

    socket.on("clearCanvas", () => {
      clearCanvas(false);
    });

    return () => {
      socket.off("drawing");
      socket.off("text");
      socket.off("clearCanvas");
    };
  }, [userId]);

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

  // Store stroke contexts for different users
  const strokeContexts = useRef(new Map());

  const drawLineFromSocket = (x0, y0, x1, y1, color, brushSize, isEraser, strokeId, isStrokeStart) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Save current context
    const currentStrokeStyle = ctx.strokeStyle;
    const currentLineWidth = ctx.lineWidth;
    
    // Set drawing properties
    ctx.strokeStyle = isEraser ? "#FFFFFF" : color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    if (isStrokeStart) {
      // Start new path for this stroke
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      strokeContexts.current.set(strokeId, { lastX: x0, lastY: y0 });
    } else {
      // Continue existing stroke
      const strokeContext = strokeContexts.current.get(strokeId);
      if (strokeContext) {
        ctx.beginPath();
        ctx.moveTo(strokeContext.lastX, strokeContext.lastY);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        strokeContexts.current.set(strokeId, { lastX: x1, lastY: y1 });
      }
    }
    
    // Restore context
    ctx.strokeStyle = currentStrokeStyle;
    ctx.lineWidth = currentLineWidth;
  };

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
      isEraser,
      userId,
      strokeId: currentStrokeId,
      isStrokeStart: false
    });
  };

  const startDrawing = (e) => {
    // Prevent default touch behavior (scrolling, zooming)
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const coords = getEventCoordinates(e);
    
    // Generate new stroke ID
    const newStrokeId = `${userId}-${Date.now()}`;
    setCurrentStrokeId(newStrokeId);

    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = isEraser ? "#FFFFFF" : color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    // Start a new path for smooth drawing
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);

    // Emit stroke start
    socket.emit("drawing", {
      x0: coords.x,
      y0: coords.y,
      x1: coords.x,
      y1: coords.y,
      color,
      brushSize,
      isEraser,
      userId,
      strokeId: newStrokeId,
      isStrokeStart: true
    });

    setLastPos(coords);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || !currentStrokeId) return;
    
    // Prevent default touch behavior
    e.preventDefault();

    const canvas = canvasRef.current;
    const coords = getEventCoordinates(e);

    const ctx = canvas.getContext("2d");
    
    // Calculate distance for smooth drawing
    const distance = Math.sqrt(Math.pow(coords.x - lastPos.x, 2) + Math.pow(coords.y - lastPos.y, 2));
    
    // Use quadratic curves for smoother lines
    if (distance > 2) {
      const midX = (lastPos.x + coords.x) / 2;
      const midY = (lastPos.y + coords.y) / 2;
      
      ctx.quadraticCurveTo(lastPos.x, lastPos.y, midX, midY);
      ctx.stroke();
      
      // Emit for socket with stroke ID
      socket.emit("drawing", {
        x0: lastPos.x,
        y0: lastPos.y,
        x1: coords.x,
        y1: coords.y,
        color,
        brushSize,
        isEraser,
        userId,
        strokeId: currentStrokeId,
        isStrokeStart: false
      });
      
      setLastPos(coords);
    }
  };

  const stopDrawing = (e) => {
    if (!isDrawing) return;
    
    // Prevent default touch behavior
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    
    // Finish the current path
    ctx.stroke();
    ctx.closePath();
    
    // Clean up stroke context
    if (currentStrokeId) {
      strokeContexts.current.delete(currentStrokeId);
    }
    
    setCurrentStrokeId(null);
    setIsDrawing(false);
  };

  const clearCanvas = (emit = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Clear stroke contexts
    strokeContexts.current.clear();

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
    getEventCoordinates,
    socket,
  };
};