# FlowSync AI - Complete Setup Guide

This guide provides detailed instructions for setting up FlowSync AI on your machine.

## Prerequisites

### System Requirements
- **CPU**: 2+ cores recommended
- **RAM**: 4GB minimum, 8GB recommended
- **Disk**: 2GB available space
- **OS**: Windows, macOS, or Linux

### Required Software

#### Python (Backend)
- Minimum: Python 3.9
- Download: https://www.python.org/downloads/
- Verify installation:
  ```bash
  python --version
  ```

#### Node.js (Frontend)
- Minimum: Node.js 18 LTS
- Download: https://nodejs.org/
- Verify installation:
  ```bash
  node --version
  npm --version
  ```

#### Git
- Download: https://git-scm.com/
- Verify installation:
  ```bash
  git --version
  ```

## Installation Steps

### Step 1: Clone the Repository

```bash
# Using HTTPS
git clone https://github.com/Yash55-max/FlowSync-AI.git
cd FlowSync-AI

# Or using SSH (if configured)
git clone git@github.com:Yash55-max/FlowSync-AI.git
cd FlowSync-AI
```

### Step 2: Backend Setup

#### On Windows (PowerShell)
```powershell
# Create virtual environment
python -m venv .venv

# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# If you get execution policy error:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Install dependencies
cd backend
pip install -r requirements.txt

# Run the server
python -m uvicorn app.main:app --reload --port 8000
```

#### On macOS/Linux (Bash)
```bash
# Create virtual environment
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate

# Install dependencies
cd backend
pip install -r requirements.txt

# Run the server
python -m uvicorn app.main:app --reload --port 8000
```

**Expected Output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started server process
```

### Step 3: Frontend Setup

**Open a new terminal window** (keep the backend running in the first one)

```bash
# Navigate to project root
cd /path/to/FlowSync-AI

# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

**Expected Output:**
```
  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### Step 4: Access the Application

Open these URLs in your browser:

1. **Frontend**: http://localhost:5173/
   - Main FlowSync AI application
   - Canvas-based heatmap visualization
   - Demo controls and dashboards

2. **API Documentation**: http://localhost:8000/docs
   - Interactive Swagger UI
   - Test all API endpoints
   - See request/response examples

3. **API ReDoc**: http://localhost:8000/redoc
   - Alternative API documentation
   - Better for reference material

## Verification Steps

### Test Backend
```bash
# In a new terminal, test the health endpoint
curl http://localhost:8000/health

# Should return:
# {"status":"ok"}
```

### Test Frontend Build
```bash
cd frontend
npm run build

# Should create dist/ folder with optimized build
```

## Troubleshooting

### Backend Won't Start

**Error**: `ModuleNotFoundError: No module named 'fastapi'`
- **Solution**: Ensure virtual environment is activated and `pip install -r requirements.txt` completed

**Error**: `Port 8000 already in use`
- **Solution**: Use a different port: `uvicorn app.main:app --port 8001`

**Error**: `python: command not found`
- **Solution**: Use `python3` instead of `python` on macOS/Linux

### Frontend Won't Start

**Error**: `npm: command not found`
- **Solution**: Install Node.js from https://nodejs.org/

**Error**: `Port 5173 already in use`
- **Solution**: Kill the process using that port or use: `npm run dev -- --port 5174`

**Error**: `Module not found`
- **Solution**: Delete `node_modules/` and run `npm install` again

### Can't Connect Frontend to Backend

**Error**: `Failed to fetch from http://localhost:8000`
- **Solution**: Ensure backend is running on port 8000
- **Alternative**: Set environment variable `VITE_API_BASE_URL=http://localhost:8001` if using different port

**Error**: CORS error in browser console
- **Solution**: Backend should have CORS enabled by default, restart backend server

## Environment Configuration

### Optional: Custom API Port

Create `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:CUSTOM_PORT
```

### Optional: Firebase Setup (Advanced)

For persistent data storage:

1. Create Firebase project at https://firebase.google.com/
2. Create `backend/.env`:
```env
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_auth_domain
FIREBASE_DATABASE_URL=your_database_url
```

3. Uncomment Firebase code in `backend/app/firebase_client.py`

## Running Production Builds

### Build Frontend
```bash
cd frontend
npm run build
```
Output: `frontend/dist/` contains optimized build

### Build Backend
```bash
cd backend
pip install gunicorn
gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app
```

## Development Workflow

### During Development
```bash
# Terminal 1 - Backend
cd backend
source .venv/bin/activate  # or .\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload

# Terminal 2 - Frontend
cd frontend
npm run dev

# Terminal 3 - (optional) Tests, git commands, etc.
```

### Code Formatting (Optional)

**Python**
```bash
pip install black
black backend/app/
```

**TypeScript/React**
```bash
npm install -D prettier eslint
npm run lint
npm run format
```

## Next Steps

1. **Explore the API**: Visit http://localhost:8000/docs
2. **Test Demo Scenarios**: Click the demo buttons in the UI
3. **Read Documentation**: Check `TRD.txt` and `PRD.txt`
4. **Make Modifications**: Update code and see changes reload
5. **Share Feedback**: Open issues or discussions on GitHub

## Getting Help

- **Backend Issues**: Check `backend/` documentation
- **Frontend Issues**: Check `frontend/` source comments
- **General Questions**: Create a GitHub Discussion
- **Bug Reports**: Submit a GitHub Issue with reproduction steps

---

**Happy coding! 🚀**
