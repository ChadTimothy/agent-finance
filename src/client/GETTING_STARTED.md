# Getting Started with the Canvas Visualization

This guide will help you get the Canvas Visualization tool up and running so you can visualize and edit the relationships between Products, Rules, and Questions in your Broker AI Decision Engine.

## Quick Start

1. Make sure your backend is running on port 3001
2. Build and run the client:

```bash
# Navigate to the client directory
cd src/client

# Install dependencies
npm install

# Start the development server
npm run dev
```

3. Open your browser and go to `http://localhost:5173`

## Development Workflow

### Running in Development Mode

For development, run the client in development mode with hot reloading:

```bash
cd src/client
npm run dev
```

### Building for Production

To build the client for production:

```bash
cd src/client
npm run build
```

This will create optimized files in the `dist` directory.

### Serving the Built Client

The main server is configured to automatically serve the client if the build exists. After building:

1. Make sure your backend server is running: 
   ```bash
   npm run dev
   ```
2. Navigate to `http://localhost:3001` in your browser

Alternatively, you can serve just the client with:

```bash
cd src/client
node serve.js
```

## Using the Canvas

1. **Viewing Relationships**: 
   - Products are blue nodes
   - Rules are red nodes
   - Questions are green nodes
   - Arrows show the relationships between them

2. **Navigation**:
   - Pan by dragging the canvas
   - Zoom with mouse wheel
   - Use the controls in the bottom right

3. **Filtering**:
   - Use the filter panel to show/hide specific node types
   - Filter by lender, rule attribute, or question text

4. **Editing**:
   - Click any node to view/edit its details in the right panel
   - Drag between node connection points to create new relationships
   - Use the "Save Changes" button to persist your edits

## Troubleshooting

- **Canvas appears empty**: Ensure your backend is running and the `/api/canvas/data` endpoint returns data
- **Changes not persisting**: Check the browser console for API errors
- **Layout issues**: Use the "Re-layout" button to reorganize the nodes 