"use client";

import { useState } from "react";
import { format, subMonths, addMonths, parseISO, startOfMonth } from "date-fns";
import {
  useGetMonthlySummary,
  getGetMonthlySummaryQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function HistoryPage() {
  const [currentMonthDate, setCurrentMonthDate] = useState(startOfMonth(new Date()));
  const monthStr = format(currentMonthDate, "yyyy-MM");

  const { data: summary, isLoading } = useGetMonthlySummary(
    { month: monthStr },
    {
      query: {
        queryKey: getGetMonthlySummaryQueryKey({ month: monthStr }),
      },
    }
  );

  const prevMonth = () => setCurrentMonthDate((d) => subMonths(d, 1));
  const nextMonth = () => setCurrentMonthDate((d) => addMonths(d, 1));

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return <Badge className="bg-green-600">PRESENT</Badge>;
      case "late":
        return <Badge className="bg-amber-500">LATE</Badge>;
      case "absent":
        return <Badge className="bg-red-600">ABSENT</Badge>;
      case "permit":
        return <Badge className="bg-indigo-600">PERMIT</Badge>;
      default:
        return <Badge variant="outline">{status.toUpperCase()}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">History</h1>
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-full p-1">
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold w-24 text-center">
            {format(currentMonthDate, "MMM yyyy")}
          </span>
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full" onClick={nextMonth} disabled={currentMonthDate >= startOfMonth(new Date())}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-green-50 dark:bg-green-900/10">
              <CardContent className="p-4 flex flex-col justify-center items-center text-center">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Present</p>
                <p className="text-3xl font-bold text-green-600">{summary.presentDays}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-amber-50 dark:bg-amber-900/10">
              <CardContent className="p-4 flex flex-col justify-center items-center text-center">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Late</p>
                <p className="text-3xl font-bold text-amber-600">{summary.lateDays}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-red-50 dark:bg-red-900/10">
              <CardContent className="p-4 flex flex-col justify-center items-center text-center">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Absent</p>
                <p className="text-3xl font-bold text-red-600">{summary.absentDays}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-indigo-50 dark:bg-indigo-900/10">
              <CardContent className="p-4 flex flex-col justify-center items-center text-center">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Permit</p>
                <p className="text-3xl font-bold text-indigo-600">{summary.permitDays}</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5" /> Daily Records
            </h2>
            <div className="space-y-3">
              {summary.records.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <p className="text-slate-500 text-sm">No records found for this month.</p>
                </div>
              ) : (
                summary.records.map((record) => (
                  <div
                    key={record.id}
                    className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-semibold text-sm">
                        {format(parseISO(record.date), "EEE, dd MMM")}
                      </span>
                      {renderStatusBadge(record.status)}
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                          In
                        </p>
                        <p className="text-sm font-medium">
                          {record.checkInTime ? format(parseISO(record.checkInTime), "HH:mm") : "--:--"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                          Out
                        </p>
                        <p className="text-sm font-medium">
                          {record.checkOutTime ? format(parseISO(record.checkOutTime), "HH:mm") : "--:--"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
