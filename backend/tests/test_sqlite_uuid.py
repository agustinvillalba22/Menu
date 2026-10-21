import uuid

from sqlalchemy import select

from app.models.restaurant import Restaurant

# 32 hex chars made of digits and a single "e": SQLite reads it as a number
# when the column has NUMERIC affinity.
NUMERIC_LOOKING_ID = uuid.UUID("12345678-1234-4234-8234-12345678e123")


async def test_uuid_that_looks_like_a_number_round_trips(db_session):
    db_session.add(Restaurant(id=NUMERIC_LOOKING_ID, name="R", slug="numeric-id"))
    await db_session.commit()
    db_session.expire_all()

    found = (await db_session.execute(select(Restaurant))).scalar_one()

    assert found.id == NUMERIC_LOOKING_ID
