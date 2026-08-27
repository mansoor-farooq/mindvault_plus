'use client';
import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Product, StockMovement, Category, ProductVariant } from '@/lib/db';
import { useAuthStore } from '@/store/authStore';
import QuotaWidget from '@/components/QuotaWidget';
import { SyncService } from '@/services/SyncService';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

type UIProduct = Product & { currentStock: number };
type UIVariant = ProductVariant & { currentStock: number };

export default function InventoryPage() {
  const { user } = useAuthStore();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [sku, setSku] = useState('');
  const [initialStock, setInitialStock] = useState('0');
  const [locationId, setLocationId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const [deliveryModalProduct, setDeliveryModalProduct] = useState<UIProduct | null>(null);
  const [deliveryModalType, setDeliveryModalType] = useState<'STOCK_IN' | 'STOCK_OUT'>('STOCK_IN');
  const [deliveryQuantity, setDeliveryQuantity] = useState('1');
  const [deliveryLocationId, setDeliveryLocationId] = useState('');
  const [deliveryCost, setDeliveryCost] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');

  const [variantsModalProduct, setVariantsModalProduct] = useState<UIProduct | null>(null);
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantSku, setNewVariantSku] = useState('');
  const [newVariantPrice, setNewVariantPrice] = useState('');

  const [variantDeliveryTarget, setVariantDeliveryTarget] = useState<UIVariant | null>(null);
  const [variantDeliveryType, setVariantDeliveryType] = useState<'STOCK_IN' | 'STOCK_OUT'>('STOCK_IN');
  const [variantDeliveryQuantity, setVariantDeliveryQuantity] = useState('1');
  const [variantDeliveryCost, setVariantDeliveryCost] = useState('');
  const [variantDeliveryNote, setVariantDeliveryNote] = useState('');

  const products = useLiveQuery(() => db.products.filter(p => !p.isDeleted).toArray()) || [];
  const stockMovements = useLiveQuery(() => db.stockMovements.orderBy('createdAt').reverse().filter(sm => !sm.isDeleted).toArray()) || [];
  const locations = useLiveQuery(() => db.locations.filter((l) => l.isActive && !l.isDeleted).toArray()) || [];
  const categories = useLiveQuery(() => db.categories.filter((c) => c.isActive && !c.isDeleted).toArray()) || [];
  const variants = useLiveQuery(() => db.productVariants.filter((v) => v.isActive && !v.isDeleted).toArray()) || [];

  // Flattens the category tree into a depth-indented list for the plain <select> picker
  // (the real interactive expand/collapse tree lives on the dedicated /categories page).
  const flatCategories = useMemo(() => {
    const byParent = new Map<string | undefined, Category[]>();
    for (const cat of categories) {
      // Normalize null -> undefined: a synced-then-pulled category comes back with
      // parentId: null (from Postgres) rather than undefined (a plain JS Map treats
      // those as different keys, which would make root categories vanish after sync).
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

  const productsWithStock: UIProduct[] = products.map((p) => {
    // Movements tagged with a variantId belong to that variant's own stock (see
    // variantsWithStock below), not the parent product's - excluding them here avoids
    // double-counting a variant's stock into its product's total.
    const movements = stockMovements.filter((sm: StockMovement) => sm.productId === p.syncId && !sm.variantId);
    // Postgres returns DECIMAL columns as strings, so a movement's quantity can come back
    // as e.g. "50.00" after a sync round-trip - Number() here prevents the reduce from
    // silently doing string concatenation (0 + "20.00" -> "020.00") instead of addition.
    const currentStock = movements.reduce((acc: number, sm: StockMovement) => acc + (sm.type === 'STOCK_IN' ? Number(sm.quantity) : -Number(sm.quantity)), 0);
    return { ...p, currentStock };
  });

  const variantsWithStock: UIVariant[] = variants.map((v) => {
    const movements = stockMovements.filter((sm: StockMovement) => sm.variantId === v.syncId);
    // Same Postgres DECIMAL-as-string coercion as productsWithStock above.
    const currentStock = movements.reduce((acc: number, sm: StockMovement) => acc + (sm.type === 'STOCK_IN' ? Number(sm.quantity) : -Number(sm.quantity)), 0);
    return { ...v, currentStock };
  });

  const recentMovements = stockMovements.slice(0, 20);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || !user || !categoryId) return;

    try {
      const syncId = crypto.randomUUID();
      const pickedCategory = categories.find((c) => c.syncId === categoryId);
      const newProduct: Product = {
        syncId,
        name,
        sku: sku || '',
        sellingPrice: parseFloat(price),
        category: pickedCategory?.name || 'General',
        categoryId: categoryId || undefined,
        unit: 'pcs',
        lowStockThreshold: 5,
        reorderPoint: 5,
        isActive: true,
        locationId: locationId || undefined,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.transaction('rw', db.products, db.stockMovements, async () => {
        await db.products.add(newProduct as any); // cast to bypass generated numeric ID

        const startingStock = parseInt(initialStock, 10);
        if (startingStock > 0) {
          const newMovement: StockMovement = {
            productId: syncId,
            type: 'STOCK_IN',
            quantity: startingStock,
            reason: 'Initial',
            locationId: locationId || undefined,
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          await db.stockMovements.add(newMovement as any);
        }
      });

      setName('');
      setPrice('');
      setSku('');
      setInitialStock('0');
      setLocationId('');
      setCategoryId('');

      SyncService.sync();
    } catch (error) {
      console.error(error);
      alert('Failed to create product');
    }
  };

  const handleStockAdjust = async (productSyncId: string, quantity: number, type: 'STOCK_IN' | 'STOCK_OUT', reason: string) => {
    try {
      const product = products.find((p) => p.syncId === productSyncId);
      const newMovement: StockMovement = {
        productId: productSyncId,
        type,
        quantity,
        reason,
        locationId: product?.locationId,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.stockMovements.add(newMovement as any);
      SyncService.sync();
    } catch (error) {
      console.error(error);
      alert('Failed to adjust stock');
    }
  };

  const openDeliveryModal = (p: UIProduct, type: 'STOCK_IN' | 'STOCK_OUT') => {
    setDeliveryModalProduct(p);
    setDeliveryModalType(type);
    setDeliveryQuantity('1');
    setDeliveryLocationId(p.locationId || '');
    setDeliveryCost('');
    setDeliveryNote('');
  };

  const handleLogDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryModalProduct) return;

    try {
      const newMovement: StockMovement = {
        productId: deliveryModalProduct.syncId!,
        type: deliveryModalType,
        quantity: parseFloat(deliveryQuantity) || 0,
        reason: deliveryModalType === 'STOCK_IN' ? 'Delivery received' : 'Delivery dispatched',
        locationId: deliveryLocationId || undefined,
        deliveryCost: deliveryCost ? parseFloat(deliveryCost) : undefined,
        deliveryNote: deliveryNote || undefined,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.stockMovements.add(newMovement as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      setDeliveryModalProduct(null);
      SyncService.sync();
    } catch (error) {
      console.error(error);
      alert('Failed to log delivery');
    }
  };

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVariantName || !variantsModalProduct?.syncId) return;

    try {
      const newVariant: ProductVariant = {
        productId: variantsModalProduct.syncId,
        name: newVariantName,
        sku: newVariantSku || undefined,
        priceOverride: newVariantPrice ? parseFloat(newVariantPrice) : undefined,
        isActive: true,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.productVariants.add(newVariant as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      setNewVariantName('');
      setNewVariantSku('');
      setNewVariantPrice('');
      SyncService.sync();
    } catch (error) {
      console.error(error);
      alert('Failed to add variant');
    }
  };

  const handleDeleteVariant = async (variant: UIVariant) => {
    if (!confirm(`Delete variant "${variant.name}"? Its stock history stays but it will no longer be usable.`)) return;
    try {
      await db.productVariants.where('syncId').equals(variant.syncId!).modify({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      });
      SyncService.sync();
    } catch (error) {
      console.error(error);
      alert('Failed to delete variant');
    }
  };

  const handleVariantStockAdjust = async (variant: UIVariant, quantity: number, type: 'STOCK_IN' | 'STOCK_OUT', reason: string) => {
    try {
      const newMovement: StockMovement = {
        productId: variant.productId,
        variantId: variant.syncId,
        type,
        quantity,
        reason,
        locationId: variantsModalProduct?.locationId,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.stockMovements.add(newMovement as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      SyncService.sync();
    } catch (error) {
      console.error(error);
      alert('Failed to adjust variant stock');
    }
  };

  const openVariantDeliveryModal = (v: UIVariant, type: 'STOCK_IN' | 'STOCK_OUT') => {
    setVariantDeliveryTarget(v);
    setVariantDeliveryType(type);
    setVariantDeliveryQuantity('1');
    setVariantDeliveryCost('');
    setVariantDeliveryNote('');
  };

  const handleLogVariantDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variantDeliveryTarget) return;

    try {
      const newMovement: StockMovement = {
        productId: variantDeliveryTarget.productId,
        variantId: variantDeliveryTarget.syncId,
        type: variantDeliveryType,
        quantity: parseFloat(variantDeliveryQuantity) || 0,
        reason: variantDeliveryType === 'STOCK_IN' ? 'Delivery received' : 'Delivery dispatched',
        locationId: variantsModalProduct?.locationId,
        deliveryCost: variantDeliveryCost ? parseFloat(variantDeliveryCost) : undefined,
        deliveryNote: variantDeliveryNote || undefined,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.stockMovements.add(newMovement as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      setVariantDeliveryTarget(null);
      SyncService.sync();
    } catch (error) {
      console.error(error);
      alert('Failed to log variant delivery');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 pb-20 max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
          <h1 className="text-2xl text-white font-bold">Inventory Management</h1>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Link href="/categories" className="text-xs font-bold text-violet-400 hover:text-violet-300 transition">
            Manage Categories →
          </Link>
          <Link href="/locations" className="text-xs font-bold text-blue-400 hover:text-blue-300 transition">
            Manage Locations →
          </Link>
        </div>
      </div>

      <QuotaWidget featureKey="products" title="Products" freeLimit={25} />

      <div className="lg:grid lg:grid-cols-[380px_1fr] lg:gap-6 lg:items-start flex flex-col gap-6">
      <div className="bg-slate-900 border border-white/5 p-4 rounded-xl">
        <h2 className="text-lg text-white font-bold mb-4">Add Product</h2>
        <form onSubmit={handleCreateProduct} className="flex flex-col gap-3">
          <input 
            className="bg-white/5 border border-white/10 rounded-lg p-2 text-white" 
            placeholder="Product Name" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            required 
          />
          <input 
            className="bg-white/5 border border-white/10 rounded-lg p-2 text-white" 
            placeholder="Selling Price" 
            type="number" 
            value={price} 
            onChange={e => setPrice(e.target.value)} 
            required 
          />
          <div className="flex gap-2">
            <input 
              className="bg-white/5 border border-white/10 rounded-lg p-2 text-white flex-1" 
              placeholder="SKU (Optional)" 
              value={sku} 
              onChange={e => setSku(e.target.value)} 
            />
            <input
              className="bg-white/5 border border-white/10 rounded-lg p-2 text-white flex-1"
              placeholder="Initial Stock"
              type="number"
              value={initialStock}
              onChange={e => setInitialStock(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <select
              className="bg-white/5 border border-white/10 rounded-lg p-2 text-white"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              <option value="" disabled>Select a category *</option>
              {flatCategories.map((c) => (
                <option key={c.syncId} value={c.syncId}>{'→ '.repeat(c.depth)}{c.name}</option>
              ))}
            </select>
            {flatCategories.length === 0 && (
              <p className="text-[11px] text-amber-400">
                No categories yet - <Link href="/categories" className="underline font-bold">create one first</Link>.
              </p>
            )}
          </div>
          <select
            className="bg-white/5 border border-white/10 rounded-lg p-2 text-white"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            <option value="">No location (unassigned)</option>
            {locations.map((l) => (
              <option key={l.syncId} value={l.syncId}>{l.name}</option>
            ))}
          </select>
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded-lg mt-2 transition">
            Save Product
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg text-white font-bold mb-3">Your Products</h2>
        {productsWithStock.length === 0 ? (
          <p className="text-gray-500">No products yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {productsWithStock.map(p => {
              const productVariants = variantsWithStock.filter(v => v.productId === p.syncId);
              const variantTotalStock = productVariants.reduce((a, v) => a + v.currentStock, 0);
              return (
              <div key={p.id} className="bg-white/5 border border-white/10 p-3 rounded-xl flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-medium">{p.name}</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                      {p.category}
                    </span>
                  </div>
                  {productVariants.length > 0 ? (
                    <p className="text-gray-400 text-sm">
                      Price: Rs {p.sellingPrice} | {productVariants.length} variant{productVariants.length > 1 ? 's' : ''} · total stock: <span className={variantTotalStock <= 5 ? 'text-orange-400 font-bold' : 'text-emerald-400 font-bold'}>{variantTotalStock}</span>
                    </p>
                  ) : (
                    <p className="text-gray-400 text-sm">Price: Rs {p.sellingPrice} | Stock: <span className={p.currentStock <= 5 ? 'text-orange-400 font-bold' : 'text-emerald-400 font-bold'}>{p.currentStock}</span></p>
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  {productVariants.length > 0 ? (
                    <button onClick={() => setVariantsModalProduct(p)} className="text-[10px] font-bold text-violet-400 hover:text-violet-300 transition px-1.5">
                      Manage Variants →
                    </button>
                  ) : (
                    <>
                      <button onClick={() => setVariantsModalProduct(p)} className="text-[10px] font-bold text-violet-400 hover:text-violet-300 transition px-1.5">
                        + Add Variant
                      </button>
                      <button onClick={() => openDeliveryModal(p, 'STOCK_IN')} className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition px-1.5">
                        Log Delivery
                      </button>
                      <button onClick={() => handleStockAdjust(p.syncId!, 1, 'STOCK_IN', 'Restock')} className="bg-emerald-500/20 hover:bg-emerald-500/40 transition text-emerald-400 w-8 h-8 rounded-full flex items-center justify-center font-bold">+</button>
                      <button onClick={() => handleStockAdjust(p.syncId!, 1, 'STOCK_OUT', 'Sale')} className="bg-red-500/20 hover:bg-red-500/40 transition text-red-400 w-8 h-8 rounded-full flex items-center justify-center font-bold">-</button>
                    </>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
      
      <div>
        <h2 className="text-lg text-white font-bold mb-3">Recent Movements</h2>
        {recentMovements.length === 0 ? (
          <p className="text-gray-500">No movements yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentMovements.map((sm: StockMovement) => {
              const product = products.find(p => p.syncId === sm.productId);
              return (
                <div key={sm.id} className="bg-white/5 p-2 rounded-lg flex flex-col gap-1 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-medium">{product?.name || 'Unknown Product'}</span>
                    <span className="text-gray-500 text-xs">{new Date(sm.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={sm.type === 'STOCK_IN' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                      {sm.type === 'STOCK_IN' ? '+' : '-'}{sm.quantity}
                    </span>
                    <span className="text-gray-400">({sm.reason})</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      </div>
      </div>

      {deliveryModalProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 w-full max-w-sm">
            <h3 className="text-white font-bold text-lg mb-1">Log Delivery</h3>
            <p className="text-gray-400 text-xs mb-4">{deliveryModalProduct.name}</p>
            <form onSubmit={handleLogDelivery} className="flex flex-col gap-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeliveryModalType('STOCK_IN')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${
                    deliveryModalType === 'STOCK_IN' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white/5 border-white/10 text-gray-300'
                  }`}
                >
                  Stock In
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryModalType('STOCK_OUT')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${
                    deliveryModalType === 'STOCK_OUT' ? 'bg-red-600 border-red-600 text-white' : 'bg-white/5 border-white/10 text-gray-300'
                  }`}
                >
                  Stock Out
                </button>
              </div>
              <input
                className="bg-white/5 border border-white/10 rounded-lg p-2 text-white"
                placeholder="Quantity"
                type="number"
                value={deliveryQuantity}
                onChange={(e) => setDeliveryQuantity(e.target.value)}
                required
              />
              <select
                className="bg-white/5 border border-white/10 rounded-lg p-2 text-white"
                value={deliveryLocationId}
                onChange={(e) => setDeliveryLocationId(e.target.value)}
              >
                <option value="">No location (unassigned)</option>
                {locations.map((l) => (
                  <option key={l.syncId} value={l.syncId}>{l.name}</option>
                ))}
              </select>
              <input
                className="bg-white/5 border border-white/10 rounded-lg p-2 text-white"
                placeholder="Delivery / Fuel Cost (optional)"
                type="number"
                step="0.01"
                value={deliveryCost}
                onChange={(e) => setDeliveryCost(e.target.value)}
              />
              <input
                className="bg-white/5 border border-white/10 rounded-lg p-2 text-white"
                placeholder="Note (e.g. bike fare to Gulshan)"
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setDeliveryModalProduct(null)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 font-bold p-2.5 rounded-lg transition"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold p-2.5 rounded-lg transition">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {variantsModalProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-1">
              <div>
                <h3 className="text-white font-bold text-lg">Manage Variants</h3>
                <p className="text-gray-400 text-xs">{variantsModalProduct.name}</p>
              </div>
              <button onClick={() => setVariantsModalProduct(null)} className="text-gray-400 hover:text-white text-sm font-bold px-2">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddVariant} className="flex flex-col gap-2 mt-4 mb-5 bg-white/5 border border-white/10 rounded-lg p-3">
              <p className="text-xs font-bold text-gray-300">Add a variant</p>
              <input
                className="bg-white/5 border border-white/10 rounded-lg p-2 text-white text-sm"
                placeholder="Name (e.g. Small, Red)"
                value={newVariantName}
                onChange={(e) => setNewVariantName(e.target.value)}
                required
              />
              <div className="flex gap-2">
                <input
                  className="bg-white/5 border border-white/10 rounded-lg p-2 text-white text-sm flex-1"
                  placeholder="SKU (optional)"
                  value={newVariantSku}
                  onChange={(e) => setNewVariantSku(e.target.value)}
                />
                <input
                  className="bg-white/5 border border-white/10 rounded-lg p-2 text-white text-sm flex-1"
                  placeholder={`Price (defaults to Rs ${variantsModalProduct.sellingPrice})`}
                  type="number"
                  value={newVariantPrice}
                  onChange={(e) => setNewVariantPrice(e.target.value)}
                />
              </div>
              <button type="submit" className="bg-violet-600 hover:bg-violet-700 text-white font-bold p-2 rounded-lg text-sm transition">
                Add Variant
              </button>
            </form>

            <div className="flex flex-col gap-2">
              {variantsWithStock.filter(v => v.productId === variantsModalProduct.syncId).length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No variants yet.</p>
              ) : (
                variantsWithStock
                  .filter(v => v.productId === variantsModalProduct.syncId)
                  .map((v) => (
                    <div key={v.id} className="bg-white/5 border border-white/10 p-3 rounded-lg flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-white font-medium text-sm">{v.name}</h4>
                          {v.sku && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">
                              {v.sku}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-xs">
                          Rs {v.priceOverride ?? variantsModalProduct.sellingPrice} | Stock: <span className={v.currentStock <= 5 ? 'text-orange-400 font-bold' : 'text-emerald-400 font-bold'}>{v.currentStock}</span>
                        </p>
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <button onClick={() => openVariantDeliveryModal(v, 'STOCK_IN')} className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition px-1">
                          Log Delivery
                        </button>
                        <button onClick={() => handleVariantStockAdjust(v, 1, 'STOCK_IN', 'Restock')} className="bg-emerald-500/20 hover:bg-emerald-500/40 transition text-emerald-400 w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm">+</button>
                        <button onClick={() => handleVariantStockAdjust(v, 1, 'STOCK_OUT', 'Sale')} className="bg-red-500/20 hover:bg-red-500/40 transition text-red-400 w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm">-</button>
                        <button onClick={() => handleDeleteVariant(v)} className="text-gray-500 hover:text-red-400 transition px-1 text-xs">
                          🗑
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {variantDeliveryTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-60">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 w-full max-w-sm">
            <h3 className="text-white font-bold text-lg mb-1">Log Delivery</h3>
            <p className="text-gray-400 text-xs mb-4">{variantsModalProduct?.name} — {variantDeliveryTarget.name}</p>
            <form onSubmit={handleLogVariantDelivery} className="flex flex-col gap-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setVariantDeliveryType('STOCK_IN')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${
                    variantDeliveryType === 'STOCK_IN' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white/5 border-white/10 text-gray-300'
                  }`}
                >
                  Stock In
                </button>
                <button
                  type="button"
                  onClick={() => setVariantDeliveryType('STOCK_OUT')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${
                    variantDeliveryType === 'STOCK_OUT' ? 'bg-red-600 border-red-600 text-white' : 'bg-white/5 border-white/10 text-gray-300'
                  }`}
                >
                  Stock Out
                </button>
              </div>
              <input
                className="bg-white/5 border border-white/10 rounded-lg p-2 text-white"
                placeholder="Quantity"
                type="number"
                value={variantDeliveryQuantity}
                onChange={(e) => setVariantDeliveryQuantity(e.target.value)}
                required
              />
              <input
                className="bg-white/5 border border-white/10 rounded-lg p-2 text-white"
                placeholder="Delivery / Fuel Cost (optional)"
                type="number"
                step="0.01"
                value={variantDeliveryCost}
                onChange={(e) => setVariantDeliveryCost(e.target.value)}
              />
              <input
                className="bg-white/5 border border-white/10 rounded-lg p-2 text-white"
                placeholder="Note (e.g. bike fare to Gulshan)"
                value={variantDeliveryNote}
                onChange={(e) => setVariantDeliveryNote(e.target.value)}
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setVariantDeliveryTarget(null)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 font-bold p-2.5 rounded-lg transition"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold p-2.5 rounded-lg transition">
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
