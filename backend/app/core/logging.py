import logging

LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s %(message)s"


def configure_logging(level: str) -> None:
    """Apply a single-line stdlib logging config to the root logger.

    force=True replaces handlers installed earlier so calling this twice
    (e.g. under uvicorn --reload) never duplicates output.
    """
    logging.basicConfig(level=level.upper(), format=LOG_FORMAT, force=True)
    # httpx logs every request URL at INFO; keep outbound calls to payment
    # providers out of the logs unless something is wrong.
    logging.getLogger("httpx").setLevel(logging.WARNING)
