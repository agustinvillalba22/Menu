import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.restaurant import RestaurantRole
from app.models.user import User
from app.schemas.staff_member import StaffMemberCreate, StaffMemberRead, StaffMemberUpdate
from app.services.staff_member import (
    create_staff_member,
    delete_staff_member,
    list_staff_members,
    update_staff_member,
)

router = APIRouter()


@router.post("/{restaurant_id}/staff", response_model=StaffMemberRead, status_code=201)
async def create(
    restaurant_id: uuid.UUID,
    data: StaffMemberCreate,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> StaffMemberRead:
    member = await create_staff_member(restaurant_id, data, session)
    return StaffMemberRead.model_validate(member)


@router.get("/{restaurant_id}/staff", response_model=list[StaffMemberRead], status_code=200)
async def list_all(
    restaurant_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> list[StaffMemberRead]:
    members = await list_staff_members(restaurant_id, session)
    return [StaffMemberRead.model_validate(m) for m in members]


@router.patch(
    "/{restaurant_id}/staff/{staff_member_id}", response_model=StaffMemberRead, status_code=200
)
async def patch(
    restaurant_id: uuid.UUID,
    staff_member_id: uuid.UUID,
    data: StaffMemberUpdate,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> StaffMemberRead:
    member = await update_staff_member(restaurant_id, staff_member_id, data, session)
    return StaffMemberRead.model_validate(member)


@router.delete("/{restaurant_id}/staff/{staff_member_id}", status_code=204)
async def delete(
    restaurant_id: uuid.UUID,
    staff_member_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> None:
    await delete_staff_member(restaurant_id, staff_member_id, session)
