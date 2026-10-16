import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { getRollByRollId, submitInspection, updateDispatchStatus } from '../services/rollService';
import { qualityService } from '../services/qualityService';
import { getMachines } from '../services/machineService';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { buildRollUrl, buildRollInfoText, buildRollJsonSpec, DEFAULT_LAN_IP } from '../utils/qrUtils';
import { formatNumber, formatDate } from '../utils/formatters';
import {
  ArrowLeft,
  QrCode,
  Printer,
  Calendar,
  Layers,
  Cpu,
  User,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Send,
  RotateCcw,
  Truck,
  Search,
  ExternalLink,
  Copy,
  Smartphone,
  Globe,
  Wifi,
  Plus,
  Trash2,
  ChevronRight,
  Calculator,
  ArrowRight,
  ShieldAlert,
  Info,
} from 'lucide-react';

const STAGE_CONFIGS = [
  { code: 'GREY', label: '1. Grey Weave', short: 'Grey', machineType: 'loom / knitting' },
  { code: 'DYEING', label: '2. Dyeing', short: 'Dyeing', machineType: 'dyeing_vat' },
  { code: 'FINISHING', label: '3. Finishing', short: 'Finishing', machineType: 'finishing_range' },
  { code: 'FINAL', label: '4. Final QC', short: 'Final QC', machineType: 'manual table' },
];

export const Passport = () => {
  const { rollId } = useParams();
  const [roll, setRoll] = useState(null);
  const [qualityConfig, setQualityConfig] = useState(null);
  const [allMachines, setAllMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // QR Configuration state (Default: 'url' to link to the digital fabric passport)
  const [qrContentMode, setQrContentMode] = useState('url'); // 'url' | 'text' | 'json'
  const [selectedHostMode, setSelectedHostMode] = useState('online');
  const [customHostUrl, setCustomHostUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Defect Rows Form State
  const [defects, setDefects] = useState([]);
  const [inspectionResult, setInspectionResult] = useState('PASS');
  const [defectNotes, setDefectNotes] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [inspectorName, setInspectorName] = useState('');
  const [inspectionSubmitting, setInspectionSubmitting] = useState(false);
  const [inspectionError, setInspectionError] = useState(null);
  const [inspectionSuccess, setInspectionSuccess] = useState(false);

  // Live Preview State
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Advance Stage State
  const [selectedMachineCode, setSelectedMachineCode] = useState('');
  const [advanceSubmitting, setAdvanceSubmitting] = useState(false);
  const [advanceError, setAdvanceError] = useState(null);
  const [advanceSuccess, setAdvanceSuccess] = useState(false);

  // Dispatch action state
  const [dispatchSubmitting, setDispatchSubmitting] = useState(false);
  const [dispatchError, setDispatchError] = useState(null);
  const [dispatchSuccess, setDispatchSuccess] = useState(false);

  // Custom search box for 404 state
  const [notFoundSearch, setNotFoundSearch] = useState('');

  const fetchPassportAndConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rollRes, cfgRes, machRes] = await Promise.all([
        getRollByRollId(rollId),
        qualityService.getConfig().catch(() => null),
        getMachines().catch(() => ({ machines: [] })),
      ]);
      setRoll(rollRes.roll);
      setQualityConfig(cfgRes);
      setAllMachines(machRes.machines || []);
      setDefectNotes('');
      setOverrideReason('');
      setDefects([]);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [rollId]);

  useEffect(() => {
    fetchPassportAndConfig();
  }, [fetchPassportAndConfig]);

  // Live debounced preview calculation
  useEffect(() => {
    if (!roll || !roll.rollId) return;

    let isMounted = true;
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await qualityService.previewInspection(roll.rollId, {
          defects,
          result: inspectionResult,
          defectNotes,
          overrideReason,
        });
        if (isMounted) {
          setPreview(res.preview);
        }
      } catch (err) {
        // Silent catch for preview
      } finally {
        if (isMounted) setPreviewLoading(false);
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [roll?.rollId, roll?.stage, defects, inspectionResult, overrideReason, defectNotes]);

  const currentStage = roll?.stage || 'GREY';
  const stageCatalog = (qualityConfig?.defectCatalog && qualityConfig.defectCatalog[currentStage])
    ? (currentStage === 'FINAL' ? Object.values(qualityConfig.allDefects || {}) : qualityConfig.defectCatalog[currentStage])
    : (qualityConfig?.allDefects ? Object.values(qualityConfig.allDefects) : []);

  const getActiveQrBaseUrl = () => {
    if (selectedHostMode === 'online') {
      return (
        import.meta.env?.VITE_PUBLIC_APP_URL ||
        (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')
      );
    }
    if (selectedHostMode === 'lan') {
      return `http://${DEFAULT_LAN_IP}:5173`;
    }
    if (selectedHostMode === 'custom' && customHostUrl.trim()) {
      return customHostUrl.trim();
    }
    return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  };

  const rollInfoText = roll ? buildRollInfoText(roll) : '';
  const rollJsonSpec = roll ? buildRollJsonSpec(roll) : '';
  const activeQrUrl = roll ? buildRollUrl(roll.rollId, getActiveQrBaseUrl()) : '';

  // Current scannable payload: defaults to human-readable item specifications
  const activeQrPayload = qrContentMode === 'text'
    ? rollInfoText
    : qrContentMode === 'json'
    ? rollJsonSpec
    : activeQrUrl;

  const handleCopyPayload = () => {
    if (activeQrPayload) {
      navigator.clipboard.writeText(activeQrPayload);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // Defect row management
  const handleAddDefect = () => {
    const defaultCode = stageCatalog.length > 0 ? stageCatalog[0].code : 'BROKEN_END';
    setDefects((prev) => [...prev, { code: defaultCode, severity: 'MINOR', quantity: 1 }]);
  };

  const handleRemoveDefect = (index) => {
    setDefects((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateDefect = (index, field, val) => {
    setDefects((prev) =>
      prev.map((d, idx) => (idx === index ? { ...d, [field]: val } : d))
    );
  };

  const handleInspectionSubmit = async (e) => {
    e.preventDefault();

    if (inspectionResult === 'REJECT') {
      const confirmed = window.confirm(
        '⚠️ Are you sure you want to REJECT this roll at the ' + currentStage + ' gate? This stops the roll from advancing.'
      );
      if (!confirmed) return;
    }

    setInspectionSubmitting(true);
    setInspectionError(null);
    setInspectionSuccess(false);

    try {
      const payload = {
        result: inspectionResult,
        defects,
        defectNotes,
        overrideReason: overrideReason.trim() || undefined,
        inspectorName: inspectorName.trim() || undefined,
      };
      const res = await submitInspection(roll.rollId, payload);
      setRoll(res.roll);
      setDefects([]);
      setDefectNotes('');
      setOverrideReason('');
      setInspectionSuccess(true);
      setTimeout(() => setInspectionSuccess(false), 4000);
    } catch (err) {
      setInspectionError(err.message || 'Inspection submission failed');
    } finally {
      setInspectionSubmitting(false);
    }
  };

  const handleAdvanceStage = async () => {
    setAdvanceSubmitting(true);
    setAdvanceError(null);
    setAdvanceSuccess(false);

    try {
      const payload = selectedMachineCode ? { machineCode: selectedMachineCode } : {};
      const res = await qualityService.advanceStage(roll.rollId, payload);
      setRoll(res.roll);
      setSelectedMachineCode('');
      setAdvanceSuccess(true);
      setTimeout(() => setAdvanceSuccess(false), 4000);
    } catch (err) {
      setAdvanceError(err.message || 'Stage advancement failed');
    } finally {
      setAdvanceSubmitting(false);
    }
  };

  const handleDispatchTransition = async (targetStatus) => {
    if (targetStatus === 'DISPATCHED') {
      const confirmed = window.confirm(
        '🚚 Are you sure you want to mark this roll as DISPATCHED? This is a terminal state.'
      );
      if (!confirmed) return;
    }

    setDispatchSubmitting(true);
    setDispatchError(null);
    setDispatchSuccess(false);

    try {
      const res = await updateDispatchStatus(roll.rollId, { dispatchStatus: targetStatus });
      setRoll(res.roll);
      setDispatchSuccess(true);
      setTimeout(() => setDispatchSuccess(false), 4000);
    } catch (err) {
      setDispatchError(err.message || 'Dispatch status update failed');
    } finally {
      setDispatchSubmitting(false);
    }
  };

  const handlePrintLabel = () => {
    window.print();
  };

  if (loading) return <LoadingState message={`Accessing Stage Quality Passport for ${rollId}...`} />;

  // 404 Roll Not Found
  if (error && (error.status === 404 || error.code === 'ROLL_NOT_FOUND')) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-6">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 inline-block shadow-sm">
          <QrCode className="w-12 h-12 text-rose-500 mx-auto" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fabric Roll Passport Not Found</h1>
          <p className="text-xs font-mono text-slate-700 mt-2 bg-slate-100 py-1.5 px-3 rounded-lg inline-block border border-slate-200">
            Scanned ID: <span className="text-rose-600 font-bold">{rollId}</span>
          </p>
          <p className="text-sm text-slate-600 mt-2">
            No digital passport exists with this identifier. The roll may have been deleted or the QR code is invalid.
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
          <label className="block text-xs font-bold text-slate-700 text-left">Search Roll Registry</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. FR-2026-000001"
              value={notFoundSearch}
              onChange={(e) => setNotFoundSearch(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 uppercase focus:outline-none focus:border-teal-500 font-mono"
            />
            <Link
              to={`/rolls/${notFoundSearch.trim().toUpperCase()}`}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 shadow-xs"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search</span>
            </Link>
          </div>
        </div>

        <div>
          <Link
            to="/rolls"
            className="inline-flex items-center gap-2 text-xs font-semibold text-teal-700 hover:text-teal-800"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Fabric Rolls Registry</span>
          </Link>
        </div>
      </div>
    );
  }

  // 400 Malformed / Invalid Roll ID
  if (error && (error.status === 400 || error.code === 'INVALID_ROLL_ID_FORMAT')) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-6">
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 inline-block shadow-sm">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invalid Roll Identifier Format</h1>
          <p className="text-xs font-mono text-slate-700 mt-2 bg-slate-100 py-1.5 px-3 rounded-lg inline-block border border-slate-200">
            Scanned ID: <span className="text-amber-700 font-bold">{rollId}</span>
          </p>
          <p className="text-sm text-slate-600 mt-2">
            The provided identifier is not a valid fabric roll ID format. Expected standard format e.g. <span className="font-mono font-semibold">FR-2026-000001</span>.
          </p>
        </div>
        <div>
          <Link
            to="/rolls"
            className="inline-flex items-center gap-2 text-xs font-semibold text-teal-700 hover:text-teal-800"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Fabric Rolls Registry</span>
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Failed to load Fabric Passport" error={error} onRetry={fetchPassportAndConfig} />;
  }

  if (!roll) return null;

  const allowed = roll.allowedActions || {
    canInspect: true,
    canAdvance: false,
    nextStage: null,
    blockReason: null,
    canMarkReady: false,
    canUnready: false,
    canDispatch: false,
  };

  // Determine stage gate status for stepper
  const currentStageIndex = STAGE_CONFIGS.findIndex((s) => s.code === roll.stage);
  const nextStageInfo = qualityConfig?.stages ? qualityConfig.stages[allowed.nextStage] : null;
  const allowedNextMachines = nextStageInfo
    ? allMachines.filter((m) => nextStageInfo.machineTypes?.includes(m.type))
    : [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Printable Label Section */}
      <div className="hidden print:block print:p-8 print:text-black print:bg-white text-center space-y-4 font-mono">
        <h1 className="text-2xl font-bold uppercase tracking-wider">LoomIQ Stage Quality Passport</h1>
        <div className="flex justify-center my-4">
          <QRCodeSVG value={activeQrPayload} size={220} level="M" />
        </div>
        <div className="text-xl font-bold">{roll.rollId}</div>
        <div className="text-sm">Stage: {roll.stage} | Status: {roll.qualityStatus}</div>
        <div className="text-sm">Order: {roll.order?.orderNumber || 'N/A'} ({roll.order?.buyer || 'Standard'})</div>
        <div className="text-sm">Length: {formatNumber(roll.quantityMetres)} Metres</div>
        <div className="text-xs text-gray-500 mt-4">Scan QR with any phone camera or handheld scanner to view item specifications</div>
      </div>

      {/* Screen Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <Link
          to="/rolls"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-teal-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Fabric Rolls</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrintLabel}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs transition-all"
          >
            <Printer className="w-3.5 h-3.5 text-teal-600" />
            <span>Print QR Label</span>
          </button>
        </div>
      </div>

      {/* Main Passport Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm print:hidden space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200/80 flex items-center gap-1.5 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                Digital Fabric Passport • Provenance Verified
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Asset #{roll.rollId}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-2xl md:text-3xl font-bold font-mono text-slate-900 tracking-tight flex items-center gap-2">
                <QrCode className="w-7 h-7 text-teal-600" />
                {roll.rollId}
              </span>
              <StatusBadge type="stage" value={roll.stage} />
              <StatusBadge type="quality" value={roll.qualityStatus} />
              <StatusBadge type="dispatch" value={roll.dispatchStatus} />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Tamper-evident shopfloor ledger tracking composition, physical inspections, and chain of custody
            </p>
          </div>

          <div className="flex flex-col md:items-end gap-1">
            <span className="text-xs text-slate-500 font-mono">
              Stage Entered: {formatDate(roll.stageEnteredAt || roll.createdAt)}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Created: {formatDate(roll.createdAt)}
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FABRIC ROLL LIFECYCLE TIMELINE (SAFE BUILD FROM EXISTING RECORDS) */}
        {/* ========================================================================= */}
        <div className="bg-slate-50/90 p-5 rounded-2xl border border-slate-200/90 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600" />
              <span>Digital Roll Lifecycle & Provenance Timeline</span>
            </span>
            <span className="text-[10px] font-mono text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200/60 font-semibold">
              {(roll.inspections?.length || 0) + 2} Lifecycle Milestones
            </span>
          </div>

          <div className="relative pl-6 space-y-3.5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {/* 1. Origin Milestone */}
            <div className="relative">
              <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] font-bold ring-4 ring-white shadow-2xs">
                ✓
              </div>
              <div className="text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <strong className="text-slate-900">1. Weaving Output & Passport Registration</strong>
                  <span className="text-slate-400">•</span>
                  <span className="font-mono text-slate-500">{formatDate(roll.createdAt)}</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Woven on Loom <strong className="font-mono text-slate-900">{roll.machine?.code || 'LM-01'}</strong> for Order <strong className="font-mono text-teal-700">{roll.order?.orderNumber || 'Standard'}</strong> ({formatNumber(roll.quantityMetres)} metres).
                </p>
              </div>
            </div>

            {/* 2. Inspection Events */}
            {(roll.inspections || []).map((insp, iIdx) => (
              <div key={insp._id || iIdx} className="relative">
                <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ring-4 ring-white shadow-2xs ${
                  insp.result === 'PASS' ? 'bg-emerald-600 text-white' : insp.result === 'REWORK' ? 'bg-amber-500 text-white' : 'bg-rose-600 text-white'
                }`}>
                  {insp.result === 'PASS' ? '✓' : insp.result === 'REWORK' ? '↻' : '✕'}
                </div>
                <div className="text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong className="text-slate-900">Stage Gate {insp.stage || 'GREY'} Inspection</strong>
                    <StatusBadge type="quality" value={insp.result} />
                    <span className="text-slate-400">•</span>
                    <span className="font-mono text-slate-500">{formatDate(insp.inspectedAt)}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Inspector: <span className="font-medium text-slate-800">{insp.inspectorName || 'Lead Inspector'}</span> — {insp.defectPoints || 0} defect pts ({insp.pointsPer100m || 0} pts/100m). {insp.defectNotes ? `Notes: "${insp.defectNotes}"` : 'Clean run.'}
                  </p>
                </div>
              </div>
            ))}

            {/* 3. Dispatch & Custody Status */}
            <div className="relative">
              <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ring-4 ring-white shadow-2xs ${
                roll.dispatchStatus === 'DISPATCHED' ? 'bg-sky-600 text-white' : roll.dispatchStatus === 'READY_FOR_DISPATCH' ? 'bg-teal-600 text-white' : 'bg-slate-300 text-slate-700'
              }`}>
                {roll.dispatchStatus === 'DISPATCHED' ? '✓' : roll.dispatchStatus === 'READY_FOR_DISPATCH' ? '•' : '○'}
              </div>
              <div className="text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <strong className="text-slate-900">Chain of Custody & Dispatch Gateway</strong>
                  <StatusBadge type="dispatch" value={roll.dispatchStatus} />
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {roll.dispatchStatus === 'DISPATCHED'
                    ? 'Fabric roll securely shipped to buyer destination.'
                    : roll.dispatchStatus === 'READY_FOR_DISPATCH'
                    ? 'Quality certified. Staged at warehouse loading dock for dispatch.'
                    : 'Roll currently staged in active shopfloor pipeline.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* STAGE GATES STEPPER (GREY -> DYEING -> FINISHING -> FINAL) */}
        {/* ========================================================================= */}
        <div className="space-y-3 bg-slate-50 p-4 md:p-5 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>Production Quality Gates Pipeline</span>
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              Stage {currentStageIndex + 1} of 4
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {STAGE_CONFIGS.map((st, idx) => {
              const isPast = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              const isFuture = idx > currentStageIndex;

              const stageHist = (roll.stageHistory || []).find((h) => h.stage === st.code);
              const stageInsp = (roll.inspections || []).find((insp) => insp.stage === st.code);

              let gateBadge = null;
              if (isPast) {
                gateBadge = <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">Passed ✓</span>;
              } else if (isCurrent) {
                if (roll.qualityStatus === 'PASS') {
                  gateBadge = <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">Gate Passed</span>;
                } else if (roll.qualityStatus === 'REWORK') {
                  gateBadge = <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">Rework ↻</span>;
                } else if (roll.qualityStatus === 'REJECT') {
                  gateBadge = <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">Rejected ✕</span>;
                } else {
                  gateBadge = <span className="text-[10px] font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded-md">Pending QC</span>;
                }
              } else {
                gateBadge = <span className="text-[10px] font-medium text-slate-400">Locked</span>;
              }

              return (
                <div
                  key={st.code}
                  className={`p-3 rounded-xl border transition-all ${
                    isCurrent
                      ? 'bg-white border-teal-500 shadow-sm ring-2 ring-teal-500/20'
                      : isPast
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-slate-100/70 border-slate-200 opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-bold ${isCurrent ? 'text-teal-900' : isPast ? 'text-emerald-900' : 'text-slate-600'}`}>
                      {st.short}
                    </span>
                    {gateBadge}
                  </div>

                  <div className="text-[11px] text-slate-500 font-mono truncate">
                    Machine: {stageHist?.machineCode || (isCurrent && roll.machine?.code) || '—'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {stageHist?.enteredAt ? formatDate(stageHist.enteredAt) : (isCurrent ? formatDate(roll.stageEnteredAt) : 'Pending')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Notifications */}
        {inspectionSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 text-xs font-medium shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>Inspection recorded successfully! Stage gate verdict and points calculated.</span>
          </div>
        )}

        {advanceSuccess && (
          <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 flex items-center gap-3 text-teal-900 text-xs font-medium shadow-xs">
            <ArrowRight className="w-5 h-5 text-teal-600 flex-shrink-0" />
            <span>Fabric roll advanced to next quality stage! Quality status reset to PENDING for the new gate.</span>
          </div>
        )}

        {dispatchSuccess && (
          <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 flex items-center gap-3 text-sky-900 text-xs font-medium shadow-xs">
            <Truck className="w-5 h-5 text-sky-600 flex-shrink-0" />
            <span>Dispatch status updated successfully!</span>
          </div>
        )}

        {/* Traceability & QR Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-teal-700 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span>Production Origin & Specifications</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">Production Work Order</span>
                {roll.order ? (
                  <Link
                    to={`/orders/${roll.order.orderNumber}`}
                    className="font-mono font-bold text-teal-700 hover:underline inline-flex items-center gap-1 mt-0.5"
                  >
                    <span>{roll.order.orderNumber}</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                ) : (
                  <span className="text-slate-400 italic">Unlinked</span>
                )}
                <span className="text-[11px] text-slate-500 block truncate mt-0.5">
                  Buyer: {roll.order?.buyer || '—'}
                </span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">Current Stage Workcenter</span>
                <span className="font-mono font-bold text-slate-900 text-sm block mt-0.5">
                  {roll.machine?.machineCode || roll.machine?.code || 'None (Manual QA)'}
                </span>
                <span className="text-[11px] text-slate-500 block truncate mt-0.5">
                  {roll.machine?.name || 'Inspection Staging'} ({roll.machine?.type || 'table'})
                </span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">Roll Length</span>
                <span className="text-lg font-bold font-mono text-slate-900 mt-0.5 block">
                  {formatNumber(roll.quantityMetres)} <span className="text-xs font-normal text-slate-500">metres</span>
                </span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">Fabric Specification</span>
                <span className="font-bold text-slate-800 truncate block mt-0.5">
                  {roll.order?.fabricType || 'Standard Textile'}
                </span>
              </div>
            </div>

            {/* Advance Stage Card */}
            {roll.stage !== 'FINAL' && roll.dispatchStatus !== 'DISPATCHED' && (
              <div className="bg-teal-50/70 p-4 rounded-xl border border-teal-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-teal-700" />
                    <span className="text-xs font-bold text-teal-900">
                      Stage Gate Advancement: {currentStage} → {allowed.nextStage || 'Next Stage'}
                    </span>
                  </div>
                  {allowed.canAdvance ? (
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded-md">
                      Eligible to Advance
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-md">
                      Gate Blocked
                    </span>
                  )}
                </div>

                {advanceError && (
                  <div className="p-2.5 rounded-lg bg-rose-100 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>{advanceError}</span>
                  </div>
                )}

                {!allowed.canAdvance ? (
                  <p className="text-xs text-amber-900">
                    ⚠️ <strong>Block Reason:</strong> {allowed.blockReason || 'Inspection with PASS verdict required to unlock next stage.'}
                  </p>
                ) : (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                    {allowedNextMachines.length > 0 && (
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-teal-900 mb-1">
                          Assign {allowed.nextStage} Workcenter <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={selectedMachineCode}
                          onChange={(e) => setSelectedMachineCode(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-teal-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-teal-600"
                        >
                          <option value="">-- Select Workcenter ({nextStageInfo?.machineTypes?.join(', ')}) --</option>
                          {allowedNextMachines.map((m) => (
                            <option key={m.code} value={m.code}>
                              {m.code} - {m.name} ({m.type})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleAdvanceStage}
                      disabled={advanceSubmitting || (allowedNextMachines.length > 0 && !selectedMachineCode)}
                      className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-50 transition-all self-end sm:self-auto inline-flex items-center gap-2"
                    >
                      <ArrowRight className="w-4 h-4" />
                      <span>{advanceSubmitting ? 'Advancing Stage...' : `Advance to ${allowed.nextStage}`}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Scannable QR Identity Card */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-center space-y-4 shadow-2xs">
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" />
                <span>Fabric Passport QR</span>
              </span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                qrContentMode === 'text'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-teal-100 text-teal-800 border-teal-300'
              }`}>
                {qrContentMode === 'text' ? 'Direct Info (No Redirect)' : qrContentMode === 'json' ? 'JSON Spec' : 'Web Link'}
              </span>
            </div>

            {/* QR Content Mode Switcher Tabs */}
            <div className="w-full flex p-1 bg-slate-200/80 rounded-xl text-[11px] font-semibold gap-1">
              <button
                type="button"
                onClick={() => setQrContentMode('text')}
                className={`flex-1 py-1.5 px-2 rounded-lg transition-all ${
                  qrContentMode === 'text'
                    ? 'bg-white text-teal-800 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Item Info
              </button>
              <button
                type="button"
                onClick={() => setQrContentMode('url')}
                className={`flex-1 py-1.5 px-2 rounded-lg transition-all ${
                  qrContentMode === 'url'
                    ? 'bg-white text-teal-800 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Web Link
              </button>
              <button
                type="button"
                onClick={() => setQrContentMode('json')}
                className={`flex-1 py-1.5 px-2 rounded-lg transition-all ${
                  qrContentMode === 'json'
                    ? 'bg-white text-teal-800 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                JSON Data
              </button>
            </div>

            {/* QR SVG */}
            <div className="p-3.5 bg-white rounded-2xl shadow-xs border border-slate-200 inline-block">
              <QRCodeSVG value={activeQrPayload} size={175} level="M" includeMargin={false} />
            </div>

            <div className="w-full space-y-2 text-left">
              {qrContentMode === 'text' ? (
                <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 p-2 rounded-xl flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-emerald-600" />
                  <span>
                    <strong>Direct Item Info Active:</strong> Scanning this QR directly displays the item details on any phone camera without opening a webpage.
                  </span>
                </p>
              ) : qrContentMode === 'url' ? (
                <div className="space-y-2">
                  <div className="flex gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setSelectedHostMode('online')}
                      className={`flex-1 py-1 px-2 rounded-lg font-bold border transition-all flex items-center justify-center gap-1 ${
                        selectedHostMode === 'online'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Globe className="w-3 h-3" />
                      <span>Live Online</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedHostMode('lan')}
                      className={`py-1 px-2 rounded-lg font-semibold border transition-all flex items-center justify-center gap-1 ${
                        selectedHostMode === 'lan'
                          ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Wifi className="w-3 h-3" />
                      <span>Wi-Fi</span>
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Payload Preview */}
              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="font-bold text-slate-700">Scanner Content:</span>
                <button
                  onClick={handleCopyPayload}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-800 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedLink ? 'Copied!' : 'Copy Info'}</span>
                </button>
              </div>

              <div className="text-[10px] font-mono text-slate-800 bg-white p-2.5 rounded-xl border border-slate-200 max-h-32 overflow-y-auto whitespace-pre-wrap break-all shadow-2xs">
                {activeQrPayload}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STAGE INSPECTION FORM & LIVE VERDICT EXPLAINER PANEL */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:hidden">
        {/* Left 7 Cols: Defect Recording & Verdict Selector Form */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-600" />
              <h2 className="font-bold text-slate-900 text-base">
                Inspect Stage Gate: <span className="text-teal-700 font-mono">{currentStage}</span>
              </h2>
            </div>
            <StatusBadge type="quality" value={roll.qualityStatus} />
          </div>

          {!allowed.canInspect ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-600 flex-shrink-0" />
              <span>
                Roll is <strong>{roll.dispatchStatus === 'DISPATCHED' ? 'DISPATCHED' : 'REJECTED'}</strong>. Quality inspection is locked.
              </span>
            </div>
          ) : (
            <form onSubmit={handleInspectionSubmit} className="space-y-4">
              {inspectionError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{inspectionError}</span>
                </div>
              )}

              {/* Defect Item Rows */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Recorded Defect Catalog Items ({defects.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddDefect}
                    className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Defect</span>
                  </button>
                </div>

                {defects.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center text-xs text-slate-500">
                    No defects added yet. Fabric is assessed as zero-defect clean.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {defects.map((def, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row gap-2 items-start sm:items-center text-xs"
                      >
                        {/* Defect Code Select */}
                        <div className="flex-1 w-full">
                          <select
                            value={def.code}
                            onChange={(e) => handleUpdateDefect(idx, 'code', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-teal-600"
                          >
                            {stageCatalog.map((cat) => (
                              <option key={cat.code} value={cat.code}>
                                {cat.label} ({cat.code})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Severity Select */}
                        <div className="w-28">
                          <select
                            value={def.severity}
                            onChange={(e) => handleUpdateDefect(idx, 'severity', e.target.value)}
                            className={`w-full px-2 py-1.5 rounded-lg text-xs font-bold border focus:outline-none ${
                              def.severity === 'CRITICAL'
                                ? 'bg-rose-50 text-rose-700 border-rose-300'
                                : def.severity === 'MAJOR'
                                ? 'bg-amber-50 text-amber-700 border-amber-300'
                                : 'bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                          >
                            <option value="MINOR">MINOR (1 pt)</option>
                            <option value="MAJOR">MAJOR (3 pts)</option>
                            <option value="CRITICAL">CRITICAL (5 pts)</option>
                          </select>
                        </div>

                        {/* Quantity */}
                        <div className="w-20 flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            max="999"
                            value={def.quantity}
                            onChange={(e) => handleUpdateDefect(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-center font-bold text-slate-800 focus:outline-none focus:border-teal-600"
                          />
                          <span className="text-[10px] text-slate-400">qty</span>
                        </div>

                        {/* Remove Button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveDefect(idx)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Remove defect"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Inspector Result Decision */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Final Inspector Verdict Decision <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setInspectionResult('PASS')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      inspectionResult === 'PASS'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ✓ PASS
                  </button>

                  <button
                    type="button"
                    onClick={() => setInspectionResult('REWORK')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      inspectionResult === 'REWORK'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ↻ REWORK
                  </button>

                  <button
                    type="button"
                    onClick={() => setInspectionResult('REJECT')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      inspectionResult === 'REJECT'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ✕ REJECT
                  </button>
                </div>
              </div>

              {/* Lenient Override Reason Field (Appears conditionally) */}
              {preview?.requiresOverrideReason && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <ShieldAlert className="w-4 h-4 text-amber-700" />
                    <span>Lenient Override Justification Required (≥ 10 characters)</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Your chosen verdict (<strong>{inspectionResult}</strong>) is more lenient than the calculated recommendation (<strong>{preview?.recommendedResult}</strong>). Factory SOP requires entering a formal justification reason.
                  </p>
                  <textarea
                    rows="2"
                    maxLength={300}
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Enter formal reason (e.g. Concession waiver approved by buyer QA manager under #WAIV-2026-04)..."
                    required
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-amber-600 font-medium"
                  />
                </div>
              )}

              {/* Defect Notes with Counter */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Defect Notes & Observations{' '}
                    {(inspectionResult === 'REWORK' || inspectionResult === 'REJECT') && (
                      <span className="text-rose-500 font-bold">* (Required for REWORK/REJECT)</span>
                    )}
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    {defectNotes.length}/500
                  </span>
                </div>
                <textarea
                  rows="2"
                  maxLength={500}
                  value={defectNotes}
                  onChange={(e) => setDefectNotes(e.target.value)}
                  placeholder={
                    inspectionResult === 'PASS'
                      ? 'Optional remarks (e.g. 4-point inspection approved, uniform tension)'
                      : 'Describe defects, slub locations, shade variations, or needle line damage...'
                  }
                  required={inspectionResult === 'REWORK' || inspectionResult === 'REJECT'}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Inspector Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Inspector Name / ID <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  maxLength={80}
                  placeholder="e.g. Devon Vance (QA Lead)"
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="pt-1 flex justify-end">
                <button
                  type="submit"
                  disabled={inspectionSubmitting || (preview?.requiresOverrideReason && overrideReason.trim().length < 10)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{inspectionSubmitting ? 'Recording Inspection...' : `Certify ${currentStage} Gate`}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right 5 Cols: Live Recommended Verdict & Explainability Calculation Trace */}
        <div className="lg:col-span-5 bg-slate-900 text-white rounded-2xl p-6 shadow-md space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-teal-400" />
                <h3 className="font-bold text-white text-sm">Deterministic Verdict Engine</h3>
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-teal-900/60 text-teal-300 border border-teal-700/50">
                Live Preview
              </span>
            </div>

            {/* Verdict Card */}
            <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Calculated Recommendation:</span>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                    preview?.recommendedResult === 'PASS'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                      : preview?.recommendedResult === 'REWORK'
                      ? 'bg-amber-950 text-amber-300 border-amber-700'
                      : 'bg-rose-950 text-rose-300 border-rose-700'
                  }`}
                >
                  {preview?.recommendedResult || 'PASS'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="bg-slate-900/70 p-2.5 rounded-lg">
                  <span className="text-[11px] text-slate-400 block">Total Defect Points</span>
                  <span className="text-base font-bold font-mono text-white">
                    {preview?.defectPoints !== undefined ? preview.defectPoints : 0} pts
                  </span>
                </div>
                <div className="bg-slate-900/70 p-2.5 rounded-lg">
                  <span className="text-[11px] text-slate-400 block">Points per 100m</span>
                  <span className="text-base font-bold font-mono text-teal-300">
                    {preview?.pointsPer100m !== undefined ? preview.pointsPer100m : 0} <span className="text-[10px] font-normal text-slate-400">pts/100m</span>
                  </span>
                </div>
              </div>

              {/* Thresholds Reference */}
              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 font-mono">
                <span>Pass ≤ {preview?.passMax || 20} pts/100m</span>
                <span>Rework ≤ {preview?.reworkMax || 40} pts/100m</span>
              </div>
            </div>

            {/* Explanation Trace */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-teal-400" />
                <span>Explainable Calculation Steps</span>
              </span>

              {preview?.calculation ? (
                <div className="space-y-1.5 font-mono text-[11px]">
                  {preview.calculation.map((step, sIdx) => (
                    <div key={sIdx} className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/50 space-y-0.5">
                      <div className="text-slate-400 text-[10px]">{step.label}</div>
                      <div className="text-slate-300 text-[10px] break-all">{step.expression}</div>
                      <div className="text-teal-300 font-bold">{step.result}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic py-2">
                  Add defects to inspect live mathematical calculations.
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400">
            {preview?.explanation || 'Fabric meets standard thresholds. Safe to certify gate.'}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DISPATCH LIFECYCLE CONTROLS */}
      {/* ========================================================================= */}
      {roll.stage === 'FINAL' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm print:hidden space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-teal-600" />
              <h2 className="font-bold text-slate-900 text-base">Warehouse Dispatch Lifecycle</h2>
            </div>
            <StatusBadge type="dispatch" value={roll.dispatchStatus} />
          </div>

          {dispatchError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{dispatchError}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <p className="text-xs text-slate-600 max-w-xl">
              Final quality gate passed. Roll is verified for client shipment staging and warehouse dispatch.
            </p>

            <div className="flex gap-2">
              {allowed.canMarkReady && (
                <button
                  onClick={() => handleDispatchTransition('READY_FOR_DISPATCH')}
                  disabled={dispatchSubmitting}
                  className="py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark Ready for Dispatch</span>
                </button>
              )}

              {allowed.canUnready && (
                <button
                  onClick={() => handleDispatchTransition('NOT_DISPATCHED')}
                  disabled={dispatchSubmitting}
                  className="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Undo Ready Status</span>
                </button>
              )}

              {allowed.canDispatch && (
                <button
                  onClick={() => handleDispatchTransition('DISPATCHED')}
                  disabled={dispatchSubmitting}
                  className="py-2 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Truck className="w-4 h-4" />
                  <span>Mark Dispatched (Ship to Buyer)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* QUALITY INSPECTION AUDIT TIMELINE (GROUPED BY STAGE) */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm print:hidden space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-600" />
            <h2 className="font-bold text-slate-900 text-base">Stage Quality Audit Timeline</h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {roll.inspections?.length || 0} event{(roll.inspections?.length || 0) === 1 ? '' : 's'} recorded
          </span>
        </div>

        {(!roll.inspections || roll.inspections.length === 0) ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            No inspection entries logged yet. Roll is awaiting initial shopfloor QA check at <strong>{currentStage}</strong> stage.
          </div>
        ) : (
          <div className="space-y-3">
            {roll.inspections.map((entry, idx) => (
              <div
                key={entry._id || idx}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge type="stage" value={entry.stage || 'GREY'} />
                    <StatusBadge type="quality" value={entry.result} />
                    {entry.isOverride && (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
                        Override
                      </span>
                    )}
                    {entry.inspectorName && (
                      <span className="font-semibold text-slate-800">
                        • {entry.inspectorName}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {formatDate(entry.inspectedAt)} ({new Date(entry.inspectedAt).toLocaleTimeString()})
                  </span>
                </div>

                {/* Points & Recommendation */}
                <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 font-mono">
                  <span>
                    Machine: <strong>{entry.machineCode || 'N/A'}</strong>
                  </span>
                  <span>
                    Points: <strong>{entry.defectPoints || 0}</strong> ({entry.pointsPer100m || 0} pts/100m)
                  </span>
                  {entry.recommendedResult && (
                    <span>
                      Recommended: <strong>{entry.recommendedResult}</strong>
                    </span>
                  )}
                </div>

                {/* Defect Chips */}
                {entry.defects && entry.defects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {entry.defects.map((d, dIdx) => (
                      <span
                        key={dIdx}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          d.severity === 'CRITICAL'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : d.severity === 'MAJOR'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span>{d.quantity}x</span>
                        <span>{d.code}</span>
                        <span>({d.severity})</span>
                      </span>
                    ))}
                  </div>
                )}

                {entry.overrideReason && (
                  <p className="text-amber-800 bg-amber-50/70 p-2 rounded-lg border border-amber-200 text-xs italic">
                    <strong>Override Reason:</strong> {entry.overrideReason}
                  </p>
                )}

                {entry.defectNotes && (
                  <p className="text-slate-700 pt-0.5 text-xs">
                    {entry.defectNotes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Passport;
