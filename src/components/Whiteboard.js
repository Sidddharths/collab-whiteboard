import React, { useState } from "react";
import { useEffect } from "react";
import "./Whiteboard.css";
import { useWhiteboard } from "./useWhiteboard";

export const Whiteboard = () => {
  const {
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
    drawTextOnCanvas,
    setShowColorWheel,
    colorWheelRef,
    COLOR_WHEEL_POSITIONS,
    getEventCoordinates,
    socket
  } = useWhiteboard();

  const [isTextToolActive, setIsTextToolActive] = useState(false);
  const [textCursorPos, setTextCursorPos] = useState(null);
  const [showBrushDropdown, setShowBrushDropdown] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;

    const updateMousePos = (e) => {
      const coords = getEventCoordinates(e);
      setMousePos(coords);
    };

    if (isTextToolActive && canvas) {
      canvas.addEventListener("mousemove", updateMousePos);
      canvas.addEventListener("touchmove", updateMousePos, { passive: false });
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener("mousemove", updateMousePos);
        canvas.removeEventListener("touchmove", updateMousePos);
      }
    };
  }, [isTextToolActive, getEventCoordinates]);

  // Handle click for text tool (PC only)
  const handleCanvasClick = (e) => {
    if (!isTextToolActive) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const coords = getEventCoordinates(e);

    createTextInput(coords, rect);
  };

  // Handle touch for text tool (Mobile)
  const handleCanvasTouch = (e) => {
    if (!isTextToolActive) return;
    
    e.preventDefault();
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const coords = getEventCoordinates(e);

    createTextInput(coords, rect);
  };

  // Common function to create text input
  const createTextInput = (coords, rect) => {
    setTextCursorPos(coords);
    setIsTextToolActive(false); // Reset the tool after use

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Type here';
    input.style.position = 'absolute';
    input.style.left = `${coords.x + rect.left}px`;
    input.style.top = `${coords.y + rect.top}px`;
    input.style.font = '16px sans-serif';
    input.style.zIndex = 1000;
    input.style.border = '1px solid #ccc';
    input.style.padding = '10px';
    input.style.backgroundColor = 'white';
    input.style.borderRadius = '6px';

    document.body.appendChild(input);
    
    // Focus with a slight delay for mobile compatibility
    setTimeout(() => {
      input.focus();
    }, 100);

    // Handle both Enter key and blur events
    const handleInput = () => {
  const text = input.value;
  if (text.trim() !== '') {
    drawTextOnCanvas(coords.x, coords.y, text, color);
    socket.emit('text', { x: coords.x, y: coords.y, text, color });
  }
  
  // Use a timeout to ensure any other handlers finish first
  setTimeout(() => {
    if (document.body.contains(input)) {
      document.body.removeChild(input);
    }
  }, 0);
};

input.onkeydown = (event) => {
  if (event.key === 'Enter') {
    event.preventDefault(); // Add this to prevent any default behavior
    handleInput();
  }
};

input.onblur = handleInput;

    // Auto-remove input after 30 seconds if not used
    setTimeout(() => {
      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }
    }, 30000);
  };

  const toggleColorWheel = () => {
    setShowColorWheel(!showColorWheel);
    setIsEraser(false);
    setShowBrushDropdown(false);
  };

  const toggleBrushDropdown = () => {
    setShowBrushDropdown(!showBrushDropdown);
    setShowColorWheel(false);
  };

  const selectBrushSize = (size) => {
    setBrushSize(size);
    setShowBrushDropdown(false);
  };

  return (
    <div className={`whiteboard-container ${isTextToolActive ? 'text-cursor' : ''}`}>
      <div className="logo">
        <img 
          src="/orado-fulllogo.png" 
          alt="Orado Logo" 
          style={{
            width: "100px",
            height: "auto",
            position: "absolute",
            bottom: "25px",
            right: "25px",
            zIndex: 10
          }}
        />
      </div>
      
      <div className="toolbar">
        {/* Color Picker Button */}
        <div className="color-picker-container" ref={colorWheelRef}>
          <button 
            className="color-picker-button"
            onClick={toggleColorWheel}
            onTouchEnd={(e) => {
              e.preventDefault();
              toggleColorWheel();
            }}
            style={{ backgroundColor: color }}
          />
          
          {/* Color Wheel */}
          {showColorWheel && (
            <div className="color-wheel">
              {COLORS.map((c, index) => {
                const pos = COLOR_WHEEL_POSITIONS[index] || { angle: 0, distance: 0 };
                const angleRad = (pos.angle * Math.PI) / 180;
                const x = pos.distance * Math.cos(angleRad) * 50;
                const y = pos.distance * Math.sin(angleRad) * 50;
                
                return (
                  <div
                    key={c}
                    className={`color-option ${color === c ? 'active' : ''}`}
                    style={{
                      backgroundColor: c,
                      transform: `translate(${x}px, ${y}px)`,
                      position: 'absolute',
                    }}
                    onClick={() => {
                      setColor(c);
                      setShowColorWheel(false);
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      setColor(c);
                      setShowColorWheel(false);
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
        
        {/* Brush Size Dropdown */}
        <div className="brush-dropdown-container">
          <button 
            className="brush-dropdown-button"
            onClick={toggleBrushDropdown}
            onTouchEnd={(e) => {
              e.preventDefault();
              toggleBrushDropdown();
            }}
          >
            {brushSize}px
          </button>
          
          {showBrushDropdown && (
            <div className="brush-dropdown-menu">
              {BRUSH_SIZES.map((size) => (
                <div
                  key={size}
                  className={`brush-size-option ${brushSize === size ? 'active' : ''}`}
                  onClick={() => selectBrushSize(size)}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    selectBrushSize(size);
                  }}
                >
                  {size}px
                </div>
              ))}
            </div>
          )}
        </div>
        
        <button
          className={`eraser ${isEraser ? 'active' : ''}`}
          onClick={() => {
            setIsEraser(!isEraser);
            setShowColorWheel(false);
            setShowBrushDropdown(false);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            setIsEraser(!isEraser);
            setShowColorWheel(false);
            setShowBrushDropdown(false);
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.42 4.58a2.1 2.1 0 0 0-2.97 0L7.85 14.15a0.51 0.51 0 0 0 0 .72l5.28 5.28a0.51 0.51 0 0 0 .72 0l9.57-9.57a2.1 2.1 0 0 0 0-2.97z"></path>
            <path d="m15 5-3 3"></path>
            <path d="M6.5 12.5 1 18"></path>
            <path d="M21 13.5 15.5 19"></path>
          </svg>
        </button>
        
        <button 
          className="clear-btn" 
          onClick={clearCanvas}
          onTouchEnd={(e) => {
            e.preventDefault();
            clearCanvas();
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18"></path>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <path d="M10 11v6"></path>
            <path d="M14 11v6"></path>
          </svg>
        </button>

        <button
          className={`text-tool ${isTextToolActive ? 'active' : ''}`}
          onClick={() => {
            setIsTextToolActive(!isTextToolActive);
            setIsEraser(false);
            setShowColorWheel(false);
            setShowBrushDropdown(false);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            setIsTextToolActive(!isTextToolActive);
            setIsEraser(false);
            setShowColorWheel(false);
            setShowBrushDropdown(false);
          }}
        >
          T
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={window.innerWidth * 0.97}
        height={window.innerHeight * 0.93}
        className="whiteboard"
        // Mouse events
        onMouseDown={(e) => {
          if (isTextToolActive) return;
          startDrawing(e);
        }}
        onMouseMove={(e) => {
          if (isTextToolActive) return;
          draw(e);
        }}
        onMouseUp={(e) => {
          if (isTextToolActive) return;
          stopDrawing(e);
        }}
        onMouseLeave={(e) => {
          if (isTextToolActive) return;
          stopDrawing(e);
        }}
        onClick={handleCanvasClick}
        // Touch events
        onTouchStart={(e) => {
          if (isTextToolActive) {
            handleCanvasTouch(e);
            return;
          }
          startDrawing(e);
        }}
        onTouchMove={(e) => {
          if (isTextToolActive) return;
          draw(e);
        }}
        onTouchEnd={(e) => {
          if (isTextToolActive) return;
          stopDrawing(e);
        }}
        // Prevent context menu on long press
        onContextMenu={(e) => e.preventDefault()}
        style={{
          touchAction: 'none', // Prevent default touch behaviors
        }}
      />
    </div>
  );
};