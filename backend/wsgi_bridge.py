"""Puente mínimo para servir una app ASGI (FastAPI) sobre un servidor WSGI
(como el que usa PythonAnywhere en su plan gratuito).

Resuelve cada petición con asyncio.run() de principio a fin, sin hilos ni
colas en segundo plano, evitando el bloqueo (deadlock) observado con la
librería a2wsgi bajo uWSGI. No soporta streaming ni websockets, pero esta
app no los necesita.
"""
import asyncio
from http import HTTPStatus


def wsgi_from_asgi(asgi_app):
    def application(environ, start_response):
        headers = []
        for key, value in environ.items():
            if key.startswith("HTTP_"):
                name = key[5:].replace("_", "-").lower().encode("latin1")
                headers.append((name, value.encode("latin1")))
        if environ.get("CONTENT_TYPE"):
            headers.append((b"content-type", environ["CONTENT_TYPE"].encode("latin1")))
        if environ.get("CONTENT_LENGTH"):
            headers.append((b"content-length", environ["CONTENT_LENGTH"].encode("latin1")))

        server_name = environ.get("SERVER_NAME", "")
        try:
            server_port = int(environ.get("SERVER_PORT") or 0)
        except ValueError:
            server_port = 0

        scope = {
            "type": "http",
            "asgi": {"version": "3.0", "spec_version": "2.3"},
            "http_version": "1.1",
            "method": environ["REQUEST_METHOD"],
            "path": environ.get("PATH_INFO", ""),
            "raw_path": environ.get("PATH_INFO", "").encode("utf-8"),
            "query_string": environ.get("QUERY_STRING", "").encode("utf-8"),
            "root_path": "",
            "scheme": environ.get("wsgi.url_scheme", "http"),
            "server": (server_name, server_port),
            "client": (environ.get("REMOTE_ADDR", ""), 0),
            "headers": headers,
        }

        try:
            content_length = int(environ.get("CONTENT_LENGTH") or 0)
        except ValueError:
            content_length = 0
        body = environ["wsgi.input"].read(content_length) if content_length > 0 else b""
        request_sent = {"done": False}

        async def receive():
            if not request_sent["done"]:
                request_sent["done"] = True
                return {"type": "http.request", "body": body, "more_body": False}
            return {"type": "http.disconnect"}

        response = {"status": 500, "headers": [], "body": bytearray()}

        async def send(message):
            if message["type"] == "http.response.start":
                response["status"] = message["status"]
                response["headers"] = message.get("headers", [])
            elif message["type"] == "http.response.body":
                response["body"] += message.get("body", b"")

        async def run():
            await asgi_app(scope, receive, send)

        asyncio.run(run())

        try:
            reason = HTTPStatus(response["status"]).phrase
        except ValueError:
            reason = ""
        status_line = f"{response['status']} {reason}".strip()

        response_headers = [
            (name.decode("latin1"), value.decode("latin1"))
            for name, value in response["headers"]
        ]
        start_response(status_line, response_headers)
        return [bytes(response["body"])]

    return application
