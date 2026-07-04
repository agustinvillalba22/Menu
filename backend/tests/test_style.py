"""
Tests for M8 — Style endpoint (owner-facing): GET/PATCH /restaurants/{id}/style.

Cubre la SPEC "Style endpoint (owner-facing)" de
.agents/specs/M8_dashboard_menu_publico.md (CA-01 .. CA-08) más los casos de
error de las tablas de contrato (401, 404 legacy) y bordes de validación.

asyncio_mode=auto via pytest.ini — sin @pytest.mark.asyncio.

Identidad en los tests: igual que test_restaurant.py. El cliente httpx persiste
la cookie httpOnly de /auth/register y get_current_user le da precedencia sobre
el header Authorization; ``as_user`` limpia las cookies y devuelve el header
Bearer para que el header controle la identidad.
"""
import uuid

from httpx import AsyncClient
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.restaurant import RestaurantRole, UserRestaurantRole
from app.models.style import MenuStyle
from app.models.user import User


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def as_user(
    client: AsyncClient,
    email: str = "owner@example.com",
    password: str = "password123",
    full_name: str = "Owner User",
) -> dict:
    """Registra un usuario y devuelve el header Authorization para actuar como él."""
    res = await client.post(
        "/auth/register",
        json={"email": email, "password": password, "full_name": full_name},
    )
    token = res.json()["access_token"]
    client.cookies.clear()
    return {"Authorization": f"Bearer {token}"}


async def get_user_by_email(email: str, session: AsyncSession) -> User:
    result = await session.execute(select(User).where(User.email == email))
    return result.scalar_one()


async def create_restaurant_as_owner(
    client: AsyncClient, name: str = "My Bar", email: str = "owner@example.com"
) -> tuple[str, str, dict]:
    """Crea un restaurant y devuelve (restaurant_id, qr_token, owner_headers)."""
    owner_headers = await as_user(client, email=email)
    res = await client.post("/restaurants", json={"name": name}, headers=owner_headers)
    assert res.status_code == 201, res.text
    body = res.json()
    return body["id"], body["qr_token"], owner_headers


async def add_editor(
    client: AsyncClient,
    db_session: AsyncSession,
    restaurant_id: str,
    email: str = "editor@example.com",
) -> dict:
    """Registra un editor, le asigna rol editor sobre el restaurant, devuelve headers."""
    editor_headers = await as_user(client, email=email, full_name="Editor User")
    editor = await get_user_by_email(email, db_session)
    db_session.add(
        UserRestaurantRole(
            user_id=editor.id,
            restaurant_id=uuid.UUID(restaurant_id),
            role=RestaurantRole.editor,
        )
    )
    await db_session.commit()
    return editor_headers


# ---------------------------------------------------------------------------
# CA-01: crear restaurant → GET style responde 200 con defaults
# ---------------------------------------------------------------------------


async def test_new_restaurant_has_default_style(client: AsyncClient):
    restaurant_id, _, owner_headers = await create_restaurant_as_owner(client)

    res = await client.get(
        f"/restaurants/{restaurant_id}/style", headers=owner_headers
    )

    assert res.status_code == 200
    assert res.json() == {
        "font_family": "Inter",
        "primary_color": None,
        "secondary_color": None,
    }


async def test_create_restaurant_persists_menu_style_row(
    client: AsyncClient, db_session: AsyncSession
):
    """RF-01: create_restaurant crea la fila MenuStyle en la misma transacción."""
    restaurant_id, _, _ = await create_restaurant_as_owner(client)

    result = await db_session.execute(
        select(MenuStyle).where(
            MenuStyle.restaurant_id == uuid.UUID(restaurant_id)
        )
    )
    style = result.scalar_one()
    assert style.font_family.value == "Inter"
    assert style.primary_color is None
    assert style.secondary_color is None


# ---------------------------------------------------------------------------
# CA-02: owner PATCH primary_color → 200, otros campos sin cambios
# ---------------------------------------------------------------------------


async def test_owner_patch_primary_color_leaves_other_fields_untouched(
    client: AsyncClient,
):
    restaurant_id, _, owner_headers = await create_restaurant_as_owner(client)

    res = await client.patch(
        f"/restaurants/{restaurant_id}/style",
        json={"primary_color": "#112233"},
        headers=owner_headers,
    )

    assert res.status_code == 200
    assert res.json() == {
        "font_family": "Inter",  # sin cambios respecto al default previo
        "primary_color": "#112233",
        "secondary_color": None,  # sin cambios
    }


async def test_owner_patch_primary_color_persists(
    client: AsyncClient, db_session: AsyncSession
):
    restaurant_id, _, owner_headers = await create_restaurant_as_owner(client)

    await client.patch(
        f"/restaurants/{restaurant_id}/style",
        json={"primary_color": "#112233"},
        headers=owner_headers,
    )

    result = await db_session.execute(
        select(MenuStyle).where(
            MenuStyle.restaurant_id == uuid.UUID(restaurant_id)
        )
    )
    assert result.scalar_one().primary_color == "#112233"


# ---------------------------------------------------------------------------
# CA-03: PATCH secondary_color=null borra el color previamente seteado
# ---------------------------------------------------------------------------


async def test_owner_patch_null_clears_previously_set_color(client: AsyncClient):
    restaurant_id, _, owner_headers = await create_restaurant_as_owner(client)

    # Arrange: setear secondary_color primero.
    seeded = await client.patch(
        f"/restaurants/{restaurant_id}/style",
        json={"secondary_color": "#ABCDEF"},
        headers=owner_headers,
    )
    assert seeded.json()["secondary_color"] == "#ABCDEF"

    # Act: enviarlo explícitamente como null.
    res = await client.patch(
        f"/restaurants/{restaurant_id}/style",
        json={"secondary_color": None},
        headers=owner_headers,
    )

    assert res.status_code == 200
    assert res.json()["secondary_color"] is None


async def test_omitted_field_is_not_cleared(client: AsyncClient):
    """RF-04: un campo ausente en el body conserva su valor (no se pisa con null)."""
    restaurant_id, _, owner_headers = await create_restaurant_as_owner(client)

    # Arrange: setear primary_color.
    await client.patch(
        f"/restaurants/{restaurant_id}/style",
        json={"primary_color": "#AABBCC"},
        headers=owner_headers,
    )

    # Act: patchear solo font_family, sin mencionar primary_color.
    res = await client.patch(
        f"/restaurants/{restaurant_id}/style",
        json={"font_family": "Poppins"},
        headers=owner_headers,
    )

    assert res.status_code == 200
    body = res.json()
    assert body["font_family"] == "Poppins"
    assert body["primary_color"] == "#AABBCC"  # NO se borró por estar ausente


# ---------------------------------------------------------------------------
# CA-04: editor (no owner) PATCH → 403 insufficient_role
# ---------------------------------------------------------------------------


async def test_editor_cannot_patch_style(
    client: AsyncClient, db_session: AsyncSession
):
    restaurant_id, _, _ = await create_restaurant_as_owner(client)
    editor_headers = await add_editor(client, db_session, restaurant_id)

    res = await client.patch(
        f"/restaurants/{restaurant_id}/style",
        json={"primary_color": "#112233"},
        headers=editor_headers,
    )

    assert res.status_code == 403
    assert res.json()["detail"] == "insufficient_role"


async def test_editor_can_get_style(
    client: AsyncClient, db_session: AsyncSession
):
    """RF-02: GET requiere rol editor o superior — el editor SÍ puede leer."""
    restaurant_id, _, _ = await create_restaurant_as_owner(client)
    editor_headers = await add_editor(client, db_session, restaurant_id)

    res = await client.get(
        f"/restaurants/{restaurant_id}/style", headers=editor_headers
    )

    assert res.status_code == 200
    assert res.json()["font_family"] == "Inter"


# ---------------------------------------------------------------------------
# CA-05: usuario sin ningún rol → GET → 403 no_role
# ---------------------------------------------------------------------------


async def test_get_style_without_role_forbidden(client: AsyncClient):
    restaurant_id, _, _ = await create_restaurant_as_owner(client)

    stranger_headers = await as_user(client, email="stranger@example.com")
    res = await client.get(
        f"/restaurants/{restaurant_id}/style", headers=stranger_headers
    )

    assert res.status_code == 403
    assert res.json()["detail"] == "no_role"


async def test_patch_style_without_role_forbidden(client: AsyncClient):
    restaurant_id, _, _ = await create_restaurant_as_owner(client)

    stranger_headers = await as_user(client, email="stranger@example.com")
    res = await client.patch(
        f"/restaurants/{restaurant_id}/style",
        json={"primary_color": "#112233"},
        headers=stranger_headers,
    )

    assert res.status_code == 403
    assert res.json()["detail"] == "no_role"


# ---------------------------------------------------------------------------
# CA-06: PATCH font_family fuera del enum → 422
# ---------------------------------------------------------------------------


async def test_patch_invalid_font_family_returns_422(client: AsyncClient):
    restaurant_id, _, owner_headers = await create_restaurant_as_owner(client)

    res = await client.patch(
        f"/restaurants/{restaurant_id}/style",
        json={"font_family": "Comic Sans"},
        headers=owner_headers,
    )

    assert res.status_code == 422


# ---------------------------------------------------------------------------
# CA-07: PATCH color con formato no-hex → 422
# ---------------------------------------------------------------------------


async def test_patch_invalid_primary_color_returns_422(client: AsyncClient):
    restaurant_id, _, owner_headers = await create_restaurant_as_owner(client)

    res = await client.patch(
        f"/restaurants/{restaurant_id}/style",
        json={"primary_color": "not-a-color"},
        headers=owner_headers,
    )

    assert res.status_code == 422


async def test_patch_invalid_secondary_color_returns_422(client: AsyncClient):
    restaurant_id, _, owner_headers = await create_restaurant_as_owner(client)

    res = await client.patch(
        f"/restaurants/{restaurant_id}/style",
        json={"secondary_color": "#12"},  # 2 dígitos: ni #RGB ni #RRGGBB
        headers=owner_headers,
    )

    assert res.status_code == 422


# ---------------------------------------------------------------------------
# CA-08: PATCH luego GET /menu/{qr_token} refleja los valores nuevos
# ---------------------------------------------------------------------------


async def test_patch_style_reflected_in_public_menu(client: AsyncClient):
    restaurant_id, qr_token, owner_headers = await create_restaurant_as_owner(client)

    await client.patch(
        f"/restaurants/{restaurant_id}/style",
        json={
            "font_family": "Playfair Display",
            "primary_color": "#FC462F",
            "secondary_color": "#FFE0E0",
        },
        headers=owner_headers,
    )

    # Endpoint público, sin auth: limpiar cualquier cookie residual.
    client.cookies.clear()
    res = await client.get(f"/menu/{qr_token}")

    assert res.status_code == 200
    assert res.json()["style"] == {
        "font_family": "Playfair Display",
        "primary_color": "#FC462F",
        "secondary_color": "#FFE0E0",
    }


# ---------------------------------------------------------------------------
# Contrato: valores válidos del enum FontFamily y hex de 3 dígitos
# ---------------------------------------------------------------------------


async def test_patch_accepts_all_font_family_values(client: AsyncClient):
    """RF-06: los 4 valores del enum son aceptados."""
    restaurant_id, _, owner_headers = await create_restaurant_as_owner(client)

    for font in ("Inter", "Playfair Display", "Poppins", "DM Sans"):
        res = await client.patch(
            f"/restaurants/{restaurant_id}/style",
            json={"font_family": font},
            headers=owner_headers,
        )
        assert res.status_code == 200, font
        assert res.json()["font_family"] == font


async def test_patch_accepts_short_hex_color(client: AsyncClient):
    """RF-05: #RGB (3 dígitos) es un color hex válido."""
    restaurant_id, _, owner_headers = await create_restaurant_as_owner(client)

    res = await client.patch(
        f"/restaurants/{restaurant_id}/style",
        json={"primary_color": "#f0a"},
        headers=owner_headers,
    )

    assert res.status_code == 200
    assert res.json()["primary_color"] == "#f0a"


# ---------------------------------------------------------------------------
# Contrato de errores: sin auth → 401
# ---------------------------------------------------------------------------


async def test_style_endpoints_require_auth(client: AsyncClient):
    restaurant_id, _, _ = await create_restaurant_as_owner(client)
    client.cookies.clear()

    get_res = await client.get(f"/restaurants/{restaurant_id}/style")
    patch_res = await client.patch(
        f"/restaurants/{restaurant_id}/style", json={"primary_color": "#112233"}
    )

    assert get_res.status_code == 401
    assert get_res.json()["detail"] == "not_authenticated"
    assert patch_res.status_code == 401
    assert patch_res.json()["detail"] == "not_authenticated"


# ---------------------------------------------------------------------------
# RNF-02 / PA-01: restaurant legacy sin fila MenuStyle → 404 style_not_found
# ---------------------------------------------------------------------------


async def test_get_style_legacy_without_row_returns_404(
    client: AsyncClient, db_session: AsyncSession
):
    restaurant_id, _, owner_headers = await create_restaurant_as_owner(client)

    # Simular dato legacy: borrar la fila MenuStyle creada automáticamente.
    await db_session.execute(
        delete(MenuStyle).where(
            MenuStyle.restaurant_id == uuid.UUID(restaurant_id)
        )
    )
    await db_session.commit()

    res = await client.get(
        f"/restaurants/{restaurant_id}/style", headers=owner_headers
    )

    assert res.status_code == 404
    assert res.json()["detail"] == "style_not_found"


async def test_patch_style_legacy_without_row_returns_404(
    client: AsyncClient, db_session: AsyncSession
):
    restaurant_id, _, owner_headers = await create_restaurant_as_owner(client)

    await db_session.execute(
        delete(MenuStyle).where(
            MenuStyle.restaurant_id == uuid.UUID(restaurant_id)
        )
    )
    await db_session.commit()

    res = await client.patch(
        f"/restaurants/{restaurant_id}/style",
        json={"primary_color": "#112233"},
        headers=owner_headers,
    )

    assert res.status_code == 404
    assert res.json()["detail"] == "style_not_found"
