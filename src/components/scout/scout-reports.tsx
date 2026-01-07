"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, Calendar, User } from "lucide-react";
import Link from "next/link";
import NextImage from "next/image";

interface ScoutReport {
  id: string;
  scout_profile_id: string;
  report_date: string;
  week_start: string;
  week_end: string;
  candidate_count: number;
  created_at: string;
}

interface ScoutCandidate {
  id: string;
  scout_report_id: string;
  user_id: string | null;
  twitter_user_id: string | null;
  match_confidence: number;
  reasoning: string;
  sample_post_ids: number[];
  revealed: boolean;
  revealed_at: string | null;
  created_at: string;
  users: {
    id: string;
    handle: string | null;
    name: string | null;
    avatar_url: string | null;
  } | null;
}

interface ScoutReportsProps {
  profileId?: string;
}

export function ScoutReports({ profileId: _profileId }: ScoutReportsProps) {
  const [reports, setReports] = useState<ScoutReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<ScoutReport | null>(null);
  const [candidates, setCandidates] = useState<ScoutCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealing, setRevealing] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    if (selectedReport) {
      fetchCandidates(selectedReport.id);
    }
  }, [selectedReport]);

  const fetchReports = async () => {
    try {
      const response = await fetch("/api/scout/reports");
      const data = await response.json();
      setReports(data.reports || []);
      if (data.reports && data.reports.length > 0) {
        setSelectedReport(data.reports[0]);
      }
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCandidates = async (reportId: string) => {
    try {
      const response = await fetch(`/api/scout/reports/${reportId}`);
      const data = await response.json();
      setCandidates(data.candidates || []);
    } catch (error) {
      console.error("Error fetching candidates:", error);
    }
  };

  const handleReveal = async (candidateId: string) => {
    if (!selectedReport) return;
    
    setRevealing(candidateId);
    try {
      const response = await fetch(
        `/api/scout/reports/${selectedReport.id}/reveal`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ candidateId }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to reveal candidate");
      }

      const data = await response.json();
      
      // Update candidates list
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidateId
            ? {
                ...c,
                revealed: true,
                revealed_at: new Date().toISOString(),
                users: data.candidate?.users || c.users,
              }
            : c
        )
      );
    } catch (error) {
      console.error("Error revealing candidate:", error);
      alert("Failed to reveal candidate. Please try again.");
    } finally {
      setRevealing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Reports Yet</CardTitle>
          <CardDescription>
            Your first Scout Mode report will appear here after the next weekly scan.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatWeekRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })} - ${endDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  };

  return (
    <div className="space-y-6">
      {/* Report Selector */}
      <div className="flex flex-wrap gap-2">
        {reports.map((report) => (
          <Button
            key={report.id}
            variant={selectedReport?.id === report.id ? "default" : "outline"}
            onClick={() => setSelectedReport(report)}
            size="sm"
          >
            <Calendar className="mr-2 h-4 w-4" />
            {formatDate(report.report_date)}
          </Button>
        ))}
      </div>

      {selectedReport && (
        <>
          {/* Report Header */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    Scout Report — Week of {formatDate(selectedReport.week_start)}
                  </CardTitle>
                  <CardDescription>
                    {formatWeekRange(selectedReport.week_start, selectedReport.week_end)}
                  </CardDescription>
                </div>
                <Badge variant="secondary">
                  {selectedReport.candidate_count} candidates
                </Badge>
              </div>
            </CardHeader>
          </Card>

          {/* Candidates */}
          {candidates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No candidates in this report.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {candidates.map((candidate) => {
                const isRevealed = candidate.revealed;
                const user = candidate.users;

                return (
                  <Card key={candidate.id}>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {candidate.match_confidence}% match
                              </Badge>
                              {candidate.match_confidence >= 70 && (
                                <Badge variant="default">Strong</Badge>
                              )}
                              {candidate.match_confidence >= 40 &&
                                candidate.match_confidence < 70 && (
                                  <Badge variant="secondary">Medium</Badge>
                                )}
                              {candidate.match_confidence < 40 && (
                                <Badge variant="outline">Early Signal</Badge>
                              )}
                            </div>
                          </div>
                          {!isRevealed && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReveal(candidate.id)}
                              disabled={revealing === candidate.id}
                            >
                              {revealing === candidate.id ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Revealing...
                                </>
                              ) : (
                                <>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Reveal Identity
                                </>
                              )}
                            </Button>
                          )}
                        </div>

                        {/* Identity */}
                        {isRevealed && user ? (
                          <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
                            {user.avatar_url && (
                              <NextImage
                                src={user.avatar_url}
                                alt={user.name || user.handle || "User"}
                                width={40}
                                height={40}
                                className="h-10 w-10 rounded-full"
                              />
                            )}
                            <div>
                              <div className="font-medium">
                                {user.name || user.handle || "Unknown User"}
                              </div>
                              {user.handle && (
                                <div className="text-sm text-muted-foreground">
                                  @{user.handle}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                              <User className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="font-medium">Anonymous Candidate</div>
                              <div className="text-sm text-muted-foreground">
                                Click to reveal identity
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Reasoning */}
                        <div>
                          <div className="text-sm font-medium text-muted-foreground mb-2">
                            Why this match:
                          </div>
                          <div className="text-sm">{candidate.reasoning}</div>
                        </div>

                        {/* Sample Posts */}
                        {candidate.sample_post_ids && candidate.sample_post_ids.length > 0 && (
                          <div>
                            <div className="text-sm font-medium text-muted-foreground mb-2">
                              Sample posts:
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {candidate.sample_post_ids.slice(0, 3).map((postId) => (
                                <Link
                                  key={postId}
                                  href={`/?post=${postId}`}
                                  className="text-sm text-primary hover:underline"
                                >
                                  Post #{postId}
                                </Link>
                              ))}
                              {candidate.sample_post_ids.length > 3 && (
                                <span className="text-sm text-muted-foreground">
                                  +{candidate.sample_post_ids.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

