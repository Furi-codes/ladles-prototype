import styles from "./SoupLoader.module.css";

export default function SoupLoader({ size = 210, label = "Loading" }: { size?: number; label?: string }) {
  return <span className={styles.loader} style={{ width: size }} role="status">
    <svg viewBox="0 0 200 200" fill="none" aria-hidden="true" focusable="false">
      <path d="M40 119C25 114 22 133 39 135M160 119C175 114 178 133 161 135" stroke="#A9AAA7" strokeWidth="5" strokeLinecap="round" />
      <path d="M38 115C38 99 162 99 162 115L157 151C154 177 46 177 43 151Z" fill="#202321" stroke="#A9AAA7" strokeWidth="3.5" />
      <ellipse cx="100" cy="115" rx="62" ry="17" fill="#650A15" stroke="#A9AAA7" strokeWidth="3.5" />
      <ellipse cx="100" cy="116" rx="55" ry="12" fill="#E60024" />
      <g className={styles.ripples} stroke="#FF8790" strokeWidth="1.8" strokeLinecap="round"><path d="M57 118C63 123 75 125 85 124" /><path d="M119 108C132 109 141 112 143 116" /></g>
      <g className={styles.stir}><g className={styles.tilt} transform="translate(10 4) rotate(-4 100 105)"><path d="M104 112C98 99 96 78 101 52C104 35 111 22 120 22C129 22 132 32 128 41C125 48 122 55 127 58" stroke="#D1D1CE" strokeWidth="5" strokeLinecap="round" /><path d="M105 103C86 93 73 90 66 96C59 103 71 111 98 114C116 116 128 112 132 106C126 100 116 99 105 103Z" fill="#ED1524" stroke="#050505" strokeWidth="5" strokeLinejoin="round" /><path d="M69 104C84 112 111 116 130 106M73 110C86 119 111 122 127 112M79 115L91 122L105 116L117 123" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></g></g>
      <path d="M38 116C41 138 159 138 162 116L157 151C154 177 46 177 43 151L38 116Z" fill="#202321" /><path d="M38 116C41 138 159 138 162 116M38 116L43 151C46 177 154 177 157 151L162 116" stroke="#A9AAA7" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M56 142L58 151C60 156 66 158 73 159" stroke="#626761" strokeWidth="3" strokeLinecap="round" /><g stroke="#A9AAA7" strokeWidth="2.7" strokeLinecap="round"><path className={styles.steamOne} d="M127 87C115 79 139 72 128 62" /><path className={styles.steamTwo} d="M147 96C136 88 157 81 148 72" /></g>
    </svg>
    <span className={styles.srOnly}>{label}</span>
  </span>;
}
