# Sentry Proxy - Forwards events to Sentry from mobile clients
# This avoids tracking prevention blockers that block o4511113586409472.ingest.de.sentry.io
# Clients send events to our backend domain which is not blocked

from fastapi import APIRouter, Request, Response, status
from fastapi.responses import JSONResponse
import httpx
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Sentry envelope endpoint
SENTRY_ENVELOPE_URL = (
    f'https://o4511113586409472.ingest.de.sentry.io'
    f'/api/4511114011410512/envelope/'
)


@router.post(
    '/sentry-proxy',
    tags=['sentry'],
    summary='Sentry Event Proxy',
    description=(
        'Proxies Sentry events from mobile/web clients to avoid '
        'tracking prevention blockers. Events are forwarded to Sentry '
        'API server-side where they are not blocked.'
    ),
)
async def sentry_proxy(request: Request) -> Response:
    try:
        # Receive envelope directly (x-sentry-envelope format)
        body = await request.body()
        if not body:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={'error': 'Empty request body'},
            )
        
        # Extract sentry_key from query params to forward
        sentry_key = request.query_params.get('sentry_key', '')
        sentry_version = request.query_params.get('sentry_version', '7')
        sentry_client = request.query_params.get('sentry_client', '')
        
        # Build the target URL with query params
        target_url = SENTRY_ENVELOPE_URL
        params = {
            'sentry_version': sentry_version,
            'sentry_key': sentry_key,
            'sentry_client': sentry_client,
        }
        
        # Forward to Sentry using server-side HTTP client (not blocked)
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                target_url,
                content=body,
                params=params,
                headers={
                    'Content-Type': 'application/x-sentry-envelope',
                    'User-Agent': 'VeriPass-Sentry-Proxy/1.0',
                },
            )
        
        # Log for debugging
        logger.info(
            f'Sentry proxy: forwarded event, '
            f'status={response.status_code}, '
            f'size={len(body)} bytes'
        )
        
        return Response(
            content=response.content,
            status_code=response.status_code,
            headers=dict(response.headers),
        )
        
    except httpx.TimeoutException:
        logger.error('Sentry proxy: timeout forwarding event')
        return JSONResponse(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            content={'error': 'Timeout forwarding to Sentry'},
        )
    except httpx.RequestError as e:
        logger.error(f'Sentry proxy: request error: {e}')
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={'error': f'Failed to forward to Sentry: {str(e)}'},
        )
    except Exception as e:
        logger.exception(f'Sentry proxy: unexpected error: {e}')
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={'error': str(e)},
        )


@router.get('/sentry-proxy/health', tags=['sentry'])
async def sentry_proxy_health():
    return {'status': 'ok', 'service': 'sentry-proxy'}