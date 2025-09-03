import Foundation
import Capacitor
import UserNotifications

@objc(BackgroundUploaderPlugin)
public class BackgroundUploaderPlugin: CAPPlugin, CAPBridgedPlugin, URLSessionDelegate, URLSessionTaskDelegate, URLSessionDataDelegate {
    public let identifier = "BackgroundUploaderPlugin"
    public let jsName = "BackgroundUploader"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startUpload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise)
    ]

    lazy var session: URLSession = {
        let id = (Bundle.main.bundleIdentifier ?? "app") + ".bg.uploads"
        let cfg = URLSessionConfiguration.background(withIdentifier: id)
        cfg.isDiscretionary = false
        cfg.sessionSendsLaunchEvents = true
        return URLSession(configuration: cfg, delegate: self, delegateQueue: nil)
    }()

    @objc func startUpload(_ call: CAPPluginCall) {
        guard
            let fileUrlStr = call.getString("fileUrl"),
            let uploadUrlStr = call.getString("uploadUrl"),
            let target = URL(string: uploadUrlStr)
        else { call.reject("fileUrl and uploadUrl are required"); return }

        let method  = call.getString("method")  ?? "POST"
        let headers = call.getObject("headers") as? [String:String] ?? [:]
        let field   = call.getString("field")   ?? "file"

        var req = URLRequest(url: target)
        req.httpMethod = method
        headers.forEach { req.setValue($0.value, forHTTPHeaderField: $0.key) }

        if method == "PUT" {
            guard let fileURL = URL(string: fileUrlStr) else { call.reject("bad fileUrl"); return }
            let task = session.uploadTask(with: req, fromFile: fileURL)
            task.resume()
            call.resolve(["uploadId": String(task.taskIdentifier)])
            return
        }

        // multipart
        let boundary = "----CapBoundary\(UUID().uuidString)"
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        guard let fileURL = URL(string: fileUrlStr) else { call.reject("bad fileUrl"); return }
        let fileName = fileURL.lastPathComponent

        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"\(field)\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: application/octet-stream\r\n\r\n".data(using: .utf8)!)
        if let stream = InputStream(url: fileURL) {
            stream.open()
            let bufSize = 64 * 1024
            let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufSize)
            defer { buffer.deallocate() }
            while stream.hasBytesAvailable {
                let read = stream.read(buffer, maxLength: bufSize)
                if read > 0 { body.append(buffer, count: read) } else { break }
            }
            stream.close()
        }
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)

        let task = session.uploadTask(with: req, from: body)
        task.resume()
        call.resolve(["uploadId": String(task.taskIdentifier)])
    }

    @objc func cancel(_ call: CAPPluginCall) {
        guard let idStr = call.getString("uploadId"), let id = Int(idStr) else {
            call.reject("uploadId required"); return
        }
        session.getAllTasks { tasks in tasks.first { $0.taskIdentifier == id }?.cancel() }
        call.resolve()
    }

    // progress
    public func urlSession(_ session: URLSession, task: URLSessionTask,
                           didSendBodyData bytesSent: Int64,
                           totalBytesSent: Int64,
                           totalBytesExpectedToSend: Int64) {
        guard totalBytesExpectedToSend > 0 else { return }
        let pct = Int((Double(totalBytesSent) / Double(totalBytesExpectedToSend)) * 100.0)
        notifyListeners("progress", data: ["uploadId": String(task.taskIdentifier), "progress": pct])
        notifyLocal(title: "Uploading…", body: "\(pct)%")
    }

    public func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        let id = String(task.taskIdentifier)
        if let err = error {
            notifyListeners("error", data: ["uploadId": id, "message": err.localizedDescription])
            notifyLocal(title: "Upload failed", body: err.localizedDescription)
        } else {
            let status = (task.response as? HTTPURLResponse)?.statusCode ?? 200
            notifyListeners("completed", data: ["uploadId": id, "status": status])
            notifyLocal(title: "Upload complete", body: "Success")
        }
    }

    private func notifyLocal(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body  = body
        let req = UNNotificationRequest(identifier: "upload-progress", content: content, trigger: nil)
        UNUserNotificationCenter.current().add(req, withCompletionHandler: nil)
    }
}
