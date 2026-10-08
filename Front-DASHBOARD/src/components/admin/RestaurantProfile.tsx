import React, { useState, useEffect } from 'react';
import {
  RestaurantProfileData,
} from '../../types';
import {
  Upload,
  Download,
  ExternalLink,
  Check,
  QrCode,
  Store,
  Phone,
  Clock,
  MapPin,
  Sparkles,
  Link2
} from 'lucide-react';
import { generateQRDataURL } from '../../utils/qr';

interface RestaurantProfileProps {
  restaurant: RestaurantProfileData;
  onUpdate: (data: Partial<RestaurantProfileData>) => void;
  onOpenQRPrint: () => void;
  onOpenCustomerPreview: () => void;
}

export const RestaurantProfile: React.FC<RestaurantProfileProps> = ({
  restaurant,
  onUpdate,
  onOpenQRPrint,
  onOpenCustomerPreview,
}) => {
  const [formData, setFormData] = useState<RestaurantProfileData>(restaurant);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [qrCodeImg, setQrCodeImg] = useState<string>('');

  useEffect(() => {
    const url = formData.publicMenuUrl || `https://aistudio.google.com/apps/${formData.publicMenuId}?showPreview=true&showAssistant=true`;
    generateQRDataURL(url).then(setQrCodeImg);
  }, [formData.publicMenuUrl, formData.publicMenuId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFormData((prev) => ({
            ...prev,
            logoUrl: event.target!.result as string,
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Title & Description Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-neutral-200">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 tracking-tight">
            Perfil del Restaurante
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Configura los datos del local, código QR del menú digital y recepción de pedidos.
          </p>
        </div>

        {savedSuccess && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-md border border-emerald-200">
            <Check className="w-3.5 h-3.5" />
            <span>Cambios guardados con éxito</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Main Grid: Form Left, QR Card Right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* General Information (2 cols) */}
          <div className="lg:col-span-2 space-y-5 bg-white p-5 rounded-xl border border-neutral-200">
            <div className="flex items-center gap-2 pb-3 border-b border-neutral-100 text-xs font-semibold text-neutral-900 uppercase tracking-wider">
              <Store className="w-4 h-4 text-neutral-500" />
              <span>Datos del Establecimiento</span>
            </div>

            {/* Logo and Name row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="relative group shrink-0">
                <img
                  src={formData.logoUrl}
                  alt={formData.name}
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 rounded-xl object-cover border border-neutral-200 bg-neutral-50 shadow-xs"
                />
                <label className="absolute inset-0 bg-black/50 text-white rounded-xl flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity text-[10px]">
                  <Upload className="w-4 h-4 mb-0.5" />
                  <span>Cambiar</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex-1 w-full space-y-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Título del Restaurant
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50/50 focus:bg-white focus:border-neutral-400 focus:outline-hidden text-neutral-900 font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Slug / URL amigable
                  </label>
                  <div className="flex items-center">
                    <span className="px-2.5 py-1.5 text-xs bg-neutral-100 border border-r-0 border-neutral-200 rounded-l-lg text-neutral-500 font-mono">
                      /menu/
                    </span>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) =>
                        setFormData({ ...formData, slug: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-xs rounded-r-lg border border-neutral-200 bg-neutral-50/50 focus:bg-white focus:border-neutral-400 focus:outline-hidden text-neutral-900 font-mono"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-amber-600" />
                      <span>Proyecto Vinculado (Menú AI Studio)</span>
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">ID: {formData.publicMenuId}</span>
                  </label>
                  <input
                    type="url"
                    value={formData.publicMenuUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, publicMenuUrl: e.target.value })
                    }
                    placeholder="https://aistudio.google.com/apps/..."
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50/50 focus:bg-white focus:border-neutral-400 focus:outline-hidden text-neutral-900 font-mono"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Descripción del local & Propuesta gastronómica
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 bg-neutral-50/50 focus:bg-white focus:border-neutral-400 focus:outline-hidden text-neutral-800 leading-relaxed"
                placeholder="Cuenta brevemente el estilo culinario, los ingredientes de temporada y la experiencia del comensal..."
              />
            </div>

            {/* Operational details: Address, Phone, Hours */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-neutral-100">
              <div>
                <label className="flex items-center gap-1 text-[11px] font-medium text-neutral-600 mb-1">
                  <MapPin className="w-3 h-3 text-neutral-400" />
                  <span>Dirección</span>
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-md border border-neutral-200 bg-neutral-50/50 text-neutral-800"
                />
              </div>

              <div>
                <label className="flex items-center gap-1 text-[11px] font-medium text-neutral-600 mb-1">
                  <Phone className="w-3 h-3 text-neutral-400" />
                  <span>Teléfono / Reservas</span>
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-md border border-neutral-200 bg-neutral-50/50 text-neutral-800"
                />
              </div>

              <div>
                <label className="flex items-center gap-1 text-[11px] font-medium text-neutral-600 mb-1">
                  <Clock className="w-3 h-3 text-neutral-400" />
                  <span>Horario de atención</span>
                </label>
                <input
                  type="text"
                  value={formData.hours}
                  onChange={(e) =>
                    setFormData({ ...formData, hours: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-md border border-neutral-200 bg-neutral-50/50 text-neutral-800"
                />
              </div>
            </div>

            {/* Order Reception Switch */}
            <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-neutral-900">
                  Recepción de pedidos
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {formData.orderReceptionEnabled
                    ? 'Los comensales pueden enviar comandas directamente desde las mesas.'
                    : 'Los pedidos están desactivados. Activalos para recibirlos en Comandas.'}
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.orderReceptionEnabled}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      orderReceptionEnabled: e.target.checked,
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-neutral-900" />
              </label>
            </div>
          </div>

          {/* Right Column: QR Code & Public Menu Link */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl border border-neutral-200 flex flex-col items-center text-center">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900 mb-3 uppercase tracking-wider">
                <QrCode className="w-4 h-4 text-neutral-500" />
                <span>Código QR del Menú</span>
              </div>

              {/* QR Code Container */}
              <div className="p-3 bg-white border border-neutral-200 rounded-xl shadow-xs mb-3 flex items-center justify-center min-h-[160px] w-44">
                {qrCodeImg ? (
                  <img
                    src={qrCodeImg}
                    alt={`QR Menú ${formData.name}`}
                    className="w-36 h-36 object-contain"
                  />
                ) : (
                  <div className="w-36 h-36 flex items-center justify-center text-[11px] text-neutral-400">
                    Generando QR...
                  </div>
                )}
              </div>

              <div className="w-full space-y-2">
                <button
                  type="button"
                  onClick={onOpenQRPrint}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar QR en PDF</span>
                </button>

                <a
                  href={formData.publicMenuUrl || `https://aistudio.google.com/apps/${formData.publicMenuId}?showPreview=true&showAssistant=true`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200/80 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Abrir Menú en Nueva Pestaña</span>
                </a>

                <button
                  type="button"
                  onClick={onOpenCustomerPreview}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  <span>Previsualizar Menú Vinculado</span>
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-100 w-full text-left">
                <p className="text-[11px] text-neutral-500">Proyecto Vinculado:</p>
                <p className="text-[10px] font-mono text-neutral-700 truncate mt-0.5" title={formData.publicMenuUrl}>
                  {formData.publicMenuUrl}
                </p>
              </div>
            </div>

            <div className="p-4 bg-amber-50/70 border border-amber-200/60 rounded-xl text-amber-900 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-amber-800 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Consejo de presentación</span>
              </div>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                Coloca los soportes acrílicos con el código QR en el centro de cada mesa. Los clientes podrán ordenar y pagar sin demoras.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Save Bar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-sm"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Guardar cambios</span>
          </button>
        </div>
      </form>
    </div>
  );
};
