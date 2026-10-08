import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  FileText,
  Trash2,
  HelpCircle
} from 'lucide-react';
import { StockItem } from '../../types';

interface ParsedStockRow {
  name: string;
  category: StockItem['category'];
  quantity: number;
  unit: StockItem['unit'];
  minThreshold: number;
  costPerUnit: number;
  isValid: boolean;
  validationError?: string;
}

interface StockImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: Omit<StockItem, 'id' | 'status' | 'lastRestocked'>[]) => void;
  existingCount: number;
}

const VALID_CATEGORIES: StockItem['category'][] = [
  'Carnes & Pescados',
  'Verduras & Frescos',
  'Almacén & Secos',
  'Lácteos',
  'Bebidas & Licores',
];

const VALID_UNITS: StockItem['unit'][] = ['kg', 'g', 'l', 'unidades', 'botellas'];

export const StockImportModal: React.FC<StockImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingCount,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedStockRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const normalizeCategory = (catStr: any): StockItem['category'] => {
    if (!catStr) return 'Almacén & Secos';
    const s = String(catStr).toLowerCase();
    if (s.includes('carne') || s.includes('pescado') || s.includes('pollo')) return 'Carnes & Pescados';
    if (s.includes('verd') || s.includes('fresc') || s.includes('fruta')) return 'Verduras & Frescos';
    if (s.includes('lact') || s.includes('láct') || s.includes('queso') || s.includes('leche')) return 'Lácteos';
    if (s.includes('bebid') || s.includes('licor') || s.includes('vino') || s.includes('trago')) return 'Bebidas & Licores';
    return 'Almacén & Secos';
  };

  const normalizeUnit = (unitStr: any): StockItem['unit'] => {
    if (!unitStr) return 'unidades';
    const u = String(unitStr).toLowerCase().trim();
    if (u === 'kg' || u === 'kilo' || u === 'kilos') return 'kg';
    if (u === 'g' || u === 'gr' || u === 'gramo' || u === 'gramos') return 'g';
    if (u === 'l' || u === 'lt' || u === 'litro' || u === 'litros') return 'l';
    if (u.includes('bot')) return 'botellas';
    return 'unidades';
  };

  const handleFileProcess = async (selectedFile: File) => {
    setErrorMsg(null);
    setIsProcessing(true);
    setFile(selectedFile);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error('El archivo no contiene ninguna hoja con datos.');
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

      if (rawJson.length === 0) {
        throw new Error('No se encontraron filas con datos en la planilla.');
      }

      // Map headers flexibly
      const rows: ParsedStockRow[] = rawJson.map((row, idx) => {
        // Find matching keys
        const keys = Object.keys(row);
        const findVal = (terms: string[]) => {
          const key = keys.find((k) => {
            const clean = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return terms.some((t) => clean.includes(t));
          });
          return key ? row[key] : '';
        };

        const rawName = findVal(['nombre', 'producto', 'insumo', 'item', 'descripcion', 'name']);
        const rawCategory = findVal(['categoria', 'rubro', 'tipo', 'category']);
        const rawQuantity = findVal(['cantidad', 'stock', 'disponible', 'qty', 'quantity']);
        const rawUnit = findVal(['unidad', 'medida', 'uom', 'unit']);
        const rawThreshold = findVal(['umbral', 'minimo', 'alerta', 'threshold', 'min']);
        const rawCost = findVal(['costo', 'precio', 'cost', 'unitario']);

        const name = String(rawName || '').trim();
        const quantity = parseFloat(String(rawQuantity).replace(',', '.')) || 0;
        const minThreshold = parseFloat(String(rawThreshold).replace(',', '.')) || 5;
        const costPerUnit = parseFloat(String(rawCost).replace(',', '.')) || 0;
        const category = normalizeCategory(rawCategory);
        const unit = normalizeUnit(rawUnit);

        let isValid = true;
        let validationError: string | undefined = undefined;

        if (!name) {
          isValid = false;
          validationError = `Fila ${idx + 2}: Nombre del insumo requerido.`;
        } else if (isNaN(quantity) || quantity < 0) {
          isValid = false;
          validationError = `Fila ${idx + 2}: Cantidad inválida.`;
        }

        return {
          name: name || `Insumo ${idx + 1}`,
          category,
          quantity,
          unit,
          minThreshold,
          costPerUnit,
          isValid,
          validationError,
        };
      });

      setParsedRows(rows);
    } catch (err: any) {
      console.error('Error al procesar archivo:', err);
      setErrorMsg(err.message || 'Error al leer el archivo. Asegúrate de que sea un formato válido (.xlsx, .xls o .csv).');
      setParsedRows([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadTemplate = (format: 'xlsx' | 'csv') => {
    const templateData = [
      {
        'Nombre Insumo': 'Harina 0000 Especial',
        'Categoría': 'Almacén & Secos',
        'Cantidad': 50,
        'Unidad': 'kg',
        'Umbral Mínimo': 15,
        'Costo Unitario ($)': 1200,
      },
      {
        'Nombre Insumo': 'Queso Mozzarella Barra',
        'Categoría': 'Lácteos',
        'Cantidad': 25,
        'Unidad': 'kg',
        'Umbral Mínimo': 8,
        'Costo Unitario ($)': 9500,
      },
      {
        'Nombre Insumo': 'Tomate Perita Redondo',
        'Categoría': 'Verduras & Frescos',
        'Cantidad': 30,
        'Unidad': 'kg',
        'Umbral Mínimo': 10,
        'Costo Unitario ($)': 2100,
      },
      {
        'Nombre Insumo': 'Cerveza IPA Artesanal 500ml',
        'Categoría': 'Bebidas & Licores',
        'Cantidad': 48,
        'Unidad': 'botellas',
        'Umbral Mínimo': 12,
        'Costo Unitario ($)': 3400,
      },
      {
        'Nombre Insumo': 'Bife de Chorizo Premium',
        'Categoría': 'Carnes & Pescados',
        'Cantidad': 18.5,
        'Unidad': 'kg',
        'Umbral Mínimo': 6,
        'Costo Unitario ($)': 16000,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock');

    const fileName = `plantilla_stock_gastrosuite.${format}`;
    XLSX.writeFile(workbook, fileName, { bookType: format });
  };

  const handleConfirmImport = () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) return;

    const itemsToImport = validRows.map((r) => ({
      name: r.name,
      category: r.category,
      quantity: r.quantity,
      unit: r.unit,
      minThreshold: r.minThreshold,
      costPerUnit: r.costPerUnit,
    }));

    onImport(itemsToImport);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/70 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-neutral-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900">
                Importar Mercadería desde Excel o CSV
              </h2>
              <p className="text-[11px] text-neutral-500">
                Carga masiva de inventario para cocina, barra y almacén.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* File Upload / Drag Zone */}
          {!file ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileProcess(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                isDragging
                  ? 'border-amber-500 bg-amber-50/50'
                  : 'border-neutral-300 hover:border-amber-400 hover:bg-neutral-50/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileProcess(e.target.files[0]);
                  }
                }}
              />
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-800">
                  Arrastra tu archivo aquí o haz clic para explorar
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Formatos compatibles: Microsoft Excel (.xlsx, .xls) o valores separados por comas (.csv)
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-900">{file.name}</p>
                  <p className="text-[11px] text-neutral-500">
                    {(file.size / 1024).toFixed(1)} KB · {parsedRows.length} filas detectadas
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                title="Quitar archivo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Download Templates Banner */}
          <div className="bg-amber-50/60 rounded-xl border border-amber-200/80 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <HelpCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-950 block">
                  ¿No tienes el formato adecuado?
                </span>
                <span className="text-[11px] text-amber-900/80">
                  Descarga una plantilla de ejemplo lista para completar con tus insumos.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleDownloadTemplate('xlsx')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-950 bg-white border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors shadow-2xs"
              >
                <Download className="w-3 h-3 text-amber-700" />
                <span>Plantilla Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownloadTemplate('csv')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-950 bg-white border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors shadow-2xs"
              >
                <Download className="w-3 h-3 text-amber-700" />
                <span>Plantilla CSV (.csv)</span>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Parsed Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-800">
                  Vista Previa de Importación ({validCount} válidos
                  {invalidCount > 0 && `, ${invalidCount} con errores`})
                </span>
                <span className="text-[11px] text-neutral-500 font-mono">
                  {existingCount} insumos actuales en inventario
                </span>
              </div>

              <div className="border border-neutral-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 text-[11px] sticky top-0">
                    <tr>
                      <th className="py-2 px-3 font-medium">Insumo</th>
                      <th className="py-2 px-3 font-medium">Categoría</th>
                      <th className="py-2 px-3 font-medium text-right">Cantidad</th>
                      <th className="py-2 px-3 font-medium text-right">Umbral Mín.</th>
                      <th className="py-2 px-3 font-medium text-right">Costo Unit.</th>
                      <th className="py-2 px-3 font-medium text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {parsedRows.map((row, idx) => (
                      <tr
                        key={idx}
                        className={row.isValid ? 'hover:bg-neutral-50' : 'bg-red-50/50 text-red-900'}
                      >
                        <td className="py-2 px-3 font-medium truncate max-w-[160px]">
                          {row.name}
                        </td>
                        <td className="py-2 px-3 text-neutral-500 truncate max-w-[120px]">
                          {row.category}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {row.quantity} {row.unit}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-neutral-400 tabular-nums">
                          {row.minThreshold} {row.unit}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-neutral-600 tabular-nums">
                          ${row.costPerUnit.toLocaleString('es-AR')}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {row.isValid ? (
                            <span className="inline-flex items-center text-emerald-600 text-[11px] font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center text-red-600 text-[10px]"
                              title={row.validationError}
                            >
                              <AlertCircle className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 rounded-lg transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={validCount === 0 || isProcessing}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Confirmar Importación ({validCount} insumos)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
