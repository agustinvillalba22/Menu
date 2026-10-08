import React, { useState, useEffect } from 'react';
import { X, Printer, Download, Sparkles, ExternalLink } from 'lucide-react';
import { RestaurantProfileData } from '../types';
import { generateQRDataURL, generateQRSVG } from '../utils/qr';

interface QRPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurant: RestaurantProfileData;
  publicMenuUrl: string;
}

export const QRPrintModal: React.FC<QRPrintModalProps> = ({
  isOpen,
  onClose,
  restaurant,
  publicMenuUrl,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrSvg, setQrSvg] = useState<string>('');

  const targetUrl = restaurant.publicMenuUrl || publicMenuUrl;

  useEffect(() => {
    if (isOpen) {
      generateQRDataURL(targetUrl).then(setQrDataUrl);
      generateQRSVG(targetUrl).then(setQrSvg);
    }
  }, [isOpen, targetUrl]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadSVG = () => {
    const element = document.createElement('a');
    const file = new Blob([qrSvg], { type: 'image/svg+xml' });
    element.href = URL.createObjectURL(file);
    element.download = `QR-Menu-${restaurant.slug}.svg`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-neutral-200 w-full max-w-lg overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">
              Exportar QR de Mesa
            </h3>
            <p className="text-xs text-neutral-500">
              Listo para imprimir y colocar en el salón o exportar en PDF/SVG
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Card Preview */}
        <div className="p-6 bg-neutral-100/70 flex justify-center">
          <div
            id="printable-table-card"
            className="w-72 bg-white rounded-lg p-6 shadow-sm border border-neutral-200 text-center flex flex-col items-center"
          >
            {restaurant.logoUrl ? (
              <img
                src={restaurant.logoUrl}
                alt={restaurant.name}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-full object-cover border border-neutral-200 mb-3 shadow-xs"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-neutral-900 text-neutral-100 flex items-center justify-center font-bold text-lg mb-3">
                {restaurant.name.charAt(0)}
              </div>
            )}

            <h4 className="font-semibold text-neutral-900 text-base leading-tight">
              {restaurant.name}
            </h4>
            <p className="text-[11px] text-neutral-500 mt-1 mb-4">
              Menú Digital & Carta de Vinos
            </p>

            {/* Crisp QR Code Vector / Image */}
            <div className="p-3 bg-white border border-neutral-200 rounded-lg shadow-xs mb-3 flex items-center justify-center min-h-[180px] w-48">
              {qrDataUrl ? (
                <img
                  id="printable-qr-image"
                  src={qrDataUrl}
                  alt={`QR Menú ${restaurant.name}`}
                  className="w-44 h-44 object-contain"
                />
              ) : (
                <div className="w-44 h-44 flex items-center justify-center text-xs text-neutral-400">
                  Generando código QR...
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-neutral-600 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Escanea para ver la carta y ordenar en vivo</span>
            </div>
            <p className="text-[10px] text-neutral-500 mt-1 font-mono truncate max-w-[240px]" title={targetUrl}>
              aistudio.google.com/apps/31ff0dd1...
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-neutral-100 flex items-center justify-between bg-neutral-50">
          <span className="text-xs text-neutral-500 font-mono">
            Formato: 10x15cm (Estándar de mesa)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadSVG}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar SVG / QR</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-neutral-900 rounded-md hover:bg-neutral-800"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / Guardar PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
