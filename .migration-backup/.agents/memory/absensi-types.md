---
name: Absensi generated type patterns
description: Non-obvious patterns in the generated API types for the Absensi app
---

**TodayAttendanceOverview** is NOT an array — has shape { date, totalEmployees, checkedIn, checkedOut, notYet, records: AttendanceRecord[] }. Access via .records not directly.

**AttendanceRecord** user info is nested: r.user?.name, r.user?.jabatan, r.user?.employeeId — NOT flat r.userName etc.

**LeaveRequest** user info is nested: leave.user?.name, leave.user?.jabatan etc.

**UpdateUserInput** fields: name, jabatan, department, phone, isActive — NO role field.

**useGetMyLeaveRequests(params, options)** — first arg is GetMyLeaveRequestsParams ({status?}), second is query options. Do NOT pass {query:...} as first arg.

**useGetCycleSummary(params, options)** and useGetAttendanceHistory both take {cycleStart?} as first positional arg.

**Why:** These caused typecheck failures; must be followed consistently.
