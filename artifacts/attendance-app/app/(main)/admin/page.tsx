"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminGetLeaveRequests,
  getAdminGetLeaveRequestsQueryKey,
  useApproveLeaveRequest,
  useRejectLeaveRequest,
  useAdminGetAllAttendance,
  getAdminGetAllAttendanceQueryKey,
  useGetDashboardStats,
  getGetDashboardStatsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle, XCircle, Users, Clock, AlertTriangle, UserCheck } from "lucide-react";

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [monthStr] = useState(format(new Date(), "yyyy-MM"));

  // Leave Requests Tab State
  const [leaveStatus, setLeaveStatus] = useState<any>(undefined); // all
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: leaveRequests, isLoading: isLoadingLeaves } = useAdminGetLeaveRequests(
    { status: leaveStatus },
    {
      query: {
        queryKey: getAdminGetLeaveRequestsQueryKey({ status: leaveStatus }),
      },
    }
  );

  const { data: stats } = useGetDashboardStats(
    { month: monthStr },
    {
      query: {
        queryKey: getGetDashboardStatsQueryKey({ month: monthStr }),
      },
    }
  );

  const { data: attendance } = useAdminGetAllAttendance(
    { month: monthStr },
    {
      query: {
        queryKey: getAdminGetAllAttendanceQueryKey({ month: monthStr }),
      },
    }
  );

  const approveLeave = useApproveLeaveRequest();
  const rejectLeave = useRejectLeaveRequest();

  const handleApprove = (id: number) => {
    approveLeave.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminGetLeaveRequestsQueryKey({ status: leaveStatus }) });
          toast.success("Request approved");
        },
        onError: () => toast.error("Failed to approve request"),
      }
    );
  };

  const handleReject = () => {
    if (!rejectId) return;
    rejectLeave.mutate(
      { id: rejectId, data: { reason: rejectReason } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminGetLeaveRequestsQueryKey({ status: leaveStatus }) });
          toast.success("Request rejected");
          setRejectModalOpen(false);
          setRejectId(null);
          setRejectReason("");
        },
        onError: () => toast.error("Failed to reject request"),
      }
    );
  };

  const openRejectModal = (id: number) => {
    setRejectId(id);
    setRejectReason("");
    setRejectModalOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Admin Panel</h1>

      <Tabs defaultValue="leave" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="leave">Leave Requests</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="leave" className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <Button
              variant={leaveStatus === undefined ? "default" : "outline"}
              size="sm"
              onClick={() => setLeaveStatus(undefined)}
              className="rounded-full"
            >
              All
            </Button>
            <Button
              variant={leaveStatus === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => setLeaveStatus("pending")}
              className="rounded-full"
            >
              Pending
            </Button>
            <Button
              variant={leaveStatus === "approved" ? "default" : "outline"}
              size="sm"
              onClick={() => setLeaveStatus("approved")}
              className="rounded-full"
            >
              Approved
            </Button>
            <Button
              variant={leaveStatus === "rejected" ? "default" : "outline"}
              size="sm"
              onClick={() => setLeaveStatus("rejected")}
              className="rounded-full"
            >
              Rejected
            </Button>
          </div>

          <div className="space-y-3">
            {isLoadingLeaves ? (
              <div className="text-center py-4 text-sm text-slate-500">Loading requests...</div>
            ) : leaveRequests?.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                <p className="text-slate-500 text-sm">No leave requests found.</p>
              </div>
            ) : (
              leaveRequests?.map((req) => (
                <div key={req.id} className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-sm">{req.user?.name}</h3>
                      <p className="text-xs text-slate-500 capitalize">{req.type} Leave</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        req.status === "approved"
                          ? "bg-green-100 text-green-700 border-green-200"
                          : req.status === "rejected"
                          ? "bg-red-100 text-red-700 border-red-200"
                          : "bg-amber-100 text-amber-700 border-amber-200"
                      }
                    >
                      {req.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                    {format(parseISO(req.startDate), "dd MMM yyyy")} - {format(parseISO(req.endDate), "dd MMM yyyy")}
                  </div>
                  <div className="text-sm bg-slate-50 dark:bg-slate-900 p-2 rounded-md mb-3">
                    {req.reason}
                  </div>
                  
                  {req.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => handleApprove(req.id)}
                        disabled={approveLeave.isPending}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        onClick={() => openRejectModal(req.id)}
                      >
                        <XCircle className="w-4 h-4 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          {stats && (
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-slate-200 shadow-sm bg-indigo-50/50">
                <CardContent className="p-4 flex flex-col justify-center items-center text-center">
                  <Users className="w-5 h-5 text-indigo-600 mb-1" />
                  <p className="text-xs font-medium text-slate-600">Total Employees</p>
                  <p className="text-xl font-bold text-slate-900">{stats.totalEmployees}</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm bg-green-50/50">
                <CardContent className="p-4 flex flex-col justify-center items-center text-center">
                  <UserCheck className="w-5 h-5 text-green-600 mb-1" />
                  <p className="text-xs font-medium text-slate-600">Present Today</p>
                  <p className="text-xl font-bold text-slate-900">{stats.presentToday}</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm bg-amber-50/50">
                <CardContent className="p-4 flex flex-col justify-center items-center text-center">
                  <Clock className="w-5 h-5 text-amber-600 mb-1" />
                  <p className="text-xs font-medium text-slate-600">Late Today</p>
                  <p className="text-xl font-bold text-slate-900">{stats.lateToday}</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm bg-red-50/50">
                <CardContent className="p-4 flex flex-col justify-center items-center text-center">
                  <AlertTriangle className="w-5 h-5 text-red-600 mb-1" />
                  <p className="text-xs font-medium text-slate-600">Absent Today</p>
                  <p className="text-xl font-bold text-slate-900">{stats.absentToday}</p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Today's Attendance Logs</h2>
            {attendance?.filter(a => a.date === format(new Date(), "yyyy-MM-dd")).length === 0 ? (
              <div className="text-center py-6 text-sm text-slate-500">No logs for today yet.</div>
            ) : (
              attendance
                ?.filter(a => a.date === format(new Date(), "yyyy-MM-dd"))
                .map((record) => (
                <div key={record.id} className="bg-white p-3 rounded-lg border border-slate-100 flex items-center justify-between text-sm shadow-sm">
                  <div>
                    <p className="font-semibold">{record.user?.name}</p>
                    <p className="text-xs text-slate-500">
                      In: {record.checkInTime ? format(parseISO(record.checkInTime), "HH:mm") : "--"}
                    </p>
                  </div>
                  <Badge variant="outline" className={
                    record.status === "present" ? "bg-green-100 text-green-700" :
                    record.status === "late" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"
                  }>
                    {record.status.toUpperCase()}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-md w-[90vw] rounded-xl">
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this request.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Reason for rejection (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" className="flex-1" onClick={handleReject} disabled={rejectLeave.isPending}>
              Reject Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
