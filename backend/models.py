# models.py

from pydantic import BaseModel, Field
from typing import Optional, Dict
from uuid import UUID
import uuid

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

class AlertRule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    site_id: str
    name: str
    condition: str  # 'page_views_spike', 'new_referrer', 'error_rate', 'custom_event'
    threshold: Optional[float] = None
    time_window: int = 300  # seconds
    notification_email: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AlertRuleCreate(BaseModel):
    site_id: str
    name: str
    condition: str
    threshold: Optional[float] = None
    time_window: int = 300
    notification_email: str
class AlertRuleUpdate(BaseModel):
    name: Optional[str] = None
    condition: Optional[str] = None
    threshold: Optional[float] = None
    time_window: Optional[int] = None
    notification_email: Optional[str] = None
    is_active: Optional[bool] = None
class AlertNotification(BaseModel):
    id: UUID = Field(default_factory=uuid.uuid4)
    rule_id: Optional[UUID]
    site_id: UUID
    message: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    notification_email: str
    alert_name: Optional[str] = None
