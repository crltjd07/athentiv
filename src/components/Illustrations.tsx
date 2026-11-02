// Inline SVG illustrations in the reference's flat blue style.

export function DeskIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 120" className={className} aria-hidden>
      <rect x="20" y="96" width="200" height="6" rx="3" fill="#5B7FF2" />
      <rect x="40" y="102" width="6" height="16" fill="#3E63D9" />
      <rect x="194" y="102" width="6" height="16" fill="#3E63D9" />
      {/* plant */}
      <path d="M52 96h20l-3-20H55z" fill="#8EA9FB" />
      <path d="M62 76c-8-10-14-26-6-34 4 10 8 18 6 34zM62 76c4-14 14-24 24-22-6 8-12 16-24 22zM62 76c-10-4-20-14-18-24 8 4 14 12 18 24z" fill="#BCCDFF" />
      {/* laptop */}
      <rect x="92" y="54" width="62" height="40" rx="4" fill="#DCE6FF" />
      <rect x="97" y="59" width="52" height="30" rx="2" fill="#5B7FF2" />
      <path d="M84 94h78l-6 4H90z" fill="#BCCDFF" />
      {/* books */}
      <rect x="164" y="86" width="34" height="5" rx="1.5" fill="#BCCDFF" />
      <rect x="166" y="91" width="30" height="5" rx="1.5" fill="#8EA9FB" />
      {/* lamp */}
      <path d="M182 86V50l14-14" stroke="#DCE6FF" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="m188 28 18 2-8 16z" fill="#DCE6FF" />
      <circle cx="182" cy="86" r="4" fill="#DCE6FF" />
    </svg>
  );
}

export function SleepyCat({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 140" className={className} aria-hidden>
      <ellipse cx="110" cy="118" rx="84" ry="16" fill="#BCCDFF" />
      <ellipse cx="110" cy="110" rx="80" ry="18" fill="#DCE6FF" />
      <path d="M48 100c0-28 26-46 62-46s64 18 64 46c0 8-28 12-63 12s-63-4-63-12z" fill="#fff" stroke="#8EA9FB" strokeWidth="2.5" />
      <path d="M70 66 64 46l18 12M98 58l4-18 10 18" fill="#fff" stroke="#8EA9FB" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M72 78q6 5 12 0M94 78q6 5 12 0" stroke="#2F5BEA" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M86 88q3 3 6 0" stroke="#2F5BEA" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M150 104c18 2 28-6 24-16" stroke="#8EA9FB" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <text x="128" y="44" fill="#2F5BEA" fontSize="16" fontWeight="700" fontFamily="system-ui">z</text>
      <text x="142" y="30" fill="#2F5BEA" fontSize="20" fontWeight="700" fontFamily="system-ui">z</text>
      <text x="160" y="14" fill="#2F5BEA" fontSize="24" fontWeight="700" fontFamily="system-ui">Z</text>
      <path d="M190 112v-26M190 92c-8-4-12-12-8-18 6 4 8 10 8 18zM190 98c6-6 14-8 18-4-4 6-10 6-18 4z" stroke="#5B7FF2" strokeWidth="2" fill="#BCCDFF" />
    </svg>
  );
}

export function PhoneOnStand({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <circle cx="100" cy="96" r="78" fill="#EEF3FF" />
      <circle cx="100" cy="96" r="60" fill="none" stroke="#BCCDFF" strokeWidth="3" strokeDasharray="6 8" className="origin-center" />
      <rect x="72" y="36" width="56" height="104" rx="12" fill="#1539B0" />
      <rect x="77" y="44" width="46" height="88" rx="7" fill="#fff" />
      <circle cx="100" cy="82" r="16" fill="none" stroke="#2F5BEA" strokeWidth="4" strokeDasharray="70 30" strokeLinecap="round" transform="rotate(-90 100 82)" />
      <rect x="88" y="108" width="24" height="5" rx="2.5" fill="#BCCDFF" />
      <path d="M58 168h84" stroke="#0F2E8F" strokeWidth="8" strokeLinecap="round" />
      <path d="M84 140 76 168M116 140l8 28" stroke="#0F2E8F" strokeWidth="7" strokeLinecap="round" />
      <path d="M150 64c8 8 8 24 0 32M160 56c13 13 13 35 0 48" stroke="#2F5BEA" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function SmartphoneOnly({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 180" className={className} aria-hidden>
      <rect x="10" y="30" width="120" height="80" rx="8" fill="#E4E9F2" />
      <rect x="18" y="38" width="104" height="62" rx="4" fill="#fff" />
      <path d="M0 116h140l-8 8H8z" fill="#CBD5E1" />
      <path d="M40 54l60 34M100 54 40 88" stroke="#F87171" strokeWidth="6" strokeLinecap="round" />
      <rect x="150" y="18" width="70" height="140" rx="14" fill="#1539B0" />
      <rect x="156" y="28" width="58" height="120" rx="9" fill="#fff" />
      <circle cx="185" cy="78" r="18" fill="#DCFCE7" />
      <path d="m176 78 7 7 12-14" stroke="#16A34A" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
