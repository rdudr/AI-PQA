/**
 * Data sampling utilities for efficient chart rendering
 * Reduces number of points for large datasets while preserving trends
 */

export interface SamplingOptions {
  maxPoints?: number
  method?: 'decimation' | 'lanczos' | 'lttb'
}

/**
 * Simple decimation - every Nth point
 */
export function decimationSampling<T>(
  data: T[],
  maxPoints: number,
): T[] {
  if (data.length <= maxPoints) return data

  const stride = Math.ceil(data.length / maxPoints)
  return data.filter((_, idx) => idx % stride === 0)
}

/**
 * Largest-Triangle-Three-Buckets algorithm
 * Preserves shape better than decimation
 */
export function lttbSampling(
  data: Array<[number, number]>,
  maxPoints: number,
): Array<[number, number]> {
  if (data.length <= maxPoints) return data

  const bucketSize = (data.length - 2) / (maxPoints - 2)
  const sampled: Array<[number, number]> = [data[0]]

  for (let i = 0; i < maxPoints - 2; i++) {
    const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1
    const avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1
    const avgRangeLength = avgRangeEnd - avgRangeStart

    let avgX = 0
    let avgY = 0

    for (let j = avgRangeStart; j < avgRangeEnd && j < data.length; j++) {
      avgX += data[j][0]
      avgY += data[j][1]
    }

    avgX /= avgRangeLength
    avgY /= avgRangeLength

    const rangeStart = Math.floor(i * bucketSize) + 1
    const rangeEnd = Math.floor((i + 1) * bucketSize) + 1

    let maxArea = -1
    let maxAreaPoint = 0

    for (let j = rangeStart; j < rangeEnd && j < data.length; j++) {
      const area = Math.abs(
        (sampled[sampled.length - 1][0] - avgX) * (data[j][1] - sampled[sampled.length - 1][1]) -
        (sampled[sampled.length - 1][0] - data[j][0]) * (avgY - sampled[sampled.length - 1][1]),
      )

      if (area > maxArea) {
        maxArea = area
        maxAreaPoint = j
      }
    }

    sampled.push(data[maxAreaPoint])
  }

  sampled.push(data[data.length - 1])
  return sampled
}

/**
 * Sample numeric array with optional gap filling
 */
export function sampleNumericData(
  data: (number | null)[],
  maxPoints: number,
): (number | null)[] {
  if (data.length <= maxPoints) return data

  const stride = Math.ceil(data.length / maxPoints)
  const sampled: (number | null)[] = []

  for (let i = 0; i < data.length; i += stride) {
    sampled.push(data[i])
  }

  // Ensure last point is included
  if (sampled[sampled.length - 1] !== data[data.length - 1]) {
    sampled.push(data[data.length - 1])
  }

  return sampled
}

/**
 * Sample multiple series maintaining index alignment
 */
export function sampleMultiSeries(
  timestamps: string[],
  series: Array<(number | null | undefined)[]>,
  maxPoints: number,
): {
  timestamps: string[]
  series: Array<(number | null | undefined)[]>
} {
  if (timestamps.length <= maxPoints) {
    return { timestamps, series }
  }

  const stride = Math.ceil(timestamps.length / maxPoints)
  const sampledTs: string[] = []
  const sampledSeries: Array<(number | null | undefined)[]> = series.map(() => [])

  for (let i = 0; i < timestamps.length; i += stride) {
    sampledTs.push(timestamps[i])
    series.forEach((s, seriesIdx) => {
      sampledSeries[seriesIdx].push(s[i])
    })
  }

  // Ensure last point is included
  if (sampledTs[sampledTs.length - 1] !== timestamps[timestamps.length - 1]) {
    sampledTs.push(timestamps[timestamps.length - 1])
    series.forEach((s, seriesIdx) => {
      sampledSeries[seriesIdx].push(s[s.length - 1])
    })
  }

  return {
    timestamps: sampledTs,
    series: sampledSeries,
  }
}

/**
 * Get sampling parameters based on dataset size
 */
export function getOptimalSampling(dataSize: number): {
  shouldSample: boolean
  maxPoints: number
  method: 'decimation' | 'lttb'
} {
  if (dataSize <= 1000) {
    return { shouldSample: false, maxPoints: dataSize, method: 'decimation' }
  }

  if (dataSize <= 5000) {
    return { shouldSample: true, maxPoints: 1000, method: 'decimation' }
  }

  if (dataSize <= 50000) {
    return { shouldSample: true, maxPoints: 500, method: 'lttb' }
  }

  return { shouldSample: true, maxPoints: 250, method: 'lttb' }
}
