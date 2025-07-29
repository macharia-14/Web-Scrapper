# models.py

from pydantic import BaseModel
from typing import Optional, Dict
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
    
class SiteResponse(BaseModel):
    id: str
    name: str
    domain: str
    owner: str
    created_at: datetime
    is_active: bool
    stats: Dict[str, int]

class SiteUpdate(BaseModel):
    name: Optional[str] = None
    domain: Optional[str] = None
    owner: Optional[str] = None
    is_active: Optional[bool] = None