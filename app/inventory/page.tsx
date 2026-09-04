'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Product, StockMovement, Category, ProductVariant } from '@/lib/db';
import { useAuthStore } from '@/store/authStore';
import QuotaWidget from '@/components/QuotaWidget';
import { SyncService } from '@/services/SyncService';
import Link from 'next/link';
import {
  Package,
  Plus,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Layers,
  MapPin,
  FolderTree,
  CheckCircle2,
  RefreshCw,
  LayoutGrid,
  List,
  Trash2,
  Edit2,
  X,
  ExternalLink,
  Users,
  ShieldCheck,
  Tag,
  Boxes,
  Truck,
  History,
  Barcode
} from 'lucide-react';

type UIProduct = Product & { currentStock: number };
type UIVariant = ProductVariant & { currentStock: number };

export default function InventoryPage() {
  const { user } = useAuthStore();
  const [syncing, setSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Main navigation tab
  const [activeMainTab, setActiveMainTab] = useState<'catalog' | 'movements'>('catalog');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  // Add Product Form / Modal
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sku, setSku] = useState('');
  const [initialStock, setInitialStock] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [locationId, setLocationId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  // Delivery / Stock Adjustment Modal
  const [deliveryModalProduct, setDeliveryModalProduct] = useState<UIProduct | null>(null);
  const [deliveryModalType, setDeliveryModalType] = useState<'STOCK_IN' | 'STOCK_OUT'>('STOCK_IN');
  const [deliveryQuantity, setDeliveryQuantity] = useState('1');
  const [deliveryLocationId, setDeliveryLocationId] = useState('');
  const [deliveryCost, setDeliveryCost] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');

  // Variants Modal
  const [variantsModalProduct, setVariantsModalProduct] = useState<UIProduct | null>(null);
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantSku, setNewVariantSku] = useState('');
  const [newVariantPrice, setNewVariantPrice] = useState('');

  // Variant Delivery Target
  const [variantDeliveryTarget, setVariantDeliveryTarget] = useState<UIVariant | null>(null);
  const [variantDeliveryType, setVariantDeliveryType] = useState<'STOCK_IN' | 'STOCK_OUT'>('STOCK_IN');
  const [variantDeliveryQuantity, setVariantDeliveryQuantity] = useState('1');
  const [variantDeliveryCost, setVariantDeliveryCost] = useState('');
  const [variantDeliveryNote, setVariantDeliveryNote] = useState('');

  // Live Queries from Dexie
  const products = useLiveQuery(() => db.products.filter(p => !p.isDeleted).toArray()) || [];
  const stockMovements = useLiveQuery(() => db.stockMovements.filter(sm => !sm.isDeleted).reverse().toArray()) || [];
  const locations = useLiveQuery(() => db.locations.filter(l => l.isActive && !l.isDeleted).toArray()) || [];
  const categories = useLiveQuery(() => db.categories.filter(c => c.isActive && !c.isDeleted).toArray()) || [];
  const variants = useLiveQuery(() => db.productVariants.filter(v => v.isActive && !v.isDeleted).toArray()) || [];

  // Flattened Categories tree for dropdowns
  const flatCategories = useMemo(() => {
    const byParent = new Map<string | undefined, Category[]>();
    for (const cat of categories) {
      const key = cat.parentId ?? undefined;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(cat);
    }
    const result: { syncId: string; name: string; depth: number }[] = [];
    const walk = (parentId: string | undefined, depth: number) => {
      for (const cat of byParent.get(parentId) ?? []) {
        if (cat.syncId) result.push({ syncId: cat.syncId, name: cat.name, depth });
        walk(cat.syncId, depth + 1);
      }
    };
    walk(undefined, 0);
    return result;
  }, [categories]);

  // Lookup Maps
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach(c => {
      if (c.syncId) map.set(c.syncId, c.name);
    });
    return map;
  }, [categories]);

  const locationMap = useMemo(() => {
    const map = new Map<string, string>();
    locations.forEach(l => {
      if (l.syncId) map.set(l.syncId, l.name);
    });
    return map;
  }, [locations]);

  // Computed Products with Stock
  const productsWithStock: UIProduct[] = useMemo(() => {
    return products.map((p) => {
      const movements = stockMovements.filter((sm: StockMovement) => sm.productId === p.syncId && !sm.variantId);
      const currentStock = movements.reduce(
        (acc: number, sm: StockMovement) =>
          acc + (sm.type === 'STOCK_IN' || sm.type === 'IN' ? Number(sm.quantity) : -Number(sm.quantity)),
        0
      );
      return { ...p, currentStock };
    });
  }, [products, stockMovements]);

  // Computed Variants with Stock
  const variantsWithStock: UIVariant[] = useMemo(() => {
    return variants.map((v) => {
      const movements = stockMovements.filter((sm: StockMovement) => sm.variantId === v.syncId);
      const currentStock = movements.reduce(
        (acc: number, sm: StockMovement) =>
          acc + (sm.type === 'STOCK_IN' || sm.type === 'IN' ? Number(sm.quantity) : -Number(sm.quantity)),
        0
      );
      return { ...v, currentStock };
    });
  }, [variants, stockMovements]);

  // Key KPI Metrics
  const metrics = useMemo(() => {
    const totalItems = productsWithStock.length;
    let totalStock = 0;
    let totalValue = 0;
    let lowStock = 0;
    let outOfStock = 0;

    productsWithStock.forEach(p => {
      const pVariants = variantsWithStock.filter(v => v.productId === p.syncId);
      const stock = pVariants.length > 0
        ? pVariants.reduce((sum, v) => sum + v.currentStock, 0)
        : p.currentStock;

      totalStock += stock;
      totalValue += stock * (Number(p.sellingPrice) || 0);

      const threshold = p.lowStockThreshold || 5;
      if (stock <= 0) {
        outOfStock++;
      } else if (stock <= threshold) {
        lowStock++;
      }
    });

    return { totalItems, totalStock, totalValue, lowStock, outOfStock };
  }, [productsWithStock, variantsWithStock]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return productsWithStock.filter(p => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.name?.toLowerCase().includes(q);
        const matchesSku = p.sku?.toLowerCase().includes(q);
        const matchesBarcode = p.barcode?.toLowerCase().includes(q);
        const matchesCategory = p.category?.toLowerCase().includes(q);
        if (!matchesName && !matchesSku && !matchesBarcode && !matchesCategory) return false;
      }

      // Category filter
      if (selectedCategoryFilter !== 'all') {
        if (p.categoryId !== selectedCategoryFilter) return false;
      }

      // Stock status filter
      const pVariants = variantsWithStock.filter(v => v.productId === p.syncId);
      const stock = pVariants.length > 0
        ? pVariants.reduce((sum, v) => sum + v.currentStock, 0)
        : p.currentStock;
      const threshold = p.lowStockThreshold || 5;

      if (stockStatusFilter === 'in_stock' && stock <= threshold) return false;
      if (stockStatusFilter === 'low_stock' && (stock <= 0 || stock > threshold)) return false;
      if (stockStatusFilter === 'out_of_stock' && stock > 0) return false;

      return true;
    });
  }, [productsWithStock, variantsWithStock, searchQuery, selectedCategoryFilter, stockStatusFilter]);

  // Sync Trigger
  const handleSync = async () => {
    setSyncing(true);
    try {
      await SyncService.sync();
      showToast('Inventory & stock movements synchronized successfully!');
    } catch (e: any) {
      showToast(e.message || 'Sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Create Product Action
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || !categoryId) {
      return showToast('Product name, price, and category are required', 'error');
    }

    try {
      const syncId = crypto.randomUUID();
      const pickedCategory = categories.find((c) => c.syncId === categoryId);
      const newProduct: Product = {
        syncId,
        name: name.trim(),
        sku: sku.trim() || '',
        sellingPrice: parseFloat(price),
        costPrice: costPrice ? parseFloat(costPrice) : undefined,
        category: pickedCategory?.name || 'General',
        categoryId: categoryId || undefined,
        unit: 'pcs',
        lowStockThreshold: Number(lowStockThreshold) || 5,
        reorderPoint: Number(lowStockThreshold) || 5,
        isActive: true,
        locationId: locationId || undefined,
        companyCode: user?.companyCode,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.transaction('rw', db.products, db.stockMovements, async () => {
        await db.products.add(newProduct as any);

        const startingStock = parseInt(initialStock, 10);
        if (startingStock > 0) {
          const newMovement: StockMovement = {
            syncId: crypto.randomUUID(),
            productId: syncId,
            type: 'STOCK_IN',
            quantity: startingStock,
            reason: 'Initial Opening Stock',
            locationId: locationId || undefined,
            companyCode: user?.companyCode,
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          await db.stockMovements.add(newMovement as any);
        }
      });

      setName('');
      setPrice('');
      setCostPrice('');
      setSku('');
      setInitialStock('0');
      setLocationId('');
      setCategoryId('');
      setShowAddProductModal(false);

      showToast(`Product "${newProduct.name}" added successfully!`);
      SyncService.sync();
    } catch (error: any) {
      console.error(error);
      showToast(error.message || 'Failed to create product', 'error');
    }
  };

  // Quick Stock Adjust (+1 / -1)
  const handleStockAdjust = async (productSyncId: string, quantity: number, type: 'STOCK_IN' | 'STOCK_OUT', reason: string) => {
    try {
      const product = products.find((p) => p.syncId === productSyncId);
      const newMovement: StockMovement = {
        syncId: crypto.randomUUID(),
        productId: productSyncId,
        type,
        quantity,
        reason,
        locationId: product?.locationId,
        companyCode: user?.companyCode,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.stockMovements.add(newMovement as any);
      showToast(`${type === 'STOCK_IN' ? '+ ' : '- '}${quantity} unit ${reason.toLowerCase()}`);
      SyncService.sync();
    } catch (error: any) {
      console.error(error);
      showToast('Failed to adjust stock', 'error');
    }
  };

  // Open Log Delivery Modal
  const openDeliveryModal = (p: UIProduct, type: 'STOCK_IN' | 'STOCK_OUT') => {
    setDeliveryModalProduct(p);
    setDeliveryModalType(type);
    setDeliveryQuantity('1');
    setDeliveryLocationId(p.locationId || '');
    setDeliveryCost('');
    setDeliveryNote('');
  };

  // Handle Delivery Form
  const handleLogDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryModalProduct) return;

    try {
      const qty = parseFloat(deliveryQuantity) || 0;
      if (qty <= 0) return showToast('Quantity must be greater than 0', 'error');

      const newMovement: StockMovement = {
        syncId: crypto.randomUUID(),
        productId: deliveryModalProduct.syncId!,
        type: deliveryModalType,
        quantity: qty,
        reason: deliveryModalType === 'STOCK_IN' ? 'Delivery received' : 'Delivery dispatched',
        locationId: deliveryLocationId || undefined,
        deliveryCost: deliveryCost ? parseFloat(deliveryCost) : undefined,
        deliveryNote: deliveryNote || undefined,
        companyCode: user?.companyCode,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.stockMovements.add(newMovement as any);
      setDeliveryModalProduct(null);
      showToast(`Logged ${deliveryModalType === 'STOCK_IN' ? 'inward delivery' : 'dispatch'} of ${qty} units`);
      SyncService.sync();
    } catch (error: any) {
      console.error(error);
      showToast('Failed to log delivery', 'error');
    }
  };

  // Add Variant Action
  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVariantName || !variantsModalProduct?.syncId) return;

    try {
      const newVariant: ProductVariant = {
        syncId: crypto.randomUUID(),
        productId: variantsModalProduct.syncId,
        name: newVariantName.trim(),
        sku: newVariantSku.trim() || undefined,
        priceOverride: newVariantPrice ? parseFloat(newVariantPrice) : undefined,
        isActive: true,
        companyCode: user?.companyCode,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.productVariants.add(newVariant as any);
      setNewVariantName('');
      setNewVariantSku('');
      setNewVariantPrice('');
      showToast(`Variant "${newVariant.name}" added`);
      SyncService.sync();
    } catch (error: any) {
      console.error(error);
      showToast('Failed to add variant', 'error');
    }
  };

  // Delete Variant
  const handleDeleteVariant = async (variant: UIVariant) => {
    if (!confirm(`Delete variant "${variant.name}"?`)) return;
    try {
      await db.productVariants.where('syncId').equals(variant.syncId!).modify({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      });
      showToast('Variant removed');
      SyncService.sync();
    } catch (error: any) {
      console.error(error);
      showToast('Failed to delete variant', 'error');
    }
  };

  // Variant Quick Stock Adjust
  const handleVariantStockAdjust = async (variant: UIVariant, quantity: number, type: 'STOCK_IN' | 'STOCK_OUT', reason: string) => {
    try {
      const newMovement: StockMovement = {
        syncId: crypto.randomUUID(),
        productId: variant.productId,
        variantId: variant.syncId,
        type,
        quantity,
        reason,
        locationId: variantsModalProduct?.locationId,
        companyCode: user?.companyCode,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.stockMovements.add(newMovement as any);
      showToast(`${type === 'STOCK_IN' ? '+' : '-'}${quantity} ${variant.name}`);
      SyncService.sync();
    } catch (error: any) {
      console.error(error);
      showToast('Failed to adjust variant stock', 'error');
    }
  };

  // Open Variant Delivery Modal
  const openVariantDeliveryModal = (v: UIVariant, type: 'STOCK_IN' | 'STOCK_OUT') => {
    setVariantDeliveryTarget(v);
    setVariantDeliveryType(type);
    setVariantDeliveryQuantity('1');
    setVariantDeliveryCost('');
    setVariantDeliveryNote('');
  };

  // Log Variant Delivery
  const handleLogVariantDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variantDeliveryTarget) return;

    try {
      const qty = parseFloat(variantDeliveryQuantity) || 0;
      if (qty <= 0) return showToast('Quantity must be greater than 0', 'error');

      const newMovement: StockMovement = {
        syncId: crypto.randomUUID(),
        productId: variantDeliveryTarget.productId,
        variantId: variantDeliveryTarget.syncId,
        type: variantDeliveryType,
        quantity: qty,
        reason: variantDeliveryType === 'STOCK_IN' ? 'Delivery received' : 'Delivery dispatched',
        locationId: variantsModalProduct?.locationId,
        deliveryCost: variantDeliveryCost ? parseFloat(variantDeliveryCost) : undefined,
        deliveryNote: variantDeliveryNote || undefined,
        companyCode: user?.companyCode,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.stockMovements.add(newMovement as any);
      setVariantDeliveryTarget(null);
      showToast(`Logged delivery for ${variantDeliveryTarget.name}`);
      SyncService.sync();
    } catch (error: any) {
      console.error(error);
      showToast('Failed to log variant delivery', 'error');
    }
  };

  // Delete Product
  const handleDeleteProduct = async (p: UIProduct) => {
    if (!confirm(`Are you sure you want to delete product "${p.name}"?`)) return;
    try {
      await db.products.where('syncId').equals(p.syncId!).modify({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date()
      });
      showToast(`Product "${p.name}" deleted`);
      SyncService.sync();
    } catch (e: any) {
      showToast('Failed to delete product', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-semibold transition-all border ${
          toastMessage.type === 'success'
            ? 'bg-emerald-600 text-white border-emerald-500'
            : 'bg-rose-600 text-white border-rose-500'
        }`}>
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          {toastMessage.text}
        </div>
      )}

      {/* Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            <Link href="/" className="hover:text-indigo-600 transition-colors">Workspace</Link>
            <span>/</span>
            <span className="text-slate-700">Inventory & Stock</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-2xl shadow-md shadow-indigo-100">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Inventory & Warehouses</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Multi-location stock, variant management, live batch movements & automated reorder alerts
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/categories"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-bold text-xs transition-colors shadow-sm"
          >
            <FolderTree className="w-4 h-4 text-violet-600" />
            Categories
          </Link>
          <Link
            href="/locations"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-bold text-xs transition-colors shadow-sm"
          >
            <MapPin className="w-4 h-4 text-blue-600" />
            Locations
          </Link>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-bold text-xs transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
          <button
            onClick={() => setShowAddProductModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-md shadow-indigo-200"
          >
            <Plus className="w-4 h-4" />
            Add New Product
          </button>
        </div>
      </div>

      {/* Top KPI Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Products */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Products</span>
            <div className="text-3xl font-black text-slate-900 mt-1">{metrics.totalItems}</div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">Active catalog items</div>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        {/* Total Stock Quantity */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Stock Units</span>
            <div className="text-3xl font-black text-emerald-600 mt-1">{metrics.totalStock}</div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">Units in all warehouses</div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Total Inventory Value */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Inventory Valuation</span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              Rs. {metrics.totalValue.toLocaleString()}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">At retail selling price</div>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Low Stock Alert Card */}
        <div 
          onClick={() => setStockStatusFilter(stockStatusFilter === 'low_stock' ? 'all' : 'low_stock')}
          className={`p-5 rounded-3xl border shadow-sm flex items-center justify-between cursor-pointer transition-all ${
            stockStatusFilter === 'low_stock'
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/30'
              : 'bg-white border-slate-200/80 hover:border-amber-200'
          }`}
        >
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Low Stock Alerts</span>
            <div className="text-3xl font-black text-amber-600 mt-1">{metrics.lowStock}</div>
            <div className="text-xs font-semibold text-amber-700/80 mt-0.5">
              {metrics.outOfStock > 0 ? `${metrics.outOfStock} out of stock` : 'Requires restocking'}
            </div>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Modern Quota Widget */}
      <QuotaWidget featureKey="products" title="Products" freeLimit={25} />

      {/* Main Tabs Navigation & Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Main Tab Toggle */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl w-fit">
            <button
              onClick={() => setActiveMainTab('catalog')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeMainTab === 'catalog'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-4 h-4" />
              Products Catalog ({productsWithStock.length})
            </button>
            <button
              onClick={() => setActiveMainTab('movements')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeMainTab === 'movements'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-4 h-4" />
              Stock Movement Ledger ({stockMovements.length})
            </button>
          </div>

          {/* View Mode Switcher (only for catalog tab) */}
          {activeMainTab === 'catalog' && (
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl w-fit">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-xl transition-all ${
                  viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Grid Cards View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-xl transition-all ${
                  viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Table View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Filter Controls Bar (Catalog View) */}
        {activeMainTab === 'catalog' && (
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 pt-2 border-t border-slate-100">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search products by name, SKU, or barcode..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-indigo-600 bg-slate-50/50 focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Dropdown Filter */}
            <div className="min-w-[180px]">
              <select
                value={selectedCategoryFilter}
                onChange={e => setSelectedCategoryFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50/50 focus:bg-white focus:outline-indigo-600"
              >
                <option value="all">All Categories ({categories.length})</option>
                {flatCategories.map(c => (
                  <option key={c.syncId} value={c.syncId}>
                    {'→ '.repeat(c.depth)}{c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Stock Status Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
              <button
                onClick={() => setStockStatusFilter('all')}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                  stockStatusFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({productsWithStock.length})
              </button>
              <button
                onClick={() => setStockStatusFilter('in_stock')}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                  stockStatusFilter === 'in_stock'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                In Stock
              </button>
              <button
                onClick={() => setStockStatusFilter('low_stock')}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                  stockStatusFilter === 'low_stock'
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Low Stock ({metrics.lowStock})
              </button>
              <button
                onClick={() => setStockStatusFilter('out_of_stock')}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                  stockStatusFilter === 'out_of_stock'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Out of Stock ({metrics.outOfStock})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===================== TAB 1: CATALOG VIEW ===================== */}
      {activeMainTab === 'catalog' && (
        <div>
          {filteredProducts.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-black text-slate-800">No products found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {searchQuery || selectedCategoryFilter !== 'all' || stockStatusFilter !== 'all'
                  ? 'Try clearing your search query or filters.'
                  : 'Start by clicking "Add New Product" to create your inventory catalog.'}
              </p>
              <button
                onClick={() => setShowAddProductModal(true)}
                className="mt-4 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-sm"
              >
                + Add Product Now
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            /* GRID VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProducts.map(p => {
                const productVariants = variantsWithStock.filter(v => v.productId === p.syncId);
                const totalStock = productVariants.length > 0
                  ? productVariants.reduce((sum, v) => sum + v.currentStock, 0)
                  : p.currentStock;

                const threshold = p.lowStockThreshold || 5;
                const isOutOfStock = totalStock <= 0;
                const isLowStock = totalStock > 0 && totalStock <= threshold;

                return (
                  <div
                    key={p.syncId}
                    className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-extrabold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                            {p.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
                              {p.category || 'General'}
                            </span>
                            {p.sku && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                                <Barcode className="w-3 h-3 text-slate-400" />
                                {p.sku}
                              </span>
                            )}
                            {p.locationId && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1">
                                <MapPin className="w-2.5 h-2.5 text-blue-500" />
                                {locationMap.get(p.locationId) || 'Location'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Stock Status Pill */}
                        <span className={`text-[11px] font-black px-2.5 py-1 rounded-full shrink-0 border ${
                          isOutOfStock
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : isLowStock
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {totalStock} {p.unit || 'units'}
                        </span>
                      </div>

                      {/* Pricing & Stock Details */}
                      <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100 space-y-1.5 mb-4 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">Selling Price:</span>
                          <span className="font-extrabold text-slate-900 text-sm">
                            Rs. {Number(p.sellingPrice).toLocaleString()}
                          </span>
                        </div>
                        {p.costPrice !== undefined && (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400 font-medium">Cost Price:</span>
                            <span className="font-semibold text-slate-600">
                              Rs. {Number(p.costPrice).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {productVariants.length > 0 && (
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                            <span className="text-violet-700 font-bold">Variants:</span>
                            <span className="font-bold text-violet-700">
                              {productVariants.length} item{productVariants.length > 1 ? 's' : ''} configured
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Micro-Actions Toolbar */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between gap-2">
                        {productVariants.length > 0 ? (
                          <button
                            onClick={() => setVariantsModalProduct(p)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold transition-colors"
                          >
                            <Layers className="w-3.5 h-3.5" /> Manage {productVariants.length} Variants
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => openDeliveryModal(p, 'STOCK_IN')}
                              className="flex-1 flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                            >
                              <Truck className="w-3.5 h-3.5 text-indigo-600" /> Log Delivery
                            </button>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleStockAdjust(p.syncId!, 1, 'STOCK_IN', 'Restock')}
                                title="Quick Restock +1"
                                className="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center font-black text-sm active:scale-95 transition-transform"
                              >
                                +
                              </button>
                              <button
                                onClick={() => handleStockAdjust(p.syncId!, 1, 'STOCK_OUT', 'Sale')}
                                title="Quick Sale -1"
                                disabled={totalStock <= 0}
                                className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center font-black text-sm active:scale-95 transition-transform disabled:opacity-40"
                              >
                                -
                              </button>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1 text-slate-400">
                        {productVariants.length === 0 && (
                          <button
                            onClick={() => setVariantsModalProduct(p)}
                            className="hover:text-indigo-600 font-semibold"
                          >
                            + Add Variant
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteProduct(p)}
                          className="hover:text-rose-600 font-semibold ml-auto flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* HIGH DENSITY TABLE VIEW */
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3.5 px-5">Product Name</th>
                      <th className="py-3.5 px-5">Category</th>
                      <th className="py-3.5 px-5">SKU</th>
                      <th className="py-3.5 px-5">Location</th>
                      <th className="py-3.5 px-5">Price (Rs.)</th>
                      <th className="py-3.5 px-5">Stock Level</th>
                      <th className="py-3.5 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                    {filteredProducts.map(p => {
                      const productVariants = variantsWithStock.filter(v => v.productId === p.syncId);
                      const totalStock = productVariants.length > 0
                        ? productVariants.reduce((sum, v) => sum + v.currentStock, 0)
                        : p.currentStock;

                      const threshold = p.lowStockThreshold || 5;
                      const isOutOfStock = totalStock <= 0;
                      const isLowStock = totalStock > 0 && totalStock <= threshold;

                      return (
                        <tr key={p.syncId} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-4 px-5">
                            <span className="font-bold text-slate-900 text-sm">{p.name}</span>
                            {productVariants.length > 0 && (
                              <span className="block text-[10px] text-violet-600 font-bold">
                                {productVariants.length} variants
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-violet-50 text-violet-700 border border-violet-100">
                              {p.category || 'General'}
                            </span>
                          </td>
                          <td className="py-4 px-5 text-slate-500">{p.sku || '-'}</td>
                          <td className="py-4 px-5 text-slate-500">
                            {p.locationId ? locationMap.get(p.locationId) || 'Assigned' : '-'}
                          </td>
                          <td className="py-4 px-5 font-bold text-slate-900">
                            Rs. {Number(p.sellingPrice).toLocaleString()}
                          </td>
                          <td className="py-4 px-5">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-black border ${
                              isOutOfStock
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : isLowStock
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {totalStock} {p.unit || 'units'}
                            </span>
                          </td>
                          <td className="py-4 px-5 text-right space-x-1.5">
                            {productVariants.length > 0 ? (
                              <button
                                onClick={() => setVariantsModalProduct(p)}
                                className="px-2.5 py-1 bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-lg text-xs font-bold transition-colors"
                              >
                                Variants
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => openDeliveryModal(p, 'STOCK_IN')}
                                  className="px-2.5 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-bold transition-colors"
                                >
                                  Delivery
                                </button>
                                <button
                                  onClick={() => handleStockAdjust(p.syncId!, 1, 'STOCK_IN', 'Restock')}
                                  className="w-7 h-7 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-black transition-colors"
                                >
                                  +
                                </button>
                                <button
                                  onClick={() => handleStockAdjust(p.syncId!, 1, 'STOCK_OUT', 'Sale')}
                                  disabled={totalStock <= 0}
                                  className="w-7 h-7 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-black transition-colors disabled:opacity-40"
                                >
                                  -
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDeleteProduct(p)}
                              className="p-1 text-slate-300 hover:text-rose-600 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4 inline" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB 2: RECENT MOVEMENTS ===================== */}
      {activeMainTab === 'movements' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Stock Movement Audit Ledger</h2>
              <p className="text-xs text-slate-500 font-medium">Verified historical log of all deliveries, sales, and manual adjustments</p>
            </div>
          </div>

          {stockMovements.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-600">No stock movements recorded yet</p>
              <p className="text-xs text-slate-400 mt-1">Movements are logged automatically when stock is adjusted, delivered, or sold.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {stockMovements.slice(0, 50).map((sm: StockMovement) => {
                const product = products.find(p => p.syncId === sm.productId);
                const isInward = sm.type === 'STOCK_IN' || sm.type === 'IN';

                return (
                  <div
                    key={sm.syncId || sm.id}
                    className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl shrink-0 ${
                        isInward ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {isInward ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{product?.name || 'Unknown Product'}</div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span>{sm.reason || (isInward ? 'Restock' : 'Dispatched')}</span>
                          {sm.deliveryNote && <span>• {sm.deliveryNote}</span>}
                          {sm.locationId && <span>• {locationMap.get(sm.locationId) || 'Location'}</span>}
                          {sm.lotNumber && (
                            <span className="font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700">
                              Lot: {sm.lotNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                      <span className={`text-base font-black ${
                        isInward ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {isInward ? '+' : '-'}{sm.quantity} units
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">
                        {sm.createdAt ? new Date(sm.createdAt).toLocaleDateString() : '-'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================== MODAL: ADD PRODUCT ===================== */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Add New Product</h3>
                  <p className="text-xs text-slate-500">Define product details, category, and initial inventory</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddProductModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Product Title *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Basmati Biryani Rice (5kg Bag)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-indigo-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Selling Price (Rs.) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="e.g. 1200"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-indigo-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Cost Price (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={costPrice}
                    onChange={e => setCostPrice(e.target.value)}
                    placeholder="e.g. 950"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">SKU / Barcode</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={e => setSku(e.target.value)}
                    placeholder="e.g. RICE-001"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Initial Opening Stock</label>
                  <input
                    type="number"
                    value={initialStock}
                    onChange={e => setInitialStock(e.target.value)}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Category *</label>
                <select
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-indigo-600"
                  required
                >
                  <option value="" disabled>Select Category</option>
                  {flatCategories.map(c => (
                    <option key={c.syncId} value={c.syncId}>
                      {'→ '.repeat(c.depth)}{c.name}
                    </option>
                  ))}
                </select>
                {flatCategories.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    No categories found. <Link href="/categories" className="underline font-bold">Create a category first</Link>.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Warehouse Location</label>
                  <select
                    value={locationId}
                    onChange={e => setLocationId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-indigo-600"
                  >
                    <option value="">No location (unassigned)</option>
                    {locations.map(l => (
                      <option key={l.syncId} value={l.syncId}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Low Stock Alert Level</label>
                  <input
                    type="number"
                    value={lowStockThreshold}
                    onChange={e => setLowStockThreshold(e.target.value)}
                    placeholder="5"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-indigo-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-100 transition-colors"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: LOG DELIVERY / STOCK IN-OUT ===================== */}
      {deliveryModalProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">Log Delivery & Stock Movement</h3>
                <p className="text-xs text-slate-500">{deliveryModalProduct.name}</p>
              </div>
              <button
                onClick={() => setDeliveryModalProduct(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLogDelivery} className="space-y-3.5">
              {/* Movement Type Toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDeliveryModalType('STOCK_IN')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    deliveryModalType === 'STOCK_IN'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" /> Stock In (Inward)
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryModalType('STOCK_OUT')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    deliveryModalType === 'STOCK_OUT'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" /> Stock Out (Dispatch)
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Quantity *</label>
                <input
                  type="number"
                  step="any"
                  value={deliveryQuantity}
                  onChange={e => setDeliveryQuantity(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-indigo-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Warehouse Location</label>
                <select
                  value={deliveryLocationId}
                  onChange={e => setDeliveryLocationId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-indigo-600"
                >
                  <option value="">No location (unassigned)</option>
                  {locations.map(l => (
                    <option key={l.syncId} value={l.syncId}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Delivery / Freight Cost (Rs.)</label>
                <input
                  type="number"
                  step="0.01"
                  value={deliveryCost}
                  onChange={e => setDeliveryCost(e.target.value)}
                  placeholder="Optional delivery charges"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Reference Note</label>
                <input
                  type="text"
                  value={deliveryNote}
                  onChange={e => setDeliveryNote(e.target.value)}
                  placeholder="e.g. Inward from Lahore vendor / Bill # 1049"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-indigo-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeliveryModalProduct(null)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-md transition-colors ${
                    deliveryModalType === 'STOCK_IN'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                      : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                  }`}
                >
                  Confirm {deliveryModalType === 'STOCK_IN' ? 'Stock In' : 'Stock Out'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: MANAGE VARIANTS ===================== */}
      {variantsModalProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">Manage Product Variants</h3>
                <p className="text-xs text-slate-500">{variantsModalProduct.name}</p>
              </div>
              <button
                onClick={() => setVariantsModalProduct(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Add Variant Form */}
            <form onSubmit={handleAddVariant} className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
              <span className="text-xs font-extrabold text-slate-800">Add New Variant</span>
              <div>
                <input
                  type="text"
                  value={newVariantName}
                  onChange={e => setNewVariantName(e.target.value)}
                  placeholder="Variant Name (e.g. Small, Red, 1kg pack)"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white focus:outline-indigo-600"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newVariantSku}
                  onChange={e => setNewVariantSku(e.target.value)}
                  placeholder="SKU (optional)"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white focus:outline-indigo-600"
                />
                <input
                  type="number"
                  step="0.01"
                  value={newVariantPrice}
                  onChange={e => setNewVariantPrice(e.target.value)}
                  placeholder={`Price (Rs. ${variantsModalProduct.sellingPrice})`}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white focus:outline-indigo-600"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                + Add Variant
              </button>
            </form>

            {/* Existing Variants List */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase text-slate-400">Configured Variants</span>
              {variantsWithStock.filter(v => v.productId === variantsModalProduct.syncId).length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs font-medium">
                  No variants added yet for this product.
                </div>
              ) : (
                variantsWithStock
                  .filter(v => v.productId === variantsModalProduct.syncId)
                  .map(v => (
                    <div
                      key={v.syncId}
                      className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{v.name}</div>
                        <div className="text-[11px] text-slate-500">
                          Rs. {v.priceOverride ?? variantsModalProduct.sellingPrice} • Stock:{' '}
                          <strong className={v.currentStock <= 5 ? 'text-amber-600' : 'text-emerald-600'}>
                            {v.currentStock}
                          </strong>
                          {v.sku && <span className="ml-2 text-slate-400 font-mono">({v.sku})</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openVariantDeliveryModal(v, 'STOCK_IN')}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px]"
                        >
                          Delivery
                        </button>
                        <button
                          onClick={() => handleVariantStockAdjust(v, 1, 'STOCK_IN', 'Restock')}
                          className="w-7 h-7 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-black text-xs"
                        >
                          +
                        </button>
                        <button
                          onClick={() => handleVariantStockAdjust(v, 1, 'STOCK_OUT', 'Sale')}
                          disabled={v.currentStock <= 0}
                          className="w-7 h-7 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg font-black text-xs disabled:opacity-40"
                        >
                          -
                        </button>
                        <button
                          onClick={() => handleDeleteVariant(v)}
                          className="p-1 text-slate-300 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setVariantsModalProduct(null)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: VARIANT DELIVERY ===================== */}
      {variantDeliveryTarget && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">Log Variant Delivery</h3>
                <p className="text-xs text-slate-500">{variantDeliveryTarget.name}</p>
              </div>
              <button
                onClick={() => setVariantDeliveryTarget(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLogVariantDelivery} className="space-y-3">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setVariantDeliveryType('STOCK_IN')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    variantDeliveryType === 'STOCK_IN' ? 'bg-emerald-600 text-white' : 'text-slate-600'
                  }`}
                >
                  Stock In
                </button>
                <button
                  type="button"
                  onClick={() => setVariantDeliveryType('STOCK_OUT')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    variantDeliveryType === 'STOCK_OUT' ? 'bg-rose-600 text-white' : 'text-slate-600'
                  }`}
                >
                  Stock Out
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Quantity</label>
                <input
                  type="number"
                  value={variantDeliveryQuantity}
                  onChange={e => setVariantDeliveryQuantity(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Delivery / Fuel Cost</label>
                <input
                  type="number"
                  step="0.01"
                  value={variantDeliveryCost}
                  onChange={e => setVariantDeliveryCost(e.target.value)}
                  placeholder="Optional cost"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Notes</label>
                <input
                  type="text"
                  value={variantDeliveryNote}
                  onChange={e => setVariantDeliveryNote(e.target.value)}
                  placeholder="e.g. Inward from supplier"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVariantDeliveryTarget(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-md ${
                    variantDeliveryType === 'STOCK_IN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
