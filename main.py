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

# Define a regex for allowed origins to include localhost, 127.0.0.1, and ngrok URLs.
# This is more flexible for testing than a static list, especially since ngrok
# can generate dynamic URLs. It supports new (.app) and old (.io) ngrok domains.
origin_regex = r"https?://(localhost|127\.0\.0\.1)(:\d+)?|https?://.+\.ngrok(-free)?\.(app|io)"

# Use the correct CORS setup. `allow_origin_regex` allows matching against dynamic
# origins like those from ngrok, which is not possible with a static `allow_origins` list.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=origin_regex,
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
