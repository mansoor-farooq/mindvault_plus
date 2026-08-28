'use client';

import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Type, Image as ImageIcon, Table, Minus, Printer, Save, Trash2, Settings, Download, LayoutTemplate, FolderOpen } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

type ElementType = 'text' | 'image' | 'table' | 'divider' | 'total';

interface CanvasElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
}

export default function InvoiceBuilderPage() {
  const [elements, setElements] = useState<CanvasElement[]>([
    { id: '1', type: 'text', x: 50, y: 50, width: 250, height: 40, content: 'YOUR COMPANY NAME', fontSize: 24, fontWeight: 'bold' },
    { id: '2', type: 'text', x: 50, y: 100, width: 200, height: 30, content: 'INVOICE', fontSize: 18, color: '#64748b' },
    { id: '3', type: 'table', x: 50, y: 200, width: 700, height: 150, content: 'Description | Qty | Price | Total\nItem 1 | 2 | $10 | $20\nItem 2 | 1 | $50 | $50' },
  ]);
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [templateName, setTemplateName] = useState('My Custom Template');
  const [showLoadModal, setShowLoadModal] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const savedTemplates = useLiveQuery(() => db.pdfTemplates.toArray()) || [];

  const addElement = (type: ElementType) => {
    const newEl: CanvasElement = {
      id: crypto.randomUUID(),
      type,
      x: 100,
      y: 100,
      width: type === 'table' ? 600 : 200,
      height: type === 'table' ? 100 : 40,
      content: type === 'text' ? 'Double click to edit' : type === 'table' ? 'Col 1 | Col 2\nData 1 | Data 2' : '',
      fontSize: 16,
      color: '#000000'
    };
    setElements([...elements, newEl]);
    setSelectedId(newEl.id);
  };

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
    setIsDragging(true);
    
    const el = elements.find(el => el.id === id);
    if (el && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const offsetX = (e.clientX - rect.left) - el.x;
      const offsetY = (e.clientY - rect.top) - el.y;
      setDragOffset({ x: offsetX, y: offsetY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedId || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const newX = (e.clientX - rect.left) - dragOffset.x;
    const newY = (e.clientY - rect.top) - dragOffset.y;

    setElements(prev => prev.map(el => 
      el.id === selectedId 
        ? { ...el, x: Math.max(0, newX), y: Math.max(0, newY) } 
        : el
    ));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const updateSelected = (updates: Partial<CanvasElement>) => {
    if (!selectedId) return;
    setElements(prev => prev.map(el => el.id === selectedId ? { ...el, ...updates } : el));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setElements(prev => prev.filter(el => el.id !== selectedId));
    setSelectedId(null);
  };

  const handlePrint = () => {
    window.print();
  };

  const saveTemplate = async () => {
    try {
      await db.pdfTemplates.add({
        name: templateName,
        elementsData: JSON.stringify(elements),
        createdAt: new Date().toISOString()
      });
      alert('Template saved successfully!');
    } catch (e) {
      console.error(e);
      alert('Error saving template');
    }
  };

  const loadTemplate = (jsonString: string) => {
    try {
      setElements(JSON.parse(jsonString));
      setShowLoadModal(false);
    } catch(e) {
      alert('Corrupt template data');
    }
  };

  const selectedElement = elements.find(el => el.id === selectedId);

  return (
    <main className="flex-1 flex h-screen bg-slate-900 text-slate-200 overflow-hidden font-sans print:h-auto print:bg-white print:overflow-visible relative">
      
      {/* LOAD TEMPLATE MODAL */}
      {showLoadModal && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-800">
            <h2 className="text-xl font-bold mb-4 text-white">Load Saved Template</h2>
            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
              {savedTemplates.length === 0 ? (
                <p className="text-slate-500 text-sm">No templates saved yet.</p>
              ) : (
                savedTemplates.map(t => (
                  <button key={t.id} onClick={() => loadTemplate(t.elementsData)} className="p-4 rounded-xl bg-slate-800 hover:bg-indigo-600 transition-colors text-left group">
                    <p className="font-bold text-white">{t.name}</p>
                    <p className="text-xs text-slate-400 group-hover:text-indigo-200">{new Date(t.createdAt).toLocaleDateString()}</p>
                  </button>
                ))
              )}
            </div>
            <button onClick={() => setShowLoadModal(false)} className="mt-6 w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* LEFT SIDEBAR - TOOLS */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col print:hidden shrink-0 z-10">
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-bold flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-indigo-400" /> Canvas Builder
          </h1>
        </div>

        <div className="p-4 flex flex-col gap-2 flex-1 overflow-y-auto">
          <p className="text-xs font-bold text-slate-500 uppercase mb-2">Add Elements</p>
          <button onClick={() => addElement('text')} className="flex items-center gap-3 p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition-colors text-left">
            <Type className="w-5 h-5 text-indigo-400" />
            <div>
              <p className="text-sm font-bold">Text Block</p>
              <p className="text-[10px] text-slate-500">Add headers or labels</p>
            </div>
          </button>
          
          <button onClick={() => addElement('table')} className="flex items-center gap-3 p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition-colors text-left">
            <Table className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-sm font-bold">Data Table</p>
              <p className="text-[10px] text-slate-500">Invoice items grid</p>
            </div>
          </button>

          <button onClick={() => addElement('divider')} className="flex items-center gap-3 p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition-colors text-left">
            <Minus className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-sm font-bold">Divider</p>
              <p className="text-[10px] text-slate-500">Horizontal line</p>
            </div>
          </button>

          <p className="text-xs font-bold text-slate-500 uppercase mt-6 mb-2">Templates</p>
          <button onClick={() => setShowLoadModal(true)} className="flex items-center gap-3 p-3 bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-500/30 rounded-xl transition-colors text-left text-indigo-300">
            <FolderOpen className="w-5 h-5" />
            <div>
              <p className="text-sm font-bold">Load Template</p>
              <p className="text-[10px] opacity-70">Open saved designs</p>
            </div>
          </button>
        </div>

        <div className="p-4 border-t border-slate-800 flex flex-col gap-2">
          <input 
            type="text" 
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Template Name..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:border-indigo-500 outline-none"
          />
          <button onClick={saveTemplate} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors">
            <Save className="w-4 h-4" /> Save
          </button>
          
          <button onClick={handlePrint} className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/50 transition-colors">
            <Printer className="w-5 h-5" /> Print / PDF
          </button>
        </div>
      </aside>

      {/* CENTER - CANVAS AREA */}
      <section className="flex-1 flex flex-col bg-slate-900 overflow-auto print:overflow-visible relative">
        <div className="min-w-max p-8 flex justify-center items-start print:p-0 mx-auto">
          
          {/* THE A4 CANVAS */}
          <div 
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={() => setSelectedId(null)}
            className="bg-white text-black shadow-2xl relative print:shadow-none shrink-0"
            style={{ 
              width: '794px',
              height: '1123px',
            }}
          >
            {elements.map(el => (
              <div 
                key={el.id}
                onMouseDown={(e) => handleMouseDown(e, el.id)}
                className={bsolute cursor-move print:border-none \}
                style={{
                  left: el.x + 'px',
                  top: el.y + 'px',
                  width: el.width + 'px',
                  minHeight: el.height + 'px',
                }}
              >
                {el.type === 'text' && (
                  <div style={{ fontSize: el.fontSize + 'px', fontWeight: el.fontWeight, color: el.color }} className="w-full h-full p-1 whitespace-pre-wrap outline-none">
                    {el.content}
                  </div>
                )}
                
                {el.type === 'divider' && (
                  <div className="w-full h-[2px] bg-slate-800 my-2"></div>
                )}

                {el.type === 'table' && (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-black">
                        {el.content.split('\n')[0]?.split('|').map((h, i) => (
                          <th key={i} className="py-2 px-1 text-sm font-bold uppercase">{h.trim()}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {el.content.split('\n').slice(1).map((row, i) => (
                        <tr key={i} className="border-b border-slate-200">
                          {row.split('|').map((cell, j) => (
                            <td key={j} className="py-2 px-1 text-sm">{cell.trim()}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RIGHT SIDEBAR - PROPERTIES */}
      <aside className="w-72 bg-slate-950 border-l border-slate-800 flex flex-col print:hidden shrink-0 z-10">
        <div className="p-4 border-b border-slate-800">
          <h2 className="font-bold flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-400" /> Properties
          </h2>
        </div>

        {selectedElement ? (
          <div className="p-4 flex flex-col gap-4 overflow-y-auto">
            
            {selectedElement.type === 'text' && (
              <>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Text Content</label>
                  <textarea 
                    value={selectedElement.content}
                    onChange={(e) => updateSelected({ content: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-indigo-500 outline-none resize-none h-24"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Size (px)</label>
                    <input 
                      type="number" 
                      value={selectedElement.fontSize || 16}
                      onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-sm text-white focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Weight</label>
                    <select 
                      value={selectedElement.fontWeight || 'normal'}
                      onChange={(e) => updateSelected({ fontWeight: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-sm text-white focus:border-indigo-500 outline-none"
                    >
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                      <option value="900">Black</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Color</label>
                  <input 
                    type="color" 
                    value={selectedElement.color || '#000000'}
                    onChange={(e) => updateSelected({ color: e.target.value })}
                    className="w-full h-10 rounded-xl cursor-pointer"
                  />
                </div>
              </>
            )}

            {selectedElement.type === 'table' && (
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Table Data (CSV Format)</label>
                <p className="text-[10px] text-slate-400 mb-2">Use | to separate columns. First row is the header.</p>
                <textarea 
                  value={selectedElement.content}
                  onChange={(e) => updateSelected({ content: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-indigo-500 outline-none resize-none h-48 font-mono"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-800">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Width</label>
                <input 
                  type="number" 
                  value={selectedElement.width}
                  onChange={(e) => updateSelected({ width: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-sm text-white focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <button onClick={deleteSelected} className="mt-4 w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors border border-rose-500/20">
              <Trash2 className="w-4 h-4" /> Delete Element
            </button>

          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full">
            <LayoutTemplate className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm">Click any element on the canvas to edit its properties.</p>
          </div>
        )}
      </aside>

    </main>
  );
}
