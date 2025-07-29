#handles API requests related to sites
from fastapi import APIRouter, Depends
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
