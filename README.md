<<<<<<< HEAD
# Hardware Configuration Tool

A web-based tool for designing hardware network topologies, managing requests, and exporting to PowerPoint.

## Features
- **Logical View**: Design the network topology.
- **Physical View**: Place nodes on a floor plan.
- **Request Mode**: Mark Power and Network requests on the floor plan.
- **PPT Export**: Generate a comprehensive PowerPoint presentation including BOM.
- **No Login Required**: Uses Firebase Anonymous Auth.

## Setup & Deployment

### Prerequisites
- A Firebase Project.
- Enable **Anonymous Authentication** in Firebase Console.
- Create a **Firestore Database** in test mode (or configure rules).

### Configuration
1. Open `src/config/firebase-config.js`.
2. Replace the `firebaseConfig` object with your project's configuration keys.

### Local Development
Since this project uses ES Modules, you need a local server.
If you have Python installed:
```bash
python -m http.server 8000
```
Then open `http://localhost:8000`.

### Deployment (GitHub Pages)
1. Push this repository to GitHub.
2. Go to **Settings > Pages**.
3. Select `main` branch as the source.
4. Your site will be live at `https://<username>.github.io/<repo-name>/`.

## Technologies
- Vanilla JavaScript (ES Modules)
- Tailwind CSS (CDN)
- Konva.js (Canvas Rendering)
- PptxGenJS (PPT Export)
- Firebase (Auth & Firestore)
=======
# Configuration-Driagram-Drawing-Tool
>>>>>>> 099fda832fb7827514cfc12d6f3830e9dd211bb5
