import React, { useState, useEffect, useCallback } from 'react';
import {
  getStock,
  getStockSummary,
  createStock,
  updateStock,
  deleteStock,
  receiveStock,
  useStock as consumeStock,
  adjustStock,
  markOrdered,
  getStockMovements,
} from '../services/stockService';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { formatNumber } from '../utils/formatters';
import {
  Boxes,
  RefreshCw,
  AlertOctagon,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  X,
  Layers,
  ArrowDownCircle,
  PackagePlus,
  ArrowUpRight,
  ArrowDownRight,
  SlidersHorizontal,
  History,
  ShoppingCart,
  Search,
  Check,
  Shield,
  Clock,
  User,
  Filter,
} from 'lucide-react';

const STOCK_UNITS = ['kg', 'meters', 'liters', 'cones', 'bags', 'rolls'];
const STOCK_CATEGORIES = ['raw_fiber', 'yarn', 'dyes_chemicals', 'packaging', 'auxiliary', 'general'];
const STOCK_SECTORS = ['spinning', 'weaving', 'dyeing', 'finishing', 'general'];

export const Stock = () => {
  const { isOwner, hasPermission } = useAuth();

  // Active View Tab: 'table' | 'overview'
  const [activeTab, setActiveTab] = useState('overview');

  // Stock Items & Summary Data
  const [stock, setStock] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [receiveItem, setReceiveItem] = useState(null);
  const [useItem, setUseItem] = useState(null);
  const [adjustItem, setAdjustItem] = useState(null);
  const [orderItem, setOrderItem] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);
  const [historyMovements, setHistoryMovements] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);

  // Operation Form States
  const [opQuantity, setOpQuantity] = useState('');
  const [opReason, setOpReason] = useState('');
  const [opOrderNumber, setOpOrderNumber] = useState('');
  const [opSubmitting, setOpSubmitting] = useState(false);

  // Add/Edit Form State
  const [itemForm, setItemForm] = useState({
    sku: '',
    name: '',
    category: 'yarn',
    sector: 'weaving',
    quantityOnHand: '',
    unit: 'kg',
    reorderLevel: '100',
    supplier: '',
  });

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4500);
  };

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, summaryRes] = await Promise.all([
        getStock({
          level: levelFilter,
          category: categoryFilter,
          sector: sectorFilter,
          search: searchTerm,
        }),
        getStockSummary(),
      ]);
      setStock(listRes.stock || []);
      setSummary(summaryRes);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [levelFilter, categoryFilter, sectorFilter, searchTerm]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Handle Receive Submit
  const handleReceiveSubmit = async (e) => {
    e.preventDefault();
    if (!receiveItem || !opQuantity) return;

    setOpSubmitting(true);
    try {
      await receiveStock(receiveItem._id, {
        quantity: Number(opQuantity),
        notes: opReason,
      });
      showFeedback('success', `Received ${opQuantity} ${receiveItem.unit} of ${receiveItem.sku}.`);
      setReceiveItem(null);
      setOpQuantity('');
      setOpReason('');
      fetchAllData();
    } catch (err) {
      showFeedback('error', err.message || 'Failed to record receipt.');
    } finally {
      setOpSubmitting(false);
    }
  };

  // Handle Use Submit
  const handleUseSubmit = async (e) => {
    e.preventDefault();
    if (!useItem || !opQuantity) return;

    setOpSubmitting(true);
    try {
      await consumeStock(useItem._id, {
        quantity: Number(opQuantity),
        notes: opReason,
        orderNumber: opOrderNumber || null,
      });
      showFeedback('success', `Used ${opQuantity} ${useItem.unit} of ${useItem.sku}.`);
      setUseItem(null);
      setOpQuantity('');
      setOpReason('');
      setOpOrderNumber('');
      fetchAllData();
    } catch (err) {
      showFeedback('error', err.message || 'Failed to record stock usage.');
    } finally {
      setOpSubmitting(false);
    }
  };

  // Handle Physical Count Adjustment Submit (Owner only)
  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!adjustItem || opQuantity === '') return;

    if (!opReason || opReason.trim().length < 5) {
      showFeedback('error', 'A mandatory reason (at least 5 characters) is required for physical count adjustments.');
      return;
    }

    setOpSubmitting(true);
    try {
      await adjustStock(adjustItem._id, {
        newQuantity: Number(opQuantity),
        reason: opReason.trim(),
      });
      showFeedback('success', `Adjusted count for ${adjustItem.sku} to ${opQuantity} ${adjustItem.unit}.`);
      setAdjustItem(null);
      setOpQuantity('');
      setOpReason('');
      fetchAllData();
    } catch (err) {
      showFeedback('error', err.message || 'Failed to adjust stock count.');
    } finally {
      setOpSubmitting(false);
    }
  };

  // Handle Mark Ordered Submit
  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    if (!orderItem) return;

    setOpSubmitting(true);
    try {
      await markOrdered(orderItem._id, {
        orderedQuantity: opQuantity ? Number(opQuantity) : orderItem.suggestedReorderQuantity || orderItem.reorderLevel,
        notes: opReason,
      });
      showFeedback('success', `Marked ${orderItem.sku} as ordered with supplier.`);
      setOrderItem(null);
      setOpQuantity('');
      setOpReason('');
      fetchAllData();
    } catch (err) {
      showFeedback('error', err.message || 'Failed to mark as ordered.');
    } finally {
      setOpSubmitting(false);
    }
  };

  // Handle View Movement History
  const handleViewHistory = async (item) => {
    setHistoryItem(item);
    setLoadingHistory(true);
    try {
      const res = await getStockMovements(item._id);
      setHistoryMovements(res.movements || []);
    } catch (err) {
      showFeedback('error', 'Failed to load movement ledger.');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Handle Add Item Submit (Owner only)
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!itemForm.name.trim() || !itemForm.sku.trim()) {
      showFeedback('error', 'Material name and SKU are required.');
      return;
    }

    setOpSubmitting(true);
    try {
      await createStock({
        ...itemForm,
        quantityOnHand: Number(itemForm.quantityOnHand) || 0,
        reorderLevel: Number(itemForm.reorderLevel) || 100,
      });
      setIsAddModalOpen(false);
      setItemForm({ sku: '', name: '', category: 'yarn', sector: 'weaving', quantityOnHand: '', unit: 'kg', reorderLevel: '100', supplier: '' });
      showFeedback('success', `Registered material ${itemForm.sku.toUpperCase()}.`);
      fetchAllData();
    } catch (err) {
      showFeedback('error', err.message || 'Failed to register material.');
    } finally {
      setOpSubmitting(false);
    }
  };

  // Handle Edit Item Submit (Owner only)
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editItem) return;

    setOpSubmitting(true);
    try {
      await updateStock(editItem._id, {
        name: editItem.name,
        category: editItem.category,
        sector: editItem.sector,
        reorderLevel: Number(editItem.reorderLevel),
        supplier: editItem.supplier,
      });
      setEditItem(null);
      showFeedback('success', `Updated material ${editItem.sku}.`);
      fetchAllData();
    } catch (err) {
      showFeedback('error', err.message || 'Failed to update material.');
    } finally {
      setOpSubmitting(false);
    }
  };

  // Handle Delete Confirmation (Owner only)
  const handleDeleteConfirm = async () => {
    if (!deleteItem) return;
    setOpSubmitting(true);
    try {
      await deleteStock(deleteItem._id);
      setDeleteItem(null);
      showFeedback('success', `Removed ${deleteItem.sku} from inventory.`);
      fetchAllData();
    } catch (err) {
      showFeedback('error', err.message || 'Failed to delete material.');
    } finally {
      setOpSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200/60">
              Inventory Ledger
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">Material Stock & Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time material on hand, sector shortfalls, atomic inventory operations, and immutable movement history.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isOwner && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Material</span>
            </button>
          )}
          <button
            onClick={fetchAllData}
            disabled={loading}
            className="p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
            title="Refresh Inventory"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-2.5 text-sm animate-fadeIn ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <span className="font-medium">{feedback.message}</span>
        </div>
      )}

      {/* Navigation View Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'overview'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Sector Overview & Needs Attention
        </button>
        <button
          onClick={() => setActiveTab('table')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'table'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Inventory Catalog & Actions ({stock.length})
        </button>
      </div>

      {/* TAB 1: OVERVIEW & NEEDS ATTENTION */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Top High-level KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Materials</span>
              <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">{summary?.totalItems || 0}</p>
              <p className="text-xs text-slate-500 mt-1">Managed catalog items</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-xs bg-rose-50/20">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600">Out of Stock</span>
              <p className="text-2xl font-bold text-rose-700 mt-1 font-mono">{summary?.outOfStockCount || 0}</p>
              <p className="text-xs text-rose-600/80 mt-1">Requires immediate order</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs bg-amber-50/20">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Low Stock Reorder</span>
              <p className="text-2xl font-bold text-amber-700 mt-1 font-mono">{summary?.lowStockCount || 0}</p>
              <p className="text-xs text-amber-600/80 mt-1">Below reorder threshold</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs bg-emerald-50/20">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Optimal Stock</span>
              <p className="text-2xl font-bold text-emerald-700 mt-1 font-mono">{summary?.okStockCount || 0}</p>
              <p className="text-xs text-emerald-600/80 mt-1">Adequate on-hand</p>
            </div>
          </div>

          {/* Sector Summaries with Unit Segregation */}
          <div>
            <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-600" />
              <span>Plant Sector Stock Breakdown</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(summary?.perSector || {}).map(([secName, secData]) => (
                <div key={secName} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 capitalize text-sm">{secName} Sector</h3>
                    <span className="text-xs font-medium text-slate-500">{secData.totalItems} items</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-semibold border border-rose-200">
                      {secData.outCount} Out
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                      {secData.lowCount} Low
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                      {secData.okCount} OK
                    </span>
                  </div>
                  {/* Totals Segregated Per Unit */}
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">On Hand by Unit</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(secData.unitTotals || {}).length === 0 ? (
                        <span className="text-xs text-slate-400 italic">No materials assigned</span>
                      ) : (
                        Object.entries(secData.unitTotals).map(([unit, qty]) => (
                          <span key={unit} className="px-2 py-1 bg-slate-100 rounded-lg text-xs font-mono font-medium text-slate-700">
                            {formatNumber(qty)} {unit}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Needs Attention List (OUT first, then LOW by shortfall) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-rose-600" />
                <h2 className="font-bold text-slate-900 text-base">Needs Attention List ({summary?.needsAttention?.length || 0})</h2>
              </div>
              <span className="text-xs text-slate-500">Ordered by criticality: OUT first, then highest shortfall</span>
            </div>

            {(!summary?.needsAttention || summary.needsAttention.length === 0) ? (
              <div className="p-8 text-center text-emerald-700 font-medium text-sm">
                🎉 All materials have healthy on-hand levels above reorder thresholds!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-6">Status</th>
                      <th className="py-3.5 px-6">SKU / Item</th>
                      <th className="py-3.5 px-6">Sector</th>
                      <th className="py-3.5 px-6">On Hand</th>
                      <th className="py-3.5 px-6">Reorder At</th>
                      <th className="py-3.5 px-6">Shortfall</th>
                      <th className="py-3.5 px-6">Suggested Reorder</th>
                      <th className="py-3.5 px-6 text-right">Quick Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.needsAttention.map((item) => (
                      <tr key={item._id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-6">
                          <StatusBadge type="stock" value={item.stockLevel} />
                        </td>
                        <td className="py-3.5 px-6">
                          <div className="font-semibold text-slate-900">{item.name}</div>
                          <div className="text-xs font-mono text-slate-500">{item.sku}</div>
                        </td>
                        <td className="py-3.5 px-6 text-xs capitalize text-slate-600">
                          {item.sector}
                        </td>
                        <td className="py-3.5 px-6 font-mono font-semibold text-slate-800">
                          {formatNumber(item.quantityOnHand)} {item.unit}
                        </td>
                        <td className="py-3.5 px-6 font-mono text-xs text-slate-500">
                          {formatNumber(item.reorderLevel)} {item.unit}
                        </td>
                        <td className="py-3.5 px-6 font-mono font-bold text-rose-600">
                          {formatNumber(item.shortfall)} {item.unit}
                        </td>
                        <td className="py-3.5 px-6 font-mono text-xs font-semibold text-teal-700">
                          +{formatNumber(item.suggestedReorderQuantity)} {item.unit}
                        </td>
                        <td className="py-3.5 px-6 text-right space-x-2">
                          {item.isOrdered ? (
                            <span className="inline-flex items-center gap-1 text-xs text-teal-700 bg-teal-50 px-2 py-1 rounded-lg border border-teal-200">
                              <Check className="w-3.5 h-3.5" /> Ordered ({item.orderedQuantity} {item.unit})
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setOrderItem(item);
                                setOpQuantity(item.suggestedReorderQuantity || item.reorderLevel);
                              }}
                              className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Mark Ordered
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setReceiveItem(item);
                              setOpQuantity('');
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Receive
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Movement Activity Feed */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-slate-600" />
              <span>Recent Inventory Movements Ledger</span>
            </h2>
            {(!summary?.recentMovements || summary.recentMovements.length === 0) ? (
              <p className="text-xs text-slate-500">No recent inventory movements recorded.</p>
            ) : (
              <div className="divide-y divide-slate-100 text-sm">
                {summary.recentMovements.map((m) => (
                  <div key={m._id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        m.quantityDelta > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {m.quantityDelta > 0 ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-500">{m.sku}</span>
                          <span>•</span>
                          <span className="text-xs font-medium text-slate-600">{m.reason || m.type}</span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <User className="w-3 h-3" />
                          <span>{m.actor?.name || 'Operator'}</span>
                          <span>•</span>
                          <Clock className="w-3 h-3" />
                          <span>{new Date(m.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className={`font-bold ${m.quantityDelta > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta} {m.unit}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {m.quantityBefore} → {m.quantityAfter} {m.unit}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: INVENTORY TABLE & ACTIONS */}
      {activeTab === 'table' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search material by name, SKU, or supplier..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              >
                <option value="">All Stock Levels</option>
                <option value="out">Out of Stock</option>
                <option value="low">Low Stock (Reorder)</option>
                <option value="ok">Optimal (OK)</option>
              </select>

              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 capitalize font-medium"
              >
                <option value="">All Sectors</option>
                {STOCK_SECTORS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 capitalize font-medium"
              >
                <option value="">All Categories</option>
                {STOCK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Catalog Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-6">SKU / Code</th>
                    <th className="py-3.5 px-6">Material Name</th>
                    <th className="py-3.5 px-6">Category / Sector</th>
                    <th className="py-3.5 px-6">On Hand</th>
                    <th className="py-3.5 px-6">Reorder Level</th>
                    <th className="py-3.5 px-6">Supplier</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6 text-right">Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stock.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-6 font-mono text-xs font-bold text-slate-900">
                        {item.sku}
                      </td>
                      <td className="py-4 px-6 font-semibold text-slate-900">
                        {item.name}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-500">
                        <span className="capitalize font-medium text-slate-700">{item.sector}</span>
                        <span className="text-slate-400"> • </span>
                        <span className="capitalize">{item.category?.replace('_', ' ')}</span>
                      </td>
                      <td className="py-4 px-6 font-mono font-bold text-slate-900">
                        {formatNumber(item.quantityOnHand)} {item.unit}
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-500">
                        {formatNumber(item.reorderLevel)} {item.unit}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-600">
                        {item.supplier || '—'}
                      </td>
                      <td className="py-4 px-6">
                        <StatusBadge type="stock" value={item.stockLevel} />
                      </td>
                      <td className="py-4 px-6 text-right space-x-1.5">
                        {/* Receive */}
                        <button
                          onClick={() => {
                            setReceiveItem(item);
                            setOpQuantity('');
                            setOpReason('');
                          }}
                          className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                          title="Receive Stock (+)"
                        >
                          <ArrowDownRight className="w-3.5 h-3.5" />
                        </button>

                        {/* Use */}
                        <button
                          onClick={() => {
                            setUseItem(item);
                            setOpQuantity('');
                            setOpReason('');
                          }}
                          className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                          title="Use Stock (-)"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>

                        {/* Adjust Count (Owner only) */}
                        {isOwner && (
                          <button
                            onClick={() => {
                              setAdjustItem(item);
                              setOpQuantity(item.quantityOnHand);
                              setOpReason('');
                            }}
                            className="p-1.5 text-indigo-700 hover:bg-indigo-50 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                            title="Physical Count Adjustment (Owner Only)"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Movement History */}
                        <button
                          onClick={() => handleViewHistory(item)}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                          title="View Ledger History"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit Item (Owner only) */}
                        {isOwner && (
                          <button
                            onClick={() => setEditItem(item)}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                            title="Edit Material Details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete Item (Owner only) */}
                        {isOwner && (
                          <button
                            onClick={() => setDeleteItem(item)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                            title="Delete Material"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RECEIVE STOCK MODAL */}
      {receiveItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Receive Stock: {receiveItem.sku}</h3>
            <p className="text-xs text-slate-500 mb-4">{receiveItem.name} • Current on hand: {receiveItem.quantityOnHand} {receiveItem.unit}</p>

            <form onSubmit={handleReceiveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Received Quantity ({receiveItem.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  required
                  value={opQuantity}
                  onChange={(e) => setOpQuantity(e.target.value)}
                  placeholder="e.g. 250"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Receipt Notes / PO Reference (Optional)
                </label>
                <input
                  type="text"
                  value={opReason}
                  onChange={(e) => setOpReason(e.target.value)}
                  placeholder="e.g. Batch #490 from Supplier"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReceiveItem(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium rounded-xl hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={opSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer"
                >
                  Confirm Receipt (+)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* USE STOCK MODAL */}
      {useItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Use Stock: {useItem.sku}</h3>
            <p className="text-xs text-slate-500 mb-4">{useItem.name} • Available: {useItem.quantityOnHand} {useItem.unit}</p>

            <form onSubmit={handleUseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Quantity to Deduct ({useItem.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  max={useItem.quantityOnHand}
                  required
                  value={opQuantity}
                  onChange={(e) => setOpQuantity(e.target.value)}
                  placeholder={`Max: ${useItem.quantityOnHand}`}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Production Order # (Optional)
                </label>
                <input
                  type="text"
                  value={opOrderNumber}
                  onChange={(e) => setOpOrderNumber(e.target.value)}
                  placeholder="e.g. PO-2026-0001"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Usage Purpose / Notes
                </label>
                <input
                  type="text"
                  value={opReason}
                  onChange={(e) => setOpReason(e.target.value)}
                  placeholder="e.g. Loom set-up yarn loading"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setUseItem(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium rounded-xl hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={opSubmitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer"
                >
                  Confirm Usage (-)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PHYSICAL COUNT ADJUSTMENT MODAL (OWNER ONLY) */}
      {adjustItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">Owner Only</span>
              <h3 className="text-lg font-bold text-slate-900">Physical Stock Count Correction</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">{adjustItem.name} ({adjustItem.sku}) • Recorded: {adjustItem.quantityOnHand} {adjustItem.unit}</p>

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Actual Count Verified ({adjustItem.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={opQuantity}
                  onChange={(e) => setOpQuantity(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Mandatory Audit Reason (min 5 chars)
                </label>
                <textarea
                  required
                  rows={2}
                  value={opReason}
                  onChange={(e) => setOpReason(e.target.value)}
                  placeholder="e.g. Monthly stocktake recount variance correction"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustItem(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium rounded-xl hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={opSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer"
                >
                  Save Count Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOVEMENT HISTORY MODAL */}
      {historyItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Movement History: {historyItem.sku}</h3>
                <p className="text-xs text-slate-500">{historyItem.name} • On hand: {historyItem.quantityOnHand} {historyItem.unit}</p>
              </div>
              <button
                onClick={() => setHistoryItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              {loadingHistory ? (
                <div className="py-8 text-center text-slate-400 text-xs">Loading movement ledger...</div>
              ) : historyMovements.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">No movements recorded for this item yet.</div>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {historyMovements.map((m) => (
                    <div key={m._id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.type === 'RECEIVE' ? 'bg-emerald-50 text-emerald-700' :
                            m.type === 'USE' || m.type === 'ORDER_DEDUCT' ? 'bg-amber-50 text-amber-700' :
                            'bg-indigo-50 text-indigo-700'
                          }`}>
                            {m.type}
                          </span>
                          <span className="font-semibold text-slate-800">{m.reason}</span>
                          {m.orderNumber && (
                            <span className="font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {m.orderNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 text-[11px] mt-1">
                          Actor: <strong>{m.actor?.name || 'Operator'}</strong> ({m.actor?.role || 'user'}) • {new Date(m.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right font-mono">
                        <span className={`font-bold ${m.quantityDelta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta} {m.unit}
                        </span>
                        <div className="text-[10px] text-slate-400">
                          {m.quantityBefore} → {m.quantityAfter} {m.unit}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setHistoryItem(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-200 transition-colors"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD MATERIAL MODAL (OWNER ONLY) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Register New Material</h3>
            <p className="text-xs text-slate-500 mb-4">Add raw material or consumable to the plant catalog.</p>

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">SKU / Code</label>
                <input
                  type="text"
                  required
                  value={itemForm.sku}
                  onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                  placeholder="e.g. YRN-COT-40S"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Material Name</label>
                <input
                  type="text"
                  required
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  placeholder="e.g. 40s Combed Cotton Yarn"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Category</label>
                  <select
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 capitalize"
                  >
                    {STOCK_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Sector</label>
                  <select
                    value={itemForm.sector}
                    onChange={(e) => setItemForm({ ...itemForm, sector: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 capitalize"
                  >
                    {STOCK_SECTORS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Initial Qty</label>
                  <input
                    type="number"
                    step="any"
                    value={itemForm.quantityOnHand}
                    onChange={(e) => setItemForm({ ...itemForm, quantityOnHand: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Unit</label>
                  <select
                    value={itemForm.unit}
                    onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                  >
                    {STOCK_UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Reorder Level</label>
                  <input
                    type="number"
                    step="any"
                    value={itemForm.reorderLevel}
                    onChange={(e) => setItemForm({ ...itemForm, reorderLevel: e.target.value })}
                    placeholder="100"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Supplier</label>
                <input
                  type="text"
                  value={itemForm.supplier}
                  onChange={(e) => setItemForm({ ...itemForm, supplier: e.target.value })}
                  placeholder="e.g. Apex Mills Ltd."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900 font-medium rounded-xl hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={opSubmitting}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Register Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL (OWNER ONLY) */}
      {deleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-sm w-full p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Remove Material Item?</h3>
            <p className="text-xs text-slate-600 mb-6">
              Are you sure you want to remove <strong>{deleteItem.sku}</strong> ({deleteItem.name}) from inventory? This action is permanent.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteItem(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium rounded-xl hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stock;
