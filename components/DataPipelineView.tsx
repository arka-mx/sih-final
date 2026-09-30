'use client';

import React, { useMemo, useState } from 'react';
import { CleanedFareItem, MOCK_CLEANED_FARES, MOCK_PIPELINE_AUDIT, PipelineAuditSummary } from '@/lib/mockData';
import { DEMO_MODE } from '@/lib/demoMode';
import { useApiData } from '@/lib/useApiData';
import { LoadingPanel, ErrorPanel } from './ApiStateBanner';
import { CheckCircle2, Play, Ban, RefreshCw } from './icons';
import { StatusTag } from './ui/status-tag';

interface PipelineCleanApiResponse {
  auditSummary: PipelineAuditSummary;
  cleanedRecords: CleanedFareItem[];
}

export default function DataPipelineView() {
  const [filterState, setFilterState] = useState<'ALL' | 'ELIGIBLE' | 'OUTLIERS' | 'DUPLICATES' | 'IMPUTED'>('ALL');

  const pipeline = useApiData<PipelineCleanApiResponse>(DEMO_MODE ? null : '/api/pipeline/clean', []);
  const isProcessing = !DEMO_MODE && pipeline.loading;

  const auditSummary: PipelineAuditSummary = DEMO_MODE
    ? MOCK_PIPELINE_AUDIT
    : pipeline.data?.auditSummary ?? MOCK_PIPELINE_AUDIT;

  const cleanedRecords: CleanedFareItem[] = DEMO_MODE ? MOCK_CLEANED_FARES : pipeline.data?.cleanedRecords ?? [];

  const filteredList = useMemo(
    () =>
      cleanedRecords.filter((rec) => {
        if (filterState === 'ELIGIBLE') return rec.include_in_cpi_index;
        if (filterState === 'OUTLIERS') return rec.is_outlier;
        if (filterState === 'DUPLICATES') return rec.is_duplicate;
        if (filterState === 'IMPUTED') return rec.imputation_applied;
        return true;
      }),
    [cleanedRecords, filterState]
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink-900">Data Cleaning &amp; Outlier Detection</h2>
          <p className="text-xs text-ink-500 mt-1 max-w-lg">
            Normalizes currency, removes duplicate sessions, and filters CPI index eligibility from raw scrape payloads.
          </p>
        </div>

        <button
          onClick={pipeline.refetch}
          disabled={isProcessing || DEMO_MODE}
          className="bg-navy-700 text-white hover:bg-navy-800 text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center justify-center space-x-2 transition-all shrink-0 disabled:opacity-50 cursor-pointer"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Normalizing Data...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Run Cleaning Pipeline</span>
            </>
          )}
        </button>
      </div>

      {!DEMO_MODE && pipeline.loading && !pipeline.data && <LoadingPanel label="Running live cleaning pipeline on APIx backend..." />}
      {!DEMO_MODE && pipeline.error && <ErrorPanel message={pipeline.error} onRetry={pipeline.refetch} />}

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="panel p-4 text-center">
          <span className="text-[11px] text-ink-500 block font-medium">Raw Ingested</span>
          <span className="text-xl font-semibold text-ink-900 font-tabular">{auditSummary.total_raw_ingested}</span>
        </div>

        <div className="panel p-4 text-center">
          <span className="text-[11px] text-ink-500 block font-medium">Duplicates Merged</span>
          <span className="text-xl font-semibold text-amber-600 font-tabular">{auditSummary.duplicates_merged}</span>
        </div>

        <div className="panel p-4 text-center">
          <span className="text-[11px] text-ink-500 block font-medium">Outliers Flagged</span>
          <span className="text-xl font-semibold text-rose-600 font-tabular">{auditSummary.outliers_flagged}</span>
        </div>

        <div className="panel p-4 text-center">
          <span className="text-[11px] text-ink-500 block font-medium">Imputed Fares</span>
          <span className="text-xl font-semibold text-navy-700 font-tabular">{auditSummary.imputed_records_count}</span>
        </div>

        <div className="panel p-4 text-center">
          <span className="text-[11px] text-ink-500 block font-medium">Sold Out (Logged)</span>
          <span className="text-xl font-semibold text-ink-400 font-tabular">{auditSummary.sold_out_excluded}</span>
        </div>

        <div className="panel p-4 text-center">
          <span className="text-[11px] text-ink-500 block font-medium">CPI Eligible Basket</span>
          <span className="text-xl font-semibold text-emerald-700 font-tabular">{auditSummary.cpi_eligible_records}</span>
        </div>
      </div>

      {/* 5-Stage Pipeline Process Diagram */}
      <div className="panel p-6 space-y-4">
        <h3 className="text-sm font-semibold text-ink-900">Normalization Pipeline</h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
          {[
            { label: 'Parser & Mapping', body: 'Extracts core schema attributes (carrier, flight_no, dates, taxes/UDF, convenience fee, base fare).' },
            { label: 'Currency & Imputation', body: 'Cleans ₹ strings and applies the standard 78% base-fare / 22% taxes & UDF split when a leg is missing.' },
            { label: 'De-duplication', body: 'Fingerprints carrier-flight-departure-window-source to prevent duplicate scrape inflation.' },
            { label: 'IQR & Z-Score Filter', body: 'Calculates Q1, Q3, IQR and flags extreme fares (|Z| > 2.5) per route-window.' },
            { label: 'Basket Verification', body: 'Flags sold-out / cancelled flights for load-factor analytics while keeping CPI index pure.' },
          ].map((stage, idx) => (
            <div key={stage.label} className="p-3 bg-ink-50 border border-ink-100 rounded-lg space-y-1.5">
              <span className="w-5 h-5 rounded-full bg-ink-900 text-white text-[10px] font-semibold flex items-center justify-center font-tabular">
                {idx + 1}
              </span>
              <span className="font-semibold text-ink-900 block">{stage.label}</span>
              <p className="text-[11px] text-ink-500">{stage.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Tabs & Cleaned Records Table */}
      <div className="panel p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-ink-900">Cleaned &amp; Audited Fare Records</h3>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-ink-100">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'ELIGIBLE', label: 'CPI Eligible' },
            { id: 'OUTLIERS', label: 'Outliers' },
            { id: 'DUPLICATES', label: 'Duplicates' },
            { id: 'IMPUTED', label: 'Imputed' },
          ].map((f) => {
            const isActive = filterState === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilterState(f.id as 'ALL' | 'ELIGIBLE' | 'OUTLIERS' | 'DUPLICATES' | 'IMPUTED')}
                className={`relative shrink-0 px-3 py-2.5 text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  isActive ? 'text-navy-800' : 'text-ink-500 hover:text-ink-800'
                }`}
              >
                <span className={isActive ? 'font-semibold' : ''}>{f.label}</span>
                {isActive && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-navy-700" />}
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto border border-ink-100 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-ink-50 text-ink-700 font-semibold text-[10px] uppercase tracking-wider border-b border-ink-100">
              <tr>
                <th className="p-3">Record ID</th>
                <th className="p-3">Route</th>
                <th className="p-3">Carrier / Flight</th>
                <th className="p-3">Lead Days</th>
                <th className="p-3">Base Fare</th>
                <th className="p-3">Taxes &amp; UDF</th>
                <th className="p-3">Total Fare</th>
                <th className="p-3">Z-Score</th>
                <th className="p-3">Availability</th>
                <th className="p-3">Audit Status</th>
                <th className="p-3">CPI Basket</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filteredList.map((rec) => (
                <tr key={rec.id} className="hover:bg-ink-50/60 transition-colors">
                  <td className="p-3 font-mono text-[11px] text-navy-700 font-semibold">{rec.id}</td>
                  <td className="p-3 font-semibold text-ink-900 font-mono text-[11px]">{rec.origin} → {rec.destination}</td>
                  <td className="p-3">
                    <span className="font-semibold text-ink-900">{rec.carrier}</span>
                    <span className="text-[10px] text-ink-500 block font-mono">{rec.flight_no}</span>
                  </td>
                  <td className="p-3 font-tabular">T+{rec.advance_days}</td>
                  <td className="p-3 font-tabular">₹{rec.base_fare.toLocaleString()}</td>
                  <td className="p-3 text-ink-500 font-tabular">₹{rec.taxes_udf.toLocaleString()}</td>
                  <td className="p-3 font-semibold text-ink-900 font-tabular">₹{rec.total_fare.toLocaleString()}</td>
                  <td className="p-3 font-mono text-[11px]">
                    <span className={Math.abs(rec.z_score) > 2.0 ? 'text-rose-600 font-semibold' : 'text-ink-500'}>
                      {rec.z_score > 0 ? `+${rec.z_score}` : rec.z_score}
                    </span>
                  </td>
                  <td className="p-3">
                    {rec.seat_availability_flag === 'AVAILABLE' && <StatusTag tone="success">Available</StatusTag>}
                    {rec.seat_availability_flag === 'FEW_SEATS_LEFT' && <StatusTag tone="warning">Few Seats</StatusTag>}
                    {(rec.seat_availability_flag === 'SOLD_OUT' || rec.seat_availability_flag === 'CANCELLED') && (
                      <StatusTag tone="danger" icon={Ban}>{rec.seat_availability_flag === 'SOLD_OUT' ? 'Sold Out' : 'Cancelled'}</StatusTag>
                    )}
                  </td>
                  <td className="p-3 space-y-0.5">
                    {rec.is_duplicate && <StatusTag tone="warning">Duplicate Merged</StatusTag>}
                    {rec.is_outlier && (
                      <StatusTag tone="danger" className="block" >
                        <span title={rec.outlier_reason ?? undefined}>Outlier Flagged</span>
                      </StatusTag>
                    )}
                    {rec.imputation_applied && (
                      <StatusTag tone="info" className="block">Imputed ({rec.imputed_fields.join(', ')})</StatusTag>
                    )}
                    {!rec.is_duplicate && !rec.is_outlier && !rec.imputation_applied && (
                      <StatusTag tone="success">Verified Clean</StatusTag>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {rec.include_in_cpi_index ? (
                      <StatusTag tone="success" icon={CheckCircle2} className="text-[11px]">Included</StatusTag>
                    ) : (
                      <StatusTag tone="neutral" icon={Ban} className="text-[11px]">Excluded</StatusTag>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
