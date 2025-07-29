#handles API requests related to data export
from fastapi import APIRouter, Request, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Request, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import datetime
import io
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from .analytics import get_analytics

import io
from .analytics import get_analytics

router = APIRouter()

@router.get("/analytics/{site_id}/export/csv")
async def export_analytics_csv(
    site_id: str,
    request: Request,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    try:
        analytics = await get_analytics(site_id, request, start_date, end_date)

        output = io.StringIO()
        output.write("Web Analytics Report\n")
        output.write(f"Site ID: {site_id}\n")
        output.write(f"Export Date: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}\n")
        output.write(f"Date Range: {start_date or 'Last 7 days'} to {end_date or 'Now'}\n\n")
        output.write("Summary Metrics\nMetric,Value\n")
        output.write(f"Total Pageviews,{analytics['total_pageviews']}\n")
        output.write(f"Unique Visitors,{analytics['unique_visitors']}\n")
        output.write(f"Total Sessions,{analytics['total_sessions']}\n")
        output.write(f"Button Clicks,{analytics['button_clicks']}\n")
        output.write(f"Form Submissions,{analytics['form_submissions']}\n")
        output.write(f"JavaScript Errors,{analytics['error_count']}\n")
        output.write(f"Average Load Time (ms),{analytics['avg_load_time']}\n\n")

        output.write("Top Pages\nURL,Views\n")
        for page in analytics['top_pages']:
            output.write(f"\"{page['url']}\",{page['views']}\n")
        output.write("\n")

        output.write("Top Referrers\nReferrer,Count\n")
        for ref in analytics['referrer_stats']:
            output.write(f"\"{ref['referrer']}\",{ref['count']}\n")
        output.write("\n")

        output.write("Device Breakdown\nDevice,Count\n")
        for device in analytics['device_stats']:
            output.write(f"{device['device']},{device['count']}\n")

        output.seek(0)
        response = StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=analytics_{site_id}_{datetime.utcnow().strftime('%Y%m%d')}.csv"}
        )
        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export CSV: {str(e)}")




@router.get("/analytics/{site_id}/export/pdf")
async def export_analytics_pdf(
    site_id: str,
    request: Request,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    try:
        analytics = await get_analytics(site_id, request, start_date, end_date)

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.navy,
            spaceAfter=30
        )

        story = []

        story.append(Paragraph("Web Analytics Report", title_style))
        story.append(Spacer(1, 12))

        summary_data = [
            ["Site ID", site_id],
            ["Export Date", datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')],
            ["Date Range", f"{start_date or 'Last 7 days'} to {end_date or 'Now'}"]
        ]
        summary_table = Table(summary_data, colWidths=[2*inch, 4*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 14),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 20))

        story.append(Paragraph("Summary Metrics", styles['Heading2']))
        metrics_data = [
            ["Metric", "Value"],
            ["Total Pageviews", str(analytics['total_pageviews'])],
            ["Unique Visitors", str(analytics['unique_visitors'])],
            ["Total Sessions", str(analytics['total_sessions'])],
            ["Button Clicks", str(analytics['button_clicks'])],
            ["Form Submissions", str(analytics['form_submissions'])],
            ["JavaScript Errors", str(analytics['error_count'])],
            ["Average Load Time (ms)", str(analytics['avg_load_time'])]
        ]

        metrics_table = Table(metrics_data, colWidths=[3*inch, 2*inch])
        metrics_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(metrics_table)
        story.append(Spacer(1, 20))

        if analytics['top_pages']:
            story.append(Paragraph("Top Pages", styles['Heading2']))
            pages_data = [["URL", "Views"]]
            for page in analytics['top_pages'][:10]:
                url_display = page['url'][:50] + "..." if len(page['url']) > 50 else page['url']
                pages_data.append([url_display, str(page['views'])])

            pages_table = Table(pages_data, colWidths=[4*inch, 1*inch])
            pages_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(pages_table)

        doc.build(story)
        buffer.seek(0)

        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=analytics_{site_id}_{datetime.utcnow().strftime('%Y%m%d')}.pdf"}
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export PDF: {str(e)}")
