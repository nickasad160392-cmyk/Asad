import { pgTable, serial, integer, text, timestamp, date, real, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const attendanceTable = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  date: date("date").notNull(),
  checkInTime: timestamp("check_in_time"),
  checkOutTime: timestamp("check_out_time"),
  checkInSelfie: text("check_in_selfie"),
  checkOutSelfie: text("check_out_selfie"),
  checkInLat: real("check_in_lat"),
  checkInLng: real("check_in_lng"),
  checkOutLat: real("check_out_lat"),
  checkOutLng: real("check_out_lng"),
  status: varchar("status", { length: 20 }).notNull().default("present"),
  latenessMinutes: integer("lateness_minutes"),
  overtimeMinutes: integer("overtime_minutes"),
  workHours: real("work_hours"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true, createdAt: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
