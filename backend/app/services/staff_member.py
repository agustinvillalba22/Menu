import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.staff_member import StaffMember
from app.schemas.staff_member import StaffMemberCreate, StaffMemberUpdate
from app.services.crud import apply_patch, get_owned


async def create_staff_member(
    restaurant_id: uuid.UUID, data: StaffMemberCreate, session: AsyncSession
) -> StaffMember:
    member = StaffMember(
        restaurant_id=restaurant_id,
        name=data.name,
        position=data.position,
        pin=data.pin,
    )
    session.add(member)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="pin_taken")
    await session.refresh(member)
    return member


async def list_staff_members(
    restaurant_id: uuid.UUID, session: AsyncSession
) -> list[StaffMember]:
    result = await session.execute(
        select(StaffMember)
        .where(StaffMember.restaurant_id == restaurant_id)
        .order_by(StaffMember.name.asc())
    )
    return list(result.scalars().all())


async def get_staff_member(
    restaurant_id: uuid.UUID, staff_member_id: uuid.UUID, session: AsyncSession
) -> StaffMember:
    return await get_owned(
        session, StaffMember, restaurant_id, staff_member_id, "staff_member_not_found"
    )


async def update_staff_member(
    restaurant_id: uuid.UUID,
    staff_member_id: uuid.UUID,
    data: StaffMemberUpdate,
    session: AsyncSession,
) -> StaffMember:
    member = await get_staff_member(restaurant_id, staff_member_id, session)
    apply_patch(member, data.model_dump(exclude_unset=True))
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="pin_taken")
    await session.refresh(member)
    return member


async def delete_staff_member(
    restaurant_id: uuid.UUID, staff_member_id: uuid.UUID, session: AsyncSession
) -> None:
    member = await get_staff_member(restaurant_id, staff_member_id, session)
    await session.delete(member)
    await session.commit()


async def get_active_staff_member(
    restaurant_id: uuid.UUID, staff_member_id: uuid.UUID, session: AsyncSession
) -> StaffMember:
    """Like get_staff_member, but 422 staff_member_inactive if deactivated."""
    member = await get_staff_member(restaurant_id, staff_member_id, session)
    if not member.active:
        raise HTTPException(status_code=422, detail="staff_member_inactive")
    return member
