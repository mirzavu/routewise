import math
from datetime import timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import timezone
from rest_framework import serializers


class Coordinates(serializers.ListField):
    child = serializers.FloatField()
    min_length = 2
    max_length = 2

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        if not all(math.isfinite(v) for v in value) or not (
            -180 <= value[0] <= 180 and -85 <= value[1] <= 85
        ):
            raise serializers.ValidationError("Enter valid longitude and latitude.")
        return value


class LocationSerializer(serializers.Serializer):
    label = serializers.CharField(max_length=256)
    coordinates = Coordinates()
    timezone = serializers.CharField(max_length=64, default="UTC")

    def validate_timezone(self, value):
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError:
            raise serializers.ValidationError("Select a valid timezone.")
        return value


class TripSerializer(serializers.Serializer):
    origin = LocationSerializer()
    destination = LocationSerializer()
    departure = serializers.DateTimeField()
    load_lb = serializers.FloatField(min_value=0, max_value=200000)
    spacing_miles = serializers.ChoiceField(choices=[10, 25, 50])

    def validate_load_lb(self, value):
        if not math.isfinite(value):
            raise serializers.ValidationError("Enter a finite cargo weight.")
        return value

    def validate_departure(self, value):
        now = timezone.now()
        if value < now - timedelta(minutes=5) or value > now + timedelta(days=6):
            raise serializers.ValidationError(
                "Choose a departure from now through the next six days. Arrival must be within forecast coverage."
            )
        return value

    def validate(self, data):
        if data["origin"]["coordinates"] == data["destination"]["coordinates"]:
            raise serializers.ValidationError("Origin and destination must be different.")
        return data


class CorridorSerializer(serializers.Serializer):
    departure = serializers.DateTimeField()
    routes = serializers.ListField(
        child=serializers.ListField(child=Coordinates(), min_length=2, max_length=1000),
        min_length=1,
        max_length=3,
    )
    load_lb = serializers.FloatField(min_value=0, max_value=200000)

    def validate_load_lb(self, value):
        if not math.isfinite(value):
            raise serializers.ValidationError("Enter a finite cargo weight.")
        return value

    def validate_routes(self, value):
        points = [p for line in value for p in line]
        if (
            max(p[0] for p in points) - min(p[0] for p in points) > 100
            or max(p[1] for p in points) - min(p[1] for p in points) > 60
        ):
            raise serializers.ValidationError("The requested weather corridor is too large.")
        return value
