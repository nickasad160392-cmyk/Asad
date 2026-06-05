"use client";

import { useState } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetLeaveRequests,
  getGetLeaveRequestsQueryKey,
  useSubmitLeaveRequest,
  LeaveRequestInputType,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Clock, FileText } from "lucide-react";

export default function LeavePage() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [type, setType] = useState<LeaveRequestInputType>("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const { data: requests, isLoading } = useGetLeaveRequests({
    query: {
      queryKey: getGetLeaveRequestsQueryKey({}),
    },
  });

  const submitLeave = useSubmitLeaveRequest();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || !reason) {
      toast.error("Please fill all required fields");
      return;
    }

    submitLeave.mutate(
      {
        data: {
          type,
          startDate,
          endDate,
          reason,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetLeaveRequestsQueryKey({}) });
          toast.success("Leave request submitted successfully");
          setIsFormOpen(false);
          setStartDate("");
          setEndDate("");
          setReason("");
        },
        onError: (err: any) => {
          toast.error(err.data?.error || "Failed to submit request");
        },
      }
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800";
      case "rejected":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800";
      default:
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800";
    }
  };

  const estimatedDays = startDate && endDate
    ? differenceInDays(parseISO(endDate), parseISO(startDate)) + 1
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Leave / Permit</h1>
        <Button size="icon" onClick={() => setIsFormOpen(!isFormOpen)} className="rounded-full h-10 w-10 bg-indigo-600 hover:bg-indigo-700">
          <Plus className={`w-5 h-5 transition-transform ${isFormOpen ? "rotate-45" : ""}`} />
        </Button>
      </div>

      {isFormOpen && (
        <Card className="border-indigo-100 dark:border-indigo-900/50 shadow-md">
          <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Leave Type</Label>
                <Select value={type} onValueChange={(val: any) => setType(val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">Annual Leave</SelectItem>
                    <SelectItem value="sick">Sick Leave</SelectItem>
                    <SelectItem value="personal">Personal Leave</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} />
                </div>
              </div>

              {estimatedDays > 0 && (
                <p className="text-xs font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-md">
                  Estimated duration: {estimatedDays} day(s)
                </p>
              )}

              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  placeholder="Explain why you need this leave..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="resize-none h-24"
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitLeave.isPending}>
                {submitLeave.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit Request
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5" /> My Requests
        </h2>
        
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : requests?.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
            <p className="text-slate-500 text-sm">No leave requests found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests?.map((req) => (
              <div key={req.id} className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-sm capitalize">{req.type} Leave</h3>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(parseISO(req.startDate), "dd MMM")} - {format(parseISO(req.endDate), "dd MMM yyyy")}
                    </p>
                  </div>
                  <Badge variant="outline" className={getStatusColor(req.status)}>
                    {req.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="mt-3 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-2 rounded-md">
                  {req.reason}
                </div>
                {req.status === "rejected" && req.rejectionReason && (
                  <div className="mt-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded-md">
                    <span className="font-semibold">Reason:</span> {req.rejectionReason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
