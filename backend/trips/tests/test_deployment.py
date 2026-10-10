import os
import subprocess
import sys
from pathlib import Path

import pytest


@pytest.mark.parametrize(
    "host,extra_env",
    [
        ("routewise-preview.vercel.app", {"VERCEL": "1"}),
        (
            "routewise.example.com",
            {"VERCEL": "1", "VERCEL_PROJECT_PRODUCTION_URL": "routewise.example.com"},
        ),
        ("routewise.onrender.com", {"RENDER_EXTERNAL_HOSTNAME": "routewise.onrender.com"}),
    ],
)
def test_repository_root_entrypoint_serves_health_on_deployment_host(host, extra_env):
    root = Path(__file__).resolve().parents[3]
    env = {**os.environ, "DJANGO_DEBUG": "false", "DJANGO_ALLOWED_HOSTS": "localhost"}
    for key in ("VERCEL", "VERCEL_PROJECT_PRODUCTION_URL", "RENDER_EXTERNAL_HOSTNAME", "PYTHONPATH"):
        env.pop(key, None)
    env.update(extra_env)
    code = """
import sys
from io import BytesIO
from wsgiref.util import setup_testing_defaults
from vercel_wsgi import application

environ = {}
setup_testing_defaults(environ)
environ.update(PATH_INFO='/api/health', HTTP_HOST=sys.argv[1], **{'wsgi.input': BytesIO()})
response = {}
def start_response(status, headers, exc_info=None):
    response['status'] = status
body = b''.join(application(environ, start_response))
assert response['status'] == '200 OK', response
assert body == b'{"status":"ok"}', body
"""
    completed = subprocess.run(
        [sys.executable, "-c", code, host], cwd=root, env=env, capture_output=True, text=True
    )
    assert completed.returncode == 0, completed.stderr
