import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.restaurant import RestaurantRole
from app.models.user import User
from app.schemas.supplier import SupplierCreate, SupplierRead, SupplierUpdate
from app.services.supplier import (
    create_supplier,
    delete_supplier,
    list_suppliers,
    update_supplier,
)

router = APIRouter()


@router.post("/{restaurant_id}/suppliers", response_model=SupplierRead, status_code=201)
async def create(
    restaurant_id: uuid.UUID,
    data: SupplierCreate,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> SupplierRead:
    supplier = await create_supplier(restaurant_id, data, session)
    return SupplierRead.model_validate(supplier)


@router.get("/{restaurant_id}/suppliers", response_model=list[SupplierRead], status_code=200)
async def list_all(
    restaurant_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> list[SupplierRead]:
    suppliers = await list_suppliers(restaurant_id, session)
    return [SupplierRead.model_validate(s) for s in suppliers]


@router.patch(
    "/{restaurant_id}/suppliers/{supplier_id}", response_model=SupplierRead, status_code=200
)
async def patch(
    restaurant_id: uuid.UUID,
    supplier_id: uuid.UUID,
    data: SupplierUpdate,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> SupplierRead:
    supplier = await update_supplier(restaurant_id, supplier_id, data, session)
    return SupplierRead.model_validate(supplier)


@router.delete("/{restaurant_id}/suppliers/{supplier_id}", status_code=204)
async def delete(
    restaurant_id: uuid.UUID,
    supplier_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> None:
    await delete_supplier(restaurant_id, supplier_id, session)
