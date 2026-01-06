"use client";

import { useState, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, Clock, User } from "lucide-react";
import Link from "next/link";
import NextImage from "next/image";

interface WriteRequest {
  id: string;
  user_id: string;
  twitter_user_id: string;
  twitter_handle: string;
  status: "pending" | "approved" | "denied";
  reviewer_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  users?: {
    id: string;
    handle: string | null;
    name: string | null;
    avatar_url: string | null;
    twitter_verified: boolean;
  };
}

function AdminDashboardContent() {
  const [requests, setRequests] = useState<WriteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      // First check if user is admin by fetching user state
      const stateResponse = await fetch("/api/user/state");
      const stateData = await stateResponse.json();
      
      if (!stateResponse.ok || !stateData.userId) {
        setError("Not authenticated");
        setIsAdmin(false);
        return;
      }

      // Check admin status
      const adminResponse = await fetch("/api/admin/check");
      const adminData = await adminResponse.json();
      
      if (adminResponse.ok && adminData.isAdmin) {
        setIsAdmin(true);
        fetchRequests();
      } else {
        setError("Admin access required");
        setIsAdmin(false);
      }
    } catch (err) {
      console.error("Error checking admin access:", err);
      setError("Failed to verify admin access");
      setIsAdmin(false);
    }
  };

  const fetchRequests = async () => {
    try {
      const response = await fetch("/api/admin/write-requests");
      const data = await response.json();
      if (response.ok) {
        setRequests(data.requests || []);
      } else {
        setError(data.error || "Failed to fetch requests");
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
      setError("Failed to fetch requests");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setProcessing(id);
    try {
      const response = await fetch(`/api/admin/write-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });

      if (response.ok) {
        await fetchRequests();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to approve request");
      }
    } catch (error) {
      console.error("Error approving request:", error);
      alert("Failed to approve request");
    } finally {
      setProcessing(null);
    }
  };

  const handleDeny = async (id: string) => {
    const notes = prompt("Enter reason for denial (optional):");
    if (notes === null) return; // User cancelled

    setProcessing(id);
    try {
      const response = await fetch(`/api/admin/write-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "denied", reviewerNotes: notes || null }),
      });

      if (response.ok) {
        await fetchRequests();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to deny request");
      }
    } catch (error) {
      console.error("Error denying request:", error);
      alert("Failed to deny request");
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Approved
          </Badge>
        );
      case "denied":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400">
            <XCircle className="mr-1 h-3 w-3" />
            Denied
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isAdmin === null || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin || error) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 flex items-center gap-4">
          <Link href="/" className="flex items-center">
            <NextImage
              src="/logo.svg"
              alt="Poaster League"
              width={32}
              height={32}
              className="h-8 w-8"
              priority
            />
          </Link>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Admin Dashboard</h1>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <XCircle className="mx-auto h-12 w-12 text-red-500" />
              <h2 className="mt-4 text-xl font-semibold">Access Denied</h2>
              <p className="mt-2 text-muted-foreground">
                {error || "You must be an admin to access this page."}
              </p>
              <Link href="/">
                <Button variant="outline" className="mt-4">
                  Go to Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const reviewedRequests = requests.filter((r) => r.status !== "pending");

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8 flex items-center gap-4">
        <Link href="/" className="flex items-center">
          <NextImage
            src="/logo.svg"
            alt="Poaster League"
            width={32}
            height={32}
            className="h-8 w-8"
            priority
          />
        </Link>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage write access requests</p>
        </div>
      </div>

      {/* Pending Requests */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Pending Requests ({pendingRequests.length})</CardTitle>
          <CardDescription>Write access requests awaiting review</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending requests</p>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    {request.users?.avatar_url ? (
                      <img
                        src={request.users.avatar_url}
                        alt={request.users.name || request.twitter_handle}
                        className="h-10 w-10 rounded-full"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <User className="h-5 w-5" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {request.users?.name || request.twitter_handle || "Unknown"}
                        </p>
                        {getStatusBadge(request.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        @{request.twitter_handle} • {request.twitter_user_id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Requested {new Date(request.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleApprove(request.id)}
                      disabled={processing === request.id}
                    >
                      {processing === request.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeny(request.id)}
                      disabled={processing === request.id}
                    >
                      {processing === request.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="mr-2 h-4 w-4" />
                      )}
                      Deny
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reviewed Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Reviewed Requests ({reviewedRequests.length})</CardTitle>
          <CardDescription>Previously reviewed write access requests</CardDescription>
        </CardHeader>
        <CardContent>
          {reviewedRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviewed requests</p>
          ) : (
            <div className="space-y-4">
              {reviewedRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    {request.users?.avatar_url ? (
                      <img
                        src={request.users.avatar_url}
                        alt={request.users.name || request.twitter_handle}
                        className="h-10 w-10 rounded-full"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <User className="h-5 w-5" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {request.users?.name || request.twitter_handle || "Unknown"}
                        </p>
                        {getStatusBadge(request.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        @{request.twitter_handle} • {request.twitter_user_id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {request.reviewed_at
                          ? `Reviewed ${new Date(request.reviewed_at).toLocaleDateString()}`
                          : `Requested ${new Date(request.created_at).toLocaleDateString()}`}
                      </p>
                      {request.reviewer_notes && (
                        <p className="mt-1 text-xs text-muted-foreground italic">
                          Note: {request.reviewer_notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <AdminDashboardContent />
    </Suspense>
  );
}

