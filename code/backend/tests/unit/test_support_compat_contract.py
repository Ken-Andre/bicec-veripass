from app.modules.support.router import router


def test_stale_pwa_support_messages_compat_route_exists_before_uuid_route():
    paths = [route.path for route in router.routes]

    assert "/threads/messages" in paths
    assert "/threads/{thread_id}/messages" in paths
    assert paths.index("/threads/messages") < paths.index("/threads/{thread_id}/messages")
