from fastapi import APIRouter, Request, HTTPException, Query
from datetime import datetime, timedelta
from collections import defaultdict
from typing import List
from backend.database import get_db
import json

router = APIRouter()


@router.get("/analytics/{site_id}")
async def get_analytics(
    site_id: str,
    request: Request,
    start_date: str = Query(None),
    end_date: str = Query(None)
):
    conn = await request.app.state.db.acquire()

    try:
        end_dt = datetime.utcnow()
        start_dt = end_dt - timedelta(days=7)

        if start_date:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        if end_date:
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))

        query = """
            SELECT * FROM events
            WHERE site_id = $1 AND created_at BETWEEN $2 AND $3
        """
        rows = await conn.fetch(query, site_id, start_dt, end_dt)

        if not rows:
            return {
                "site_id": site_id,
                "total_pageviews": 0,
                "unique_visitors": 0,
                "total_sessions": 0,
                "bounce_rate": 0.0,
                "avg_session_duration": 0.0,
                "top_pages": [],
                "referrer_stats": [],
                "device_stats": [],
                "real_time_visitors": 0,
                "button_clicks": 0,
                "form_submissions": 0,
                "error_count": 0,
                "avg_load_time": 0,
                "click_heatmap": [],
                "user_journey": []
            }

        events = []
        for row in rows:
            event = dict(row)
            # Ensure metadata is a dict
            metadata = event.get('metadata')
            if metadata and isinstance(metadata, str):
                event['metadata'] = json.loads(metadata)
            elif not metadata:
                event['metadata'] = {}
            events.append(event)

        pageviews = [e for e in events if e['event_type'] == 'pageview']
        button_clicks = [e for e in events if e['event_type'] == 'button_click']
        form_submissions = [e for e in events if e['event_type'] == 'form_submit']
        errors = [e for e in events if e['event_type'] == 'javascript_error']

        unique_visitors = len(set(e['user_id'] for e in events if e.get('user_id')))
        unique_sessions = len(set(e['session_id'] for e in events if e.get('session_id')))

        # Top pages
        page_counts = defaultdict(int)
        for event in pageviews:
            page_counts[event['url']] += 1

        top_pages = [
            {"url": url, "views": count}
            for url, count in sorted(page_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        ]

        # Referrer stats
        referrer_counts = defaultdict(int)
        for event in pageviews:
            referrer = event.get('referrer') or 'Direct'
            referrer_counts[referrer] += 1

        referrer_stats = [
            {"referrer": ref, "count": count}
            for ref, count in sorted(referrer_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        ]

        # Device stats
        device_counts = defaultdict(int)
        for event in events:
            user_agent = event.get('user_agent') or ''
            if 'Mobile' in user_agent:
                device = 'Mobile'
            elif 'Tablet' in user_agent:
                device = 'Tablet'
            else:
                device = 'Desktop'
            device_counts[device] += 1

        device_stats = [{"device": device, "count": count} for device, count in device_counts.items()]

        # Click heatmap
        click_events = [e for e in events if e['event_type'] == 'click']
        click_heatmap = [
            {
                "x": e['metadata'].get('click_x', 0),
                "y": e['metadata'].get('click_y', 0),
                "url": e.get('url')
            }
            for e in click_events if e.get('metadata')
        ]

        # User journey
        user_journeys = defaultdict(list)
        sorted_pageviews = sorted(pageviews, key=lambda x: x['created_at'])
        for event in sorted_pageviews:
            user_id = event.get('user_id')
            if user_id:
                user_journeys[user_id].append({
                    "url": event['url'],
                    "timestamp": event['created_at'].isoformat(),
                    "title": event.get('title')
                })

        top_journeys = [
            {"user_id": user_id, "pages": pages[:10]}
            for user_id, pages in list(user_journeys.items())[:5]
        ]

        # Performance metrics (avg load time)
        perf_events = [e for e in events if e['event_type'] == 'page_performance']
        load_times = [e['metadata'].get('load_time') for e in perf_events if e.get('metadata') and e['metadata'].get('load_time') is not None]
        avg_load_time = round(sum(load_times) / len(load_times)) if load_times else 0


        # Real-time visitors (last 5 minutes)
        real_time_threshold = datetime.utcnow() - timedelta(minutes=5)
        real_time_query = """
            SELECT DISTINCT user_id
            FROM events
            WHERE site_id = $1 AND created_at >= $2
        """
        rt_rows = await conn.fetch(real_time_query, site_id, real_time_threshold)
        real_time_visitors = len(rt_rows)

        return {
            "site_id": site_id,
            "total_pageviews": len(pageviews),
            "unique_visitors": unique_visitors,
            "total_sessions": unique_sessions,
            "bounce_rate": 0.0,
            "avg_session_duration": 0.0,
            "top_pages": top_pages,
            "referrer_stats": referrer_stats,
            "device_stats": device_stats,
            "real_time_visitors": real_time_visitors,
            "button_clicks": len(button_clicks),
            "form_submissions": len(form_submissions),
            "error_count": len(errors),
            "avg_load_time": avg_load_time,
            "click_heatmap": click_heatmap,
            "user_journey": top_journeys
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get analytics: {str(e)}")
    finally:
        await request.app.state.db.release(conn)

@router.get("/analytics/{site_id}/heatmap/pages", response_model=List[str])
async def get_heatmap_pages(site_id: str, request: Request):
    """Get a list of unique page URLs that have click events for the heatmap."""
    conn = await request.app.state.db.acquire()
    try:
        query = """
            SELECT DISTINCT url
            FROM events
            WHERE site_id = $1 AND event_type = 'click' AND url IS NOT NULL
            ORDER BY url
        """
        rows = await conn.fetch(query, site_id)
        return [row["url"] for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get heatmap pages: {str(e)}")
    finally:
        await request.app.state.db.release(conn)

@router.get("/heatmap/clicks")
async def get_click_heatmap(
    request: Request,
    site_id: str = Query(...),
    page: str = Query(...),
    start_date: str = Query(None),
    end_date: str = Query(None),
):
    """Fetches click coordinates for a specific page to generate a heatmap."""
    conn = await request.app.state.db.acquire()
    try:
        end_dt = datetime.utcnow()
        start_dt = end_dt - timedelta(days=7)

        if start_date:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        if end_date:
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))

        query = """
            SELECT metadata->'click_x' as x, metadata->'click_y' as y
            FROM events
            WHERE site_id = $1 AND event_type = 'click' AND url = $2
              AND created_at BETWEEN $3 AND $4
              AND metadata ? 'click_x' AND metadata ? 'click_y'
        """
        rows = await conn.fetch(query, site_id, page, start_dt, end_dt)
        return [{"x": float(r["x"]), "y": float(r["y"])} for r in rows if r["x"] is not None and r["y"] is not None]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get click heatmap data: {str(e)}")
    finally:
        await request.app.state.db.release(conn)

@router.get("/analytics/{site_id}/scrollmap")
async def get_scrollmap_data(
    request: Request,
    site_id: str,
    page: str = Query(...),
    start_date: str = Query(None),
    end_date: str = Query(None),
):
    """Fetches scroll depth data for a specific page."""
    conn = await request.app.state.db.acquire()
    try:
        end_dt = datetime.utcnow()
        start_dt = end_dt - timedelta(days=7)

        if start_date:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        if end_date:
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))

        query = """
            SELECT session_id, MAX(CAST(metadata->>'scroll_percentage' AS INTEGER)) as max_depth
            FROM events
            WHERE site_id = $1
              AND event_type = 'scroll_depth'
              AND url = $2
              AND created_at BETWEEN $3 AND $4
              AND metadata ? 'scroll_percentage'
            GROUP BY session_id
        """
        rows = await conn.fetch(query, site_id, page, start_dt, end_dt)
        if not rows:
            return []

        scroll_bins = defaultdict(int)
        for row in rows:
            for i in range(0, row['max_depth'] + 1, 5): # Bin in 5% increments
                scroll_bins[i] += 1

        return [{"y_percent": depth, "value": count, "total_sessions": len(rows)} for depth, count in scroll_bins.items()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get scrollmap data: {str(e)}")
    finally:
        await request.app.state.db.release(conn)

@router.get("/analytics/{site_id}/realtime")
async def get_realtime_analytics(site_id: str, request: Request):
    conn = await request.app.state.db.acquire()

    try:
        real_time_threshold = datetime.utcnow() - timedelta(minutes=30)

        # Active users (distinct user_id)
        active_users_query = """
            SELECT DISTINCT user_id
            FROM events
            WHERE site_id = $1 AND created_at >= $2
        """
        active_users_rows = await conn.fetch(active_users_query, site_id, real_time_threshold)
        active_users = len(active_users_rows)

        # Pageviews in last 30 minutes
        pageviews_query = """
            SELECT COUNT(*)
            FROM events
            WHERE site_id = $1 AND event_type = 'pageview' AND created_at >= $2
        """
        pageviews_row = await conn.fetchval(pageviews_query, site_id, real_time_threshold)
        pageviews = pageviews_row or 0

        # Button clicks in last 30 minutes
        button_clicks_query = """
            SELECT COUNT(*)
            FROM events
            WHERE site_id = $1 AND event_type = 'button_click' AND created_at >= $2
        """
        button_clicks_row = await conn.fetchval(button_clicks_query, site_id, real_time_threshold)
        button_clicks = button_clicks_row or 0

        # Errors in last 30 minutes
        errors_query = """
            SELECT COUNT(*)
            FROM events
            WHERE site_id = $1 AND event_type = 'javascript_error' AND created_at >= $2
        """
        errors_row = await conn.fetchval(errors_query, site_id, real_time_threshold)
        errors = errors_row or 0

        return {
            "site_id": site_id,
            "active_users": active_users,
            "pageviews": pageviews,
            "button_clicks": button_clicks,
            "errors": errors
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get realtime analytics: {str(e)}")
    finally:
        await request.app.state.db.release(conn)
