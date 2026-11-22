//
//  HybridHandPose.swift — KB-1019 시연 전용. VisionCamera 5 Frame → Apple Vision 손 관절.
//  방향·좌표계 변환은 JS(handPose.ts)가 정한다. 여기서는 받은 방향으로 Vision만 돌린다.
//

import AVFoundation
import NitroModules
import Vision
import VisionCamera

final class HybridHandPose: HybridHandPoseSpec {
  private static let joints: [VNHumanHandPoseObservation.JointName] = [
    .wrist,
    .thumbCMC, .thumbMP, .thumbIP, .thumbTip,
    .indexMCP, .indexPIP, .indexDIP, .indexTip,
    .middleMCP, .middlePIP, .middleDIP, .middleTip,
    .ringMCP, .ringPIP, .ringDIP, .ringTip,
    .littleMCP, .littlePIP, .littleDIP, .littleTip,
  ]

  private let request: VNDetectHumanHandPoseRequest = {
    let r = VNDetectHumanHandPoseRequest()
    r.maximumHandCount = 2
    return r
  }()

  func detect(frame: any HybridFrameSpec, orientation: Double) throws -> [Double] {
    guard let nativeFrame = frame as? any NativeFrame else {
      throw RuntimeError.error(withMessage: "The given Frame is not of type `NativeFrame`!")
    }
    guard let sampleBuffer = nativeFrame.sampleBuffer else {
      throw RuntimeError.error(withMessage: "The given Frame's `sampleBuffer` is no longer valid!")
    }
    let o = CGImagePropertyOrientation(rawValue: UInt32(orientation)) ?? .up
    let handler = VNImageRequestHandler(cmSampleBuffer: sampleBuffer, orientation: o, options: [:])
    try handler.perform([request])
    var out: [Double] = []
    for obs in request.results ?? [] {
      for name in Self.joints {
        if let p = try? obs.recognizedPoint(name) {
          out.append(Double(p.location.x))
          out.append(Double(p.location.y))
          out.append(Double(p.confidence))
        } else {
          out.append(contentsOf: [0, 0, 0])
        }
      }
    }
    return out
  }
}
