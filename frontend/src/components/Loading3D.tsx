import { useMemo } from 'react'
import { Zap } from 'lucide-react'
import { BlurText } from './BlurText'

const ENERGY_QUOTES = [
  { quote: "Every watt saved is a step toward a sustainable future.", importance: "Conservation" },
  { quote: "Energy efficiency is the most cost-effective energy resource we have.", importance: "Economics" },
  { quote: "Power quality ensures reliable energy for generations to come.", importance: "Reliability" },
  { quote: "Saving energy today means a better tomorrow for all.", importance: "Sustainability" },
  { quote: "Efficient power systems reduce waste and emissions significantly.", importance: "Environment" },
  { quote: "Quality power management optimizes industrial performance.", importance: "Efficiency" },
  { quote: "Small actions in energy conservation lead to big global impacts.", importance: "Collective Impact" },
  { quote: "Power quality monitoring prevents costly equipment failures.", importance: "Prevention" },
  { quote: "Renewable energy and efficiency are the backbone of progress.", importance: "Innovation" },
  { quote: "Every kilowatt-hour saved reduces our carbon footprint.", importance: "Climate Action" },
  { quote: "Smart energy management is the key to industrial success.", importance: "Business" },
  { quote: "Power quality is not a luxury, it's a necessity.", importance: "Critical Infrastructure" },
  { quote: "Energy conservation starts with awareness and commitment.", importance: "Responsibility" },
  { quote: "Efficient systems save money while protecting the planet.", importance: "Value" },
  { quote: "Quality power delivery is the foundation of modern society.", importance: "Society" },
  { quote: "Monitoring and optimizing power use creates real value.", importance: "ROI" },
  { quote: "Energy independence through efficiency and renewables.", importance: "Independence" },
  { quote: "Better power quality means fewer outages and downtime.", importance: "Uptime" },
  { quote: "Sustainable energy practices shape our collective future.", importance: "Legacy" },
  { quote: "Efficient power systems support economic growth responsibly.", importance: "Growth" },
  { quote: "Real-time monitoring transforms energy management.", importance: "Technology" },
  { quote: "Power quality improvements reduce operational costs instantly.", importance: "Cost Savings" },
  { quote: "Energy efficiency empowers industries and nations.", importance: "Empowerment" },
  { quote: "Clean power, clean future—efficiency makes the difference.", importance: "Vision" },
  { quote: "Optimizing power consumption is optimizing our future.", importance: "Optimization" },
  { quote: "Every improvement in power quality strengthens the grid.", importance: "Infrastructure" },
]

interface Loading3DProps {
  message?: string
  fullScreen?: boolean
  progress?: number
  progressLabel?: string
}

export function Loading3D({
  message = 'Processing...',
  fullScreen = false,
  progress,
  progressLabel = 'Progress',
}: Loading3DProps) {
  const randomQuote = useMemo(() => {
    const index = Math.floor(Math.random() * ENERGY_QUOTES.length)
    return ENERGY_QUOTES[index]
  }, [])

  const hasExactProgress = typeof progress === 'number' && Number.isFinite(progress)
  const progressValue = hasExactProgress ? Math.max(0, Math.min(100, Math.round(progress))) : 42

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-white via-[#f4f6ff] to-white backdrop-blur-sm z-50">
        <div className="flex flex-col items-center gap-8 max-w-2xl px-6">
          {/* Animated Loader */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-24 h-24">
              {/* Outer rotating ring */}
              <div
                className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#10375c] border-r-[#1a5a94]"
                style={{
                  animation: 'spin 2s linear infinite',
                }}
              />
              {/* Middle rotating ring */}
              <div
                className="absolute inset-2 rounded-full border-4 border-transparent border-b-[#2d7db5] border-l-[#10375c]"
                style={{
                  animation: 'spin 3s linear infinite reverse',
                }}
              />
              {/* Center icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Zap className="w-8 h-8 text-[#10375c]" />
              </div>
            </div>
            <p className="text-sm font-semibold text-[#10375c]">{message}</p>
            <div className="w-full max-w-md space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#10375c]/70">
                <span>{progressLabel}</span>
                <span>{hasExactProgress ? `${progressValue}%` : 'Working…'}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#10375c]/10 shadow-inner">
                <div
                  className={`h-full rounded-full ${hasExactProgress ? 'bg-gradient-to-r from-[#10375c] to-[#f3c623]' : 'bg-gradient-to-r from-[#10375c]/70 via-[#2d7db5] to-[#f3c623]'}`}
                  style={hasExactProgress ? { width: `${progressValue}%` } : { width: '40%', animation: 'loadingBar 1.8s ease-in-out infinite' }}
                />
              </div>
            </div>
          </div>

          {/* Energy Quote Section */}
          <div className="w-full bg-gradient-to-r from-[#10375c]/5 to-[#2d7db5]/5 rounded-2xl border border-[#10375c]/10 p-6 space-y-3">
            <div className="flex items-start gap-3">
              <div className="text-[#10375c]/40 mt-0.5 flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M3 5a2 2 0 012-2h3.28a1 1 0 00.948-.684l1.498-4.493a1 1 0 011.502-1.498l2.8 2.8a1 1 0 00.707.293H17a2 2 0 012 2v3.28a1 1 0 00.684.948l4.493 1.498a1 1 0 001.498-1.502l-2.8-2.8a1 1 0 00-.293-.707V5z" />
                </svg>
              </div>
              <div className="flex-1">
                <BlurText
                  text={randomQuote.quote}
                  delay={150}
                  animateBy="words"
                  direction="top"
                  stepDuration={0.6}
                  className="text-sm italic text-[#10375c]/80 leading-relaxed"
                />
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12 px-6">
      {/* Animated Loader */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative w-20 h-20">
          {/* Outer rotating ring */}
          <div
            className="absolute inset-0 rounded-full border-3 border-transparent border-t-[#10375c] border-r-[#1a5a94]"
            style={{
              animation: 'spin 2s linear infinite',
            }}
          />
          {/* Middle rotating ring */}
          <div
            className="absolute inset-2 rounded-full border-3 border-transparent border-b-[#2d7db5] border-l-[#10375c]"
            style={{
              animation: 'spin 3s linear infinite reverse',
            }}
          />
          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap className="w-6 h-6 text-[#10375c]" />
          </div>
        </div>
        <p className="text-xs font-semibold text-[#10375c]">{message}</p>
        <div className="w-full max-w-sm space-y-2">
          <div className="flex items-center justify-between text-[10px] font-semibold text-[#10375c]/65">
            <span>{progressLabel}</span>
            <span>{hasExactProgress ? `${progressValue}%` : 'Working…'}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#10375c]/10 shadow-inner">
            <div
              className={`h-full rounded-full ${hasExactProgress ? 'bg-gradient-to-r from-[#10375c] to-[#f3c623]' : 'bg-gradient-to-r from-[#10375c]/70 via-[#2d7db5] to-[#f3c623]'}`}
              style={hasExactProgress ? { width: `${progressValue}%` } : { width: '40%', animation: 'loadingBar 1.8s ease-in-out infinite' }}
            />
          </div>
        </div>
      </div>

      {/* Energy Quote Section */}
      <div className="w-full max-w-md bg-gradient-to-r from-[#10375c]/5 to-[#2d7db5]/5 rounded-xl border border-[#10375c]/10 p-4">
        <BlurText
          text={randomQuote.quote}
          delay={150}
          animateBy="words"
          direction="top"
          stepDuration={0.6}
          className="text-xs italic text-[#10375c]/70 leading-relaxed"
        />
      </div>

      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes loadingBar {
          0% {
            transform: translateX(-110%);
          }
          50% {
            transform: translateX(20%);
          }
          100% {
            transform: translateX(110%);
          }
        }
      `}</style>
    </div>
  )
}
