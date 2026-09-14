"""Model registry — import every model module so SQLAlchemy can resolve
string-based ``relationship()`` references across modules.

Any module whose models participate in cross-module relationships (e.g.
``Restaurant.promos`` -> ``Promo``) must be imported before the first mapper
configuration. Importing this package from ``app.core.database`` guarantees
that for every entrypoint (app, scripts, tests), mirroring what
``alembic/env.py`` and ``scripts/promote_superadmin.py`` do explicitly.
"""

import app.models.user  # noqa: F401
import app.models.restaurant  # noqa: F401
import app.models.menu  # noqa: F401
import app.models.item  # noqa: F401
import app.models.item_modifier  # noqa: F401
import app.models.order  # noqa: F401
import app.models.promo  # noqa: F401
import app.models.style  # noqa: F401
