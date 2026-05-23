from app.modules.devices.dependencies import DeviceTagDecision, evaluate_device_tag


def test_device_tag_enforcement_allows_first_device_registration_window():
    assert evaluate_device_tag([], None) == DeviceTagDecision.ALLOWED


def test_device_tag_enforcement_requires_tag_after_device_exists():
    assert (
        evaluate_device_tag(["vp_dev_registered"], None)
        == DeviceTagDecision.REGISTRATION_REQUIRED
    )


def test_device_tag_enforcement_rejects_unknown_tag():
    assert (
        evaluate_device_tag(["vp_dev_registered"], "vp_dev_other")
        == DeviceTagDecision.INVALID
    )


def test_device_tag_enforcement_accepts_registered_tag():
    assert (
        evaluate_device_tag(["vp_dev_registered"], "vp_dev_registered")
        == DeviceTagDecision.ALLOWED
    )
