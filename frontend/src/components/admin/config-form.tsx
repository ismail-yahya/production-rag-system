"use client";

// ---------------------------------------------------------------------------
// ConfigForm — Tenant settings editor for SUPER_ADMIN users
// ---------------------------------------------------------------------------

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsService } from "@/services/settings.service";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "@/store/toast-store";
import { 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Validation schema for config update
const configSchema = z.object({
  llm_provider: z.string().min(1, { message: "LLM provider is required." }),
  llm_model: z.string().min(1, { message: "LLM model ID is required." }),
  temperature: z.number().min(0.0).max(1.0),
  query_expansion: z.boolean(),
  rate_limit_ingest: z.number().int().min(1, { message: "Must be at least 1 request/min." }),
  rate_limit_query: z.number().int().min(1, { message: "Must be at least 1 request/min." }),
});

type ConfigFormValues = z.infer<typeof configSchema>;

export function ConfigForm() {
  const queryClient = useQueryClient();
  const [saveStatus, setSaveStatus] = useState<{
    status: "idle" | "success" | "error";
    message?: string;
  }>({ status: "idle" });

  // 1. Fetch current config
  const configQuery = useQuery({
    queryKey: ["tenantConfig"],
    queryFn: async () => {
      const response = await settingsService.getConfig();
      return response.data;
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
  });

  const tempVal = watch("temperature", 0.7);

  // Sync loaded config values to form
  useEffect(() => {
    if (configQuery.data) {
      reset({
        llm_provider: configQuery.data.llm_provider,
        llm_model: configQuery.data.llm_model,
        temperature: configQuery.data.temperature,
        query_expansion: configQuery.data.query_expansion,
        rate_limit_ingest: configQuery.data.rate_limit_ingest,
        rate_limit_query: configQuery.data.rate_limit_query,
      });
    }
  }, [configQuery.data, reset]);

  // 2. Update config mutation
  const updateMutation = useMutation({
    mutationFn: async (data: ConfigFormValues) => {
      setSaveStatus({ status: "idle" });
      const response = await settingsService.updateConfig(data);
      return response.data;
    },
    onSuccess: () => {
      setSaveStatus({
        status: "success",
        message: "Tenant configuration blueprint updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["tenantConfig"] });
      toast.success("Tenant configuration blueprint updated successfully.");
      setTimeout(() => setSaveStatus({ status: "idle" }), 4000);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Failed to update tenant configurations.";
      setSaveStatus({
        status: "error",
        message: msg,
      });
      toast.error(msg);
    },
  });

  const onSubmit = (data: ConfigFormValues) => {
    updateMutation.mutate(data);
  };

  if (configQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-2 text-[#5A6E85]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="text-[10px] font-mono uppercase font-bold">Retrieving active configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] border-none p-6 rounded-2xl">
      
      {/* Form Title Header */}
      <div className="flex items-center gap-2 border-b border-slate-200/50 pb-3">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <div>
          <h3 className="text-sm font-bold text-[#3E4E63] uppercase font-mono tracking-wider">
            Super Authority Parameters
          </h3>
          <span className="text-[10px] text-[#7A8C9E] font-sans mt-0.5 block">
            Configure system-wide RAG routing keys, temperature biases, and rate throttles.
          </span>
        </div>
      </div>

      {/* Save Status Banner */}
      {saveStatus.status === "success" && (
        <div className="p-4 rounded-xl bg-emerald-50 border-none flex items-start gap-2.5 text-xs text-emerald-600 shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] font-bold animate-fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{saveStatus.message}</span>
        </div>
      )}

      {saveStatus.status === "error" && (
        <div className="p-4 rounded-xl bg-rose-50 border-none flex items-start gap-2.5 text-xs text-rose-600 shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] font-bold animate-fade-in">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{saveStatus.message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 text-xs">
        
        {/* Row 1: LLM Provider and Model */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="llm_provider" className="text-[#5A6E85] font-mono uppercase text-[10px]">
              Active LLM Provider
            </Label>
            <select
              id="llm_provider"
              className="w-full bg-[#E6EEF8] border-none rounded-full py-2 px-3 text-[#3E4E63] text-xs font-mono outline-none cursor-pointer shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] focus:ring-1 focus:ring-primary/20 h-9"
              {...register("llm_provider")}
            >
              <option value="openai" className="bg-[#E6EEF8] text-[#3E4E63]">OpenAI</option>
              <option value="anthropic" className="bg-[#E6EEF8] text-[#3E4E63]">Anthropic</option>
              <option value="gemini" className="bg-[#E6EEF8] text-[#3E4E63]">Gemini</option>
              <option value="ollama" className="bg-[#E6EEF8] text-[#3E4E63]">Ollama (Local)</option>
            </select>
            {errors.llm_provider && (
              <p className="text-[10px] text-rose-600 font-mono mt-0.5">{errors.llm_provider.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="llm_model" className="text-[#5A6E85] font-mono uppercase text-[10px]">
              Active Model Identifier
            </Label>
            <Input
              id="llm_model"
              placeholder="e.g. gpt-4o or gemini-1.5-pro"
              className="bg-[#E6EEF8] border-none text-[#3E4E63] placeholder-slate-400 focus-visible:ring-primary/20 h-9 font-mono shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] rounded-full pl-4"
              {...register("llm_model")}
              required
            />
            {errors.llm_model && (
              <p className="text-[10px] text-rose-600 font-mono mt-0.5">{errors.llm_model.message}</p>
            )}
          </div>
        </div>

        {/* Row 2: Temperature Slider */}
        <div className="space-y-2.5">
          <div className="flex justify-between items-center text-[10px] font-mono uppercase">
            <Label htmlFor="temperature" className="text-[#5A6E85] font-bold">
              Temperature Bias
            </Label>
            <span className="text-primary font-bold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
              {tempVal.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-slate-400">0.0 (Fact)</span>
            <input
              id="temperature"
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              className="flex-1 accent-primary cursor-pointer h-2 rounded-full bg-[#E6EEF8] shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff]"
              {...register("temperature", { valueAsNumber: true })}
            />
            <span className="text-[10px] font-mono text-slate-400">1.0 (Creative)</span>
          </div>
        </div>

        {/* Row 3: Query Expansion Toggle */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-[#E6EEF8] shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] border-none">
          <div className="space-y-0.5">
            <Label htmlFor="query_expansion" className="text-[#3E4E63] font-mono uppercase text-[10px] cursor-pointer font-bold">
              Query Expansion Context
            </Label>
            <p className="text-[10px] text-[#7A8C9E] font-sans leading-normal">
              Instruct LLM router to expand short questions into sub-queries prior to searching vector db index.
            </p>
          </div>
          <input
            id="query_expansion"
            type="checkbox"
            className="w-4 h-4 accent-primary bg-[#E6EEF8] border-[#c2d0e6] text-primary rounded cursor-pointer"
            {...register("query_expansion")}
          />
        </div>

        {/* Row 4: Rate Limits */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="rate_limit_ingest" className="text-[#5A6E85] font-mono uppercase text-[10px]">
              Ingestion Rate Limit (req/min)
            </Label>
            <Input
              id="rate_limit_ingest"
              type="number"
              className="bg-[#E6EEF8] border-none text-[#3E4E63] focus-visible:ring-primary/20 h-9 font-mono shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] rounded-full pl-4"
              {...register("rate_limit_ingest", { valueAsNumber: true })}
              required
            />
            {errors.rate_limit_ingest && (
              <p className="text-[10px] text-rose-600 font-mono mt-0.5">{errors.rate_limit_ingest.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rate_limit_query" className="text-[#5A6E85] font-mono uppercase text-[10px]">
              Search Rate Limit (req/min)
            </Label>
            <Input
              id="rate_limit_query"
              type="number"
              className="bg-[#E6EEF8] border-none text-[#3E4E63] focus-visible:ring-primary/20 h-9 font-mono shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] rounded-full pl-4"
              {...register("rate_limit_query", { valueAsNumber: true })}
              required
            />
            {errors.rate_limit_query && (
              <p className="text-[10px] text-rose-600 font-mono mt-0.5">{errors.rate_limit_query.message}</p>
            )}
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-3 border-t border-slate-200/50">
          <Button
            type="submit"
            disabled={updateMutation.isPending}
            className="h-10 px-6 bg-gradient-to-r from-blue-400 to-blue-600 shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-2px_-2px_4px_rgba(255,255,255,0.15)] border-none text-white cursor-pointer font-mono uppercase tracking-wider font-bold rounded-full"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-2 text-white" />
            ) : null}
            Save Blueprint Settings
          </Button>
        </div>

      </form>
    </div>
  );
}
