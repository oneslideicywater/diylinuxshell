import { HeroSection } from "@/components/home/HeroSection"
import { FeatureCards } from "@/components/home/FeatureCards"
import { TechStack } from "@/components/home/TechStack"
import { CTASection } from "@/components/home/CTASection"

/* 首页 - 组装所有核心区域 */
export default function HomePage() {
  return (
    <>
      <HeroSection />
      <FeatureCards />
      <TechStack />
      <CTASection />
    </>
  )
}
