from app.modules.support.router import router


def test_stale_pwa_support_messages_compat_route_is_removed():
    paths = [route.path for route in router.routes]

    assert "/threads/messages" not in paths
    assert "/threads/{thread_id}/messages" in paths
