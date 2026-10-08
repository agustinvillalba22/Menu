import React, { useState } from 'react';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  RefreshCw,
  QrCode,
  FileText,
  DollarSign
} from 'lucide-react';
import { PaymentConfig, Transaction } from '../../types';

interface PaymentGatewayProps {
  config: PaymentConfig;
  transactions: Transaction[];
  onUpdateConfig: (cfg: Partial<PaymentConfig>) => void;
  onRecordTransaction: (tx: Transaction) => void;
}

export const PaymentGateway: React.FC<PaymentGatewayProps> = ({
  config,
  transactions,
  onUpdateConfig,
  onRecordTransaction,
}) => {
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testAmount, setTestAmount] = useState<number>(18500);
  const [testMethod, setTestMethod] = useState<Transaction['method']>('Tarjeta Crédito/Débito');
  const [isProcessing, setIsProcessing] = useState(false);
  const [testResult, setTestResult] = useState<'success' | null>(null);

  const handleRunTestPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setTimeout(() => {
      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        orderCode: `#TST-${Math.floor(100 + Math.random() * 900)}`,
        channel: 'mesa',
        amount: Number(testAmount),
        method: testMethod,
        status: 'completado',
        timestamp: 'Recién, 20:49 hs',
      };
      onRecordTransaction(newTx);
      setIsProcessing(false);
      setTestResult('success');
      setTimeout(() => {
        setTestResult(null);
        setTestModalOpen(false);
      }, 1800);
    }, 1200);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-neutral-200">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 tracking-tight">
            Pasarela de Pagos & Cobro Seguro
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Configura la pasarela en línea (Mercado Pago / Stripe / POS) para cobro en mesa y delivery con cifrado SSL.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setTestModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-xs"
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Simular Cobro de Prueba</span>
        </button>
      </div>

      {/* Gateway Configuration & Credentials Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Settings Box (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-neutral-200 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
                Configuración del Proveedor
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
              <CheckCircle2 className="w-3 h-3" />
              <span>Conexión Verificada</span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                Plataforma de Procesamiento Principal
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'mercadopago', name: 'Mercado Pago' },
                  { id: 'stripe', name: 'Stripe Global' },
                  { id: 'pos_terminal', name: 'Terminal Smart 4G' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      onUpdateConfig({ provider: p.id as PaymentConfig['provider'] })
                    }
                    className={`py-2 px-3 text-xs rounded-lg border font-medium transition-all ${
                      config.provider === p.id
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Ambiente de Operación
                </label>
                <div className="flex rounded-lg border border-neutral-200 p-0.5 bg-neutral-50">
                  <button
                    type="button"
                    onClick={() => onUpdateConfig({ mode: 'test' })}
                    className={`flex-1 py-1 text-xs rounded-md transition-colors ${
                      config.mode === 'test'
                        ? 'bg-white shadow-xs text-neutral-900 font-medium'
                        : 'text-neutral-500'
                    }`}
                  >
                    Modo Sandbox (Test)
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateConfig({ mode: 'live' })}
                    className={`flex-1 py-1 text-xs rounded-md transition-colors ${
                      config.mode === 'live'
                        ? 'bg-neutral-900 shadow-xs text-white font-medium'
                        : 'text-neutral-500'
                    }`}
                  >
                    Producción (Live)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Terminal POS Vinculada
                </label>
                <input
                  type="text"
                  value={config.terminalModel}
                  readOnly
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-100/70 text-neutral-600 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1 flex items-center justify-between">
                <span>Access Token / API Secret Key</span>
                <span className="text-[10px] text-neutral-400 font-mono">Cifrado AES-256</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={config.apiKeyMasked}
                  readOnly
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-100/70 text-neutral-700 font-mono"
                />
                <Lock className="w-3.5 h-3.5 absolute right-3 top-2.5 text-neutral-400" />
              </div>
            </div>
          </div>

          <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200/80 text-[11px] text-neutral-600 space-y-1">
            <p className="font-semibold text-neutral-800">
              Cumplimiento PCI-DSS Nivel 1 & Tokenización Automática
            </p>
            <p>
              Los datos sensibles de tarjeta son procesados directamente por la pasarela bancaria oficial. El restaurante no almacena números de tarjeta.
            </p>
          </div>
        </div>

        {/* Payment Methods Supported (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-neutral-200 space-y-4">
          <h3 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
            Canales Habilitados en Mesa
          </h3>

          <div className="space-y-2.5 pt-1">
            <div className="p-3 rounded-lg border border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-neutral-900">
                    QR Interoperable / Transferencias
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    Cobro instantáneo desde cualquier billetera virtual
                  </p>
                </div>
              </div>
              <span className="text-[10px] text-emerald-600 font-semibold font-mono">ACTIVO</span>
            </div>

            <div className="p-3 rounded-lg border border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-neutral-900">
                    Tarjetas de Crédito / Débito (Contactless)
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    Visa, Mastercard, American Express, Apple Pay
                  </p>
                </div>
              </div>
              <span className="text-[10px] text-emerald-600 font-semibold font-mono">ACTIVO</span>
            </div>

            <div className="p-3 rounded-lg border border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-neutral-900">
                    Efectivo con Rendición de Caja
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    Asignación y cierre por turno de mozo
                  </p>
                </div>
              </div>
              <span className="text-[10px] text-emerald-600 font-semibold font-mono">ACTIVO</span>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Log */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
            Últimas Transacciones Registradas
          </h3>
          <span className="text-[11px] text-neutral-400 font-mono">
            Registro en tiempo real
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50/70 border-b border-neutral-200 text-neutral-500 text-[11px]">
              <tr>
                <th className="py-2.5 px-4 font-medium">ID Transacción</th>
                <th className="py-2.5 px-4 font-medium">Comanda</th>
                <th className="py-2.5 px-4 font-medium">Canal</th>
                <th className="py-2.5 px-4 font-medium">Método</th>
                <th className="py-2.5 px-4 font-medium text-right">Monto</th>
                <th className="py-2.5 px-4 font-medium text-center">Estado</th>
                <th className="py-2.5 px-4 font-medium text-right">Fecha / Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-neutral-50/50">
                  <td className="py-3 px-4 font-mono text-neutral-600">
                    {tx.id}
                  </td>
                  <td className="py-3 px-4 font-semibold text-neutral-900">
                    {tx.orderCode}
                  </td>
                  <td className="py-3 px-4 text-neutral-500 capitalize">
                    {tx.channel}
                  </td>
                  <td className="py-3 px-4 text-neutral-700">
                    {tx.method}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900 tabular-nums">
                    ${tx.amount.toLocaleString('es-AR')}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      Completado
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-neutral-400 font-mono text-[11px]">
                    {tx.timestamp}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Test Payment Simulation Modal */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-neutral-200 w-full max-w-sm overflow-hidden animate-in fade-in duration-150">
            <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">
                Simulador de Pasarela Segura
              </h3>
              <button
                type="button"
                onClick={() => setTestModalOpen(false)}
                className="text-xs text-neutral-400 hover:text-neutral-600"
              >
                Cerrar
              </button>
            </div>

            {testResult === 'success' ? (
              <div className="p-8 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto animate-bounce" />
                <h4 className="font-semibold text-neutral-900 text-sm">
                  ¡Cobro Aprobado Exitosamente!
                </h4>
                <p className="text-xs text-neutral-500 font-mono">
                  Monto: ${testAmount.toLocaleString('es-AR')} · Autorización #98231
                </p>
              </div>
            ) : (
              <form onSubmit={handleRunTestPayment} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Monto de Prueba ($)
                  </label>
                  <input
                    type="number"
                    min="100"
                    required
                    value={testAmount}
                    onChange={(e) => setTestAmount(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 font-mono text-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Método a Simular
                  </label>
                  <select
                    value={testMethod}
                    onChange={(e) =>
                      setTestMethod(e.target.value as Transaction['method'])
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-800"
                  >
                    <option value="Tarjeta Crédito/Débito">Tarjeta de Crédito / Débito</option>
                    <option value="QR MercadoPago">QR Mercado Pago Dinámico</option>
                    <option value="Stripe Checkout">Stripe Checkout Directo</option>
                  </select>
                </div>

                <div className="p-3 bg-neutral-50 rounded-lg text-[11px] text-neutral-500 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-neutral-600 shrink-0" />
                  <span>Entorno de pruebas Sandbox. No se debitará dinero real.</span>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => setTestModalOpen(false)}
                    className="px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 rounded-md"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="px-4 py-1.5 text-xs font-medium text-white bg-neutral-900 rounded-md hover:bg-neutral-800 disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Procesando...</span>
                      </>
                    ) : (
                      <span>Procesar Pago</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
