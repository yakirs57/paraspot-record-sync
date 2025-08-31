import Foundation

@objc public class BackgroundUploader: NSObject {
    @objc public func echo(_ value: String) -> String {
        print(value)
        return value
    }
}
