import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent
load_dotenv(ROOT_DIR / '.env')
DEBUG = os.getenv('DJANGO_DEBUG', 'false').lower() == 'true'
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'local-development-only-change-for-deployment')
ALLOWED_HOSTS = os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,testserver').split(',')
if os.getenv('RENDER_EXTERNAL_HOSTNAME'):
    ALLOWED_HOSTS.append(os.environ['RENDER_EXTERNAL_HOSTNAME'])
INSTALLED_APPS = ['django.contrib.contenttypes', 'rest_framework', 'trips']
MIDDLEWARE = ['django.middleware.security.SecurityMiddleware', 'whitenoise.middleware.WhiteNoiseMiddleware', 'django.middleware.common.CommonMiddleware']
ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3'}}
REST_FRAMEWORK = {'DEFAULT_AUTHENTICATION_CLASSES': [], 'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.AllowAny'], 'UNAUTHENTICATED_USER': None, 'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'], 'DEFAULT_THROTTLE_CLASSES': ['rest_framework.throttling.AnonRateThrottle'], 'DEFAULT_THROTTLE_RATES': {'anon': '120/min'}}
USE_TZ = True
TIME_ZONE = 'UTC'
STATIC_URL = '/assets/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = []
WHITENOISE_ROOT = ROOT_DIR / 'frontend/dist'
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
MAPBOX_ACCESS_TOKEN = os.getenv('MAPBOX_ACCESS_TOKEN', '')
MAPBOX_PUBLIC_TOKEN = os.getenv('MAPBOX_PUBLIC_TOKEN', MAPBOX_ACCESS_TOKEN if MAPBOX_ACCESS_TOKEN.startswith('pk.') else '')
CACHES = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache', 'LOCATION': 'routewise', 'OPTIONS': {'MAX_ENTRIES': 3000}}}
