import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.models.restaurant import Restaurant
from app.models.supplier import Supplier
from app.services.crud import apply_patch, get_owned


async def _restaurant_with_supplier(db_session):
    restaurant = Restaurant(name="R", slug=f"r-{uuid.uuid4().hex[:8]}")
    db_session.add(restaurant)
    await db_session.flush()
    supplier = Supplier(restaurant_id=restaurant.id, name="Distribuidora")
    db_session.add(supplier)
    await db_session.flush()
    return restaurant, supplier


async def test_get_owned_returns_the_row_of_that_restaurant(db_session):
    restaurant, supplier = await _restaurant_with_supplier(db_session)

    found = await get_owned(db_session, Supplier, restaurant.id, supplier.id, "supplier_not_found")

    assert found.id == supplier.id


async def test_get_owned_hides_rows_of_other_restaurants(db_session):
    _, supplier = await _restaurant_with_supplier(db_session)

    with pytest.raises(HTTPException) as exc:
        await get_owned(db_session, Supplier, uuid.uuid4(), supplier.id, "supplier_not_found")

    assert exc.value.status_code == 404
    assert exc.value.detail == "supplier_not_found"


async def test_get_owned_404_when_the_row_does_not_exist(db_session):
    restaurant, _ = await _restaurant_with_supplier(db_session)

    with pytest.raises(HTTPException) as exc:
        await get_owned(db_session, Supplier, restaurant.id, uuid.uuid4(), "supplier_not_found")

    assert exc.value.detail == "supplier_not_found"


def test_apply_patch_sets_every_field_including_none():
    obj = SimpleNamespace(name="a", notes="x")

    apply_patch(obj, {"name": "b", "notes": None})

    assert (obj.name, obj.notes) == ("b", None)


def test_apply_patch_skip_none_ignores_explicit_nulls():
    obj = SimpleNamespace(name="a", notes="x")

    apply_patch(obj, {"name": None, "notes": "y"}, skip_none=True)

    assert (obj.name, obj.notes) == ("a", "y")
