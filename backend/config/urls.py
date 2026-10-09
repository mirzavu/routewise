from django.urls import path, re_path
from trips import views

urlpatterns = [
    path("api/health", views.health),
    path("api/config", views.configuration),
    path("api/locations", views.locations),
    path("api/trips/analyze", views.analyze),
    path("api/weather/corridor", views.corridor),
    re_path(r"^(?!api/).*$", views.frontend),
]
