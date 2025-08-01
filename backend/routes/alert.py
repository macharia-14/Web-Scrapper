# Alert management endpoints
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timedelta
from typing import List
import logging
import uuid

from backend.models import AlertRule, AlertRuleCreate, AlertNotification
from backend.database import get_db

router = APIRouter(
    prefix="/alerts",
    tags=["alerts"]
)

@router.post("/rules", response_model=AlertRule)
async def create_alert_rule(rule: AlertRuleCreate, db=Depends(get_db)):
    """Create a new alert rule"""
    new_id = str(uuid.uuid4())
    rule_dict = rule.dict()
    rule_dict["id"] = new_id
    rule_dict["is_active"] = True

    query = """
        INSERT INTO alert_rules (
            id, site_id, name, condition, threshold, time_window, notification_email, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    """
    await db.execute(query,
        rule_dict["id"],
        rule_dict["site_id"],
        rule_dict["name"],
        rule_dict["condition"],
        rule_dict["threshold"],
        rule_dict["time_window"],
        rule_dict["notification_email"],
        rule_dict["is_active"],
    )
    return AlertRule(**rule_dict)

@router.get("/rules", response_model=List[AlertRule])
async def get_alert_rules(site_id: str = Query(...), db=Depends(get_db)):
    """Get all alert rules for a site"""
    query = "SELECT * FROM alert_rules WHERE site_id = $1 AND is_active = TRUE"
    rows = await db.fetch(query, site_id)
    return [AlertRule(**dict(row)) for row in rows]

@router.delete("/rules/{rule_id}")
async def delete_alert_rule(rule_id: str, db=Depends(get_db)):
    """Delete an alert rule by marking it as inactive."""
    query = "UPDATE alert_rules SET is_active = FALSE WHERE id = $1 RETURNING id"
    result = await db.fetchval(query, rule_id)
    if not result:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    return {"message": "Alert rule deleted successfully"}

async def check_alerts(db_pool, site_id: str, event_data: dict):
    """Background task to check if any alerts should be triggered"""
    try:
        # Acquire a connection from the pool passed to the background task
        async with db_pool.acquire() as db:
            query = "SELECT * FROM alert_rules WHERE site_id = $1 AND is_active = TRUE"
            rules = await db.fetch(query, site_id)

            for rule_row in rules:
                rule = AlertRule(**dict(rule_row))
                if rule.condition == 'page_views_spike':
                    await check_pageview_spike(rule, db, event_data)
                elif rule.condition == 'error_rate':
                    await check_error_rate(rule, db, event_data)
                elif rule.condition == 'custom_event':
                    await check_custom_event(rule, db, event_data)
    except Exception as e:
        logging.error(f"Error checking alerts: {str(e)}")

async def check_pageview_spike(rule: AlertRule, db_conn, event_data: dict):
    """Check for pageview spikes"""
    if event_data.get("event_type") != "pageview":
        return

    threshold_time = datetime.utcnow() - timedelta(seconds=rule.time_window)

    query = """
        SELECT COUNT(*) FROM events
        WHERE site_id = $1 AND event_type = 'pageview' AND created_at >= $2
    """
    count = await db_conn.fetchval(query, rule.site_id, threshold_time)

    if count > rule.threshold:
        await trigger_alert(rule, db_conn, f"Pageview spike detected: {count} views in {rule.time_window} seconds")

async def check_error_rate(rule: AlertRule, db_conn, event_data: dict):
    """Check for high error rate"""
    if event_data.get("event_type") != "javascript_error":
        return

    threshold_time = datetime.utcnow() - timedelta(seconds=rule.time_window)

    error_query = """
        SELECT COUNT(*) FROM events
        WHERE site_id = $1 AND event_type = 'javascript_error' AND created_at >= $2
    """
    total_query = """
        SELECT COUNT(*) FROM events
        WHERE site_id = $1 AND created_at >= $2
    """
    error_count = await db_conn.fetchval(error_query, rule.site_id, threshold_time)
    total_count = await db_conn.fetchval(total_query, rule.site_id, threshold_time)

    if total_count > 0:
        error_rate = (error_count / total_count) * 100
        if error_rate > rule.threshold:
            await trigger_alert(rule, db_conn, f"High error rate: {error_rate:.1f}% in {rule.time_window} seconds")

async def check_custom_event(rule: AlertRule, db_conn, event_data: dict):
    """Check for custom events"""
    if event_data.get('event_type') == 'custom_event':
        await trigger_alert(rule, db_conn, f"Custom event triggered: {event_data.get('metadata', {}).get('event_name', 'Unknown')}")

async def trigger_alert(rule: AlertRule, db, message: str):
    """Trigger an alert and store in PostgreSQL"""
    alert_id = str(uuid.uuid4())
    timestamp = datetime.utcnow()

    query = """
        INSERT INTO alert_notifications (
            id, rule_id, site_id, message, timestamp, notification_email
        ) VALUES ($1, $2, $3, $4, $5, $6)
    """
    await db.execute(query, alert_id, rule.id, rule.site_id, message, timestamp, rule.notification_email)

    logging.info(f"ALERT TRIGGERED - {rule.name}: {message}")

@router.get("/notifications", response_model=List[AlertNotification])
async def get_alert_notifications(site_id: str = Query(...), limit: int = 50, db=Depends(get_db)):
    """Get recent alert notifications for a site"""
    query = """
        SELECT an.id, an.rule_id, an.site_id, an.message, an.timestamp, ar.name as alert_name
        FROM alert_notifications an
        JOIN alert_rules ar ON an.rule_id = ar.id
        WHERE an.site_id = $1
        ORDER BY an.timestamp DESC
        LIMIT $2
    """
    rows = await db.fetch(query, site_id, limit)
    return [AlertNotification(**dict(row)) for row in rows]
