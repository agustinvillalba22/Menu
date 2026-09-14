import React from 'react'
import { motion } from 'motion/react'
import type { PublicPromo } from '../../lib/types'

interface PublicPromoBannerProps {
  promo: PublicPromo
  /** Opens the linked item's detail modal; undefined when no item is linked. */
  onOpenItem?: () => void
}

/**
 * Active-promo banner for the public menu (P4, Fase 2c).
 *
 * Adapted from the demo `components/PromoBanner.tsx` design (fixed
 * yellow/black, shine hover, "HOY" live tag) but fully props-driven: every
 * string comes from the server-resolved promo, nothing is hardcoded. The
 * big text is `XX% OFF` when a discount is set, the promo title otherwise.
 * Without an image the yellow side takes the full width.
 */
export default function PublicPromoBanner({
  promo,
  onOpenItem,
}: PublicPromoBannerProps): React.JSX.Element {
  const headline =
    promo.discount_pct !== null && promo.discount_pct > 0
      ? `${promo.discount_pct}% OFF`
      : promo.title

  const clickable = onOpenItem !== undefined

  return (
    <div className="px-4 pt-4 lg:px-10">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={clickable ? { y: -3, scale: 1.01 } : undefined}
        whileTap={clickable ? { scale: 0.99 } : undefined}
        transition={{ type: 'spring', stiffness: 350, damping: 20 }}
        onClick={clickable ? onOpenItem : undefined}
        role={clickable ? 'button' : undefined}
        aria-label={clickable ? `Ver ${promo.title}` : undefined}
        data-testid="promo-banner"
        className={
          'group relative flex w-full h-[125px] sm:h-[135px] rounded-[22px] overflow-hidden bg-[#FED130] shadow-md transition-shadow duration-300 border border-[#FED130]/20 select-none' +
          (clickable ? ' cursor-pointer hover:shadow-lg' : '')
        }
      >
        {/* Shine highlight that flows across on hover */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10 rounded-[22px]">
          <div className="absolute top-0 -inset-full h-full w-1/2 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white/20 opacity-0 group-hover:animate-shine" />
        </div>

        {/* Left side: solid yellow with the promo copy */}
        <div
          className={
            'flex flex-col justify-center pl-6 pr-3 py-3 text-black z-10 ' +
            (promo.image_url ? 'w-[45%] sm:w-[50%]' : 'w-full')
          }
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            transition={{
              repeat: Infinity,
              repeatType: 'reverse',
              duration: 1.5,
              ease: 'easeInOut',
            }}
            className="font-sans font-black text-[28px] sm:text-[34px] leading-none tracking-tighter text-[#000000] select-none line-clamp-1"
          >
            {headline}
          </motion.div>
          {promo.subtitle && (
            <div className="font-sans font-bold text-[12px] sm:text-[14px] leading-tight text-[#000000] mt-1 line-clamp-1">
              {promo.subtitle}
            </div>
          )}
          {promo.description && (
            <div className="font-sans text-[10px] sm:text-[11px] leading-snug text-black/80 mt-1 line-clamp-2 max-w-[95%]">
              {promo.description}
            </div>
          )}
        </div>

        {/* Right side: image (only when the promo has one) */}
        {promo.image_url && (
          <div className="w-[55%] sm:w-[50%] relative overflow-hidden h-full bg-stone-900">
            <img
              src={promo.image_url}
              alt={promo.title}
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-106 transition-transform duration-700 ease-out"
            />
            <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#FED130] to-transparent pointer-events-none" />
            <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-black/75 text-white backdrop-blur-xs shadow-xs">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
              </span>
              HOY
            </span>
          </div>
        )}
      </motion.div>
    </div>
  )
}
