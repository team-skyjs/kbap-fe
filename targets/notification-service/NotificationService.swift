import UserNotifications

// 서버 푸시의 richContent.image 를 받아 알림에 첨부한다.
// Expo 푸시 서버는 이를 userInfo["body"]["_richContent"]["image"] 로 실어 보낸다.
// 어떤 실패 경로에서도 원본 알림은 반드시 정확히 한 번 전달한다.
class NotificationService: UNNotificationServiceExtension {
  private var contentHandler: ((UNNotificationContent) -> Void)?
  private var bestAttemptContent: UNMutableNotificationContent?
  private var task: URLSessionDownloadTask?
  private let lock = NSLock()

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    self.contentHandler = contentHandler
    bestAttemptContent = request.content.mutableCopy() as? UNMutableNotificationContent

    guard
      let content = bestAttemptContent,
      let body = request.content.userInfo["body"] as? [String: Any],
      let rich = body["_richContent"] as? [String: Any],
      let image = rich["image"] as? String,
      let url = URL(string: image)
    else {
      deliver(bestAttemptContent ?? request.content)
      return
    }

    task = URLSession.shared.downloadTask(with: url) { [weak self] location, response, error in
      guard let self = self else { return }
      if error == nil,
         let status = (response as? HTTPURLResponse)?.statusCode, (200..<300).contains(status),
         let location = location {
        // 다운로드 임시 파일은 이 핸들러가 반환되면 지워지므로 여기서 옮긴다.
        let ext = url.pathExtension.isEmpty ? "jpg" : url.pathExtension
        let dest = FileManager.default.temporaryDirectory
          .appendingPathComponent(UUID().uuidString + "." + ext)
        if (try? FileManager.default.moveItem(at: location, to: dest)) != nil,
           let attachment = try? UNNotificationAttachment(identifier: "image", url: dest, options: nil) {
          content.attachments = [attachment]
        }
      }
      self.deliver(content)
    }
    task?.resume()
  }

  override func serviceExtensionTimeWillExpire() {
    task?.cancel()
    if let content = bestAttemptContent {
      deliver(content)
    }
  }

  // contentHandler 를 꺼내고 비운 뒤 호출 — 만료와 다운로드 완료가 겹쳐도 한 번만 전달된다.
  private func deliver(_ content: UNNotificationContent) {
    lock.lock()
    let handler = contentHandler
    contentHandler = nil
    lock.unlock()
    handler?(content)
  }
}
