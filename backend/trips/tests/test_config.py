import runpy
from pathlib import Path

import pytest


@pytest.fixture(autouse=True)
def ignore_local_dotenv(monkeypatch):
    monkeypatch.setattr("dotenv.load_dotenv", lambda *_: None)


@pytest.mark.parametrize("public_token", ["", None])
def test_public_map_token_falls_back_to_public_routing_token(monkeypatch, public_token):
    monkeypatch.setenv("MAPBOX_ACCESS_TOKEN", "pk.test-routing")
    if public_token is None:
        monkeypatch.delenv("MAPBOX_PUBLIC_TOKEN", raising=False)
    else:
        monkeypatch.setenv("MAPBOX_PUBLIC_TOKEN", public_token)
    config = runpy.run_path(str(Path(__file__).parents[2] / "config/settings.py"))
    assert config["MAPBOX_PUBLIC_TOKEN"] == "pk.test-routing"


def test_secret_routing_token_is_never_used_as_public_fallback(monkeypatch):
    monkeypatch.setenv("MAPBOX_ACCESS_TOKEN", "sk.test-secret")
    monkeypatch.setenv("MAPBOX_PUBLIC_TOKEN", "")
    config = runpy.run_path(str(Path(__file__).parents[2] / "config/settings.py"))
    assert config["MAPBOX_PUBLIC_TOKEN"] == ""
