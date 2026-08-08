/**
 * Implémentation Supabase réelle de OrchestratorStorage (K3 v4)
 * Utilise le client administrateur (service_role, bypass RLS).
 * Toutes les écritures passent par fenced_update_sync_run (conditional write).
 */
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrchestratorStorage, LeaseAcquisitionResult, SyncRunRecord } from "./orchestrator";

export function createOrchestratorStorage(): OrchestratorStorage {
  const supabase = createAdminClient();

  return {
    async acquireLease(sourceKey, periodKey, ownerToken, leaseDurationSeconds, chartSourceId, forceNewRun = false) {
      const rpcName = forceNewRun
        ? "acquire_manual_sync_lease"
        : "acquire_sync_lease";
      const { data, error } = await supabase.rpc(rpcName, {
        p_source_key: sourceKey,
        p_period_key: periodKey,
        p_owner_token: ownerToken,
        p_lease_duration_seconds: leaseDurationSeconds,
        p_chart_source_id: chartSourceId,
      });
      if (error) throw new Error(`${rpcName}: ${error.message}`);
      const row = Array.isArray(data) ? data[0] : data;
      return {
        acquired: !!row?.acquired,
        runId: row?.run_id ?? null,
        ownerToken: row?.owner_token ?? null,
        leaseExpiresAt: row?.lease_expires_at ?? null,
        runStatus: row?.run_status ?? null,
      } as LeaseAcquisitionResult;
    },

    async renewLease(sourceKey, periodKey, ownerToken, leaseDurationSeconds) {
      const { data, error } = await supabase.rpc("renew_sync_lease", {
        p_source_key: sourceKey,
        p_period_key: periodKey,
        p_owner_token: ownerToken,
        p_lease_duration_seconds: leaseDurationSeconds,
      });
      if (error) throw new Error(`renew_sync_lease: ${error.message}`);
      return !!data;
    },

    async releaseLease(sourceKey, periodKey, ownerToken) {
      const { data, error } = await supabase.rpc("release_sync_lease", {
        p_source_key: sourceKey,
        p_period_key: periodKey,
        p_owner_token: ownerToken,
      });
      if (error) throw new Error(`release_sync_lease: ${error.message}`);
      return !!data;
    },

    async fencedUpdate(sourceKey, periodKey, ownerToken, runId, patch) {
      const { data, error } = await supabase.rpc("fenced_update_sync_run", {
        p_source_key: sourceKey,
        p_period_key: periodKey,
        p_owner_token: ownerToken,
        p_run_id: runId,
        p_status: patch.status ?? null,
        p_finished_at: patch.finished_at ?? null,
        p_error_code: patch.error_code ?? null,
        p_error_message: patch.error_message ?? null,
        p_records_received: patch.records_received ?? null,
        p_records_normalized: patch.records_normalized ?? null,
        p_records_matched: patch.records_matched ?? null,
        p_records_rejected: patch.records_rejected ?? null,
        p_metadata: patch.metadata ? JSON.parse(JSON.stringify(patch.metadata)) : null,
        p_clear_error: patch.clear_error ?? false,
      });
      if (error) throw new Error(`fenced_update_sync_run: ${error.message}`);
      return !!data;
    },

    async requestCancellation(sourceKey, periodKey) {
      const { data, error } = await supabase.rpc("request_sync_cancellation", {
        p_source_key: sourceKey,
        p_period_key: periodKey,
      });
      if (error) throw new Error(`request_sync_cancellation: ${error.message}`);
      return !!data;
    },

    async readCancellationFlag(sourceKey, periodKey, ownerToken) {
      const { data, error } = await supabase
        .from("youtube_sync_leases")
        .select("cancel_requested, expires_at, released_at, owner_token")
        .eq("source_key", sourceKey)
        .eq("period_key", periodKey)
        .maybeSingle();
      if (error) throw new Error(`read youtube_sync_leases: ${error.message}`);
      if (!data) return false;
      // Lease must still be valid and ours
      if (data.owner_token !== ownerToken) return false;
      if (data.released_at !== null) return false;
      if (new Date(data.expires_at) < new Date()) return false;
      return !!data.cancel_requested;
    },

    async getChartSourceId(sourceKey) {
      const { data, error } = await supabase
        .from("chart_sources")
        .select("id")
        .eq("source_key", sourceKey)
        .maybeSingle();
      if (error) throw new Error(`read chart_sources: ${error.message}`);
      return (data?.id as string) ?? null;
    },

    async getRun(runId) {
      const { data, error } = await supabase
        .from("sync_runs")
        .select("id, status, started_at, finished_at, error_code, error_message, records_received, records_normalized, records_matched, records_rejected, metadata")
        .eq("id", runId)
        .maybeSingle();
      if (error) throw new Error(`read sync_runs: ${error.message}`);
      if (!data) return null;
      return data as SyncRunRecord;
    },
  };
}
