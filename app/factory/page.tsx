'use client';

import { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  BillOfMaterial,
  BOMLineItem,
  WorkCenter,
  WorkOrder,
  WorkOrderOperation,
  MachineDowntimeLog,
  MaterialConsumption,
  QualityDefectLog,
  WorkOrderCostPosting
} from '@/lib/db';
import { useAuthStore } from '@/store/authStore';
import { SyncService } from '@/services/SyncService';
import {
  Factory,
  Layers,
  Wrench,
  Calendar,
  Clock,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Play,
  Square,
  RefreshCw,
  Search,
  Check,
  X,
  Gauge,
  Activity,
  DollarSign,
  TrendingUp,
  Cpu,
  ShieldCheck,
  AlertCircle,
  FileText,
  Sliders
} from 'lucide-react';

export default function FactoryPage() {
  const { user, token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'scheduling' | 'boms' | 'terminal' | 'oee'>('scheduling');
  const [syncing, setSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Dexie Live Queries for true Offline-First operation
  const products = useLiveQuery(() => db.products.filter(p => !p.isDeleted).toArray()) || [];
  const boms = useLiveQuery(() => db.boms.filter(b => !b.isDeleted).toArray()) || [];
  const bomLineItems = useLiveQuery(() => db.bomLineItems.filter(l => !l.isDeleted).toArray()) || [];
  const workCenters = useLiveQuery(() => db.workCenters.filter(w => !w.isDeleted).toArray()) || [];
  const workOrders = useLiveQuery(() => db.workOrders.filter(w => !w.isDeleted).reverse().toArray()) || [];
  const workOrderOperations = useLiveQuery(() => db.workOrderOperations.filter(o => !o.isDeleted).toArray()) || [];
  const downtimeLogs = useLiveQuery(() => db.machineDowntimeLogs.filter(d => !d.isDeleted).reverse().limit(50).toArray()) || [];
  const defectLogs = useLiveQuery(() => db.qualityDefectLogs.filter(q => !q.isDeleted).reverse().limit(50).toArray()) || [];
  const costPostings = useLiveQuery(() => db.workOrderCostPostings.filter(c => !c.isDeleted).reverse().toArray()) || [];

  // Helper maps for instant lookup
  const productMap = useMemo(() => {
    const map = new Map<string, any>();
    products.forEach(p => map.set(p.syncId || '', p));
    return map;
  }, [products]);

  const workCenterMap = useMemo(() => {
    const map = new Map<string, WorkCenter>();
    workCenters.forEach(wc => map.set(wc.syncId || '', wc));
    return map;
  }, [workCenters]);

  const bomMap = useMemo(() => {
    const map = new Map<string, BillOfMaterial>();
    boms.forEach(b => map.set(b.syncId || '', b));
    return map;
  }, [boms]);

  // Sync Trigger
  const handleSync = async () => {
    setSyncing(true);
    try {
      await SyncService.sync();
      showToast('Factory data synchronized successfully!');
    } catch (e: any) {
      showToast(e.message || 'Sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  };

  // ===================== TAB 1: APS SCHEDULING STATE & ACTIONS =====================
  const [showWOModal, setShowWOModal] = useState(false);
  const [showWCModal, setShowWCModal] = useState(false);
  const [woProductId, setWoProductId] = useState('');
  const [woBomId, setWoBomId] = useState('');
  const [woQuantity, setWoQuantity] = useState('');
  const [woPriority, setWoPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [woStartDate, setWoStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [woEndDate, setWoEndDate] = useState(new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10));
  const [woOperations, setWoOperations] = useState<Array<{ workCenterId: string; durationMinutes: number }>>([]);
  const [wcName, setWcName] = useState('');
  const [wcType, setWcType] = useState<'MACHINE' | 'ASSEMBLY_LINE' | 'PACKAGING' | 'MANUAL'>('MACHINE');
  const [wcCapacityPerHour, setWcCapacityPerHour] = useState('20');
  const [wcHourlyCostRate, setWcHourlyCostRate] = useState('500');

  // Auto-select BOM when Product is selected
  useEffect(() => {
    if (woProductId) {
      const matchingBOM = boms.find(b => b.finishedProductId === woProductId && b.status !== 'deprecated');
      if (matchingBOM) {
        setWoBomId(matchingBOM.syncId || '');
      } else {
        setWoBomId('');
      }
    }
  }, [woProductId, boms]);

  // APS Capacity Load calculation
  const apsCapacityCheck = useMemo(() => {
    if (!woOperations.length || !woQuantity || !woStartDate || !woEndDate) return null;
    const qty = Number(woQuantity) || 0;
    const start = new Date(woStartDate).getTime();
    const end = new Date(woEndDate).getTime();
    const hours = Math.max(1, (end - start) / (1000 * 60 * 60));

    const warnings: string[] = [];
    let isOverload = false;

    woOperations.forEach(op => {
      const wc = workCenterMap.get(op.workCenterId);
      if (wc) {
        const maxCapacity = Math.floor(hours * Number(wc.capacityPerHour));
        if (qty > maxCapacity) {
          isOverload = true;
          warnings.push(`Work Center "${wc.name}" capacity exceeded: Max ${maxCapacity} units in ${hours.toFixed(0)}h window vs ${qty} requested.`);
        }
      }
    });

    return { isOverload, warnings, windowHours: hours };
  }, [woOperations, woQuantity, woStartDate, woEndDate, workCenterMap]);

  const handleCreateWorkCenter = async () => {
    if (!wcName.trim() || !wcCapacityPerHour) {
      return showToast('Work center name and capacity/hr are required', 'error');
    }
    try {
      const syncId = crypto.randomUUID();
      await db.workCenters.add({
        syncId,
        name: wcName.trim(),
        type: wcType,
        capacityPerHour: Number(wcCapacityPerHour),
        hourlyCostRate: Number(wcHourlyCostRate) || 0,
        shiftHoursPerDay: 8,
        status: 'ACTIVE',
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setShowWCModal(false);
      setWcName('');
      showToast(`Work Center "${wcName}" created successfully!`);
      SyncService.sync();
    } catch (e: any) {
      showToast(e.message || 'Failed to create work center', 'error');
    }
  };

  const handleCreateWorkOrder = async () => {
    if (!woProductId || !woBomId || !woQuantity) {
      return showToast('Please select a Product, BOM and planned quantity', 'error');
    }
    const qty = Number(woQuantity);
    if (qty <= 0) return showToast('Quantity must be greater than 0', 'error');

    try {
      const selectedBom = bomMap.get(woBomId);
      const snapshotVersion = selectedBom?.version || 1;
      const orderNumber = `WO-${1000 + workOrders.length + 1}`;
      const woSyncId = crypto.randomUUID();

      await db.workOrders.add({
        syncId: woSyncId,
        orderNumber,
        productId: woProductId,
        bomId: woBomId,
        bomVersionSnapshot: snapshotVersion,
        quantityPlanned: qty,
        quantityProduced: 0,
        status: 'planned',
        priority: woPriority,
        scheduledStartDate: woStartDate,
        scheduledEndDate: woEndDate,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Add Operations
      for (let i = 0; i < woOperations.length; i++) {
        const op = woOperations[i];
        await db.workOrderOperations.add({
          syncId: crypto.randomUUID(),
          workOrderId: woSyncId,
          workCenterId: op.workCenterId,
          sequenceNumber: i + 1,
          plannedDurationMinutes: op.durationMinutes || 60,
          quantityCompleted: 0,
          status: 'pending',
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      setShowWOModal(false);
      setWoProductId('');
      setWoBomId('');
      setWoQuantity('');
      setWoOperations([]);
      showToast(`Work Order ${orderNumber} scheduled!`);
      SyncService.sync();
    } catch (e: any) {
      showToast(e.message || 'Failed to create work order', 'error');
    }
  };

  // Work Order Status transitions
  const handleTransitionWOStatus = async (wo: WorkOrder, targetStatus: string) => {
    try {
      if (targetStatus === 'completed') {
        // If online and auth token available, hit the server endpoint to trigger completeWorkOrder + Roznamcha posting
        if (token && navigator.onLine) {
          const res = await fetch(`/api/factory/work-orders/${wo.syncId}/status`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'completed', quantityProduced: wo.quantityPlanned })
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Failed to complete work order');
          showToast(`Work Order ${wo.orderNumber} completed & posted to Roznamcha (Rs. ${json.costPosting?.totalCost || 0})`);
          await SyncService.sync();
          return;
        }
      }

      // Offline Dexie fallback transition
      await db.workOrders.update(wo.id!, {
        status: targetStatus as any,
        actualStartDate: targetStatus === 'in_progress' ? new Date().toISOString() : wo.actualStartDate,
        actualEndDate: targetStatus === 'completed' ? new Date().toISOString() : wo.actualEndDate,
        quantityProduced: targetStatus === 'completed' ? wo.quantityPlanned : wo.quantityProduced,
        updatedAt: new Date().toISOString()
      });
      showToast(`Work Order ${wo.orderNumber} status changed to ${targetStatus}`);
      SyncService.sync();
    } catch (e: any) {
      showToast(e.message || 'Status transition failed', 'error');
    }
  };

  // ===================== TAB 2: BOM BUILDER & EXPLORER STATE =====================
  const [showBOMModal, setShowBOMModal] = useState(false);
  const [bomProductId, setBomProductId] = useState('');
  const [bomLaborMinutes, setBomLaborMinutes] = useState('30');
  const [bomOverheadRate, setBomOverheadRate] = useState('15');
  const [bomNotes, setBomNotes] = useState('');
  const [bomLines, setBomLines] = useState<Array<{ componentProductId: string; qty: number; unit: string; wastage: number }>>([]);
  const [explodingBom, setExplodingBom] = useState<BillOfMaterial | null>(null);
  const [explodeRunQty, setExplodeRunQty] = useState('100');

  const handleAddBOMLine = () => {
    setBomLines([...bomLines, { componentProductId: '', qty: 1, unit: 'pcs', wastage: 0 }]);
  };

  const handleRemoveBOMLine = (index: number) => {
    setBomLines(bomLines.filter((_, i) => i !== index));
  };

  const handleSaveBOM = async () => {
    if (!bomProductId) return showToast('Please select a finished product', 'error');
    if (bomLines.length === 0) return showToast('Please add at least one component', 'error');

    // Circular self-reference guard in UI
    const hasSelfRef = bomLines.some(l => l.componentProductId === bomProductId);
    if (hasSelfRef) {
      return showToast('CIRCULAR BOM REJECTED: A product cannot consume itself as a component!', 'error');
    }

    try {
      const bomSyncId = crypto.randomUUID();
      await db.boms.add({
        syncId: bomSyncId,
        finishedProductId: bomProductId,
        version: 1,
        status: 'active',
        laborTimeEstimateMinutes: Number(bomLaborMinutes) || 0,
        overheadRatePerUnit: Number(bomOverheadRate) || 0,
        notes: bomNotes,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      for (const line of bomLines) {
        if (line.componentProductId) {
          await db.bomLineItems.add({
            syncId: crypto.randomUUID(),
            bomId: bomSyncId,
            componentProductId: line.componentProductId,
            quantityPerUnit: Number(line.qty) || 1,
            unit: line.unit || 'pcs',
            wastagePercent: Number(line.wastage) || 0,
            isDeleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }

      setShowBOMModal(false);
      setBomProductId('');
      setBomLines([]);
      setBomNotes('');
      showToast('Bill of Materials created successfully!');
      SyncService.sync();
    } catch (e: any) {
      showToast(e.message || 'Failed to save BOM', 'error');
    }
  };

  // Recursive Explosion for MRP in local Dexie
  const explodedRequirements = useMemo(() => {
    if (!explodingBom) return [];
    const runQty = Math.max(1, Number(explodeRunQty) || 1);
    const results: Array<{
      componentProductId: string;
      productName: string;
      unit: string;
      neededQty: number;
      inStock: number;
      shortage: number;
    }> = [];

    const lines = bomLineItems.filter(l => l.bomId === explodingBom.syncId);
    lines.forEach(line => {
      const prod = productMap.get(line.componentProductId);
      const wastage = 1 + (Number(line.wastagePercent) || 0) / 100;
      const needed = Number(line.quantityPerUnit) * runQty * wastage;
      const inStock = Number(prod?.stockQuantity) || 0;
      const shortage = Math.max(0, needed - inStock);

      results.push({
        componentProductId: line.componentProductId,
        productName: prod?.name || line.componentProductId,
        unit: line.unit || 'pcs',
        neededQty: Math.round(needed * 100) / 100,
        inStock,
        shortage: Math.round(shortage * 100) / 100
      });
    });

    return results;
  }, [explodingBom, explodeRunQty, bomLineItems, productMap]);

  // ===================== TAB 3: MES FLOOR TERMINAL STATE & ACTIONS =====================
  const [selectedTerminalWC, setSelectedTerminalWC] = useState<string>('all');
  const [showDowntimeModal, setShowDowntimeModal] = useState(false);
  const [downtimeWCId, setDowntimeWCId] = useState('');
  const [downtimeReason, setDowntimeReason] = useState<MachineDowntimeLog['reasonCode']>('breakdown');
  const [downtimeMinutes, setDowntimeMinutes] = useState('30');
  const [downtimeNotes, setDowntimeNotes] = useState('');

  const [showDefectModal, setShowDefectModal] = useState(false);
  const [defectWOId, setDefectWOId] = useState('');
  const [defectType, setDefectType] = useState<QualityDefectLog['defectType']>('dimensional');
  const [defectQty, setDefectQty] = useState('1');
  const [defectNotes, setDefectNotes] = useState('');

  const [showConsumeModal, setShowConsumeModal] = useState(false);
  const [consumeWOId, setConsumeWOId] = useState('');
  const [consumeProductId, setConsumeProductId] = useState('');
  const [consumeQty, setConsumeQty] = useState('1');
  const [consumeLotNumber, setConsumeLotNumber] = useState('');
  const [consumeSerialNumber, setConsumeSerialNumber] = useState('');

  // Increment Operation Throughput count (Bug 2 fix metric)
  const handleIncrementOperationQty = async (op: WorkOrderOperation, delta: number) => {
    try {
      const newQty = Math.max(0, (op.quantityCompleted || 0) + delta);
      await db.workOrderOperations.update(op.id!, {
        quantityCompleted: newQty,
        updatedAt: new Date().toISOString()
      });
      // Also update work order progress if needed
      showToast(`Updated throughput to ${newQty} units`);
    } catch (e: any) {
      showToast(e.message || 'Failed to update throughput', 'error');
    }
  };

  const handleStartOperation = async (op: WorkOrderOperation) => {
    try {
      await db.workOrderOperations.update(op.id!, {
        status: 'in_progress',
        actualStartTime: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      showToast('Operation started on shop floor!');
    } catch (e: any) {
      showToast(e.message || 'Failed to start operation', 'error');
    }
  };

  const handleCompleteOperation = async (op: WorkOrderOperation) => {
    try {
      await db.workOrderOperations.update(op.id!, {
        status: 'completed',
        actualEndTime: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      showToast('Operation marked completed!');
    } catch (e: any) {
      showToast(e.message || 'Failed to complete operation', 'error');
    }
  };

  const handleLogDowntime = async () => {
    if (!downtimeWCId || !downtimeMinutes) return showToast('Work center and duration required', 'error');
    try {
      const syncId = crypto.randomUUID();
      await db.machineDowntimeLogs.add({
        syncId,
        workCenterId: downtimeWCId,
        reasonCode: downtimeReason,
        durationMinutes: Number(downtimeMinutes),
        startTime: new Date(Date.now() - Number(downtimeMinutes) * 60000).toISOString(),
        endTime: new Date().toISOString(),
        notes: downtimeNotes,
        loggedByUserId: user?.id ? Number(user.id) : undefined,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setShowDowntimeModal(false);
      setDowntimeNotes('');
      showToast(`Downtime (${downtimeMinutes} min) logged`);
      SyncService.sync();
    } catch (e: any) {
      showToast(e.message || 'Failed to log downtime', 'error');
    }
  };

  const handleLogDefect = async () => {
    if (!defectWOId || !defectQty) return showToast('Work order and defect quantity required', 'error');
    try {
      const syncId = crypto.randomUUID();
      await db.qualityDefectLogs.add({
        syncId,
        workOrderId: defectWOId,
        defectType: defectType,
        quantityDefective: Number(defectQty),
        timestamp: new Date().toISOString(),
        notes: defectNotes,
        loggedByUserId: user?.id ? Number(user.id) : undefined,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setShowDefectModal(false);
      setDefectNotes('');
      showToast(`Quality defect (${defectQty} units) logged`);
      SyncService.sync();
    } catch (e: any) {
      showToast(e.message || 'Failed to log defect', 'error');
    }
  };

  const handleLogConsumption = async () => {
    if (!consumeWOId || !consumeProductId || !consumeQty) {
      return showToast('Work order, component product and quantity required', 'error');
    }
    const qty = Number(consumeQty);
    try {
      // 1. Local Stock Deduction
      const prod = productMap.get(consumeProductId);
      if (prod) {
        await db.products.update(prod.id!, {
          stockQuantity: Math.max(0, (prod.stockQuantity || 0) - qty)
        });
      }

      // 2. Stock Movement
      const moveSyncId = crypto.randomUUID();
      await db.stockMovements.add({
        syncId: moveSyncId,
        productId: consumeProductId,
        type: 'STOCK_OUT',
        quantity: qty,
        lotNumber: consumeLotNumber || undefined,
        serialNumber: consumeSerialNumber || undefined,
        workOrderId: consumeWOId,
        date: new Date().toISOString(),
        note: `Factory floor consumption for WO`,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // 3. Material Consumption
      await db.materialConsumptions.add({
        syncId: crypto.randomUUID(),
        workOrderId: consumeWOId,
        componentProductId: consumeProductId,
        quantityReserved: qty,
        quantityConsumed: qty,
        lotNumber: consumeLotNumber || undefined,
        serialNumber: consumeSerialNumber || undefined,
        stockMovementId: moveSyncId,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      setShowConsumeModal(false);
      setConsumeLotNumber('');
      setConsumeSerialNumber('');
      showToast(`Deducted ${qty} units from inventory`);
      SyncService.sync();
    } catch (e: any) {
      showToast(e.message || 'Failed to log consumption', 'error');
    }
  };

  // ===================== TAB 4: LIVE OEE & DOWNTIME ANALYTICS =====================
  const liveOEEData = useMemo(() => {
    if (!workCenters.length) {
      return { overallOEE: 0, availability: 0, performance: 0, quality: 0, workCenterStats: [] };
    }

    const shiftMinutes = 480; // Standard 8hr shift
    const stats = workCenters.map(wc => {
      // Downtime for this WC
      const dt = downtimeLogs
        .filter(d => d.workCenterId === wc.syncId)
        .reduce((sum, d) => sum + (Number(d.durationMinutes) || 0), 0);
      const runTime = Math.max(0, shiftMinutes - dt);
      const avail = shiftMinutes > 0 ? Math.min(1, runTime / shiftMinutes) : 0;

      // Throughput via quantityCompleted (Bug 2 fix)
      const throughput = workOrderOperations
        .filter(o => o.workCenterId === wc.syncId)
        .reduce((sum, o) => sum + (Number(o.quantityCompleted) || 0), 0);

      const capPerHour = Number(wc.capacityPerHour) || 10;
      const idealCycleTime = 60 / capPerHour;
      const perf = runTime > 0 && throughput > 0 ? Math.min(1.2, (idealCycleTime * throughput) / runTime) : 0;

      // Quality: exclude defects
      const defects = defectLogs.reduce((sum, d) => sum + (Number(d.quantityDefective) || 0), 0);
      const goodCount = Math.max(0, throughput - defects);
      const qual = throughput > 0 ? Math.max(0, goodCount / throughput) : 1;

      const oee = Math.round(avail * perf * qual * 1000) / 10;

      return {
        workCenter: wc,
        downtimeMinutes: dt,
        runTimeMinutes: runTime,
        throughput,
        defects,
        availability: Math.round(avail * 1000) / 10,
        performance: Math.round(perf * 1000) / 10,
        quality: Math.round(qual * 1000) / 10,
        oee: Math.min(100, oee)
      };
    });

    const avgOEE = Math.round((stats.reduce((acc, s) => acc + s.oee, 0) / stats.length) * 10) / 10;
    const avgAvail = Math.round((stats.reduce((acc, s) => acc + s.availability, 0) / stats.length) * 10) / 10;
    const avgPerf = Math.round((stats.reduce((acc, s) => acc + s.performance, 0) / stats.length) * 10) / 10;
    const avgQual = Math.round((stats.reduce((acc, s) => acc + s.quality, 0) / stats.length) * 10) / 10;

    return {
      overallOEE: avgOEE,
      availability: avgAvail,
      performance: avgPerf,
      quality: avgQual,
      workCenterStats: stats
    };
  }, [workCenters, downtimeLogs, workOrderOperations, defectLogs]);

  // Downtime Pareto categorization
  const downtimePareto = useMemo(() => {
    const reasons: Record<string, number> = {
      breakdown: 0,
      power_outage: 0,
      material_wait: 0,
      maintenance: 0,
      changeover: 0,
      other: 0
    };

    downtimeLogs.forEach(d => {
      const code = d.reasonCode || 'other';
      reasons[code] = (reasons[code] || 0) + (Number(d.durationMinutes) || 0);
    });

    return Object.entries(reasons).map(([reason, minutes]) => ({
      reason: reason.replace('_', ' ').toUpperCase(),
      minutes
    })).sort((a, b) => b.minutes - a.minutes);
  }, [downtimeLogs]);

  // Top Metrics
  const activeWOCount = workOrders.filter(w => w.status === 'in_progress' || w.status === 'planned' || w.status === 'released').length;
  const completedTodayCount = workOrders.filter(w => w.status === 'completed').reduce((sum, w) => sum + (Number(w.quantityProduced) || 0), 0);
  const totalDowntimeToday = downtimeLogs.reduce((sum, d) => sum + (Number(d.durationMinutes) || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 text-sm font-semibold transition-all ${
          toastMessage.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
        }`}>
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          {toastMessage.text}
        </div>
      )}

      {/* Header & Quick Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Factory className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Factory & Manufacturing OS</h1>
              <p className="text-sm text-slate-500 font-medium">MRP / APS Capacity Scheduling, MES Floor Terminal & Live OEE</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-semibold text-sm transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-indigo-600' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Data'}
          </button>
          <button
            onClick={() => setShowWOModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors shadow-md shadow-indigo-100"
          >
            <Plus className="w-4 h-4" />
            Schedule Work Order
          </button>
        </div>
      </div>

      {/* Top KPI Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Work Orders</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Calendar className="w-4 h-4" /></div>
          </div>
          <div className="text-3xl font-black text-slate-900">{activeWOCount}</div>
          <div className="text-xs font-semibold text-slate-500 mt-1">In planning & on floor</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Output (Units)</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><TrendingUp className="w-4 h-4" /></div>
          </div>
          <div className="text-3xl font-black text-emerald-600">{completedTodayCount}</div>
          <div className="text-xs font-semibold text-slate-500 mt-1">Finished goods produced</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Plant Live OEE</span>
            <div className="p-2 bg-violet-50 text-violet-600 rounded-lg"><Gauge className="w-4 h-4" /></div>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-black text-violet-700">{liveOEEData.overallOEE}%</div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              liveOEEData.overallOEE >= 85 ? 'bg-emerald-100 text-emerald-800' :
              liveOEEData.overallOEE >= 65 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {liveOEEData.overallOEE >= 85 ? 'World Class' : liveOEEData.overallOEE >= 65 ? 'Target' : 'Needs Action'}
            </span>
          </div>
          <div className="text-xs font-semibold text-slate-500 mt-1">Avail {liveOEEData.availability}% • Perf {liveOEEData.performance}% • Qual {liveOEEData.quality}%</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Machine Downtime</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Clock className="w-4 h-4" /></div>
          </div>
          <div className="text-3xl font-black text-amber-600">{totalDowntimeToday} <span className="text-lg font-bold">min</span></div>
          <div className="text-xs font-semibold text-slate-500 mt-1">Total stoppage time logged</div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('scheduling')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'scheduling'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4" />
          APS Scheduling & Capacity
        </button>
        <button
          onClick={() => setActiveTab('boms')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'boms'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          BOM & Recipes
        </button>
        <button
          onClick={() => setActiveTab('terminal')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'terminal'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sliders className="w-4 h-4" />
          MES Floor Terminal
        </button>
        <button
          onClick={() => setActiveTab('oee')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'oee'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          Live OEE & Downtime
        </button>
      </div>

      {/* ===================== TAB 1: APS SCHEDULING ===================== */}
      {activeTab === 'scheduling' && (
        <div className="space-y-6">
          {/* Work Centers Bar */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">Work Centers & Machine Fleet</h2>
                <p className="text-xs text-slate-500 font-medium">Capacity limits per machine hour used for APS scheduling</p>
              </div>
              <button
                onClick={() => setShowWCModal(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold text-xs transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Work Center
              </button>
            </div>

            {workCenters.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">
                <Cpu className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-600">No Work Centers configured yet</p>
                <p className="text-xs text-slate-400 mt-1">Add your machines, assembly lines, or packing stations to enable capacity-aware scheduling.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {workCenters.map(wc => (
                  <div key={wc.syncId} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 text-sm">{wc.name}</span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                          {wc.type}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 space-y-0.5 mt-2">
                        <div>Capacity: <strong className="text-slate-800">{wc.capacityPerHour} units/hr</strong></div>
                        <div>Hourly Rate: <strong className="text-slate-800">Rs. {wc.hourlyCostRate}/hr</strong></div>
                        <div>Shift: <strong className="text-slate-800">{wc.shiftHoursPerDay || 8} hrs/day</strong></div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        {wc.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Work Orders List */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">Production Work Orders (APS)</h2>
                <p className="text-xs text-slate-500 font-medium">Scheduled production runs with immutable BOM version snapshots</p>
              </div>
            </div>

            {workOrders.length === 0 ? (
              <div className="p-12 text-center">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700">No Work Orders scheduled</p>
                <p className="text-xs text-slate-400 mt-1">Click &ldquo;Schedule Work Order&rdquo; above to create your first production run.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-6">Order #</th>
                      <th className="py-3 px-6">Product</th>
                      <th className="py-3 px-6">BOM Snapshot</th>
                      <th className="py-3 px-6">Quantity</th>
                      <th className="py-3 px-6">Dates</th>
                      <th className="py-3 px-6">Priority</th>
                      <th className="py-3 px-6">Status</th>
                      <th className="py-3 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                    {workOrders.map(wo => {
                      const prod = productMap.get(wo.productId);
                      const priorityColor =
                        wo.priority === 'urgent' ? 'bg-rose-100 text-rose-800' :
                        wo.priority === 'high' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-800';

                      const statusColor =
                        wo.status === 'completed' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                        wo.status === 'in_progress' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                        wo.status === 'released' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' :
                        'bg-slate-100 text-slate-700 border-slate-200';

                      return (
                        <tr key={wo.syncId} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-4 px-6 font-bold text-slate-900">{wo.orderNumber}</td>
                          <td className="py-4 px-6">
                            <div className="font-bold text-slate-800">{prod?.name || wo.productId}</div>
                            <div className="text-xs text-slate-400">{prod?.sku || 'No SKU'}</div>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
                              v{wo.bomVersionSnapshot}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="font-extrabold text-slate-900">{wo.quantityProduced || 0}</span>
                            <span className="text-slate-400"> / {wo.quantityPlanned}</span>
                          </td>
                          <td className="py-4 px-6 text-xs text-slate-500">
                            <div>{wo.scheduledStartDate ? new Date(wo.scheduledStartDate).toLocaleDateString() : 'N/A'}</div>
                            <div className="text-[10px] text-slate-400">to {wo.scheduledEndDate ? new Date(wo.scheduledEndDate).toLocaleDateString() : 'N/A'}</div>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${priorityColor}`}>
                              {wo.priority}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusColor}`}>
                              {wo.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right space-x-2">
                            {wo.status === 'planned' && (
                              <button
                                onClick={() => handleTransitionWOStatus(wo, 'released')}
                                className="px-2.5 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-colors"
                              >
                                Release
                              </button>
                            )}
                            {wo.status === 'released' && (
                              <button
                                onClick={() => handleTransitionWOStatus(wo, 'in_progress')}
                                className="px-2.5 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors"
                              >
                                Start Floor
                              </button>
                            )}
                            {wo.status === 'in_progress' && (
                              <button
                                onClick={() => handleTransitionWOStatus(wo, 'completed')}
                                className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors"
                              >
                                Complete & Post
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== TAB 2: BOM & RECIPES ===================== */}
      {activeTab === 'boms' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">Bill of Materials (BOM Recipes)</h2>
              <p className="text-xs text-slate-500 font-medium">Multi-level sub-assemblies with circular dependency prevention & requirements explosion</p>
            </div>
            <button
              onClick={() => setShowBOMModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors shadow-md shadow-indigo-100"
            >
              <Plus className="w-4 h-4" /> Create New BOM
            </button>
          </div>

          {boms.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
              <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">No Bills of Materials defined</p>
              <p className="text-xs text-slate-400 mt-1">Create a BOM recipe to link finished products to their raw materials and sub-assemblies.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {boms.map(bom => {
                const prod = productMap.get(bom.finishedProductId);
                const lines = bomLineItems.filter(l => l.bomId === bom.syncId);

                return (
                  <div key={bom.syncId} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-extrabold text-slate-900 text-base">{prod?.name || bom.finishedProductId}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800">
                          v{bom.version || 1}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 space-y-1 mb-4">
                        <div>Labor Estimate: <strong>{bom.laborTimeEstimateMinutes || 0} mins</strong></div>
                        <div>Overhead Rate: <strong>Rs. {bom.overheadRatePerUnit || 0} / unit</strong></div>
                      </div>

                      <div className="border-t border-slate-100 pt-3">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                          Ingredients / Raw Materials ({lines.length})
                        </div>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {lines.map((line, idx) => {
                            const comp = productMap.get(line.componentProductId);
                            return (
                              <div key={idx} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                                <span className="font-semibold text-slate-700 truncate max-w-[150px]">
                                  {comp?.name || line.componentProductId}
                                </span>
                                <span className="text-slate-500 font-bold">
                                  {line.quantityPerUnit} {line.unit || 'pcs'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        onClick={() => setExplodingBom(bom)}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-colors"
                      >
                        <Cpu className="w-3.5 h-3.5" /> Explode Requirements (MRP)
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB 3: MES FLOOR TERMINAL ===================== */}
      {activeTab === 'terminal' && (
        <div className="space-y-6">
          {/* Quick Action Bar for Floor Operators */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
                <h2 className="text-lg font-black tracking-wide">MES Floor Terminal</h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">High-contrast, tablet-optimized shop floor operation controller</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setShowDowntimeModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm transition-colors shadow-md"
              >
                <Clock className="w-4 h-4" /> Log Downtime
              </button>
              <button
                onClick={() => setShowDefectModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm transition-colors shadow-md"
              >
                <AlertTriangle className="w-4 h-4" /> Log Defect
              </button>
              <button
                onClick={() => setShowConsumeModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm transition-colors shadow-md"
              >
                <Layers className="w-4 h-4" /> Deduct Material
              </button>
            </div>
          </div>

          {/* Machine Filter Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedTerminalWC('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                selectedTerminalWC === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              All Work Centers ({workOrderOperations.length})
            </button>
            {workCenters.map(wc => (
              <button
                key={wc.syncId}
                onClick={() => setSelectedTerminalWC(wc.syncId || '')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                  selectedTerminalWC === wc.syncId ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                {wc.name}
              </button>
            ))}
          </div>

          {/* Active Operations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workOrderOperations
              .filter(op => selectedTerminalWC === 'all' || op.workCenterId === selectedTerminalWC)
              .map(op => {
                const wo = workOrders.find(w => w.syncId === op.workOrderId);
                const prod = wo ? productMap.get(wo.productId) : null;
                const wc = workCenterMap.get(op.workCenterId);

                return (
                  <div key={op.syncId} className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                          Seq #{op.sequenceNumber} • {wc?.name || 'General Machine'}
                        </span>
                        <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                          op.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                          op.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {op.status.toUpperCase()}
                        </span>
                      </div>

                      <h3 className="text-xl font-black text-slate-900">{wo?.orderNumber || 'WO-Unknown'}</h3>
                      <p className="text-sm font-semibold text-slate-600 mb-4">{prod?.name || 'Finished Product'}</p>

                      {/* Throughput Counter Bar (Bug 2 Fix Metric) */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                          <span>Machine Throughput</span>
                          <span>Target: {wo?.quantityPlanned || 0}</span>
                        </div>
                        <div className="text-3xl font-black text-slate-900">{op.quantityCompleted || 0} <span className="text-sm font-bold text-slate-400">units</span></div>

                        {/* Quick Tap Buttons for rugged floor use */}
                        <div className="grid grid-cols-3 gap-2 mt-3">
                          <button
                            onClick={() => handleIncrementOperationQty(op, 1)}
                            className="py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-sm font-black text-slate-800 active:scale-95 transition-transform"
                          >
                            +1
                          </button>
                          <button
                            onClick={() => handleIncrementOperationQty(op, 5)}
                            className="py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-sm font-black text-slate-800 active:scale-95 transition-transform"
                          >
                            +5
                          </button>
                          <button
                            onClick={() => handleIncrementOperationQty(op, 10)}
                            className="py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-sm font-black text-slate-800 active:scale-95 transition-transform"
                          >
                            +10
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      {op.status === 'pending' && (
                        <button
                          onClick={() => handleStartOperation(op)}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm shadow-md transition-colors"
                        >
                          <Play className="w-4 h-4 fill-white" /> Start Machine
                        </button>
                      )}
                      {op.status === 'in_progress' && (
                        <button
                          onClick={() => handleCompleteOperation(op)}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-sm shadow-md transition-colors"
                        >
                          <Check className="w-4 h-4" /> Mark Operation Completed
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ===================== TAB 4: LIVE OEE & DOWNTIME ===================== */}
      {activeTab === 'oee' && (
        <div className="space-y-6">
          {/* Live OEE Gauge Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm text-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overall OEE</span>
              <div className="text-5xl font-black text-violet-700 my-2">{liveOEEData.overallOEE}%</div>
              <p className="text-xs text-slate-500 font-medium">Availability × Performance × Quality</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm text-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Availability (A)</span>
              <div className="text-5xl font-black text-blue-600 my-2">{liveOEEData.availability}%</div>
              <p className="text-xs text-slate-500 font-medium">Run Time / Planned Shift Time</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm text-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Performance (P)</span>
              <div className="text-5xl font-black text-emerald-600 my-2">{liveOEEData.performance}%</div>
              <p className="text-xs text-slate-500 font-medium">Ideal Cycle × Total Units / Run Time</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm text-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quality (Q)</span>
              <div className="text-5xl font-black text-amber-600 my-2">{liveOEEData.quality}%</div>
              <p className="text-xs text-slate-500 font-medium">Good Units / Total Produced</p>
            </div>
          </div>

          {/* Downtime Pareto Distribution */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="text-base font-black text-slate-900">Machine Downtime Pareto Breakdown</h3>
            <p className="text-xs text-slate-500 font-medium">Identifies the biggest root cause bottlenecks causing plant stoppage</p>

            <div className="space-y-3">
              {downtimePareto.map(item => {
                const pct = totalDowntimeToday > 0 ? Math.round((item.minutes / totalDowntimeToday) * 100) : 0;
                return (
                  <div key={item.reason} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-700">{item.reason}</span>
                      <span className="text-slate-500">{item.minutes} mins ({pct}%)</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Work Center Comparison Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">Machine-by-Machine OEE Scorecard</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-6">Work Center</th>
                    <th className="py-3 px-6">Capacity/Hr</th>
                    <th className="py-3 px-6">Downtime</th>
                    <th className="py-3 px-6">Throughput</th>
                    <th className="py-3 px-6">Availability</th>
                    <th className="py-3 px-6">Performance</th>
                    <th className="py-3 px-6">Quality</th>
                    <th className="py-3 px-6 text-right">OEE Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                  {liveOEEData.workCenterStats.map(stat => (
                    <tr key={stat.workCenter.syncId} className="hover:bg-slate-50/60">
                      <td className="py-4 px-6 font-bold text-slate-900">{stat.workCenter.name}</td>
                      <td className="py-4 px-6">{stat.workCenter.capacityPerHour} units/hr</td>
                      <td className="py-4 px-6 text-amber-600 font-bold">{stat.downtimeMinutes} min</td>
                      <td className="py-4 px-6 font-bold">{stat.throughput} units</td>
                      <td className="py-4 px-6">{stat.availability}%</td>
                      <td className="py-4 px-6">{stat.performance}%</td>
                      <td className="py-4 px-6">{stat.quality}%</td>
                      <td className="py-4 px-6 text-right">
                        <span className="text-base font-black text-violet-700">{stat.oee}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: SCHEDULE WORK ORDER ===================== */}
      {showWOModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">Schedule New Work Order (APS)</h3>
              <button onClick={() => setShowWOModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Target Product</label>
                <select
                  value={woProductId}
                  onChange={e => setWoProductId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-indigo-600"
                >
                  <option value="">Select Finished Product</option>
                  {products.map(p => (
                    <option key={p.syncId} value={p.syncId}>{p.name} ({p.sku || 'No SKU'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Recipe / BOM</label>
                <select
                  value={woBomId}
                  onChange={e => setWoBomId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-indigo-600"
                >
                  <option value="">Select BOM Recipe</option>
                  {boms
                    .filter(b => !woProductId || b.finishedProductId === woProductId)
                    .map(b => (
                      <option key={b.syncId} value={b.syncId}>
                        v{b.version} - {productMap.get(b.finishedProductId)?.name || b.finishedProductId}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Quantity Planned</label>
                  <input
                    type="number"
                    value={woQuantity}
                    onChange={e => setWoQuantity(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Priority</label>
                  <select
                    value={woPriority}
                    onChange={e => setWoPriority(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-indigo-600"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Scheduled Start</label>
                  <input
                    type="date"
                    value={woStartDate}
                    onChange={e => setWoStartDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Scheduled End</label>
                  <input
                    type="date"
                    value={woEndDate}
                    onChange={e => setWoEndDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-indigo-600"
                  />
                </div>
              </div>

              {/* Work Center Operations Routing */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase text-slate-500">Operation Routing Steps</label>
                  <button
                    type="button"
                    onClick={() => setWoOperations([...woOperations, { workCenterId: workCenters[0]?.syncId || '', durationMinutes: 60 }])}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                  >
                    + Add Routing Step
                  </button>
                </div>

                {woOperations.map((op, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-400 w-6">#{idx + 1}</span>
                    <select
                      value={op.workCenterId}
                      onChange={e => {
                        const copy = [...woOperations];
                        copy[idx].workCenterId = e.target.value;
                        setWoOperations(copy);
                      }}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                    >
                      {workCenters.map(wc => (
                        <option key={wc.syncId} value={wc.syncId}>{wc.name} ({wc.capacityPerHour} u/h)</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setWoOperations(woOperations.filter((_, i) => i !== idx))}
                      className="text-rose-500 hover:text-rose-700 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* APS Real-Time Capacity Alert */}
              {apsCapacityCheck?.isOverload && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>APS Capacity Bottleneck Detected</span>
                  </div>
                  {apsCapacityCheck.warnings.map((w, idx) => (
                    <p key={idx} className="text-xs text-amber-700 ml-6">{w}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowWOModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateWorkOrder}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-100"
              >
                Confirm & Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: CREATE WORK CENTER ===================== */}
      {showWCModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">Add New Work Center</h3>
              <button onClick={() => setShowWCModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Work Center / Machine Name</label>
                <input
                  type="text"
                  value={wcName}
                  onChange={e => setWcName(e.target.value)}
                  placeholder="e.g. Injection Molding Press #1"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Type</label>
                <select
                  value={wcType}
                  onChange={e => setWcType(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-indigo-600"
                >
                  <option value="MACHINE">Machine</option>
                  <option value="ASSEMBLY_LINE">Assembly Line</option>
                  <option value="PACKAGING">Packaging Station</option>
                  <option value="MANUAL">Manual Workbench</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Capacity (Units / Hr)</label>
                  <input
                    type="number"
                    value={wcCapacityPerHour}
                    onChange={e => setWcCapacityPerHour(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Hourly Labor/Cost Rate</label>
                  <input
                    type="number"
                    value={wcHourlyCostRate}
                    onChange={e => setWcHourlyCostRate(e.target.value)}
                    placeholder="Rs. 500"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-indigo-600"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowWCModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateWorkCenter}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md"
              >
                Save Work Center
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: CREATE BOM ===================== */}
      {showBOMModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">Create Bill of Materials (BOM)</h3>
              <button onClick={() => setShowBOMModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Finished Product</label>
                <select
                  value={bomProductId}
                  onChange={e => setBomProductId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-indigo-600"
                >
                  <option value="">Select Finished Product</option>
                  {products.map(p => (
                    <option key={p.syncId} value={p.syncId}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Estimated Labor (Minutes)</label>
                  <input
                    type="number"
                    value={bomLaborMinutes}
                    onChange={e => setBomLaborMinutes(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Overhead Rate / Unit (Rs.)</label>
                  <input
                    type="number"
                    value={bomOverheadRate}
                    onChange={e => setBomOverheadRate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                  />
                </div>
              </div>

              {/* Ingredients / Component Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase text-slate-500">Component Line Items</label>
                  <button
                    type="button"
                    onClick={handleAddBOMLine}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                  >
                    + Add Component
                  </button>
                </div>

                <div className="space-y-2">
                  {bomLines.map((line, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
                      <select
                        value={line.componentProductId}
                        onChange={e => {
                          const copy = [...bomLines];
                          copy[idx].componentProductId = e.target.value;
                          setBomLines(copy);
                        }}
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                      >
                        <option value="">Select Component Product</option>
                        {products.map(p => (
                          <option key={p.syncId} value={p.syncId} disabled={p.syncId === bomProductId}>
                            {p.name} {p.syncId === bomProductId ? '(Circular Self-Ref Prohibited)' : ''}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={line.qty}
                        onChange={e => {
                          const copy = [...bomLines];
                          copy[idx].qty = Number(e.target.value);
                          setBomLines(copy);
                        }}
                        placeholder="Qty"
                        className="w-20 px-2 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                      />
                      <input
                        type="text"
                        value={line.unit}
                        onChange={e => {
                          const copy = [...bomLines];
                          copy[idx].unit = e.target.value;
                          setBomLines(copy);
                        }}
                        placeholder="Unit"
                        className="w-16 px-2 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveBOMLine(idx)}
                        className="text-rose-500 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBOMModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBOM}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md"
              >
                Save BOM Recipe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: EXPLODE REQUIREMENTS (MRP) ===================== */}
      {explodingBom && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">MRP Requirements Explosion</h3>
                <p className="text-xs text-slate-500">{productMap.get(explodingBom.finishedProductId)?.name} (v{explodingBom.version})</p>
              </div>
              <button onClick={() => setExplodingBom(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-xs font-bold text-slate-600">Planned Production Batch:</span>
              <input
                type="number"
                value={explodeRunQty}
                onChange={e => setExplodeRunQty(e.target.value)}
                className="w-28 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-bold bg-white"
              />
              <span className="text-xs font-semibold text-slate-500">units</span>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Raw Material Requirements vs Live Inventory
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                      <th className="py-2.5 px-3">Component</th>
                      <th className="py-2.5 px-3">Required</th>
                      <th className="py-2.5 px-3">In Stock</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold">
                    {explodedRequirements.map(item => (
                      <tr key={item.componentProductId} className={item.shortage > 0 ? 'bg-rose-50/40' : ''}>
                        <td className="py-2.5 px-3 font-bold text-slate-800">{item.productName}</td>
                        <td className="py-2.5 px-3">{item.neededQty} {item.unit}</td>
                        <td className="py-2.5 px-3">{item.inStock} {item.unit}</td>
                        <td className="py-2.5 px-3">
                          {item.shortage > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">
                              Deficit: -{item.shortage} {item.unit}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                              In Stock
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setExplodingBom(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: LOG DOWNTIME ===================== */}
      {showDowntimeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">Log Machine Downtime</h3>
              <button onClick={() => setShowDowntimeModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Work Center / Machine</label>
                <select
                  value={downtimeWCId}
                  onChange={e => setDowntimeWCId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                >
                  <option value="">Select Work Center</option>
                  {workCenters.map(wc => (
                    <option key={wc.syncId} value={wc.syncId}>{wc.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Reason Code</label>
                <select
                  value={downtimeReason}
                  onChange={e => setDowntimeReason(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                >
                  <option value="breakdown">Machine Breakdown / Failure</option>
                  <option value="power_outage">Power Outage / Load Shedding (K-Electric/WAPDA)</option>
                  <option value="material_wait">Raw Material Wait / Shortage</option>
                  <option value="changeover">Tooling / Product Changeover</option>
                  <option value="maintenance">Scheduled Maintenance</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Duration (Minutes)</label>
                <input
                  type="number"
                  value={downtimeMinutes}
                  onChange={e => setDowntimeMinutes(e.target.value)}
                  placeholder="e.g. 45"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Notes / Action Taken</label>
                <textarea
                  value={downtimeNotes}
                  onChange={e => setDowntimeNotes(e.target.value)}
                  placeholder="e.g. Hydraulic pipe replacement"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold h-20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDowntimeModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogDowntime}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-black shadow-md"
              >
                Record Downtime
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: LOG DEFECT ===================== */}
      {showDefectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">Log Quality Defect</h3>
              <button onClick={() => setShowDefectModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Work Order</label>
                <select
                  value={defectWOId}
                  onChange={e => setDefectWOId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                >
                  <option value="">Select Work Order</option>
                  {workOrders.map(wo => (
                    <option key={wo.syncId} value={wo.syncId}>
                      {wo.orderNumber} - {productMap.get(wo.productId)?.name || wo.productId}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Defect Category</label>
                <select
                  value={defectType}
                  onChange={e => setDefectType(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                >
                  <option value="dimensional">Dimensional Non-Conformance</option>
                  <option value="surface">Surface / Scratch / Blemish</option>
                  <option value="material">Material Integrity Failure</option>
                  <option value="assembly">Assembly / Fitment Defect</option>
                  <option value="packaging">Packaging Defect</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Defective Units Count</label>
                <input
                  type="number"
                  value={defectQty}
                  onChange={e => setDefectQty(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Notes / Inspector Comment</label>
                <textarea
                  value={defectNotes}
                  onChange={e => setDefectNotes(e.target.value)}
                  placeholder="e.g. Thickness exceeded tolerance by 0.5mm"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold h-20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDefectModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogDefect}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-md"
              >
                Record Defect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: CONSUME MATERIAL ===================== */}
      {showConsumeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">Consume Raw Material</h3>
              <button onClick={() => setShowConsumeModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Work Order</label>
                <select
                  value={consumeWOId}
                  onChange={e => setConsumeWOId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                >
                  <option value="">Select Work Order</option>
                  {workOrders.map(wo => (
                    <option key={wo.syncId} value={wo.syncId}>{wo.orderNumber}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Raw Material</label>
                <select
                  value={consumeProductId}
                  onChange={e => setConsumeProductId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                >
                  <option value="">Select Component</option>
                  {products.map(p => (
                    <option key={p.syncId} value={p.syncId}>{p.name} (Stock: {p.stockQuantity || 0})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Quantity Consumed</label>
                <input
                  type="number"
                  value={consumeQty}
                  onChange={e => setConsumeQty(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Lot / Batch # (Ultra)</label>
                  <input
                    type="text"
                    value={consumeLotNumber}
                    onChange={e => setConsumeLotNumber(e.target.value)}
                    placeholder="LOT-2026-A"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Serial # (Ultra)</label>
                  <input
                    type="text"
                    value={consumeSerialNumber}
                    onChange={e => setConsumeSerialNumber(e.target.value)}
                    placeholder="SN-9981"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConsumeModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogConsumption}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md"
              >
                Confirm Deduction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
