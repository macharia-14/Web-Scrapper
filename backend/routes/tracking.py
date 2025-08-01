import os
import json
from uuid import uuid4
from datetime import datetime
import asyncpg
import ipaddress
import ipinfo
import asyncio
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import PlainTextResponse
from fastapi import BackgroundTasks

from backend.routes.alert import check_alerts

router = APIRouter()

# Initialize IPInfo client
def get_ipinfo_client():
    """Get IPInfo client with token from environment"""
    ipinfo_token = os.environ.get('IPINFO_TOKEN')
    if ipinfo_token:
        return ipinfo.getHandler(ipinfo_token)
    return None

@router.get("/tracking-script/{site_id}")
async def get_tracking_script(site_id: str):
    """Generate the enhanced tracking script for a specific site"""
    backend_url = os.environ.get('TRACKER_BACKEND_URL', 'http://localhost:8001')

    script_content = f"""(function() {{
    'use strict';

    const SITE_ID = '{site_id}';
    const API_BASE = '{backend_url}/api';

    let sessionId = sessionStorage.getItem('tracker_session_id');
    if (!sessionId) {{
        sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        sessionStorage.setItem('tracker_session_id', sessionId);
    }}

    let userId = localStorage.getItem('tracker_user_id');
    if (!userId) {{
        userId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('tracker_user_id', userId);
    }}

    function trackEvent(eventType, metadata = {{}}) {{
        const data = {{
            site_id: SITE_ID,
            session_id: sessionId,
            user_id: userId,
            event_type: eventType,
            url: window.location.href,
            title: document.title,
            referrer: document.referrer,
            user_agent: navigator.userAgent,
            metadata: metadata,
            ...metadata
        }};

        if (navigator.sendBeacon) {{
            const blob = new Blob([JSON.stringify(data)], {{type: 'application/json'}});
            navigator.sendBeacon(API_BASE + '/track', blob);
        }} else {{
            fetch(API_BASE + '/track', {{
                method: 'POST',
                headers: {{
                    'Content-Type': 'application/json',
                }},
                body: JSON.stringify(data),
                keepalive: true
            }}).catch(err => console.error('Tracking failed:', err));
        }}
    }}

    trackEvent('pageview');

    document.addEventListener('click', function(e) {{
        const element = e.target;
        trackEvent('click', {{
            element_id: element.id || null,
            element_class: element.className || null,
            element_text: element.textContent ? element.textContent.substring(0, 100) : null,
            click_x: e.clientX,
            click_y: e.clientY,
            element_tag: element.tagName,
            element_type: element.type || null,
            href: element.href || null
        }});

        if (element.tagName === 'BUTTON' || element.type === 'button' || element.type === 'submit') {{
            trackEvent('button_click', {{
                element_id: element.id || null,
                element_class: element.className || null,
                element_text: element.textContent ? element.textContent.substring(0, 100) : null,
                button_type: element.type || 'button'
            }});
        }}

        if (element.tagName === 'A' && element.href) {{
            trackEvent('link_click', {{
                element_id: element.id || null,
                element_text: element.textContent ? element.textContent.substring(0, 100) : null,
                href: element.href,
                is_external: !element.href.includes(window.location.hostname)
            }});
        }}
    }});

    let maxScroll = 0;
    let scrollTracked = {{}};
    window.addEventListener('scroll', function() {{
        const scrollPercent = Math.round((window.scrollY + window.innerHeight) / document.body.scrollHeight * 100);
        if (scrollPercent > maxScroll) {{
            maxScroll = scrollPercent;
            [25, 50, 75, 100].forEach(threshold => {{
                if (scrollPercent >= threshold && !scrollTracked[threshold]) {{
                    scrollTracked[threshold] = true;
                    trackEvent('scroll', {{
                        scroll_depth: threshold,
                        max_scroll: maxScroll
                    }});
                }}
            }});
        }}
    }});

    document.addEventListener('submit', function(e) {{
        const form = e.target;
        trackEvent('form_submit', {{
            form_id: form.id || null,
            form_class: form.className || null,
            form_action: form.action || null,
            form_method: form.method || 'get',
            field_count: form.elements.length
        }});
    }});

    let startTime = Date.now();
    let timeTracked = false;

    window.addEventListener('beforeunload', function() {{
        if (!timeTracked) {{
            const timeOnPage = Math.round((Date.now() - startTime) / 1000);
            trackEvent('time_on_page', {{
                time_on_page: timeOnPage,
                duration: timeOnPage
            }});
            timeTracked = true;
        }}
    }});

    document.addEventListener('visibilitychange', function() {{
        if (document.hidden) {{
            const timeOnPage = Math.round((Date.now() - startTime) / 1000);
            trackEvent('page_hidden', {{
                time_on_page: timeOnPage,
                duration: timeOnPage
            }});
        }} else {{
            startTime = Date.now();
            trackEvent('page_visible');
        }}
    }});

    window.addEventListener('error', function(e) {{
        trackEvent('javascript_error', {{
            error_message: e.message,
            error_filename: e.filename,
            error_line: e.lineno,
            error_column: e.colno
        }});
    }});

    window.addEventListener('load', function() {{
        setTimeout(function() {{
            const perfData = performance.getEntriesByType('navigation')[0];
            trackEvent('page_performance', {{
                load_time: Math.round(perfData.loadEventEnd - perfData.navigationStart),
                dom_ready: Math.round(perfData.domContentLoadedEventEnd - perfData.navigationStart),
                first_paint: Math.round(perfData.responseEnd - perfData.requestStart)
            }});
        }}, 1000);
    }});

    window.webTracker = {{
        track: trackEvent,
        getSiteId: () => SITE_ID,
        getSessionId: () => sessionId,
        getUserId: () => userId,
        trackCustomEvent: (eventName, data) => trackEvent('custom_event', {{ event_name: eventName, ...data }})
    }};
}})();
"""

    return PlainTextResponse(
        script_content,
        media_type="application/javascript",
        headers={
            "Cache-Control": "public, max-age=3600"
        }
    )

async def get_location_data(ip_address: str):
    """Get location data from IPInfo API using official library"""
    try:
        # Skip private/local IPs
        ip_obj = ipaddress.ip_address(ip_address)
        # For testing only — allow IP lookup even for localhost
        # WARNING: This will give inaccurate results if the IP is local
        # Remove or revert this when deploying!
        # if ip_obj.is_private or ip_obj.is_loopback:
        #     return None

            
        # Get IPInfo client
        handler = get_ipinfo_client()
        if not handler:
            return None
            
        # The IPInfo library is synchronous, so we run it in a thread pool
        def get_ip_details():
            return handler.getDetails(ip_address)
        
        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        details = await loop.run_in_executor(None, get_ip_details)
        
        # Convert IPInfo Details object to dictionary
        data = details.all  # .all gives all fields as a dict

        return {
            'ip': data.get("ip"),
            'city': data.get("city"),
            'region': data.get("region"),
            'country': data.get("country"),
            'country_name': data.get("country_name"),
            'loc': data.get("loc"),
            'org': data.get("org"),
            'timezone': data.get("timezone"),
            'postal': data.get("postal"),
            'hostname': data.get("hostname"),
            'asn': data.get("asn", {}).get("asn") if data.get("asn") else None,
            'company': data.get("company", {}).get("name") if data.get("company") else None,
            'carrier': data.get("carrier", {}).get("name") if data.get("carrier") else None,
            'privacy': data.get("privacy", {}).get("vpn") if data.get("privacy") else None,
            'abuse': data.get("abuse", {}).get("email") if data.get("abuse") else None,
            'domains': data.get("domains", {}).get("total") if data.get("domains") else None
        }

        
    except Exception as e:
        print(f"IPInfo lookup failed: {e}")
        return None

@router.post("/api/track")
async def track_event(request: Request, background_tasks: BackgroundTasks):
    try:
        data = await request.json()

        client_ip = request.headers.get("x-forwarded-for", request.client.host)
        # print("📥 Incoming tracking data:")
        print(json.dumps(data, indent=2))
        # Get client IP
        
        # print(f"📍 Client IP: {client_ip}")
        if "x-forwarded-for" in request.headers:
            client_ip = request.headers["x-forwarded-for"].split(",")[0].strip()
        elif "x-real-ip" in request.headers:
            client_ip = request.headers["x-real-ip"]
        
        # Get location data using IPInfo
        location_data = await get_location_data(client_ip)
        print(f"IPInfo data for {client_ip}: {json.dumps(location_data, indent=2)}")


        # Extract location data with defaults
        ip_city = None
        ip_region = None
        ip_country = None
        ip_timezone = None
        ip_org = None
        ip_latitude = None
        ip_longitude = None
        
        if location_data:
            ip_city = location_data.get("city")
            ip_region = location_data.get("region")
            ip_country = location_data.get("country")
            ip_timezone = location_data.get("timezone")
            ip_org = location_data.get("org")
            
            # Parse coordinates if available
            loc = location_data.get("loc")
            if loc and "," in loc:
                try:
                    lat, lng = loc.split(",")
                    ip_latitude = float(lat.strip())
                    ip_longitude = float(lng.strip())
                except (ValueError, AttributeError):
                    pass

        # Database query with existing columns
        query = """
        INSERT INTO events (
            id, site_id, event_type, session_id, user_id, url, title,
            referrer, user_agent, metadata, created_at,
            ip_address, ip_city, ip_region, ip_country, ip_timezone, 
            ip_org, ip_latitude, ip_longitude
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
        )
        """

        values = (
            str(uuid4()),
            data.get("site_id"),
            data.get("event_type"),
            data.get("session_id"),
            data.get("user_id"),
            data.get("url"),
            data.get("title"),
            data.get("referrer"),
            data.get("user_agent"),
            json.dumps(data.get("metadata", {})),
            datetime.utcnow(),
            client_ip,
            ip_city,
            ip_region,
            ip_country,
            ip_timezone,
            ip_org,
            ip_latitude,
            ip_longitude
        )

        print("Values to insert:", values)


        async with request.app.state.db.acquire() as conn:
            await conn.execute(query, *values)

        # Trigger alert checks in the background
        site_id = data.get("site_id")
        if site_id:
            background_tasks.add_task(check_alerts, request.app.state.db, site_id, data)

        return {"status": "ok"}

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Tracking error: {str(e)}")