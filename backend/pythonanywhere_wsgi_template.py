# Contenido para pegar en el archivo WSGI que PythonAnywhere crea
# automáticamente en la pestaña "Web" (algo como
# /var/www/TUUSUARIO_pythonanywhere_com_wsgi.py).
#
# Sustituye TUUSUARIO por tu nombre de usuario de PythonAnywhere y
# CAMBIA-ESTA-CLAVE por una clave larga y aleatoria (la misma siempre,
# si la cambias se cerrarán las sesiones de todos).

import os
import sys

os.environ["AGENDA_SECRET_KEY"] = "CAMBIA-ESTA-CLAVE-POR-ALGO-LARGO-Y-UNICO"

path = "/home/TUUSUARIO/agenda-viajes/backend"
if path not in sys.path:
    sys.path.insert(0, path)

from a2wsgi import ASGIMiddleware
from main import app as asgi_app

application = ASGIMiddleware(asgi_app)
