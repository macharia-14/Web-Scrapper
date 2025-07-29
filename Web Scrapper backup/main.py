#FASTAPI app launcher
# main.py
import os
from fastapi import FastAPI, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from backend.database import connect_to_db, disconnect_from_db
from backend.routes import sites, tracking  

app = FastAPI()
#Allow CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
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

# Mount the frontend folder to serve static files
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")

# Serve index.html from the root route
@app.get("/")
async def serve_index():
    
    file_path = "frontend/index.html"
    if os.path.exists(file_path):
        print(f"File exists: {file_path}")
        return FileResponse(file_path)
    else:
        print(f"File NOT found: {file_path}")
        print(f"Current working directory: {os.getcwd()}")
        print(f"Files in current directory: {os.listdir('.')}")
        return {"error": "index.html not found"}

@app.options("/api/track")
async def preflight_track(response: Response):
    return Response(status_code=204)


# Include routes
app.include_router(sites.router)
app.include_router(tracking.router)
