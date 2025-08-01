import "../styles/ContouringWorkspace.css";
import React, { useState, useEffect, useRef } from "react";
import Brush from "../utils/brushes/Brush";
import PointBrush from "../utils/brushes/PointBrush";
import FreepointBrush from "../utils/brushes/FreepointBrush";
import Eraser from "../utils/brushes/Eraser";
import polygonClipping from "polygon-clipping";
import { Point, Rect, translateDisplayToWorld } from "../utils/Transformations";

import {
  translateWorldToDisplay,
  convertRectDisplayToWorld,
} from "../utils/Transformations";
import { ERASER_RADIUS, ZOOM_STEP } from "../utils/constants";

import { eventBus } from "../utils/eventBus"; 


const TransversalView = ({
  // images are in [Y X Z] form
  images,
  HUValues,
  pixelSpacing,
  zList,
  minX,
  minY,
  isManipulate,
  contourStyle, // ContourStyle is moved up to Contouring Workspace component as it is shared by all views
  brushSize,
  selectedStructureSetUID,
  selectedStructureUID,
  displayStructuresUIDs,
  structureSets,
  setStructureSets,
  transversalCanvasDimensions,
  isCrosshairEnabled,
  currentZSlice,
  setCurrentZSlice,
  openAutoSegDialog,
  ROI,
  setROI,
  drawingRect,//my
  selectedShape,//my
  setDrawingRect, //my
  HUThreshold,//floodfill
  floodFillMode,//floodfill
}) => {
  
  const originalHeight = images.length;
  const originalWidth = images[0].length;
  const zSlices = images[0][0].length;

  const [canvasWidth, setCanvasWidth] = useState(
    transversalCanvasDimensions.width
  );
  const [canvasHeight, setCanvasHeight] = useState(
    transversalCanvasDimensions.height
  );

  const [ZCoordinate, setZCoordinate] = useState(
    zList[Math.floor(zSlices / 2)]
  );

  //my for checking
  // console.log("Shape:", selectedShape, "Drawing enabled?", isManipulate && selectedStructureUID && selectedShape);
  // console.log("isManipulate:", isManipulate);
  // console.log("selectedStructureUID:", selectedStructureUID);
  // console.log("selectedShape:", selectedShape);

  //uptothis
  const [CTCoordinate, setCTCoordinate] = useState(null);
  const [currentHU, setCurrentHU] = useState(null);
  const [isMouseDown, setIsMouseDown] = useState(null);
  const canvasRef = useRef(null);
  const [translateX, setTranslateX] = useState(0); // Accounts for panning
  const [translateY, setTranslateY] = useState(0); // Accounts for panning
  const [startPanX, setStartPanX] = useState(0);
  const [startPanY, setStartPanY] = useState(0);
  const [eraser, setEraser] = useState({ x: 0, y: 0, radius: ERASER_RADIUS });
  const bodyHeight = (originalHeight - 1) * pixelSpacing[1];
  const bodyWidth = (originalWidth - 1) * pixelSpacing[0];
  let positionRect = new Rect(minX, minY, bodyHeight, bodyWidth);
  const [activeBrush, setActiveBrush] = useState(new Brush());
  const [brushPolygons, setBrushPolygons] = useState({}); // Each slice has a list of polygons. eg polygons[currentIndex] = []
  const [points, setPoints] = useState({});
  const [prevPosition, setPrevPosition] = useState(null);
  const [pointBrushPolygons, setPointBrushPolygons] = useState([]);
  const [splinePoints, setSplinePoints] = useState([]);
  const [freePointBrushPolygons, setFreePointBrushPolygons] = useState({});
  const [isPanning, setIsPanning] = useState(false);

  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
 
  //my
  // Track shape drawing start and end
  const [shapeStart, setShapeStart] = useState(null);
  const [shapeEnd, setShapeEnd] = useState(null);
  const shapeStartRef = useRef(null);
  const shapeEndRef = useRef(null);

  //const [floodFillMode, setFloodFillMode] = useState(false);//floodfill

  
  // Store the drawn shape
  const [drawnShape, setDrawnShape] = useState(null);

// Track which handle is being resized
   const [resizeHandle, setResizeHandle] = useState(null);

  useEffect(() => {
  if (selectedShape === "rectangle" || selectedShape === "ellipse") {
    setDrawingRect(true);
  } else {
    setDrawingRect(false);
  }
}, [selectedShape]);

  const getResizeHandles = (shapeObj) => {
  const { x, y, w, h } = shapeObj;
  return [
    { x: x - 5, y: y - 5, position: 'top-left' },
    { x: x + w - 5, y: y - 5, position: 'top-right' },
    { x: x - 5, y: y + h - 5, position: 'bottom-left' },
    { x: x + w - 5, y: y + h - 5, position: 'bottom-right' },
  ];
};



// const getCircleResizeHandles = (shape) => {
//   const r = shape.circleRadius;
//   const cx = shape.x;
//   const cy = shape.y;

//   return [
//     { x: cx - r, y: cy, position: 'left' },
//     { x: cx + r, y: cy, position: 'right' },
//     { x: cx, y: cy - r, position: 'top' },
//     { x: cx, y: cy + r, position: 'bottom' },
//   ];
// };

const getCircleResizeHandles = (shape) => {
  const { x, y, circleRadius } = shape;
  return [
    { x: x - circleRadius * Math.SQRT1_2, y: y - circleRadius * Math.SQRT1_2, position: 'nw' }, // Top-left
    { x: x + circleRadius * Math.SQRT1_2, y: y - circleRadius * Math.SQRT1_2, position: 'ne' }, // Top-right
    { x: x - circleRadius * Math.SQRT1_2, y: y + circleRadius * Math.SQRT1_2, position: 'sw' }, // Bottom-left
    { x: x + circleRadius * Math.SQRT1_2, y: y + circleRadius * Math.SQRT1_2, position: 'se' }, // Bottom-right
  ];
};


const isOverResizeHandle = (shape, point) => {
  const size = 10;

  if (shape.type === 'rectangle') {
    const handles = getResizeHandles(shape);
    for (const handle of handles) {
      if (
        point.x >= handle.x &&
        point.x <= handle.x + size &&
        point.y >= handle.y &&
        point.y <= handle.y + size
      ) {
        return handle.position;
      }
    }
  }

  
  if (shape.type === 'ellipse') {
  const handles = getCircleResizeHandles(shape);
  for (const handle of handles) {
    if (
      point.x >= handle.x - 5 &&
      point.x <= handle.x + 5 &&
      point.y >= handle.y - 5 &&
      point.y <= handle.y + 5
    ) {
      return handle.position;
    }
  }
}

  return null;
};



const extractRectangleBorderPoints = (rect, canvasWidth, canvasHeight, translateX, translateY, positionRect, bodyHeight, bodyWidth) => {
  const points = [];

  for (let x = rect.x; x <= rect.x + rect.w; x++) {
    points.push({ x, y: rect.y });
    points.push({ x, y: rect.y + rect.h });
  }

  for (let y = rect.y; y <= rect.y + rect.h; y++) {
    points.push({ x: rect.x, y });
    points.push({ x: rect.x + rect.w, y });
  }

  const ctCoordinates = points.map((p) =>
    translateDisplayToWorld(
      new Point(p.x, p.y),
      canvasWidth,
      canvasHeight,
      translateX,
      translateY,
      positionRect,
      bodyHeight,
      bodyWidth
    )
  );

  console.log("CT Coordinates of Rectangle Border:", ctCoordinates);
};

const extractEllipseBorderPoints = (ellipse, canvasWidth, canvasHeight, translateX, translateY, positionRect, bodyHeight, bodyWidth) => {
  const points = [];

  for (let angle = 0; angle < 360; angle += 1) {
    const rad = (angle * Math.PI) / 180;
    const x = ellipse.x + ellipse.rx * Math.cos(rad);
    const y = ellipse.y + ellipse.ry * Math.sin(rad);
    points.push({ x, y });
  }

  const ctCoordinates = points.map((p) =>
    translateDisplayToWorld(
      new Point(p.x, p.y),
      canvasWidth,
      canvasHeight,
      translateX,
      translateY,
      positionRect,
      bodyHeight,
      bodyWidth
    )
  );

  console.log("CT Coordinates of Ellipse Border:", ctCoordinates);
};


  //uptothis
   

  useEffect(() => {
    setCanvasHeight(transversalCanvasDimensions.height);
    setCanvasWidth(transversalCanvasDimensions.width);
  }, [transversalCanvasDimensions.height, transversalCanvasDimensions.width]);

  //Change current Z based on current Index
  useEffect(() => {
    setZCoordinate((prevZ) => zList[currentZSlice]);
  }, [currentZSlice]);

  // Handling the type of brush
  useEffect(() => {
    let selectedBrush;
    if (isManipulate) {
      switch (contourStyle) {
        case "Point":
          selectedBrush = new PointBrush(
            pointBrushPolygons,
            setPointBrushPolygons,
            points,
            setPoints,
            splinePoints,
            setSplinePoints,
            ZCoordinate,
            isManipulate
          );
          break;
        case "Freepoint":
          selectedBrush = new FreepointBrush(
            freePointBrushPolygons,
            setFreePointBrushPolygons,
            points,
            setPoints,
            ZCoordinate,
            isManipulate
          );
          break;
        case "Brush":
          selectedBrush = new Brush(
            brushPolygons,
            setBrushPolygons,
            points,
            setPoints,
            brushSize,
            ZCoordinate,
            isManipulate,
            prevPosition,
            setPrevPosition
          );
          break;

        default:
          selectedBrush = new Brush(
            brushPolygons,
            setBrushPolygons,
            points,
            setPoints,
            brushSize,
            ZCoordinate,
            isManipulate
          );
          break;
      }
    } else {
      let polygonsList = {};
      const selectedStructureSet = structureSets.find(
        (set) => set.structureSetUID === selectedStructureSetUID
      );
      if (selectedStructureSet) {
        const selectedStructure = selectedStructureSet.structuresList.find(
          (structure) => structure.structureID === Number(selectedStructureUID)
        );
        if (selectedStructure) {
          polygonsList = selectedStructure.polygonsList[ZCoordinate];
        }
        selectedBrush = new Eraser(
          polygonsList,
          isManipulate,
          eraser,
          setEraser,
          applyEraser
        ); // passing the polygon List that has to be erased
      }
    }
    setActiveBrush((prevBrush) => selectedBrush);
  }, [
    contourStyle,
    ZCoordinate,
    brushSize,
    structureSets,
    selectedStructureSetUID,
    selectedStructureUID,
    isManipulate,
  ]);

  const applyEraser = (result) => {
    let polygonStructure = [];
    result.forEach((polygon) => {
      polygon.forEach((ring) => {
        const updated = [];
        ring.forEach(([x, y]) => {
          const point = { x, y };
          updated.push(point);
        });
        polygonStructure.push(updated);
      });
    });

    const updatedStructureSets = structureSets.map((set) => {
      if (set.structureSetUID === selectedStructureSetUID) {
        const updatedStructuresList = set.structuresList.map((structure) => {
          if (structure.structureID === Number(selectedStructureUID)) {
            const updatedPolygonsList = { ...structure.polygonsList };

            updatedPolygonsList[ZCoordinate] = [...polygonStructure];

            return {
              ...structure,
              polygonsList: updatedPolygonsList,
            };
          }
          return structure;
        });
        return {
          ...set,
          structuresList: updatedStructuresList,
        };
      }

      return set;
    });

    setStructureSets(updatedStructureSets);
  };

  const addNewPolygons = (oldPolygons, newPolygons) => {
    const oldPolygonsModified = oldPolygons.map((oldPolygon) => [
      oldPolygon.map((point) => [point.x, point.y]),
    ]);
    const newPolygonsModified = newPolygons.map((newPolygon) => [
      newPolygon.map((point) => [point.x, point.y]),
    ]);
    let unionPolygons = [];
    let polygonStructure = []; // COnverting the result of polygon clipping to polygon List
    try {
      unionPolygons = polygonClipping.union(
        oldPolygonsModified,
        newPolygonsModified
      );
      unionPolygons.forEach((polygon) => {
        polygon.forEach((ring) => {
          const updated = [];
          ring.forEach(([x, y]) => {
            const point = { x, y };
            updated.push(point);
          });
          polygonStructure.push(updated);
        });
      });
    } catch (err) {
      //console.log("Error with polygon-clipping library");
      polygonStructure = [];
    }
    return polygonStructure;
  };
  useEffect(() => {
    // This useEffect hook will add the polygons to the structures in structure Set

    const newPolygons = [
      ...(pointBrushPolygons[ZCoordinate] || []),

      ...(freePointBrushPolygons[ZCoordinate] || []),
      ...(brushPolygons[ZCoordinate] || []),
    ];
    if (newPolygons.length > 0) {
      const updatedStructureSets = structureSets.map((set) => {
        if (set.structureSetUID === selectedStructureSetUID) {
          const updatedStructuresList = set.structuresList.map((structure) => {
            if (structure.structureID === Number(selectedStructureUID)) {
              const updatedPolygonsList = { ...structure.polygonsList };
              if (updatedPolygonsList.hasOwnProperty(ZCoordinate)) {
                const result = addNewPolygons(
                  [...structure.polygonsList[ZCoordinate]],
                  [...newPolygons]
                );

                updatedPolygonsList[ZCoordinate] =
                  result.length > 0 ? result : [];
              } else {
                updatedPolygonsList[ZCoordinate] = [...newPolygons];
              }
              return {
                ...structure,
                polygonsList: updatedPolygonsList,
              };
            }
            return structure;
          });
          return {
            ...set,
            structuresList: updatedStructuresList,
          };
        }

        return set;
      });
      setStructureSets(updatedStructureSets);
      setBrushPolygons({});
      setFreePointBrushPolygons({});
      setPointBrushPolygons({}); // clear the present polygons list after the polygons have been added to structure Set
    }
  }, [
    pointBrushPolygons,
    freePointBrushPolygons,
    brushPolygons,
    ZCoordinate,
    selectedStructureSetUID,
    selectedStructureUID,
  ]);

  const drawROI = (ctx) => {
    ctx.fillStyle = "rgba(0,255,255,0.2)";
    ctx.fillRect(
      ROI.displaySpace.x,
      ROI.displaySpace.y,
      ROI.displaySpace.width,
      ROI.displaySpace.height
    );
    ctx.strokeStyle = "orange";
    ctx.strokeRect(
      ROI.displaySpace.x,
      ROI.displaySpace.y,
      ROI.displaySpace.width,
      ROI.displaySpace.height
    );
    drawHandle(ctx, ROI.displaySpace.x, ROI.displaySpace.y);
    drawHandle(
      ctx,
      ROI.displaySpace.x + ROI.displaySpace.width,
      ROI.displaySpace.y
    );
    drawHandle(
      ctx,
      ROI.displaySpace.x,
      ROI.displaySpace.y + ROI.displaySpace.height
    );
    drawHandle(
      ctx,
      ROI.displaySpace.x + ROI.displaySpace.width,
      ROI.displaySpace.y + ROI.displaySpace.height
    );
  };

  const drawHandle = (ctx, x, y) => {
    ctx.fillStyle = "blue";
    ctx.fillRect(x - 5, y - 5, 10, 10);
  };

  const getHandle = (mouseX, mouseY) => {
    const handles = {
      "top-left": { x: ROI.displaySpace.x, y: ROI.displaySpace.y },
      "top-right": {
        x: ROI.displaySpace.x + ROI.displaySpace.width,
        y: ROI.displaySpace.y,
      },
      "bottom-left": {
        x: ROI.displaySpace.x,
        y: ROI.displaySpace.y + ROI.displaySpace.height,
      },
      "bottom-right": {
        x: ROI.displaySpace.x + ROI.displaySpace.width,
        y: ROI.displaySpace.y + ROI.displaySpace.height,
      },
    };
    for (let key in handles) {
      const { x, y } = handles[key];
      if (Math.abs(mouseX - x) < 10 && Math.abs(mouseY - y) < 10) {
        return key;
      }
    }
    return null;
  };
  
  
  const transversalImgDataRef = useRef(null);
  console.log("🧩 selectedShape in ViewComponent:", selectedShape);//my

  const renderCanvas=()=>{
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const transversalImgData = ctx.createImageData(
      originalWidth,
      originalHeight
    );
   
    //Create image Data takes parameters as (width, height)
    for (let i = 0; i < originalWidth; i++) {
      // Y
      for (let j = 0; j < originalHeight; j++) {
        //X
        const value8bit = images[j][i][currentZSlice];
        const index = j * originalWidth + i;
        // Assign the value to both red and green channels (since it's grayscale)
        transversalImgData.data[index * 4] = value8bit; // Red channel
        transversalImgData.data[index * 4 + 1] = value8bit; // Green channel
        transversalImgData.data[index * 4 + 2] = value8bit; // Blue channel
        transversalImgData.data[index * 4 + 3] = 255; // Alpha channel (fully opaque)
      }
    }

    transversalImgDataRef.current=transversalImgData;

    const newWidth = canvasWidth; //391;
    const newHeight = canvasHeight; //233;
    const stretchedImgData = new ImageData(newWidth, newHeight);
    // Interpolation code
    for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
        // Calculate corresponding position in original image
        const originalX = (x / newWidth) * (originalWidth - 1);
        const originalY = (y / newHeight) * (originalHeight - 1);

        // Get the integer coordinates of the four nearest pixels
        const x0 = Math.floor(originalX);
        const x1 = Math.ceil(originalX);
        const y0 = Math.floor(originalY);
        const y1 = Math.ceil(originalY);

        // Get the fractional parts for interpolation
        const xf = originalX - x0;
        const yf = originalY - y0;

        // Get the color values of the four nearest pixels
        const topLeftIndex = (y0 * originalWidth + x0) * 4;
        const topRightIndex = (y0 * originalWidth + x1) * 4;
        const bottomLeftIndex = (y1 * originalWidth + x0) * 4;
        const bottomRightIndex = (y1 * originalWidth + x1) * 4;

        // Perform bilinear interpolation for each color channel
        for (let i = 0; i < 4; i++) {
          const topInterpolated =
            transversalImgData.data[topLeftIndex + i] * (1 - xf) +
            transversalImgData.data[topRightIndex + i] * xf;
          const bottomInterpolated =
            transversalImgData.data[bottomLeftIndex + i] * (1 - xf) +
            transversalImgData.data[bottomRightIndex + i] * xf;
          const interpolatedValue =
            topInterpolated * (1 - yf) + bottomInterpolated * yf;
          stretchedImgData.data[(y * newWidth + x) * 4 + i] = interpolatedValue;
        }
      }
    }
    ctx.putImageData(stretchedImgData, translateX, translateY);
    //my
  if (
  drawnShape &&
  drawnShape.start && drawnShape.end &&
  typeof drawnShape.start.x === "number" &&
  typeof drawnShape.start.y === "number" &&
  typeof drawnShape.end.x === "number" &&
  typeof drawnShape.end.y === "number"
) {
  const { type, start, end } = drawnShape;

  const width = end.x - start.x;
  const height = end.y - start.y;

  ctx.save();
  ctx.lineWidth = 2;

  if (type === "rectangle") {
    ctx.strokeStyle = "green";
    ctx.strokeRect(start.x, start.y, width, height);
  } else if (type === "ellipse") {
    ctx.strokeStyle = "red";
    ctx.beginPath();
    ctx.ellipse(
      start.x + width / 2,
      start.y + height / 2,
      Math.abs(width / 2),
      Math.abs(height / 2),
      0,
      0,
      2 * Math.PI
    );
    ctx.stroke();
  }

  ctx.restore();
}

//uptothis
    if (CTCoordinate && isCrosshairEnabled) {
      const mousePointCrosshair = translateWorldToDisplay(
        CTCoordinate,
        canvasWidth,
        canvasHeight,
        translateX,
        translateY,
        positionRect,
        bodyHeight,
        bodyWidth
      );
      ctx.beginPath();
      ctx.strokeStyle = "gray"; // Crosshair color

      ctx.setLineDash([5, 5]); // Dashed line: [5px dash, 5px gap]
      ctx.lineWidth = 1;

      // Horizontal line
      ctx.moveTo(0, mousePointCrosshair.y); // Start at the left edge
      ctx.lineTo(canvasWidth, mousePointCrosshair.y); // End at the right edge

      // Vertical line
      ctx.moveTo(mousePointCrosshair.x, 0); // Start at the top edge
      ctx.lineTo(mousePointCrosshair.x, canvasHeight); // End at the bottom edge

      ctx.stroke();
      ctx.closePath();
      ctx.setLineDash([]);
    }

    // Draw the complete polygons only of the selected structure for current index
    const selectedStructureSet = structureSets.find(
      (set) => set.structureSetUID === selectedStructureSetUID
    );

    if (selectedStructureSet) {
      const selectedStructures = selectedStructureSet.structuresList.filter(
        (structure) => displayStructuresUIDs.includes(structure.structureID)
      );
      selectedStructures.map((selectedStructure) => {
        // Draw all displayed structures (checkboxed) one by one
        const allPolygons = [
          ...(selectedStructure.polygonsList[ZCoordinate] || []),
        ];

        if (allPolygons.length > 0) {
          ctx.strokeStyle = `rgb(${selectedStructure.Color.split("\\")
            .map((v) => parseInt(v, 10))
            .join(",")})`;

          ctx.lineWidth = 2;
          allPolygons.forEach((polygon) => {
            ctx.beginPath();
            polygon.forEach((point, index) => {
              const displayPoint = translateWorldToDisplay(
                point,
                canvasWidth,
                canvasHeight,
                translateX,
                translateY,
                positionRect,
                bodyHeight,
                bodyWidth
              );

              if (index === 0) {
                ctx.moveTo(displayPoint.x, displayPoint.y);
              } else {
                ctx.lineTo(displayPoint.x, displayPoint.y);
              }
            });
            ctx.closePath();
            ctx.stroke();
          });
        }
      });
      // Draw points in open polygon

      if (points[ZCoordinate] && points[ZCoordinate].length > 0) {
        points[ZCoordinate].forEach((point, index) => {
          const displayPoint = translateWorldToDisplay(
            point,
            canvasWidth,
            canvasHeight,
            translateX,
            translateY,
            positionRect,
            bodyHeight,
            bodyWidth
          );

          ctx.fillStyle = "red"; // Color for points
          ctx.beginPath();

          ctx.arc(displayPoint.x, displayPoint.y, 3, 0, Math.PI * 2); // Draw point as a circle

          ctx.fill();
        });

        //Draw lines in open polygon using spline - in case of Point

        if (splinePoints.length > 0) {
          ctx.strokeStyle = "aqua";

          ctx.lineWidth = 2;
          ctx.beginPath();

          splinePoints.forEach((point, index) => {
            const displayPoint = translateWorldToDisplay(
              point,
              canvasWidth,
              canvasHeight,
              translateX,
              translateY,
              positionRect,
              bodyHeight,
              bodyWidth
            );

            if (index === 0) {
              ctx.moveTo(displayPoint.x, displayPoint.y);
            } else {
              ctx.lineTo(displayPoint.x, displayPoint.y);
            }
          });

          ctx.stroke();
        } else if (points[ZCoordinate] && points[ZCoordinate].length > 0) {
          // In case of freepoint, directly draw lines between the selected points
          ctx.strokeStyle = "aqua";
          ctx.lineWidth = 2;

          ctx.beginPath();

          points[ZCoordinate].forEach((point, index) => {
            const displayPoint = translateWorldToDisplay(
              point,
              canvasWidth,
              canvasHeight,
              translateX,
              translateY,
              positionRect,
              bodyHeight,
              bodyWidth
            );

            if (index === 0) {
              ctx.moveTo(displayPoint.x, displayPoint.y);
            } else {
              ctx.lineTo(displayPoint.x, displayPoint.y);
            }
          });

          ctx.stroke();
        }
      }

      // Draw eraser if present
      //Draw eraser

      if (!isManipulate) {
        // Draw the circle at the current position
        ctx.beginPath();
        ctx.arc(eraser.x, eraser.y, eraser.radius, 0, 2 * Math.PI);
        ctx.strokeStyle = "blue";

        ctx.stroke();
      }
      if (openAutoSegDialog && ROI) {
        drawROI(ctx);
      }

      // Draw the crosshair horizontal and vertical lines
      // Draw the currently drawn (temporary) rectangle

      //my
      if (drawnShape) {
  ctx.lineWidth = 2;

  if (drawnShape.type === 'rectangle') {
    ctx.strokeStyle = 'green';
    ctx.strokeRect(drawnShape.x, drawnShape.y, drawnShape.w, drawnShape.h);

    const handles = getResizeHandles(drawnShape); // 👈 Make sure you define this helper
    ctx.fillStyle = 'blue';
    handles.forEach((handle) => {
      ctx.fillRect(handle.x, handle.y, 10, 10);
    });
  }

  if (drawnShape.type === 'ellipse') {
  // 1. Draw the ellipse
  ctx.beginPath();
  ctx.strokeStyle = 'red';
  ctx.ellipse(
    drawnShape.x,
    drawnShape.y,
    drawnShape.rx,
    drawnShape.ry,
    0,
    0,
    Math.PI * 2
  );
  ctx.stroke();

  // 2. Draw bounding circle (light dashed circle)
  ctx.beginPath();
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = '#aaa';
  ctx.arc(
    drawnShape.x,
    drawnShape.y,
    drawnShape.circleRadius,
    0,
    Math.PI * 2
  );
  ctx.stroke();
  ctx.setLineDash([]);

  // 3. Draw resize handles on bounding circle
  const circleHandles = getCircleResizeHandles(drawnShape);
  ctx.fillStyle = 'blue';
  circleHandles.forEach((handle) => {
    ctx.fillRect(handle.x - 5, handle.y - 5, 10, 10);
  });
}

}


      //uptothis
      
    }
    
    // //uptothis
  }
  console.log("Shape:", selectedShape, "Drawing enabled?", drawingRect);//my

  useEffect(() => {
    renderCanvas();
  }, [
    points,
    ZCoordinate,
    contourStyle,
    splinePoints,
    translateX,
    translateY,
    selectedStructureSetUID,
    selectedStructureUID,
    displayStructuresUIDs,
    structureSets,
    eraser,
    canvasHeight,
    canvasWidth,
    isCrosshairEnabled,
    CTCoordinate?.x,
    CTCoordinate?.y,
    ROI,
    openAutoSegDialog,
    //my
    shapeStart,
    shapeEnd,
    drawingRect,
    selectedShape,
    drawnShape,
    resizeHandle,

    //uptothis
    
  ]);
  /*
If the contour style is changed or the slice Index is changed without completing the polygon, 
 then all the incomplete open polygons will be cleared
 */

  // If another structure/structure set is selected before closing the contour, then also the open points will be cleared
  useEffect(() => {
    setPoints([]);
    setSplinePoints([]);
  }, [
    contourStyle,
    activeBrush,
    ZCoordinate,
    selectedStructureUID,
    selectedStructureSetUID,
  ]);
   //const canvas = canvasRef.current;//my
   //const ctx = canvas.getContext("2d");//my
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const handleWheel = (event) => {
      event.preventDefault();
      const delta = event.deltaY;
      if (event.ctrlKey) {
        //Zoom functionality
        if (delta < 0) {
          // Zoom in

          setCanvasHeight((canvasHeight) => canvasHeight + ZOOM_STEP);
          setCanvasWidth((canvasWidth) => canvasWidth + ZOOM_STEP);
        } else if (delta > 0) {
          // Zoom out
          setCanvasHeight((canvasHeight) => canvasHeight - ZOOM_STEP);
          setCanvasWidth((canvasWidth) => canvasWidth - ZOOM_STEP);
        }
      } else {
        //Wheel to another slice
        setCurrentZSlice((prevIndex) => {
          let newIndex = prevIndex;
          if (delta > 0 && prevIndex < zSlices - 1) {
            newIndex = prevIndex + 1;
          } else if (delta < 0 && prevIndex > 0) {
            newIndex = prevIndex - 1;
          }
          return Math.min(Math.max(newIndex, 0), zSlices - 1); // Clamp within valid range
        });
      }
    };

    
  const handleMouseDown = (event) => {
  const canvas = canvasRef.current;
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  console.log("MouseDown - Coordinates:", mouseX, mouseY);

  if (openAutoSegDialog) {
    const handle = getHandle(mouseX, mouseY);
    if (handle) {
      setResizing(handle);
      return;
    }
    if (
      mouseX > ROI.displaySpace.x &&
      mouseX < ROI.displaySpace.x + ROI.displaySpace.width &&
      mouseY > ROI.displaySpace.y &&
      mouseY < ROI.displaySpace.y + ROI.displaySpace.height
    ) {
      setDragging(true);
      setOffset({
        x: mouseX - ROI.displaySpace.x,
        y: mouseY - ROI.displaySpace.y,
      });
    }
  } else {
    if (event.shiftKey) {
      setIsPanning(true);
      setStartPanX(event.clientX);
      setStartPanY(event.clientY);
    } else {
      if (!selectedStructureUID) return;

      // ✅ Moved mouseX/mouseY up, so we can now use them safely
      setIsMouseDown(true);
      //my
      
if (drawnShape) {
  const handle = isOverResizeHandle(drawnShape, { x: mouseX, y: mouseY });
  if (handle) {
    setResizeHandle(handle);
    return;
  }
}

shapeStartRef.current = { x: mouseX, y: mouseY };
//setDrawnShape(null); // Allow fresh drawing


      //uptothis
      if (
        mouseX > 0 &&
        mouseX <= canvasWidth &&
        mouseY > 0 &&
        mouseY <= canvasHeight
      ) {
        activeBrush.mousedown(
          event,
          ctx,
          mouseX,
          mouseY,
          canvasWidth,
          canvasHeight,
          translateX,
          translateY,
          positionRect,
          bodyHeight,
          bodyWidth
        );
      }
    }
  }
};


    const handleMouseMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      
      if (openAutoSegDialog) {
        if (!dragging && !resizing) return;
        if (dragging) {
          const newDisplayRect = {
            x: mouseX - offset.x,
            y: mouseY - offset.y,
            width: ROI.displaySpace.width,
            height: ROI.displaySpace.height,
          };
          const newCTRect = convertRectDisplayToWorld(
            newDisplayRect,
            canvasWidth,
            canvasHeight,
            translateX,
            translateY,
            positionRect,
            bodyHeight,
            bodyWidth
          );

          setROI((prev) => ({
            displaySpace: newDisplayRect,
            CTSpace: newCTRect,
          }));
        }
        if (resizing) {
          let newDisplayRect = { ...ROI.displaySpace };
          switch (resizing) {
            case "top-left":
              newDisplayRect.width += newDisplayRect.x - mouseX;
              newDisplayRect.height += newDisplayRect.y - mouseY;
              newDisplayRect.x = mouseX;
              newDisplayRect.y = mouseY;
              break;
            case "top-right":
              newDisplayRect.width = mouseX - newDisplayRect.x;
              newDisplayRect.height += newDisplayRect.y - mouseY;
              newDisplayRect.y = mouseY;
              break;
            case "bottom-left":
              newDisplayRect.width += newDisplayRect.x - mouseX;
              newDisplayRect.x = mouseX;
              newDisplayRect.height = mouseY - newDisplayRect.y;
              break;
            case "bottom-right":
              newDisplayRect.width = mouseX - newDisplayRect.x;
              newDisplayRect.height = mouseY - newDisplayRect.y;
              break;
            default:
              break;
          }

          const newCTRect = convertRectDisplayToWorld(
            newDisplayRect,
            canvasWidth,
            canvasHeight,
            translateX,
            translateY,
            positionRect,
            bodyHeight,
            bodyWidth
          );
          setROI({
            displaySpace: newDisplayRect,
            CTSpace: newCTRect,
          });
        }
      } else {
        if (
          mouseX > 0 &&
          mouseX <= canvasWidth &&
          mouseY > 0 &&
          mouseY <= canvasHeight
        ) {
          //my
          if (drawingRect && selectedShape && isMouseDown) {
            // shapeEndRef.current = { x: mouseX, y: mouseY };
            // setShapeEnd({ x: mouseX, y: mouseY });
            // console.log("MouseMove to", mouseX, mouseY);
//             
if (resizeHandle && drawnShape) {
  const newShape = { ...drawnShape };

  if (newShape.type === 'rectangle') {
    if (resizeHandle.includes('left')) {
      newShape.w += newShape.x - mouseX;
      newShape.x = mouseX;
    }
    if (resizeHandle.includes('right')) {
      newShape.w = mouseX - newShape.x;
    }
    if (resizeHandle.includes('top')) {
      newShape.h += newShape.y - mouseY;
      newShape.y = mouseY;
    }
    if (resizeHandle.includes('bottom')) {
      newShape.h = mouseY - newShape.y;
    }
//   }else if (newShape.type === 'ellipse') {
//   const dx = mouseX - newShape.x;
//   const dy = mouseY - newShape.y;

//   let newRadius;
//   if (resizeHandle === 'left' || resizeHandle === 'right') {
//     newRadius = Math.abs(dx);
//   } else if (resizeHandle === 'top' || resizeHandle === 'bottom') {
//     newRadius = Math.abs(dy);
//   }

//   newShape.circleRadius = newRadius;
//   newShape.rx = newRadius * 0.7;
//   newShape.ry = newRadius * 0.4;
// }
   } else if (newShape.type === 'ellipse') {
  const startX = shapeStartRef.current.x;
  const startY = shapeStartRef.current.y;

  const endX = mouseX;
  const endY = mouseY;

  const centerX = (startX + endX) / 2;
  const centerY = (startY + endY) / 2;

  const rx = Math.abs(endX - startX) / 2;
  const ry = Math.abs(endY - startY) / 2;

  newShape.x = centerX;
  newShape.y = centerY;
  newShape.rx = rx;
  newShape.ry = ry;
  newShape.circleRadius = Math.max(rx / 0.7, ry / 0.4); // keep existing ratio logic
}


  setDrawnShape(newShape);
  //drawCanvas(); // ensure your canvas is redrawn
  return;
}


// Normal drawing logic (not resizing)
if (!resizeHandle) {
  const width = mouseX - shapeStartRef.current.x;
  const height = mouseY - shapeStartRef.current.y;

  if (selectedShape === 'rectangle') {
    setDrawnShape({
      type: 'rectangle',
      x: shapeStartRef.current.x,
      y: shapeStartRef.current.y,
      w: width,
      h: height,
    });
  
  }else if (selectedShape === 'ellipse') {
  const centerX = (shapeStartRef.current.x + mouseX) / 2;
  const centerY = (shapeStartRef.current.y + mouseY) / 2;
  const rx = Math.abs(mouseX - shapeStartRef.current.x) / 2;
  const ry = Math.abs(mouseY - shapeStartRef.current.y) / 2;
  const circleRadius = Math.max(rx / 0.7, ry / 0.4); // Consistent with your trial logic

  setDrawnShape({
    type: 'ellipse',
    x: centerX,
    y: centerY,
    rx,
    ry,
    circleRadius,
  });
}
   

}

          }
          // console.log("MouseMove to", shapeEnd);
          //uptothis
          if (isCrosshairEnabled && HUValues) {
            const physicalPoint = translateDisplayToWorld(
              new Point(mouseX, mouseY),
              canvasWidth,
              canvasHeight,
              translateX,
              translateY,
              positionRect,
              bodyHeight,
              bodyWidth
            );
            const Xslice = Math.floor(
              (physicalPoint.x - minX) / pixelSpacing[0]
            );
            const Yslice = Math.floor(
              (physicalPoint.y - minY) / pixelSpacing[1]
            );
            if (
              Xslice >= 0 &&
              Xslice < originalWidth &&
              Yslice >= 0 &&
              Yslice < originalHeight
            ) {
              canvas.style.cursor = "crosshair";

              setCTCoordinate(
                (prevCoordinate) =>
                  new Point(
                    physicalPoint.x.toFixed(2),
                    physicalPoint.y.toFixed(2)
                  )
              );

              const HUVal = HUValues[Yslice][Xslice][currentZSlice];
              setCurrentHU(HUVal);
            } else {
              canvas.style.cursor = "default";
            }
          } else {
            canvas.style.cursor = "default";
          }
          if (isPanning) {
            const dx = event.clientX - startPanX;
            const dy = event.clientY - startPanY;
            setTranslateX((translateX) => translateX + dx);
            setTranslateY((translateY) => translateY + dy);
            setStartPanX(event.clientX);
            setStartPanY(event.clientY);
          }

          if (
            isMouseDown &&
            selectedStructureUID &&
            typeof activeBrush.mousemove === "function"
          ) {
            activeBrush.mousemove(
              event,
              ctx,
              mouseX,
              mouseY,
              canvasWidth,
              canvasHeight,
              translateX,
              translateY,
              positionRect,
              bodyHeight,
              bodyWidth,
              canvasHeight,
              canvasWidth,
              currentZSlice
            );
          }
        }
      }

    };

    const handleMouseUp = () => {
      
      if (openAutoSegDialog) {
        setDragging(false);
        setResizing(null);
      } else {
        setIsMouseDown(false);
        //my
        if (drawnShape) {
  if (drawnShape.type === "rectangle") {
    extractRectangleBorderPoints(
      drawnShape,
      canvasWidth,
      canvasHeight,
      translateX,
      translateY,
      positionRect,
      bodyHeight,
      bodyWidth
    );
  } else if (drawnShape.type === "ellipse") {
    extractEllipseBorderPoints(
      drawnShape,
      canvasWidth,
      canvasHeight,
      translateX,
      translateY,
      positionRect,
      bodyHeight,
      bodyWidth
    );
  }
}


        

        //uptothis
        setIsPanning(false);
 
        if (activeBrush && typeof activeBrush.mouseup === "function") {
          activeBrush.mouseup( ctx);
        }
      }
      setResizeHandle(null);//my
    };

    canvas.addEventListener("wheel", handleWheel);
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mousemove", handleMouseMove);

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mousemove", handleMouseMove);
    };
  }, [
    ZCoordinate,
    images,
    translateX,
    translateY,
    isManipulate,
    contourStyle,
    activeBrush,
    isMouseDown,
    isPanning,
    translateX,
    translateY,
    selectedStructureUID,
    canvasWidth,
    canvasHeight,
    isCrosshairEnabled,
    openAutoSegDialog,
    dragging,
    resizing,
    ROI,
  ]);


  const handleClick = (event) => {

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    
    const rect = canvas.getBoundingClientRect(); // Get canvas position in the viewport
  
    const canvasX = event.clientX - rect.left; // X coordinate relative to canvas
    const canvasY = event.clientY - rect.top;  // Y coordinate relative to canvas
  
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;


    const isSeedPointInside=canvasX >= 0 && canvasX <= canvasWidth &&
                            canvasY >= 0 && canvasY <= canvasHeight;
  
            
                         
    eventBus.emit("transversalImgDataReady", { 
      transversalImgData: transversalImgDataRef.current, 
      seedPoint: { x:Math.round(canvasX), y:Math.round(canvasY) },
      transformParameters:{TranslateX:translateX,TranslateY:translateY,PositionRect:positionRect,BodyHeight:bodyHeight,BodyWidth:bodyWidth}
     });

    renderCanvas();
    
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 5, 0, 2 * Math.PI); // 5px radius dot
    ctx.fillStyle = 'red'; // Color of dot
    ctx.fill()

  };

  

  
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
        }}
      >
        {/* Z coordinate on the left */}
        <h4 style={{ margin: "8px", color: "lightgray", fontWeight: "300" }}>
          Z: ({zSlices - 1 - currentZSlice}/{zSlices - 1}){" "}
          {zList[currentZSlice]} mm
        </h4>

        {/* X/Y coordinates in the center */}
        {CTCoordinate && isCrosshairEnabled && currentHU && (
          <div style={{ textAlign: "center", flex: 1 }}>
            <h4
              style={{ margin: "8px", color: "lightgray", fontWeight: "300" }}
            >
              ({CTCoordinate.x}, {CTCoordinate.y}, {zList[currentZSlice]}){" "}
              {currentHU}
            </h4>
          </div>
        )}
      </div>
      
      <canvas
        ref={canvasRef}
        className="canvas-container"
        width={canvasWidth}
        height={canvasHeight} 
        onClick={handleClick}  //commented for floodfill
        style={{ pointerEvents: 'auto', zIndex: 2 }}//my
        //onClick={combinedCanvasClick} //for floodfill
      ></canvas>
    </div>
  );
};

export default TransversalView;
