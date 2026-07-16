"use client";

// ---------------------------------------------------------------------------
// EvalPanel — RAGAS evaluation results panels with visual score gauges
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminService } from "@/services/admin.service";
import { 
  Play, 
  Loader2, 
  AlertCircle, 
  Sparkles, 
  TrendingUp, 
  CheckCircle,
  Database,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";

export function EvalPanel() {
  const queryClient = useQueryClient();
  const [evalJobMessage, setEvalJobMessage] = useState<string | null>(null);

  // 1. Fetch evaluation results
  const evalQuery = useQuery({
    queryKey: ["evalResults"],
    queryFn: async () => {
      const response = await adminService.getEvalResults();
      return response.data;
    },
  });

  // 2. Trigger Evaluation Run Mutation
  const triggerEvalMutation = useMutation({
    mutationFn: async () => {
      setEvalJobMessage(null);
      const response = await adminService.triggerEvalRun();
      return response.data;
    },
    onSuccess: (data) => {
      setEvalJobMessage(data.message || "Evaluation job successfully dispatched to worker queue.");
      // Invalidate results after trigger (though it runs asynchronously in background)
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["evalResults"] });
      }, 5000);
    },
    onError: (err: unknown) => {
      setEvalJobMessage((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Failed to trigger evaluation job.");
    },
  });

  const handleRunEval = () => {
    triggerEvalMutation.mutate();
  };

  const results = evalQuery.data?.results || [];
  const datasetId = evalQuery.data?.dataset_id;
  const evaluatedAt = evalQuery.data?.evaluated_at;

  // Helper to color code scores
  const getScoreColorClass = (score: number) => {
    if (score >= 0.8) return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (score >= 0.5) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-rose-600 bg-rose-50 border-rose-200";
  };

  const getProgressBarColor = (score: number) => {
    if (score >= 0.8) return "bg-emerald-500 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.15)]";
    if (score >= 0.5) return "bg-amber-500 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.15)]";
    return "bg-rose-500 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.15)]";
  };

  return (
    <div className="space-y-6">
      
      {/* Run Trigger card */}
      <div className="p-6 rounded-2xl bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] border-none flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-xl text-xs">
          <h3 className="font-bold text-[#3E4E63] uppercase font-mono tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            RAGAS Evaluation Orchestrator
          </h3>
          <p className="text-[#5A6E85] font-sans leading-relaxed">
            Trigger a full pipeline test suite over your golden datasets. The evaluation runs asynchronously in the background using Celery workers to calculate Faithfulness, Answer Relevance, and Context Recall metrics.
          </p>
        </div>

        <Button
          onClick={handleRunEval}
          disabled={triggerEvalMutation.isPending}
          className="h-10 px-5 bg-gradient-to-r from-blue-400 to-blue-600 text-white text-xs font-mono font-bold uppercase tracking-wider cursor-pointer shrink-0 border-none shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:brightness-110 rounded-full"
        >
          {triggerEvalMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1.5 text-white" />
          ) : (
            <Play className="w-4 h-4 mr-1.5" />
          )}
          <span>Execute Test Run</span>
        </Button>
      </div>

      {/* Trigger Feedback Banner */}
      {evalJobMessage && (
        <div className={cn(
          "p-4 rounded-xl text-xs flex items-start gap-3 border animate-fade-in font-bold shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff]",
          triggerEvalMutation.isError
            ? "bg-rose-50 border-rose-200 text-rose-600"
            : "bg-emerald-50 border-emerald-200 text-emerald-600"
        )}>
          {triggerEvalMutation.isError ? (
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <span className="font-bold font-mono uppercase">
              {triggerEvalMutation.isError ? "Trigger Failure" : "Job Dispatched"}
            </span>
            <p className="font-sans leading-relaxed font-normal">{evalJobMessage}</p>
          </div>
        </div>
      )}

      {/* Dataset & Time Details */}
      {evaluatedAt && (
        <div className="flex flex-wrap gap-4 text-[10px] font-mono text-[#5A6E85] bg-[#E6EEF8] shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] p-3 rounded-full w-fit">
          {datasetId && (
            <div className="flex items-center gap-1.5 px-1">
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span>DATASET: <span className="text-[#3E4E63] font-bold">{datasetId}</span></span>
            </div>
          )}
          {evaluatedAt && (
            <div className="flex items-center gap-1.5 px-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>TEST RUN: <span className="text-[#3E4E63] font-bold">{formatDate(evaluatedAt)}</span></span>
            </div>
          )}
        </div>
      )}

      {/* Metric Score Cards */}
      <div className="space-y-4">
        <span className="text-xs font-bold text-[#5A6E85] font-mono uppercase tracking-widest block">
          Calculated Metric Benchmarks
        </span>

        {evalQuery.isLoading ? (
          <div className="text-center py-12 text-[#7A8C9E]">
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
            <span className="text-[10px] font-mono uppercase">Retrieving benchmarks...</span>
          </div>
        ) : results.length === 0 ? (
          <div className="p-8 border-2 border-dashed border-[#c2d0e6] rounded-2xl text-center text-slate-400 space-y-2 bg-[#E6EEF8] shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff]">
            <Sparkles className="w-6 h-6 text-primary mx-auto animate-pulse" />
            <span className="text-xs font-mono uppercase block font-bold text-[#5A6E85]">No Benchmarks Recorded</span>
            <p className="text-[11px] text-[#7A8C9E] font-sans max-w-sm mx-auto">
              Execute a test run above to calculate the initial performance metrics of your active retrieval models.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((metric, i) => (
              <div
                key={i}
                className="p-5 rounded-2xl bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] border-none space-y-4 hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] transition-all duration-300"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-[#3E4E63] uppercase font-mono tracking-wider">
                      {metric.metric_name.replace(/_/g, " ")}
                    </h4>
                    <p className="text-[11px] text-[#7A8C9E] font-sans leading-relaxed">
                      {metric.description || "Synthesized precision scoring for active search operations."}
                    </p>
                  </div>

                  <span className={cn(
                    "px-2.5 py-1 rounded font-bold font-mono text-xs border tracking-wider shrink-0",
                    getScoreColorClass(metric.score)
                  )}>
                    {(metric.score * 100).toFixed(0)}%
                  </span>
                </div>

                {/* Score Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full h-2 bg-[#E6EEF8] rounded-full overflow-hidden shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff]">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", getProgressBarColor(metric.score))}
                      style={{ width: `${metric.score * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] font-mono text-[#7A8C9E] font-bold">
                    <span>0% (FAIL)</span>
                    <span>100% (Grounded)</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
