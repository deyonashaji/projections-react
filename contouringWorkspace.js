import React from "react";
import { GetImageInfo } from "../utils/GetImageInfo";
import { DicomTag } from "../utils/DicomTags";
import { useState, useEffect } from "react";
import "../styles/ContouringWorkspace.css";
import { Brush } from "@mui/icons-material";
import DropdownInput from "./DropdownInput";
import BooleanOperations from "./BooleanOperations";
import ClearIcon from "@mui/icons-material/Clear";
import { ArrowDropUp, ArrowDropDown } from "@mui/icons-material";
import PhonelinkEraseIcon from "@mui/icons-material/PhonelinkErase";
import StructureMargin from "./StructureMargin";
import FilterCenterFocusIcon from "@mui/icons-material/FilterCenterFocus";

import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import ViewComponent from "./ViewComponent";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  RadioGroup,
  Radio,
  FormControlLabel,
  Typography,
  IconButton,
  Tooltip,
  Checkbox,
  Box,
  TextField,
  InputAdornment,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Visibility } from "@mui/icons-material";
import AddStructureSet from "./AddStructureSet";
import { MIN_BRUSH_SIZE } from "../utils/constants";
import RTStructureReader from "./RTStructureReader";
import StructureSet from "../utils/StructureSet";
import DICOMWriterScratch from "./DICOMWriterScratch";
import ExecuteFloodFill from "./ExecuteFloodFill";
//my
import { Button, Menu, MenuItem} from "@mui/material";
import CropSquareIcon from "@mui/icons-material/CropSquare"; // Or any icon you prefer
import CategoryIcon from "@mui/icons-material/Category";

//uptothis

const ContouringWorkspace = ({
  patientCollection,
  selectedPatient,
  selectedStudy,
  selectedSeries,
}) => {
  const [image3d, setImage3d] = useState(null);
  const [HU3d, setHU3d] = useState(null);
  const [zList, setZList] = useState(null);
  const [pixelSpacing, setPixelSpacing] = useState(undefined);
  const [minX, setMinX] = useState(null);
  const [minY, setMinY] = useState(null);
  const [isManipulate, setIsManipulate] = useState(false);
  const [contourStyle, setContourStyle] = useState(null);
  const [brushSize, setBrushSize] = useState(10);
  const [isCrosshairEnabled, setIsCrosshairEnabled] = useState(false);

  const [isAutoSegEnabled, setIsAutoSegEnabled] = useState(false);
  const [openAutoSegDialog, setOpenAutoSegDialog] = useState(false);

  const [structureSets, setStructureSets] = useState([]);

  const [expanded, setExpanded] = useState(null);
  const [selectedStructureSetUID, setSelectedStructureSetUID] = useState(null);
  const [selectedStructureUID, setSelectedStructureUID] = useState(null);
  const [displayStructuresUIDs, setDisplayStructureUIDs] = useState([]);
  const [hoveredStructureID, setHoveredStructureID] = useState(null);

  function addStructureSet(newStructureSet, isLoadedFromFile) {
    const selectedPatientInfo = patientCollection[selectedPatient];
    const selectedStudyInfo =
      selectedPatientInfo.studyCollection[selectedStudy];
    const selectedSeriesInfo =
      selectedStudyInfo.seriesCollection[selectedSeries];

    // This data is used to save the RT Structure
    newStructureSet.SeriesDescription = selectedSeriesInfo.seriesDescription;
    newStructureSet.Modality = "RTSTRUCT";
    newStructureSet.PatientBirthDate = selectedPatientInfo.patientBirthDate;
    newStructureSet.PatientName = selectedPatientInfo.patientName;
    newStructureSet.PatientID = selectedPatientInfo.patientID;
    newStructureSet.PatientGender = selectedPatientInfo.patientGender;
    newStructureSet.StudyDate = selectedStudyInfo.studyDate;
    newStructureSet.StudyID = selectedStudyInfo.studyID;
    newStructureSet.StudyDescription = selectedStudyInfo.studyDescription;

    const newIndex = structureSets.length + 1; // index is starting from 1 to have consistency with structures numbering
    newStructureSet.structureSetUID = newIndex; // UID will allow multiple structures of same type to be recognised
    setStructureSets((prevSets) => [...prevSets, newStructureSet]);
    if (isLoadedFromFile) {
      setSelectedStructureSetUID((prevUID) => newIndex);
    }
  }

  const addBooleanResult = (structureID, polygonList) => {
    const updatedStructureSets = structureSets.map((set) => {
      if (set.structureSetUID === selectedStructureSetUID) {
        const updatedStructuresList = set.structuresList.map((structure) => {
          if (structure.structureID === structureID) {
            return {
              ...structure,
              polygonsList: polygonList,
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

  const brushHandler = () => {
    setIsManipulate((isManipulate) => !isManipulate);
  };

  const handleBrushSizeChange = (value) => {
    // If the value is empty, allow the user to clear it and type a new value
    if (value === "") {
      setBrushSize(""); // Let the input be empty for new typing
    } else {
      // If the value is a number, update the brush size (minimum size check still applies)
      const newSize = Math.max(MIN_BRUSH_SIZE, Number(value));
      setBrushSize(newSize);
    }
  };

  const contourStyles = ["Point", "Freepoint", "Brush"];

  const handleSelectBrush = (selectedOption) => {
    setContourStyle(selectedOption);
  };

  const handleAccordionChange = (structureSetUID) => (event, isExpanded) => {
    setExpanded(isExpanded ? structureSetUID : null);
    setSelectedStructureSetUID(isExpanded ? structureSetUID : null);
    setSelectedStructureUID(null); // Reset selected structure when structure set changes
  };

  const handleStructureChange = (structureID) => {
    setSelectedStructureUID(structureID);
    // If radio button is selected for editing, add it for display as well (otherwise while drawing it will not get displayed)

    setDisplayStructureUIDs((prevSelected) =>
      prevSelected.includes(structureID)
        ? prevSelected
        : [...prevSelected, structureID]
    );
  };

  const handleCheckboxChange = (structureID) => {
    setDisplayStructureUIDs((prevSelected) =>
      prevSelected.includes(structureID)
        ? prevSelected.filter((id) => id !== structureID)
        : [...prevSelected, structureID]
    );
  };

  // Handle structure removal from structureSet
  const handleRemoveStructure = (structureID) => {
    // Create a new list excluding the structure to be removed
    const selectedStructureSet = structureSets.find(
      (set) => set.structureSetUID === selectedStructureSetUID
    );

    const updatedStructuresList = selectedStructureSet.structuresList.filter(
      (structure) => structure.structureID !== structureID
    );

    // Update structureSets object with the modified structuresList
    const updatedStructureSets = structureSets.map((set) =>
      set.structureSetUID === selectedStructureSetUID
        ? { ...set, structuresList: updatedStructuresList }
        : set
    );

    // Update the structureSets state
    setStructureSets(updatedStructureSets);
  };

  const handleEraserClick = () => {
    setIsManipulate((isManipulate) => !isManipulate); // either brush or eraser can be selected at one time to avoid mousedown/mousemove clashes
  };

  const handleCrosshairClick = () => {
    setIsCrosshairEnabled((isCrosshairEnabled) => !isCrosshairEnabled);
  };

  const handleAutoSegmentation = () => {
    // if prev Autoseg value of AutoSegEnabled is false, then now it is true
    if (!isAutoSegEnabled) {
      setOpenAutoSegDialog(true);
    }
    setIsAutoSegEnabled((isAutoSegEnabled) => !isAutoSegEnabled);
  };

  const handleCloseAutoSegDialog = () => {
    setOpenAutoSegDialog(false);
    setIsAutoSegEnabled(false);
  };

  useEffect(() => {
    let CTFiles = [];
    const patientFiles = patientCollection[selectedPatient].fileList;
    const studyIDSelected =
      patientCollection[selectedPatient].studyCollection[selectedStudy].studyID;

    // Get the image files to be displayed
    patientFiles.forEach((dataSet) => {
      // Select only image files and RS files for contouring
      if (
        dataSet.string(DicomTag.StudyID) === studyIDSelected &&
        dataSet.string(DicomTag.Modality) !== "RTSTRUCT"
      ) {
        // doing only for CT images for now
        if (dataSet.string(DicomTag.Modality) === "CT") {
          CTFiles.push(dataSet);
        }
      }
    });

    if (CTFiles.length > 0) {
      const firstCTfile = CTFiles[0];
      const spacing = firstCTfile
        .string(DicomTag.Spacing)
        .split("\\")
        .map(parseFloat);
      setPixelSpacing(spacing);
      const imgPositionPatient = firstCTfile.string(
        DicomTag.ImagePositionPatient
      );
      const imagePosition = imgPositionPatient
        ? imgPositionPatient.split("\\").map(parseFloat)
        : [0, 0, 0];
      setMinX(imagePosition[0]);
      setMinY(imagePosition[1]);

      GetImageInfo(CTFiles).then((value) => {
        // The output value is in the form of array of objects of {zValue, imageData, columns, rows}
        // Declare and initialize 3D array
        const rows = value[0].rows;
        const columns = value[0].columns;
        const numZSlices = value.length;
        const zValues = [];
        const image3dElement = new Array(rows)
          .fill(null)
          .map(() =>
            new Array(columns)
              .fill(null)
              .map(() => new Array(numZSlices).fill(0))
          );
        const HU3dElement = new Array(rows)
          .fill(null)
          .map(() =>
            new Array(columns)
              .fill(null)
              .map(() => new Array(numZSlices).fill(0))
          );

        for (let zSlice = 0; zSlice < numZSlices; zSlice++) {
          zValues.push(value[zSlice].zValue);
          for (let i = 0; i < value[zSlice].imageData.length; i++) {
            const rowNo = Math.floor(i / columns);
            const columnNo = i % columns;
            // Convert 16-bit grayscale value to 8-bit (0-255) range
            const value16bit = value[zSlice].imageData[i];

            const value8bit = Math.round((value16bit / 65535) * 255);

            image3dElement[rowNo][columnNo][zSlice] = value8bit; // Y is opposite direction
            HU3dElement[rowNo][columnNo][zSlice] = value[zSlice].data[i];
          }
        }
        setImage3d(image3dElement);
        setHU3d(HU3dElement);
        setZList(zValues);
      });
    }

    //If series selected modality is RTSTRUCT, then load the structure
    let selectedStructure = null;
    if (
      patientCollection[selectedPatient].studyCollection[selectedStudy]
        .seriesCollection[selectedSeries].modality === "RTSTRUCT"
    ) {
      selectedStructure =
        patientCollection[selectedPatient].studyCollection[selectedStudy]
          .seriesCollection[selectedSeries].seriesNumber;
    }
    if (selectedStructure !== null) {
      const fileDataSetIndex =
        patientCollection[selectedPatient].studyCollection[selectedStudy]
          .seriesCollection[selectedSeries].fileListReference;

      const dataSetRequired =
        patientCollection[selectedPatient].fileList[fileDataSetIndex];

      const { rtStructs, structLabel } = RTStructureReader(dataSetRequired);
      const structureSetLoaded = new StructureSet();
      structureSetLoaded.structureSetID = structLabel;
      structureSetLoaded.structuresList = rtStructs;
      structureSetLoaded.structureSetLabel = structLabel;
      addStructureSet(structureSetLoaded, true);
    }
  }, [patientCollection, selectedPatient, selectedStudy, selectedSeries]);

  //my
  const [anchorEl, setAnchorEl] = React.useState(null);
  
  //const [selectedShape, setSelectedShape] = React.useState(null);
  const [shapeAnchorEl, setShapeAnchorEl] = React.useState(null);
  const [selectedShape, setSelectedShape] = React.useState("");

  const handleShapeSelect = (shape) => {
    console.log("Selected Shape:", shape);
    // You can set state or emit events here based on your project logic
  };
  //uptothis

  return (
    <div className="contouring-workspace">
      <div className="navbar">
        <AddStructureSet onAddStructureSet={addStructureSet} />

        <DICOMWriterScratch
          structureSet={structureSets.find(
            (set) => set.structureSetUID === selectedStructureSetUID
          )}
        ></DICOMWriterScratch>
        <div
          style={{
            pointerEvents: selectedStructureSetUID ? "auto" : "none", // Disable click when no structure set is selected
            display: "inline-block", // Ensures tooltip alignment
          }}
        >
          <Tooltip title={"Auto Segmentation"} arrow>
            <IconButton
              onClick={handleAutoSegmentation}
              sx={{
                margin: "15px",
                color: selectedStructureSetUID ? "#FFFFFF" : "#666666", // Keep the icon orange for better visibility
                backgroundColor: selectedStructureSetUID
                  ? isAutoSegEnabled
                    ? "orange"
                    : "#333333"
                  : "#121212", // Dark gray when enabled, darker when disabled
                "&:hover": {
                  backgroundColor: selectedStructureSetUID
                    ? "#444444"
                    : "#222222", // Darker gray on hover if enabled
                },
                padding: "8px",
                opacity: selectedStructureSetUID ? 1 : 0.6, // Reduce opacity when disabled for visual feedback
              }}
            >
              <AutoFixHighIcon />
            </IconButton>
          </Tooltip>
        </div>

        <div>
          <Tooltip title="New Contour" arrow>
            <IconButton
              id="brush"
              onClick={brushHandler}
              sx={{
                margin: "15px",
                color: selectedStructureUID ? "#FFF" : "#666666", // Orange for enabled, gray for disabled
                backgroundColor: selectedStructureUID
                  ? isManipulate
                    ? "orange"
                    : "#333333"
                  : "#121212", // Dark gray when enabled, darker when disabled

                "&:hover": {
                  backgroundColor: "#444444",
                },
                padding: "8px", // Adjust padding for icon button size
              }}
            >
              <Brush />
            </IconButton>
          </Tooltip>
        </div>

        <div>
          <TextField
            label="Brush Size"
            variant="outlined"
            value={brushSize}
            onChange={(e) => handleBrushSizeChange(e.target.value)}
            inputProps={{
              min: 1,
              type: "number",
              style: {
                // Remove the default spin buttons in all browsers
                MozAppearance: "textfield",
              },
            }}
            sx={{
              width: "100px",
              margin: "10px",
              backgroundColor: "#121212",
              "& .MuiOutlinedInput-root": {
                color: "#FFFFFF",
                "& fieldset": {
                  borderColor: "#FFA500",
                },
                "&:hover fieldset": {
                  borderColor: "#FFA500",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "#FFA500",
                },
                "& input[type=number]": {
                  "&::-webkit-outer-spin-button, &::-webkit-inner-spin-button":
                    {
                      "-webkit-appearance": "none",
                      margin: 0,
                    },
                },
              },
              "& .MuiInputLabel-root": {
                color: "#FFA500",
                "&.Mui-focused": {
                  color: "#FFA500",
                },
              },
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <IconButton
                      size="small"
                      sx={{
                        color: isManipulate ? "#FFA500" : "#AAAAAA",
                        padding: 0,
                        "&:hover": { backgroundColor: "#333" },
                      }}
                      onClick={() => handleBrushSizeChange(brushSize + 1)}
                    >
                      <ArrowDropUp />
                    </IconButton>
                    <IconButton
                      size="small"
                      sx={{
                        color: isManipulate ? "#FFA500" : "#AAAAAA",
                        padding: 0,
                        "&:hover": { backgroundColor: "#333" },
                      }}
                      onClick={() => handleBrushSizeChange(brushSize - 1)}
                    >
                      <ArrowDropDown />
                    </IconButton>
                  </div>
                </InputAdornment>
              ),
            }}
            disabled={!isManipulate}
            InputLabelProps={{
              shrink: true, // Keeps the label always visible
              style: {
                color: isManipulate ? "#FFA500" : "#AAAAAA", // Label color based on isManipulate
              },
            }}
          />
        </div>

        <DropdownInput
          options={contourStyles}
          onSelect={handleSelectBrush}
          isManipulate={isManipulate}
        />

        {/*Tool tip for eraser*/}
        <div>
          <Tooltip title="Eraser" arrow>
            <IconButton
              onClick={handleEraserClick}
              sx={{
                margin: "15px",
                color: selectedStructureUID ? "#FFF" : "#666666", // Orange for enabled, gray for disabled
                backgroundColor: selectedStructureUID
                  ? !isManipulate
                    ? "#FFA500"
                    : "#333333"
                  : "#121212", // Dark gray when enabled, darker when disabled

                "&:hover": {
                  backgroundColor: "#444444",
                },
                padding: "8px", // Adjust padding for icon button size
              }}
            >
              <PhonelinkEraseIcon />
            </IconButton>
          </Tooltip>
        </div>

        <div>
          <Tooltip title="Crosshair" arrow>
            <IconButton
              onClick={handleCrosshairClick}
              sx={{
                margin: "15px",
                color: "#FFF", // Orange for enabled, gray for disabled
                backgroundColor: isCrosshairEnabled ? "#FFA500" : "#333333", // Dark gray when enabled, darker when disabled

                "&:hover": {
                  backgroundColor: "#444444", // Darker gray on hover
                },
                padding: "8px", // Same padding for consistent icon size
              }}
            >
              <FilterCenterFocusIcon />
            </IconButton>
          </Tooltip>
        </div>

        <BooleanOperations
          structureSets={structureSets}
          selectedStructureSetUID={selectedStructureSetUID}
          addBooleanResult={addBooleanResult}
        />

         <ExecuteFloodFill structureSets={structureSets} selectedStructureSetUID={selectedStructureSetUID}  />
         {/*my */}
        <div>
          <Tooltip title="Select Shape" arrow>
            <IconButton
              onClick={(event) => setShapeAnchorEl(event.currentTarget)}
              sx={{
                margin: "15px",
                color: selectedShape ? "#FFF" : "#666666",
                backgroundColor: selectedShape ? "#FFA500" : "#333333",
                "&:hover": {
                  backgroundColor: "#444444",
                },
                padding: "8px",
              }}
            >
              <CategoryIcon />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={shapeAnchorEl}
            open={Boolean(shapeAnchorEl)}
            onClose={() => setShapeAnchorEl(null)}
            
          >
            <MenuItem
              onClick={() =>{
               setSelectedShape("rectangle");
               setShapeAnchorEl(null);
               setOpenAutoSegDialog(false); // 🔴 this disables AutoSeg so drawing can proceed
              }}
            > 
              Rectangle
            </MenuItem>
            <MenuItem
              onClick={() =>{
               setSelectedShape("ellipse");
               setShapeAnchorEl(null);
              }}
            > 
              Ellipse
            </MenuItem>
          </Menu>
        </div>


        {/* uptothis */}
      </div>

      <div className="contour-container">
        <div className="struct-container">
          {structureSets.map((structureSet) => (
            <Accordion
              key={structureSet.structureSetUID}
              expanded={expanded === structureSet.structureSetUID}
              //expanded={true}
              onChange={handleAccordionChange(structureSet.structureSetUID)}
              sx={{
                borderColor: "#FFA500",
                backgroundColor: "#121212", // Dark background for accordion
                color: "white", // Light text color
                "& .MuiAccordionSummary-root": {
                  backgroundColor: "#1f1f1f", // Slightly lighter background for summary
                },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: "#FFA500" }} />}
                aria-controls={`panel-${structureSet.structureSetID}-content`}
                id={`panel-${structureSet.structureSetID}-header`}
                sx={{ minHeight: "64px", maxHeight: "64px" }}
              >
                <Typography variant="h6" sx={{ color: "#FFA500" }}>
                  {structureSet.structureSetID}
                </Typography>
              </AccordionSummary>
              <AccordionDetails
                className="accordion"
                sx={{
                  minWidth: "300px", // Optional: Restrict the maximum width
                  maxWidth: "300px",
                  overflowX: "auto", // Add scrolling for content that overflows
                  minHeight: "750px",
                  maxHeight: "750px",
                  overflowY: "auto",
                }}
              >
                <RadioGroup value={selectedStructureUID}>
                  {structureSet.structuresList.map((structure) => (
                    <Box
                      key={`${structureSet.structureSetID}-${structure.structureID}`}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        padding: "4px", // Space between each item
                        background:
                          structure.structureID === selectedStructureUID ||
                          structure.structureID === hoveredStructureID
                            ? "#444"
                            : "",

                        width: "100%",
                      }}
                      onMouseEnter={(e) => {
                        setHoveredStructureID(structure.structureID);
                      }}
                      onMouseLeave={(e) => {
                        setHoveredStructureID(null);
                      }}
                    >
                      {/* Checkbox for display selection */}
                      <Checkbox
                        checked={displayStructuresUIDs.includes(
                          structure.structureID
                        )}
                        onChange={() =>
                          handleCheckboxChange(structure.structureID)
                        }
                        sx={{
                          color: "white",
                          "&.Mui-checked": {
                            ////////////CHANGE HERE
                            color: `rgb(${structure.Color.split("\\")
                              .map((v) => parseInt(v, 10))
                              .join(",")})`, // Color for selected checkbox
                          },
                          "&:hover": {
                            color: "#FFA500", // On hover, change to white for contrast
                          },
                        }}
                        checkedIcon={
                          <Visibility
                            sx={{
                              color: `rgb(${structure.Color.split("\\")
                                .map((v) => parseInt(v, 10))
                                .join(",")})`,
                            }}
                          />
                        }
                      />

                      {/* Label between checkbox and radio button */}
                      <Typography
                        sx={{
                          color: "white",
                          flex: 1, // Allow label to grow to fit text
                          paddingRight: "8px",
                        }}
                      >
                        {structure.Name}
                      </Typography>

                      {/* Radio button for edit selection */}
                      <FormControlLabel
                        value={structure.structureID}
                        control={
                          <Radio
                            sx={{
                              color: "white",

                              "&:hover": {
                                color: "orange", // On hover, change to white for contrast
                              },

                              "&.Mui-checked": {
                                color: `rgb(${structure.Color.split("\\")
                                  .map((v) => parseInt(v, 10))
                                  .join(",")})`, // Color for selected radio
                              },
                              display:
                                structure.structureID === hoveredStructureID ||
                                structure.structureID === selectedStructureUID
                                  ? ""
                                  : "none",
                            }}
                            icon={
                              <Brush
                                sx={{
                                  color: "orange",
                                }}
                              />
                            }
                            checkedIcon={
                              <Brush
                                sx={{
                                  color: "orange",
                                }}
                              />
                            } // Brush icon when selected
                            onChange={() =>
                              handleStructureChange(structure.structureID)
                            }
                          />
                        }
                        label="" // Keep label empty to avoid duplicate text
                        // Remove extra margin from FormControlLabel
                      />

                      {/* Remove Button (Clear Icon) */}
                      <IconButton
                        onClick={() =>
                          handleRemoveStructure(structure.structureID)
                        }
                        sx={{
                          color: "orange",

                          display:
                            structure.structureID === hoveredStructureID ||
                            structure.structureID === selectedStructureUID
                              ? ""
                              : "none",
                        }}
                      >
                        <ClearIcon />
                      </IconButton>
                    </Box>
                  ))}
                </RadioGroup>
              </AccordionDetails>
            </Accordion>
          ))}
        </div>

        {image3d && (
          <ViewComponent
            pixelSpacing={pixelSpacing}
            image3d={image3d}
            minX={minX}
            minY={minY}
            zList={zList}
            HU3d={HU3d}
            isManipulate={isManipulate}
            contourStyle={contourStyle}
            brushSize={brushSize}
            selectedStructureSetUID={selectedStructureSetUID}
            selectedStructureUID={selectedStructureUID}
            displayStructuresUIDs={displayStructuresUIDs}
            structureSets={structureSets}
            setStructureSets={setStructureSets}
            isCrosshairEnabled={isCrosshairEnabled}
            openAutoSegDialog={openAutoSegDialog}
            handleCloseAutoSegDialog={handleCloseAutoSegDialog}
            selectedShape={selectedShape}//my
          />
        )}
      </div>
    </div>
  );
};

export default ContouringWorkspace;
