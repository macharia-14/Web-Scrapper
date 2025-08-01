import os
from dotenv import load_dotenv
from fastapi import FastAPI, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from backend.database import connect_to_db, disconnect_from_db
from backend.routes import sites, tracking, analytics, export, alert

load_dotenv()

app = FastAPI()

# ✅ Define specific allowed origins for CORS
allowed_origins = [
    "http://127.0.0.1:5501",
    "http://localhost:5501",
    "http://127.0.0.1:5500",
    # Add your production domain(s) here if needed
]

# ✅ Use the correct CORS setup (no wildcard when using credentials)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Connect to DB at startup
@app.on_event("startup")
async def startup():
    await connect_to_db(app)

# Disconnect at shutdown
@app.on_event("shutdown")
async def shutdown():
    await disconnect_from_db(app)

# Mount the frontend static files (CSS, JS, etc.)
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")

# Serve index.html from the root route
@app.get("/")
async def serve_index():
    print("Root route called")
    file_path = "frontend/index.html"
    if os.path.exists(file_path):
        return FileResponse(file_path)
    else:
        error_message = "index.html not found"
        print(f"Error: {error_message}, Path: {file_path}")
        return {"error": error_message}

# Handle CORS preflight request explicitly for /api/track if needed
@app.options("/api/track")
async def preflight_track(response: Response):
    return Response(status_code=204)

# Include API routes
app.include_router(sites.router)
app.include_router(tracking.router)
app.include_router(analytics.router)
app.include_router(export.router)
app.include_router(alert.router)
