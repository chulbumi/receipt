from pydantic import BaseModel
from typing import Optional, List


class StatusHistoryEntry(BaseModel):
    status: str
    timestamp: str
    method: str


class AttendanceRecord(BaseModel):
    user_id: str
    date: str
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    check_in_method: Optional[str] = None
    check_out_method: Optional[str] = None
    office_id: Optional[str] = None
    status_history: List[StatusHistoryEntry] = []


class AttendanceListResponse(BaseModel):
    records: List[AttendanceRecord]
    count: int
