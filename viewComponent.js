import { useState, useEffect, useRef } from "react";
import {
  IgcDockManagerPaneType,
  IgcSplitPaneOrientation,
} from "igniteui-dockmanager";
import CoronalView from "./CoronalView";
import TransversalView from "./TransversalView";
import SagittalView from "./SagittalView";
import "../styles/DockManagerStyles.css";
import { defineCustomElements } from "igniteui-dockmanager/loader";
import Structure from "../utils/Structure";
import AutoSegmentation from "./Autosegmentation";
import Draggable from "react-draggable";
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  MenuItem,
  Select,
  TextField,
  Checkbox,
  FormControlLabel,
  FormControl,
  InputLabel,
} from "@mui/material";

import Paper from "@mui/material/Paper";

import { SketchPicker } from "react-color";
// import Sketch from "@uiw/react-color-sketch";
// Load custom elements for Ignite UI Dock Manager
defineCustomElements();

const ViewComponent = ({
  pixelSpacing,
  image3d,
  minX,
  minY,
  zList,
  HU3d,
  isManipulate,
  contourStyle,
  brushSize,
  selectedStructureSetUID,
  selectedStructureUID,
  displayStructuresUIDs,
  structureSets,
  setStructureSets,
  isCrosshairEnabled,
  openAutoSegDialog, // This is used to draw ROI when the dialogbox is open
  handleCloseAutoSegDialog,
  selectedShape,//my
}) => {
  const createContentPane = (contentID, paneHeader, isPinned = true) => ({
    header: paneHeader,
    type: IgcDockManagerPaneType.contentPane,
    contentId: contentID,
    isPinned,
    allowClose: false,
    allowMaximize: true,
    isMaximized: false,
    allowFloating: false,
    allowDocking: false,
  });
  
  
  

  const dockManagerRef = useRef(null);

  const zSlices = image3d[0][0].length;

  const [currentZSlice, setCurrentZSlice] = useState(Math.floor(zSlices / 2));
  //const [selectedShape, setSelectedShape] = useState(null); // my
  const [drawingRect, setDrawingRect] = useState(false); //my

  console.log("Shape received in ViewComponent:", selectedShape);//my

  const [transversalPaneWidth, setTransversalPaneWidth] = useState(
    Math.floor((window.screen.availWidth - 300) / 3)
  );
  const [coronalPaneWidth, setCoronalPaneWidth] = useState(
    Math.floor((window.screen.availWidth - 300) / 3)
  );
  const [sagittalPaneWidth, setSagittalPaneWidth] = useState(
    Math.floor((window.screen.availWidth - 300) / 3)
  );
  const [transversalCanvasDimensions, setTransversalCanvasDimensions] =
    useState(null);
  const [sagittalCanvasDimensions, setSagittalCanvasDimensions] =
    useState(null);
  const [coronalCanvasDimensions, setCoronalCanvasDimensions] = useState(null);

  const [color, setColor] = useState("#fff");
  const colorRef = useRef(color);

  const [forAllSlices, setForAllSlices] = useState(false);
  const [huThreshold, setHUThreshold] = useState(-450);
  const [areaThreshold, setAreaThreshold] = useState(1300);

  const [ROI, setROI] = useState({
    displaySpace: { x: 0, y: 0, width: 100, height: 100 },
    CTSpace: { x: minX, y: minY, width: 100, height: 100 },
  }); // Putting initial CT values as placeholders - they are not correct conversion
  const [acceptAutoSeg, setAcceptAutoSeg] = useState(false);

  const handleHUChange = (e) => {
    const value = e.target.value;
    if (/^-?\d*$/.test(value)) {
      // Allows negative numbers
      setHUThreshold(value);
    }
  };

  const handleAreaThresholdChange = (e) => {
    const value = e.target.value;
    if (/^\d*$/.test(value)) setAreaThreshold(value);
  };

  const handleAcceptAutoSeg = () => {
    handleCloseAutoSegDialog();
    setAcceptAutoSeg(true);
  };

  const onAutosegmentation = (edgesList) => {
    const updatedStructureSets = structureSets.map((set) => {
      if (set.structureSetUID === selectedStructureSetUID) {
        // Remove existing BODY_AUTOSEGMENTED
        const filteredStructuresList = set.structuresList.filter(
          (structure) => structure.Name !== "AUTOSEGMENTED"
        );

        // Get the latest color
        const hex = colorRef.current.replace(/^#/, "");
        let r = parseInt(hex.substring(0, 2), 16);
        let g = parseInt(hex.substring(2, 4), 16);
        let b = parseInt(hex.substring(4, 6), 16);
        const rgb_color = `${r}\\${g}\\${b}`;

        // Create a new BODY_AUTOSEGMENTED structure
        const newStructure = new Structure(
          Date.now(), // Unique ID
          "AUTOSEGMENTED",
          "AutoSegmented",
          rgb_color,
          50, // Example window
          100 // Example level
        );

        newStructure.polygonsList = edgesList; // Assign edgesList directly

        return {
          ...set,
          structuresList: [...filteredStructuresList, newStructure], // Replace the structure
        };
      }
      return set;
    });

    setStructureSets(updatedStructureSets); // Update the state
  };

  useEffect(() => {
    colorRef.current = color; // Always keep the latest color
  }, [color]);

  useEffect(() => {
    if (
      image3d &&
      pixelSpacing &&
      transversalPaneWidth &&
      coronalPaneWidth &&
      sagittalPaneWidth
    ) {
      const originalTransversalDimensions = {
        width: Math.floor(image3d[0].length * pixelSpacing[0]),
        height: Math.floor(image3d.length * pixelSpacing[1]),
      };
      const transversalAspectRatio =
        originalTransversalDimensions.width /
        originalTransversalDimensions.height;

      setTransversalCanvasDimensions({
        width: Math.floor(transversalPaneWidth),
        height: Math.floor(transversalPaneWidth / transversalAspectRatio),
      });

      const originalSagittalDimensions = {
        width: Math.floor(image3d.length * pixelSpacing[1]),
        height: Math.floor(image3d[0][0].length * 2.5),
      };
      const sagittalAspectRatio =
        originalSagittalDimensions.width / originalSagittalDimensions.height;

      setSagittalCanvasDimensions({
        width: Math.floor(sagittalPaneWidth),
        height: Math.floor(sagittalPaneWidth / sagittalAspectRatio),
      });

      const originalCoronalDimensions = {
        width: Math.floor(image3d[0].length * pixelSpacing[0]),
        height: Math.floor(image3d[0][0].length * 2.5),
      };
      const coronalAspectRatio =
        originalCoronalDimensions.width / originalCoronalDimensions.height;

      setCoronalCanvasDimensions({
        width: Math.floor(coronalPaneWidth),
        height: Math.floor(coronalPaneWidth / coronalAspectRatio),
      });
    }
  }, [
    image3d,
    pixelSpacing,
    transversalPaneWidth,
    sagittalPaneWidth,
    coronalPaneWidth,
  ]); // As soons as we get the dimensions of CT image, get the dimensions of canvas

  useEffect(() => {
    const dockManager = dockManagerRef.current;

    if (dockManager) {
      const handleSplitterResize = (event) => {
        const contentID = event.detail.pane.contentId;
        const paneWidth = event.detail.paneWidth;

        if (contentID === "coronal") {
          const offset = coronalPaneWidth - paneWidth;
          setCoronalPaneWidth(paneWidth);
          setTransversalPaneWidth((prevWidth) => prevWidth + offset);
        }
        if (contentID === "sagittal") {
          const offset = sagittalPaneWidth - paneWidth;
          setSagittalPaneWidth(paneWidth);
          setCoronalPaneWidth((prevWidth) => prevWidth + offset);
        }
      };

      dockManager.addEventListener("splitterResizeEnd", handleSplitterResize);

      return () => {
        dockManager.removeEventListener(
          "splitterResizeEnd",
          handleSplitterResize
        );
      };
    }
  }, [
    dockManagerRef,
    coronalPaneWidth,
    sagittalPaneWidth,
    transversalPaneWidth,
  ]);

  useEffect(() => {
    const dockManager = dockManagerRef.current;
    const pane1 = createContentPane("transversal", "Transversal View");
    const pane2 = createContentPane("coronal", "Coronal View");
    const pane3 = createContentPane("sagittal", "Sagittal View");
    dockManager.layout = {
      rootPane: {
        type: IgcDockManagerPaneType.splitPane,
        orientation: IgcSplitPaneOrientation.horizontal,
        panes: [pane1, pane2, pane3],
      },
    };

    // igc-trial-watermark{z-index:-1}
    setTimeout(() => {
      const topLevelComponentSelector = "#dockManager";

      const cssToAdd = ".maximized  { position:fixed; top:78px} ";
      adjustShadowRootStyles([topLevelComponentSelector], cssToAdd);
    }, 60);
  }, []);

  function adjustShadowRootStyles(hostsSelectorList, styles) {
    const shadowRoot = queryShadowRootDeep(hostsSelectorList);

    if (!shadowRoot) {
      console.error("ShadowRoot not found. Cannot apply styles.");
      return;
    }

    try {
      if ("adoptedStyleSheets" in shadowRoot) {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(styles);
        shadowRoot.adoptedStyleSheets = [
          ...shadowRoot.adoptedStyleSheets,
          sheet,
        ];
      } else {
        console.warn(
          "adoptedStyleSheets not supported. Falling back to <style>."
        );
        const styleElement = document.createElement("style");
        styleElement.textContent = styles;
        shadowRoot.appendChild(styleElement);
      }
    } catch (error) {
      console.error("Error applying styles:", error);
    }
  }

  function queryShadowRootDeep(hostsSelectorList) {
    let element = document;
    hostsSelectorList.forEach((selector) => {
      element = element.querySelector(selector)?.shadowRoot;
      if (!element) {
        throw new Error(
          `Cannot find a shadowRoot element with selector "${selector}". The selectors chain is: ${hostsSelectorList.join(
            ", "
          )}`
        );
      }
    });
    return element;
  }

  return (
    <div
      className="view-container"
      style={{
        background: "black",
        color: "orange",
      }}
    >
    {/* my */}
    {/* <div style={{ padding: "10px", background: "#111", color: "white" }}>
  <button
    onClick={() => {
      setSelectedShape("rectangle");
      setDrawingRect(true);
    }}
    style={{ marginRight: "10px" }}
  >
    Draw Rectangle
  </button>

  <button
    onClick={() => {
      setSelectedShape("ellipse");
      setDrawingRect(true);
    }}
    style={{ marginRight: "10px" }}
  >
    Draw Ellipse
  </button>

  <button
    onClick={() => {
      setSelectedShape(null);
      setDrawingRect(false);
    }}
  >
    Cancel Drawing
  </button>
</div> */}

    {/*uptothis */}
      <igc-dockmanager
        ref={dockManagerRef}
        id="dockManager"
        sx={{
          minHeight: "750px",
          maxHeight: "750px",
        }}
      >
        <div slot="transversal" className="dockManagerContent">
          {image3d &&
            HU3d &&
            minX &&
            minY &&
            zList &&
            pixelSpacing &&
            transversalCanvasDimensions && (
              <TransversalView
                images={image3d}
                HUValues={HU3d}
                pixelSpacing={pixelSpacing}
                zList={zList}
                minX={minX}
                minY={minY}
                isManipulate={isManipulate}
                contourStyle={contourStyle}
                brushSize={brushSize}
                selectedStructureSetUID={selectedStructureSetUID}
                selectedStructureUID={selectedStructureUID}
                displayStructuresUIDs={displayStructuresUIDs}
                structureSets={structureSets}
                setStructureSets={setStructureSets}
                transversalCanvasDimensions={transversalCanvasDimensions}
                isCrosshairEnabled={isCrosshairEnabled}
                currentZSlice={currentZSlice}
                setCurrentZSlice={setCurrentZSlice}
                openAutoSegDialog={openAutoSegDialog}
                ROI={ROI}
                setROI={setROI}
                selectedShape={selectedShape}   //my
                drawingRect={drawingRect}  //my
                setDrawingRect={setDrawingRect}//my
              />
            )}
        </div>

        <div slot="coronal" className="dockManagerContent">
          {image3d &&
            minX &&
            minY &&
            zList &&
            pixelSpacing &&
            coronalCanvasDimensions && (
              <CoronalView
                images={image3d}
                pixelSpacing={pixelSpacing}
                coronalCanvasDimensions={coronalCanvasDimensions}
              />
            )}
        </div>
        <div slot="sagittal" className="dockManagerContent">
          {image3d &&
            minX &&
            minY &&
            zList &&
            pixelSpacing &&
            sagittalCanvasDimensions && (
              <SagittalView
                images={image3d}
                pixelSpacing={pixelSpacing}
                sagittalCanvasDimensions={sagittalCanvasDimensions}
              />
            )}
        </div>
      </igc-dockmanager>

      <Dialog
        open={openAutoSegDialog}
        onClose={(event, reason) => {
          if (reason !== "backdropClick") {
            handleCloseAutoSegDialog();
          }
        }}
        hideBackdrop
        disableEnforceFocus
        disablePortal
        disableEscapeKeyDown
        fullWidth={false}
        disableAutoFocus
        PaperComponent={PaperComponent}
        sx={{
          "& .MuiDialog-paper": {
            width: "300px",
            height: "auto",
            padding: "5px",
            borderRadius: "10px",
            backgroundColor: "#222",
            color: "#fff",
          },
          pointerEvents: "none",
        }}
      >
        <DialogContent
          dividers
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            pointerEvents: "auto",
          }}
        >
          {/* Dropdown */}
          <FormControl fullWidth margin="dense">
            <InputLabel>Structure</InputLabel>
            <Select value="BODY_AUTOSEGMENTED" disabled>
              <MenuItem value="BODY_AUTOSEGMENTED">BODY_AUTOSEGMENTED</MenuItem>
            </Select>
          </FormControl>

          {/* Type Input */}
          {/* <TextField
            fullWidth
            label="Type"
            variant="outlined"
            margin="dense"
            value={type}
            onChange={(e) => setType(e.target.value)}
          /> */}

          {/* Color Picker - Fixed Width */}
          <label>Color</label>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <SketchPicker
              color={color}
              disableAlpha={true}
              onChange={(color) => setColor(color.hex)}
              width="250px"
              styles={{
                default: { picker: { width: "250px" } },
              }}
            />
          </div>

          {/* Checkbox */}
          <FormControlLabel
            control={
              <Checkbox
                checked={forAllSlices}
                onChange={() => setForAllSlices(!forAllSlices)}
              />
            }
            label="For All Slices"
          />

          {/* HU Threshold */}
          <TextField
            fullWidth
            label="HU Threshold"
            variant="outlined"
            margin="dense"
            value={huThreshold}
            onChange={handleHUChange}
            inputProps={{ inputMode: "numeric", pattern: "-?[0-9]*" }}
          />

          {/* Segment Area Threshold */}
          <TextField
            fullWidth
            label="Segment Area Threshold"
            variant="outlined"
            margin="dense"
            value={areaThreshold}
            onChange={handleAreaThresholdChange}
            inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
          />

          {/* Readonly Bounding Box Inputs */}
          <div style={{ display: "flex", gap: "10px" }}>
            <TextField
              label="X"
              value={ROI.displaySpace.x.toFixed(0)}
              InputProps={{ readOnly: true }}
            />
            <TextField
              label="Y"
              value={ROI.displaySpace.y.toFixed(0)}
              InputProps={{ readOnly: true }}
            />
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <TextField
              label="Width"
              value={ROI.displaySpace.width.toFixed(0)}
              InputProps={{ readOnly: true }}
            />
            <TextField
              label="Height"
              value={ROI.displaySpace.height.toFixed(0)}
              InputProps={{ readOnly: true }}
            />
          </div>
        </DialogContent>

        {/* Dialog Actions */}
        <DialogActions>
          <Button
            onClick={handleCloseAutoSegDialog}
            sx={{ color: "#FFA500", pointerEvents: "auto" }}
          >
            CANCEL
          </Button>
          <Button
            onClick={handleAcceptAutoSeg}
            sx={{ color: "#FFA500", pointerEvents: "auto" }}
          >
            ACCEPT
          </Button>
        </DialogActions>
      </Dialog>

      {acceptAutoSeg && huThreshold && areaThreshold && minX && minY && (
        <AutoSegmentation
          HUValues={HU3d}
          zList={zList}
          minX={minX}
          minY={minY}
          pixelSpacing={pixelSpacing}
          onAutosegmentation={onAutosegmentation}
          currentZSlice={currentZSlice}
          CTThreshold={huThreshold}
          areaThreshold={areaThreshold}
          ROI={ROI}
          forAllSlices={forAllSlices}
          acceptAutoSeg={acceptAutoSeg}
          setAcceptAutoSeg={setAcceptAutoSeg}
        />
      )}
    </div>
  );
};

const PaperComponent = (props) => {
  return (
    <Draggable
      handle=".draggable-dialog"
      cancel={
        '[class*="MuiInputBase-root"], [class*="MuiButton-root"], [class*="sketch-picker"]'
      }
    >
      <Paper {...props} className="draggable-dialog" />
    </Draggable>
  );
};

export default ViewComponent;
