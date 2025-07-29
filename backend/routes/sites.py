#handles API requests related to sites
from fastapi import APIRouter, Depends, HTTPException
from backend.database.connection import get_db
from backend.models import SiteCreate
from backend.models import Site

from fastapi.responses import JSONResponse
import asyncpg

router = APIRouter()

@router.post("/sites", response_model=Site)
async def create_site(site: SiteCreate, db=Depends(get_db)):
    query = """
        INSERT INTO sites (name, domain, owner)
        VALUES ($1, $2, $3)
        RETURNING id, name, domain, owner, is_active, created_at;
    """
    result = await db.fetchrow(query, site.name, site.domain, site.owner)
    return dict(result)

@router.get("/sites")
async def get_sites(db=Depends(get_db)):
    query = """
        SELECT id, name, domain, owner, is_active, created_at
        FROM sites
        ORDER BY created_at DESC;
    """
    results = await db.fetch(query)
    return [dict(result) for result in results]

@router.delete("/sites/{site_id}")
async def delete_site(site_id: str, db=Depends(get_db)):
    query = """
        DELETE FROM sites 
        WHERE id = $1
        RETURNING id;
    """
    result = await db.fetchrow(query, site_id)
    if not result:
        raise HTTPException(status_code=404, detail="Site not found")
    return {"message": "Site deleted successfully", "id": site_id}