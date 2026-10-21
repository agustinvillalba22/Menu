import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.restaurant import RestaurantRole
from app.models.user import User
from app.schemas.table import (
    TableCheckoutRequest,
    TableCreate,
    TableOccupancyRead,
    TableRead,
    TableUpdate,
)
from app.services.table import (
    checkout_table,
    create_table,
    delete_table,
    list_occupancy,
    list_tables,
    request_bill,
    update_table,
)

router = APIRouter()


@router.post("/{restaurant_id}/tables", response_model=TableRead, status_code=201)
async def create(
    restaurant_id: uuid.UUID,
    data: TableCreate,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> TableRead:
    table = await create_table(restaurant_id, data, session)
    return TableRead.model_validate(table)


@router.get("/{restaurant_id}/tables", response_model=list[TableRead], status_code=200)
async def list_all(
    restaurant_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> list[TableRead]:
    tables = await list_tables(restaurant_id, session)
    return [TableRead.model_validate(t) for t in tables]


@router.get(
    "/{restaurant_id}/tables/occupancy",
    response_model=list[TableOccupancyRead],
    status_code=200,
)
async def occupancy(
    restaurant_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> list[TableOccupancyRead]:
    return await list_occupancy(restaurant_id, session)


@router.post(
    "/{restaurant_id}/tables/{table_id}/bill-request",
    response_model=TableOccupancyRead,
    status_code=200,
)
async def bill_request(
    restaurant_id: uuid.UUID,
    table_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> TableOccupancyRead:
    return await request_bill(restaurant_id, table_id, session)


@router.post(
    "/{restaurant_id}/tables/{table_id}/checkout",
    response_model=TableOccupancyRead,
    status_code=200,
)
async def checkout(
    restaurant_id: uuid.UUID,
    table_id: uuid.UUID,
    data: TableCheckoutRequest | None = None,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> TableOccupancyRead:
    staff_id = data.staff_member_id if data else None
    return await checkout_table(restaurant_id, table_id, staff_id, session)


@router.patch(
    "/{restaurant_id}/tables/{table_id}", response_model=TableRead, status_code=200
)
async def patch(
    restaurant_id: uuid.UUID,
    table_id: uuid.UUID,
    data: TableUpdate,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> TableRead:
    table = await update_table(restaurant_id, table_id, data, session)
    return TableRead.model_validate(table)


@router.delete("/{restaurant_id}/tables/{table_id}", status_code=204)
async def delete(
    restaurant_id: uuid.UUID,
    table_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> None:
    await delete_table(restaurant_id, table_id, session)
