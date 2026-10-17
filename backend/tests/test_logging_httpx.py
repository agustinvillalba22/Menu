import logging

from app.core.logging import configure_logging


def test_configure_logging_silences_httpx_info():
    configure_logging("INFO")
    assert logging.getLogger("httpx").getEffectiveLevel() >= logging.WARNING
