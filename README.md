# Beneath the Abbey

A medieval exploration game where you play as a monk investigating the mysterious disappearance of a bishop. Built with Three.js.

## Description

"Beneath the Abbey" is a 3D exploration game set in a medieval abbey. The player takes on the role of a monk who must uncover the truth behind the bishop's disappearance by exploring the abbey and interacting with other characters.

## Features

- 3D environment with medieval architecture
- Dynamic lighting with realistic candle effects
- Third-person character controls
- Medieval-styled user interface
- Quest system

## Technical Stack

- Three.js for 3D rendering
- Native JavaScript (ES6+)
- CSS3 for UI styling
- Medieval Sharp font for thematic typography

## Installation

1. Clone the repository
2. Serve the files using a local web server (due to ES6 module requirements)
   ```bash
   # Using Python 3
   python -m http.server

   # Or using Node.js
   npx http-server
   ```
3. Open your browser and navigate to `http://localhost:8000`

## Controls

- Z: Move forward
- S: Move backward
- Q: Move left
- D: Move right
- Right Mouse Button: Rotate camera
- Mouse Wheel: Zoom in/out

## Project Structure 

```
btabbey/
├── index.html                   # Main HTML entry point
├── game.js                      # Core game logic and initialization
├── gui.js                       # User interface components
├── main.js                      # Main game engine and scene setup
├── styles.css                   # Styling for the game interface
├── README.md                    # Project documentation
└── lib/                         # External libraries
    ├── three.module.js
    ├── OrbitControls.js
    └── dat.gui.min.js
```