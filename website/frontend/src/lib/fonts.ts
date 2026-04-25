import { JetBrains_Mono, IBM_Plex_Sans } from "next/font/google"

/* JetBrains Mono - 用于品牌标题和代码展示 */
export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  weight: ["400", "500", "600", "700"],
})

/* IBM Plex Sans - 用于正文内容 */
export const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"],
})
