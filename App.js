import React, { useState, useRef } from 'react';

function App() {
  const [shape, setShape] = useState(null); // 'rectangle' or 'ellipse'
  const [showDropdown, setShowDropdown] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [shapes, setShapes] = useState([]);
  const canvasRef = useRef(null);

  // Get mouse position relative to canvas
  const getMousePosition = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Draw all saved shapes
  const drawAllShapes = (ctx, shapesList) => {
    for (const item of shapesList) {
      const { type, x, y, w, h } = item;
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = type === 'rectangle' ? 'green' : 'red';
      if (type === 'rectangle') {
        ctx.strokeRect(x, y, w, h);
      } else if (type === 'ellipse') {
        ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }
  };

  // Start drawing
  const handleMouseDown = (e) => {
    if (!shape) return;
    const pos = getMousePosition(e);
    setStartPos(pos);
    setIsDrawing(true);
  };

  // Draw live preview
  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current.getContext('2d');
    const currPos = getMousePosition(e);
    const w = currPos.x - startPos.x;
    const h = currPos.y - startPos.y;

    // Clear canvas and redraw all saved shapes
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    drawAllShapes(ctx, shapes);

    // Draw preview shape
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = shape === 'rectangle' ? 'green' : 'red';
    if (shape === 'rectangle') {
      ctx.strokeRect(startPos.x, startPos.y, w, h);
    } else if (shape === 'ellipse') {
      ctx.ellipse(startPos.x + w / 2, startPos.y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, 2 * Math.PI);
      ctx.stroke();
    }
  };

  // Finish drawing and save shape
  const handleMouseUp = (e) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const currPos = getMousePosition(e);
    const w = currPos.x - startPos.x;
    const h = currPos.y - startPos.y;

    const newShape = {
      type: shape,
      x: startPos.x,
      y: startPos.y,
      w,
      h,
    };

    const updatedShapes = [...shapes, newShape];
    setShapes(updatedShapes);

    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    drawAllShapes(ctx, updatedShapes);
  };

  // Clear canvas and shape memory
  const clearCanvas = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setShapes([]);
  };

  return (
    <div>
      {/* Dropdown and button */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px', position: 'relative' }}>
        {showDropdown && (
          <div
            style={{
              position: 'absolute',
              left: 'calc(50% - 150px)',
              top: '40px',
              backgroundColor: '#f0f0f0',
              border: '1px solid #ccc',
              borderRadius: '5px',
              padding: '10px',
              zIndex: 10,
            }}
          >
            <div
              onClick={() => {
                setShape('rectangle');
                setShowDropdown(false);
              }}
              style={{ padding: '5px', cursor: 'pointer' }}
            >
              Rectangle
            </div>
            <div
              onClick={() => {
                setShape('ellipse');
                setShowDropdown(false);
              }}
              style={{ padding: '5px', cursor: 'pointer' }}
            >
              Ellipse
            </div>
          </div>
        )}

        <button
          style={{
            backgroundColor: 'black',
            color: 'white',
            padding: '10px 20px',
            cursor: 'pointer',
            borderRadius: '5px',
            border: 'none',
          }}
          onClick={() => setShowDropdown(!showDropdown)}
        >
          Black Button
        </button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{ border: '1px solid black', display: 'block', margin: '40px auto' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />

      {/* Clear button */}
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={clearCanvas}
          style={{
            marginTop: '10px',
            padding: '8px 16px',
            backgroundColor: 'darkred',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Clear Canvas
        </button>
      </div>
    </div>
  );
}

export default App;
