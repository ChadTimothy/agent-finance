# Broker AI Decision Engine - Rule Canvas Visualization

This is a visualization tool for the Broker AI Decision Engine that displays the relationships between Products, Rules, and Questions. It uses a node-based canvas to help understand and edit these relationships.

## Features

- Interactive visualization of Products, Rules, and Questions as nodes on a canvas
- Connection lines showing relationships between entities
- Filtering capabilities to focus on specific items
- Detail panel for editing node properties
- Ability to create new connections between nodes

## Setup and Installation

### Prerequisites

- Node.js (v14+)
- npm or yarn
- The Broker AI Decision Engine backend running

### Installation

1. Clone the repository
2. Navigate to the client directory:
   ```
   cd src/client
   ```
3. Install dependencies:
   ```
   npm install
   ```
   or
   ```
   yarn
   ```

### Running the Application

1. Make sure the Broker AI Decision Engine backend is running on port 3001
2. Start the development server:
   ```
   npm run dev
   ```
   or
   ```
   yarn dev
   ```
3. Open your browser and navigate to `http://localhost:5173`

## Usage

### Canvas Navigation

- **Pan**: Click and drag on the canvas background
- **Zoom**: Use mouse wheel or pinch gesture
- **Select Node**: Click on a node to see its details in the side panel
- **Connect Nodes**: Drag from a node's handle to another node's handle
- **Move Node**: Click and drag a node to a new position

### Filtering

Use the filter panel to:
- Show/hide node types (Products, Rules, Questions)
- Filter by lender, rule attribute, or question text

### Editing

Click on any node to open the detail panel where you can:
- Edit node properties
- Save changes to the database

## Architecture

The application consists of:

1. A React frontend using `reactflow` for canvas visualization
2. Custom node components for Products, Rules, and Questions
3. API integration with the Broker AI Decision Engine backend
4. Filtering and editing capabilities 