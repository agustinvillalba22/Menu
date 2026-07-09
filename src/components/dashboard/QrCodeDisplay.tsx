import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface QrCodeDisplayProps {
  value: string // URL absoluta a codificar
  fileName: string // nombre sugerido del archivo descargado, ej. "boulette-qr.png"
}

// RF-06: tamaño fijo legible para impresión y corrección de errores media (M),
// para que el QR siga siendo escaneable con desgaste/pliegues físicos.
const QR_SIZE = 240
const QR_OPTIONS: QRCode.QRCodeToDataURLOptions = {
  width: QR_SIZE,
  errorCorrectionLevel: 'M',
}

export default function QrCodeDisplay({
  value,
  fileName,
}: QrCodeDisplayProps): React.JSX.Element {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // RNF-01: generación 100% client-side vía la librería `qrcode`, sin red.
  useEffect(() => {
    let active = true
    setError(null)
    QRCode.toDataURL(value, QR_OPTIONS)
      .then((url) => {
        if (active) setDataUrl(url)
      })
      .catch(() => {
        if (active) setError('No se pudo generar el código QR.')
      })
    return () => {
      active = false
    }
  }, [value])

  // RF-04 / RNF-02: descarga vía <a download> sintético con el data URL; se
  // dispara su click sin navegar ni recargar la página.
  function handleDownload(): void {
    if (!dataUrl) return
    const anchor = document.createElement('a')
    anchor.href = dataUrl
    anchor.download = fileName
    anchor.click()
  }

  return (
    <div className="mt-4">
      <dt className="font-medium text-gray-500">Código QR</dt>
      <dd className="mt-2">
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : dataUrl ? (
          <div className="flex flex-col items-start gap-3">
            <img
              src={dataUrl}
              alt="Código QR del menú"
              width={QR_SIZE}
              height={QR_SIZE}
              className="rounded-md border border-gray-200"
            />
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Descargar QR
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-600">Generando código QR…</p>
        )}
      </dd>
    </div>
  )
}
