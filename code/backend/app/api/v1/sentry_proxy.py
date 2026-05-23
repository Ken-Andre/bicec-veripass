# sentry_proxy.py — Fire-and-forget Sentry tunnel
#
# Problem: The Sentry ingest domain (ingest.de.sentry.io) is blocked by ad-blockers.
# Solution: Clients POST envelopes to our backend, which forwards server-side.
#
# Critical design choice — NON-BLOCKING:
#   The original blocking implementation caused 504s because httpx waited for Sentry's
#   response (up to 10s timeout) before returning anything to the client. With
#   BackgroundTasks we respond 202 instantly; Sentry forwarding happens after.
#   If the container's outbound connection to Sentry is slow/broken the user never sees it.

from fastapi import APIRouter, BackgroundTasks, Request, Response, status
from fastapi.responses import JSONResponse
import httpx
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Sentry envelope endpoint (server-side calls are not blocked by browser extensions)
SENTRY_ENVELOPE_URL = (
    'https://o4511113586409472.ingest.de.sentry.io'
    '/api/4511114011410512/envelope/'
)

# Generous timeout for the background task — the client is not waiting
_HTTPX_TIMEOUT = 30.0


async def _forward_to_sentry(
    body: bytes,
    sentry_key: str,
    sentry_version: str,
    sentry_client: str,
) -> None:
    """Background coroutine — forwards the Sentry envelope server-side.

    Failures are logged but never propagate to the client (it already got 202).
    """
    params = {
        'sentry_version': sentry_version,
        'sentry_key': sentry_key,
        'sentry_client': sentry_client,
    }
    try:
        async with httpx.AsyncClient(timeout=_HTTPX_TIMEOUT) as client:
            response = await client.post(
                SENTRY_ENVELOPE_URL,
                content=body,
                params=params,
                headers={
                    'Content-Type': 'application/x-sentry-envelope',
                    'User-Agent': 'VeriPass-Sentry-Proxy/2.0',
                },
            )
        logger.info(
            'Sentry proxy: forwarded envelope '
            f'status={response.status_code} size={len(body)}B'
        )
    except httpx.TimeoutException:
        logger.warning('Sentry proxy: timeout forwarding envelope (Sentry slow/unreachable)')
    except httpx.RequestError as exc:
        logger.warning(f'Sentry proxy: network error forwarding envelope: {exc}')
    except Exception as exc:  # noqa: BLE001
        logger.exception(f'Sentry proxy: unexpected error: {exc}')


@router.post(
    '/sentry-proxy',
    status_code=status.HTTP_202_ACCEPTED,
    tags=['sentry'],
    summary='Sentry Event Proxy (fire-and-forget)',
    description=(
        'Accepts Sentry envelopes from browser clients and forwards them '
        'to Sentry server-side (not blocked by ad-blockers). '
        'Returns 202 immediately; forwarding happens in a background task.'
    ),
)
async def sentry_proxy(request: Request, background_tasks: BackgroundTasks) -> Response:
    body = await request.body()
    if not body:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={'error': 'Empty request body'},
        )

    sentry_key = request.query_params.get('sentry_key', '')
    sentry_version = request.query_params.get('sentry_version', '7')
    sentry_client = request.query_params.get('sentry_client', '')

    # Schedule forwarding AFTER we return — client gets 202 immediately
    background_tasks.add_task(
        _forward_to_sentry,
        body,
        sentry_key,
        sentry_version,
        sentry_client,
    )

    logger.debug(f'Sentry proxy: queued envelope for forwarding ({len(body)}B)')
    return Response(status_code=status.HTTP_202_ACCEPTED)


@router.get('/sentry-proxy/health', tags=['sentry'])
async def sentry_proxy_health() -> dict:
    return {'status': 'ok', 'service': 'sentry-proxy'}