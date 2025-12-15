# P&ID Flow Editor

A visual P&ID (Piping and Instrumentation Diagram) editor focused on teaching transport phenomena. Built with React and React Flow for interactive diagram creation.

## Features

- **Visual Component Palette**: Drag-and-drop interface with professional industrial components
- **Industrial Components**:
  - Tank nodes with animated liquid levels and metallic styling
  - Pump nodes with rotation animations and flow indicators
  - Gate valve nodes with position indicators and flow visualization
- **Interactive Canvas**: Pan, zoom, and connect components with pipe-like edges
- **Professional Styling**: Industrial-grade SVG graphics with realistic animations

## Tech Stack

- **React** 19.2.0 - Modern React with hooks
- **React Flow** 11.11.4 - Interactive node-based editor
- **Vite** - Fast development and build tool
- **SVG Graphics** - Custom industrial component designs

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint
```

## Project Structure

```
src/
├── App.jsx                 # Main application with React Flow canvas
├── App.css                 # Application styling
├── components/
│   ├── TankNode.jsx         # Professional tank component with animations
│   ├── PumpNode.jsx         # Centrifugal pump with rotation
│   └── ValveNode.jsx        # Gate valve with position control
└── main.jsx                 # Application entry point

public/
└── pipe_flow_solver.py      # Python solver for future integration
```

## Usage

1. **Component Placement**: Drag components from the left sidebar to the canvas
2. **Connections**: Click and drag between component handles to create pipe connections
3. **Navigation**: Use controls to zoom, pan, and navigate the diagram
4. **Minimap**: Overview of entire diagram in bottom-right corner

## Future Enhancements

- Integration with Python solver for flow calculations
- Real-time flow simulation and visualization
- Component property editing
- Export functionality for diagrams
- Educational tutorials and examples

## Educational Context

Designed for CHME 2310 - Transport Processes I, focusing on:
- Mechanical Energy Balance concepts
- Pipe flow analysis
- Pump system design
- Interactive learning through visualization

---

Built with React Flow for educational purposes in chemical engineering transport phenomena.