# 🚀 FlowSync AI — Real-Time Crowd Intelligence Platform

[![CI](https://github.com/Yash55-max/FlowSync-AI/actions/workflows/ci.yml/badge.svg)](https://github.com/Yash55-max/FlowSync-AI/actions/workflows/ci.yml)

FlowSync AI is a **real-time crowd intelligence system** designed for large-scale venues like stadiums, concerts, and public events.

It enables **density-aware routing, queue prediction, and operational decision-making** using live or simulated crowd data—helping organizers manage **100,000+ attendees efficiently in real time**.

---

## 🧠 Problem

Large events face:

- Unpredictable crowd congestion  
- Long queues at food/restrooms  
- Unsafe bottlenecks during peak moments  
- Lack of real-time visibility for operators  

Most systems today are **reactive**, not predictive.

---

## ⚡ Solution

FlowSync AI is **predictive + adaptive**.

It continuously:
- Monitors crowd density  
- Predicts congestion hotspots  
- Suggests optimal routes  
- Recommends operator interventions  

---

## 🎯 Key Features

### 📍 Real-Time Crowd Intelligence
- Zone-based density heatmaps  
- Live crowd simulation / ingestion  
- Hotspot detection  

### 🧭 Smart Routing Engine
- Density-weighted pathfinding  
- Avoids congested zones dynamically  
- Phase-aware navigation (entry / halftime / exit)  

### ⏱ Queue Intelligence
- Predict wait times for stalls/restrooms  
- Suggest faster alternatives  

### 🧑‍💼 Operator Dashboard
- High-risk zones detection  
- Actionable interventions  
- Real-time alerts system  

### 🎮 Demo Scenarios (Hackathon Ready)
- Surge simulation  
- Food rush spike  
- Emergency evacuation mode  
- AI optimization mode  

---

## 🏟 Real-World Context

Tested using **Narendra Modi Stadium (Ahmedabad)** layout:

- Real geographic structure  
- Gate-based entry/exit logic  
- Zone-mapped crowd simulation  

---

## 📍 Supported Locations

### 🏟 Stadiums
- Narendra Modi Stadium  
- Wembley Stadium  
- MetLife Stadium  
- Melbourne Cricket Ground  
- Camp Nou  

### 🗺 Places / Landmarks
- Times Square  
- Burj Khalifa  
- Eiffel Tower  
- Tirupati Temple  
- Kumbh Mela Grounds  

---

## 🧱 Tech Stack

| Layer | Tech |
|------|------|
| Frontend | React + TypeScript + Vite |
| Backend | FastAPI (Python) |
| Deployment | Google Cloud Run |
| Maps | Google Maps Platform |
| Algorithms | Grid-based pathfinding + density cost weighting |
| Data Mode | Hybrid (Simulated + Live Ingest API) |

---

## 🌐 Live Deployment

- 🔗 **Frontend:** https://flowsync-frontend-796656775802.asia-south1.run.app  
- 🔗 **Backend API:** https://flowsync-backend-796656775802.asia-south1.run.app  
- 📘 **API Docs:** https://flowsync-backend-796656775802.asia-south1.run.app/docs  

---

## ⚙️ System Architecture
Frontend (React)
      ↓
Backend API (FastAPI)
      ↓
Crowd Simulator / Live Data Ingestion
      ↓
Routing + Prediction Engine


---

## 🚀 Getting Started (Local)

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Access

- Frontend → http://localhost:5173
- Backend Docs → http://localhost:8000/docs

---

## 🔌 API Highlights

| Endpoint | Description |
|----------|-------------|
| `/snapshot` | Current crowd + queue state |
| `/heatmap` | Zone density map |
| `/journey` | Smart route planning |
| `/venue-map` | Venue structure |
| `/staff-actions` | AI operator suggestions |
| `/alerts` | Real-time alerts |
| `/demo-control` | Trigger simulation scenarios |
| `/ingest/live-snapshot` | Push real telemetry |
| `/data-source` | Live vs simulated data status |

---

## 📡 Live Data Ingestion Example

```json
{
  "generated_at": "2026-04-15T12:30:00Z",
  "zones": [
    { "zone_id": "zone-1", "density_score": 88 }
  ],
  "queues": [
    { "stall_id": "stall-1", "wait_time_minutes": 12 }
  ]
}
```

---

## 🧪 Demo Scenarios

Trigger via `/demo-control`:

- `surge-zone-1`
- `food-rush`
- `emergency-mode`
- `optimize-crowd`

---

## 🏆 Why This Project Stands Out

- Real-world venue simulation (not dummy/demo-only data)
- AI-driven routing and prediction logic
- Full-stack deployment on Google Cloud Run
- Covers both attendee experience + operator decision-making
- Designed to scale with real telemetry (IoT, CCTV, WiFi tracking)

---

## ⚠️ Important Notes

- API keys (Google Maps) are restricted by domain
- Backend CORS is configured for deployed frontend
- System works in simulated mode by default if no live data is ingested

---

## 🔒 License

MIT License
