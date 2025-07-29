# backend/database.py
import asyncpg
import os
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from typing import AsyncGenerator


load_dotenv()  

DATABASE_URL = os.getenv("DATABASE_URL")

async def connect_to_db(app: FastAPI):
    app.state.db = await asyncpg.create_pool(DATABASE_URL)
    print("✅ Connected to PostgreSQL")

async def disconnect_from_db(app: FastAPI):
    await app.state.db.close()

    print("❌ Disconnected from PostgreSQL")

async def get_db(request: Request) -> AsyncGenerator[asyncpg.Connection, None]:
    async with request.app.state.db.acquire() as conn:
        yield conn