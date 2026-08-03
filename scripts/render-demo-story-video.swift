import AVFoundation
import CoreImage
import Foundation

guard CommandLine.arguments.count == 3 else {
  fputs("Usage: swift render-demo-story-video.swift input.png output.mp4\n", stderr)
  exit(2)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
let width = 720
let height = 1280
let framesPerSecond: Int32 = 24
let durationSeconds = 5

guard let sourceImage = CIImage(contentsOf: inputURL) else {
  fputs("Could not read input image.\n", stderr)
  exit(3)
}

try? FileManager.default.removeItem(at: outputURL)
let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)
let settings: [String: Any] = [
  AVVideoCodecKey: AVVideoCodecType.h264,
  AVVideoWidthKey: width,
  AVVideoHeightKey: height,
  AVVideoCompressionPropertiesKey: [
    AVVideoAverageBitRateKey: 800_000,
    AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
  ],
]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
input.expectsMediaDataInRealTime = false
let attributes: [String: Any] = [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
  kCVPixelBufferWidthKey as String: width,
  kCVPixelBufferHeightKey as String: height,
]
let adaptor = AVAssetWriterInputPixelBufferAdaptor(
  assetWriterInput: input,
  sourcePixelBufferAttributes: attributes
)
guard writer.canAdd(input) else {
  fputs("Could not add video writer input.\n", stderr)
  exit(4)
}
writer.add(input)
guard writer.startWriting() else {
  fputs("Could not start video writer.\n", stderr)
  exit(5)
}
writer.startSession(atSourceTime: .zero)

let context = CIContext(options: [.cacheIntermediates: false])
let outputRect = CGRect(x: 0, y: 0, width: width, height: height)
let sourceExtent = sourceImage.extent
let baseScale = max(
  CGFloat(width) / sourceExtent.width,
  CGFloat(height) / sourceExtent.height
)
let totalFrames = durationSeconds * Int(framesPerSecond)

for frame in 0..<totalFrames {
  while !input.isReadyForMoreMediaData {
    Thread.sleep(forTimeInterval: 0.002)
  }
  guard let pool = adaptor.pixelBufferPool else {
    fputs("Pixel buffer pool unavailable.\n", stderr)
    exit(6)
  }
  var optionalBuffer: CVPixelBuffer?
  CVPixelBufferPoolCreatePixelBuffer(nil, pool, &optionalBuffer)
  guard let pixelBuffer = optionalBuffer else {
    fputs("Could not allocate pixel buffer.\n", stderr)
    exit(7)
  }

  let progress = CGFloat(frame) / CGFloat(max(1, totalFrames - 1))
  let scale = baseScale * (1 + progress * 0.035)
  let scaled = sourceImage.transformed(
    by: CGAffineTransform(scaleX: scale, y: scale)
  )
  let x = (scaled.extent.width - CGFloat(width)) / 2
  let y = (scaled.extent.height - CGFloat(height)) / 2
  let framed = scaled
    .cropped(
      to: CGRect(
        x: x,
        y: y,
        width: CGFloat(width),
        height: CGFloat(height)
      )
    )
    .transformed(by: CGAffineTransform(translationX: -x, y: -y))
  context.render(
    framed,
    to: pixelBuffer,
    bounds: outputRect,
    colorSpace: CGColorSpaceCreateDeviceRGB()
  )
  let time = CMTime(value: CMTimeValue(frame), timescale: framesPerSecond)
  guard adaptor.append(pixelBuffer, withPresentationTime: time) else {
    fputs("Could not append video frame.\n", stderr)
    exit(8)
  }
}

input.markAsFinished()
let semaphore = DispatchSemaphore(value: 0)
writer.finishWriting { semaphore.signal() }
semaphore.wait()
guard writer.status == .completed else {
  fputs("Video writer failed: \(writer.error?.localizedDescription ?? "unknown error")\n", stderr)
  exit(9)
}

print(outputURL.path)
