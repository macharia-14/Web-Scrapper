#handles API requests related to sites
from fastapi import APIRouter, Depends, HTTPException
from backend.database.connection import get_db
from backend.models import SiteCreate
from backend.models import Site
from datetime import datetime
from fastapi.responses import JSONResponse
from typing import Optional
from fastapi import Query
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

@router.get("/sites/{site_id}", response_model=Site)
async def get_site(site_id: str, db=Depends(get_db)):
    """
    Retrieve a specific site by its ID.
    """
    query = """
        SELECT id, name, domain, owner, is_active, created_at
        FROM sites
        WHERE id = $1;
    """
    result = await db.fetchrow(query, site_id)

    if not result:
        raise HTTPException(status_code=404, detail="Site not found")

    return dict(result)

# ADD this new endpoint to sites.py:
@router.get("/analytics/{site_id}/realtime")
async def get_realtime_analytics(
    site_id: str, 
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db=Depends(get_db)
):
    """Get real-time analytics for a specific site"""
    try:
        # Determine date conditions and parameters
        if start_date and end_date:
            date_condition = "AND created_at >= $2::date AND created_at < ($3::date + INTERVAL '1 day')"
            base_params = [site_id, start_date, end_date]
        else:
            date_condition = "AND created_at >= CURRENT_DATE"
            base_params = [site_id]
        
        # Active users (users active in last 5 minutes - always realtime)
        active_users_query = """
            SELECT COUNT(DISTINCT user_id) as active_users
            FROM events 
            WHERE site_id = $1 
            AND created_at >= NOW() - INTERVAL '5 minutes'
        """
        active_users = await db.fetchval(active_users_query, site_id) or 0
        
        # Total pageviews for the selected date range
        pageviews_query = f"""
            SELECT COUNT(*) as total_pageviews
            FROM events 
            WHERE site_id = $1 
            AND event_type = 'pageview'
            {date_condition}
        """
        total_pageviews = await db.fetchval(pageviews_query, *base_params) or 0
        
        # Unique visitors for the selected date range
        visitors_query = f"""
            SELECT COUNT(DISTINCT user_id) as unique_visitors
            FROM events 
            WHERE site_id = $1 
            {date_condition}
        """
        unique_visitors = await db.fetchval(visitors_query, *base_params) or 0
        
        # Button clicks for the selected date range
        clicks_query = f"""
            SELECT COUNT(*) as button_clicks
            FROM events 
            WHERE site_id = $1 
            AND event_type = 'button_click'
            {date_condition}
        """
        button_clicks = await db.fetchval(clicks_query, *base_params) or 0
        
        # Top pages for the selected date range
        top_pages_query = f"""
            SELECT 
                url, 
                title,
                COUNT(*) as views
            FROM events 
            WHERE site_id = $1 
            AND event_type = 'pageview'
            {date_condition}
            GROUP BY url, title
            ORDER BY views DESC
            LIMIT 10
        """
        top_pages_result = await db.fetch(top_pages_query, *base_params)
        top_pages = []
        for row in top_pages_result:
            top_pages.append({
                'url': row['url'],
                'title': row['title'],
                'views': row['views'],
                'change': 0  # You can calculate change vs previous period if needed
            })
        
        # Traffic sources analysis for the selected date range
        traffic_sources_query = f"""
            SELECT 
                CASE 
                    WHEN referrer = '' OR referrer IS NULL THEN 'Direct'
                    WHEN referrer ILIKE '%google%' THEN 'Google Search'
                    WHEN referrer ILIKE '%facebook%' THEN 'Facebook'
                    WHEN referrer ILIKE '%twitter%' THEN 'Twitter'
                    WHEN referrer ILIKE '%linkedin%' THEN 'LinkedIn'
                    WHEN referrer ILIKE '%youtube%' THEN 'YouTube'
                    WHEN referrer ILIKE '%instagram%' THEN 'Instagram'
                    ELSE 'Other Referrals'
                END as source_name,
                COUNT(DISTINCT user_id) as visitors,
                COUNT(*) as total_visits
            FROM events 
            WHERE site_id = $1 
            AND event_type = 'pageview'
            {date_condition}
            GROUP BY source_name
            ORDER BY visitors DESC
        """
        traffic_sources_result = await db.fetch(traffic_sources_query, *base_params)
        total_traffic_visitors = sum(row['visitors'] for row in traffic_sources_result)
        
        traffic_sources = []
        for row in traffic_sources_result:
            percentage = round((row['visitors'] / total_traffic_visitors * 100) if total_traffic_visitors > 0 else 0, 1)
            traffic_sources.append({
                'name': row['source_name'],
                'visitors': row['visitors'],
                'total_visits': row['total_visits'],
                'percentage': percentage
            })
        
        # Geographic distribution for the selected date range
        geo_query = f"""
            SELECT 
                COALESCE(ip_country, 'Unknown') as country_code,
                COALESCE(ip_country, 'Unknown') as country_name,
                COUNT(DISTINCT user_id) as visitors,
                COUNT(*) as total_visits
            FROM events 
            WHERE site_id = $1 
            {date_condition}
            GROUP BY ip_country
            ORDER BY visitors DESC
            LIMIT 10
        """
        geo_result = await db.fetch(geo_query, *base_params)
        geo_distribution = []
        for row in geo_result:
            geo_distribution.append({
                'code': row['country_code'],
                'name': row['country_name'], 
                'visitors': row['visitors'],
                'total_visits': row['total_visits']
            })
        
        # Performance metrics for the selected date range
        perf_query = f"""
            SELECT 
                AVG(
                    CASE 
                        WHEN metadata->>'load_time' ~ '^[0-9]+$' 
                        THEN CAST(metadata->>'load_time' AS INTEGER)
                        ELSE NULL 
                    END
                ) as avg_load_time,
                COUNT(CASE WHEN event_type = 'javascript_error' THEN 1 END) as js_errors,
                COUNT(CASE WHEN event_type = 'form_submit' THEN 1 END) as form_submissions,
                COUNT(CASE WHEN event_type = 'page_performance' THEN 1 END) as performance_events
            FROM events 
            WHERE site_id = $1 
            {date_condition}
        """
        perf_result = await db.fetchrow(perf_query, *base_params)
        
        # Calculate bounce rate for the selected date range
        bounce_rate_query = f"""
            SELECT 
                COALESCE(
                    COUNT(CASE WHEN page_count = 1 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0),
                    0
                ) as bounce_rate
            FROM (
                SELECT 
                    user_id,
                    COUNT(CASE WHEN event_type = 'pageview' THEN 1 END) as page_count
                FROM events 
                WHERE site_id = $1 
                {date_condition}
                GROUP BY user_id
                HAVING COUNT(CASE WHEN event_type = 'pageview' THEN 1 END) > 0
            ) user_sessions
        """
        bounce_rate = await db.fetchval(bounce_rate_query, *base_params) or 0
        
        # Recent events for activity feed (last 15 events from selected date range)
        events_query = f"""
            SELECT 
                event_type, 
                url, 
                title, 
                created_at,
                metadata,
                ip_city,
                ip_country
            FROM events 
            WHERE site_id = $1 
            {date_condition}
            ORDER BY created_at DESC 
            LIMIT 15
        """
        events_result = await db.fetch(events_query, *base_params)
        
        # Format recent events for activity feed
        recent_events = []
        for event in events_result:
            # Create meaningful descriptions
            event_type = event['event_type']
            location = ""
            if event['ip_city'] and event['ip_country']:
                location = f" from {event['ip_city']}, {event['ip_country']}"
            elif event['ip_country']:
                location = f" from {event['ip_country']}"
            
            if event_type == 'pageview':
                description = f"Page view: {event['title'] or event['url']}{location}"
            elif event_type == 'button_click':
                description = f"Button clicked on {event['title'] or event['url']}{location}"
            elif event_type == 'form_submit':
                description = f"Form submitted on {event['title'] or event['url']}{location}"
            elif event_type == 'javascript_error':
                description = f"JavaScript error on {event['title'] or event['url']}{location}"
            elif event_type == 'click':
                description = f"Element clicked on {event['title'] or event['url']}{location}"
            else:
                description = f"{event_type.replace('_', ' ').title()} on {event['title'] or event['url']}{location}"
            
            recent_events.append({
                'description': description,
                'created_at': event['created_at'].isoformat(),
                'event_type': event_type
            })
        
        # Device/Browser breakdown for the selected date range
        device_query = f"""
            SELECT 
                CASE 
                    WHEN user_agent ILIKE '%mobile%' OR user_agent ILIKE '%android%' THEN 'Mobile'
                    WHEN user_agent ILIKE '%tablet%' OR user_agent ILIKE '%ipad%' THEN 'Tablet'
                    ELSE 'Desktop'
                END as device_type,
                COUNT(DISTINCT user_id) as users
            FROM events 
            WHERE site_id = $1 
            {date_condition}
            AND user_agent IS NOT NULL
            GROUP BY device_type
            ORDER BY users DESC
        """
        device_result = await db.fetch(device_query, *base_params)
        device_breakdown = [dict(row) for row in device_result]
        
        # Hourly activity for the selected date range
        hourly_query = f"""
            SELECT 
                EXTRACT(HOUR FROM created_at) as hour,
                COUNT(CASE WHEN event_type = 'pageview' THEN 1 END) as pageviews,
                COUNT(DISTINCT user_id) as unique_users
            FROM events 
            WHERE site_id = $1 
            {date_condition}
            GROUP BY EXTRACT(HOUR FROM created_at)
            ORDER BY hour
        """
        hourly_result = await db.fetch(hourly_query, *base_params)
        hourly_activity = [dict(row) for row in hourly_result]
        
        # Determine data range label for response
        if start_date and end_date:
            if start_date == end_date:
                data_range = f"Data for {start_date}"
            else:
                data_range = f"Data from {start_date} to {end_date}"
        else:
            data_range = "today"
        
        return {
            # Main metrics
            "active_users": active_users,
            "total_pageviews": total_pageviews,
            "unique_visitors": unique_visitors,
            "button_clicks": button_clicks,
            
            # Performance metrics
            "avg_load_time": round(perf_result['avg_load_time'] or 0),
            "js_errors": perf_result['js_errors'] or 0,
            "form_submissions": perf_result['form_submissions'] or 0,
            "bounce_rate": round(bounce_rate, 1),
            
            # Detailed breakdowns
            "top_pages": top_pages,
            "traffic_sources": traffic_sources,
            "geo_distribution": geo_distribution,
            "device_breakdown": device_breakdown,
            "hourly_activity": hourly_activity,
            
            # Activity feed
            "recent_events": recent_events,
            
            # Metadata
            "last_updated": datetime.utcnow().isoformat(),
            "data_range": data_range
        }
        
    except Exception as e:
        print(f"Error in get_realtime_analytics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch realtime analytics: {str(e)}")