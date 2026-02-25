from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class PresenceStatus(str, Enum):
    IN_OFFICE = "IN_OFFICE"
    IN_BUILDING = "IN_BUILDING"
    OUT_OF_OFFICE = "OUT_OF_OFFICE"
    ON_LEAVE = "ON_LEAVE"
    OFF_DUTY = "OFF_DUTY"


class DetectionMethod(str, Enum):
    WIFI = "wifi"
    GPS = "gps"
    MANUAL = "manual"


class PresenceUpdateRequest(BaseModel):
    status: PresenceStatus
    office_id: Optional[str] = None
    detection_method: DetectionMethod
    wifi_ssid: Optional[str] = None


class ManualStatusRequest(BaseModel):
    status: PresenceStatus
    manual_note: Optional[str] = Field(None, max_length=200)


class PresenceResponse(BaseModel):
    user_id: str
    name: str
    department: Optional[str] = None
    status: str
    office_id: Optional[str] = None
    office_name: Optional[str] = None
    detection_method: Optional[str] = None
    manual_note: Optional[str] = None
    last_updated: Optional[str] = None


class AllPresenceResponse(BaseModel):
    users: List[PresenceResponse]
    count: int


class OfficeResponse(BaseModel):
    office_id: str
    name: str
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_meters: Optional[int] = None
    wifi_ssids: List[str] = []
    is_active: bool = True
