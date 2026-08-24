# Agenda de Viajes

Aplicación web para gestionar viajes de empresa: personas que viajan, fechas de
ida y vuelta, persona de contacto que ha solicitado el viaje, y su teléfono y
correo. Los datos se guardan en un servidor, así que todos los usuarios con
acceso ven y pueden editar la misma información (la tabla se sincroniza sola
cada 8 segundos, y al instante en el propio usuario que guarda un cambio).

## Estructura

```
backend/
  main.py                        App FastAPI (páginas + API REST)
  models.py                       Tablas: User, AllowedEmail, Trip, Traveler
  schemas.py                       Validación de datos de entrada/salida
  auth.py                             Login por sesión con contraseñas cifradas (bcrypt)
  database.py                      Conexión SQLite
  create_user.py                 Script admin: crear/actualizar un usuario directamente
  manage_allowed_emails.py   Script admin: gestionar qué correos pueden registrarse
  templates/                        HTML (login, registro y panel principal)
  static/                             CSS y JS del panel
```

## Puesta en marcha en un servidor Linux

1. Copia la carpeta `backend/` al servidor (por ejemplo a `/opt/agenda-viajes`).

2. Instala Python 3.11+ y crea un entorno virtual:

   ```bash
   cd /opt/agenda-viajes
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

3. Autoriza los correos de tus compañeros. Cada persona pondrá su propia
   contraseña al registrarse en `/register`, así que no hace falta que se la
   asignes tú:

   ```bash
   python manage_allowed_emails.py add compañero@satlantis.com
   python manage_allowed_emails.py add otro.compañero@satlantis.com "Comercial"
   python manage_allowed_emails.py list
   ```

   Solo los correos que estén en esta lista podrán crear su cuenta. Para
   quitar el acceso a alguien: `python manage_allowed_emails.py remove correo@...`.

   Si en algún momento necesitas crear tú mismo una cuenta con contraseña ya
   puesta (por ejemplo la primera, para probar), puedes usar en su lugar:

   ```bash
   python create_user.py diego@satlantis.com "unaContraseñaSegura" "Diego Hernani"
   ```

4. Define una clave de sesión fija (si no, cada reinicio del servicio cerraría
   la sesión de todos):

   ```bash
   export AGENDA_SECRET_KEY="$(python -c 'import secrets; print(secrets.token_hex(32))')"
   ```

5. Arranca la aplicación:

   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

   Accede desde el navegador a `http://IP-DEL-SERVIDOR:8000`.

### Mantenerla siempre encendida (systemd)

Crea `/etc/systemd/system/agenda-viajes.service`:

```ini
[Unit]
Description=Agenda de Viajes
After=network.target

[Service]
WorkingDirectory=/opt/agenda-viajes
Environment="AGENDA_SECRET_KEY=pon-aqui-tu-clave-fija"
ExecStart=/opt/agenda-viajes/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now agenda-viajes
```

### HTTPS y dominio (recomendado, y necesario para compartir en SharePoint)

Pon un servidor web por delante (nginx o Caddy) que sirva la app por HTTPS con
un dominio propio, por ejemplo `https://agenda-viajes.tuempresa.com`. Con
Caddy es una sola línea:

```
agenda-viajes.tuempresa.com {
    reverse_proxy 127.0.0.1:8000
}
```

Caddy obtiene el certificado HTTPS automáticamente. Con nginx necesitarías
además Certbot/Let's Encrypt.

## Compartir el acceso en SharePoint

Con la app publicada en una URL HTTPS, hay dos formas de ponerla en SharePoint:

- **Enlace o mosaico (recomendado):** añade un web part "Enlace" o "Botón" en
  la página de SharePoint apuntando a `https://agenda-viajes.tuempresa.com`.
  Se abre en una pestaña nueva con el login normal de la app. Es la opción más
  fiable.

- **Insertar (iframe):** SharePoint también permite un web part "Insertar
  código" con un `<iframe>` a la URL de la app, para verla dentro de la propia
  página de SharePoint. Funciona, pero con una limitación importante: como la
  sesión de usuario se guarda en una cookie, y muchos navegadores (Chrome,
  Safari) bloquean por defecto las cookies "de terceros" dentro de iframes de
  otro dominio, algunos usuarios podrían ver el login constantemente o no
  quedarse conectados. Si aun así quieres usar iframe, contacta para ajustar
  la cookie de sesión (`SameSite=None; Secure`), que solo funciona ya sobre
  HTTPS.

Añade el correo de cada persona con `manage_allowed_emails.py` (ver arriba) y
dile que entre en `https://agenda-viajes.tuempresa.com/register` para crear su
propia cuenta con la contraseña que ella elija.

## Desarrollo local

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # En Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage_allowed_emails.py add tucorreo@satlantis.com
uvicorn main:app --reload
```

Abre `http://127.0.0.1:8000`.
