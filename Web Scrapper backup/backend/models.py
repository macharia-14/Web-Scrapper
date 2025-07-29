# models.py

from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

class SiteCreate(BaseModel):
    name: str
    domain: str
    owner: str

class Site(SiteCreate):
    id: UUID
    is_active: bool
    created_at: datetime
    
